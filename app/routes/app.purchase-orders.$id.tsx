import { useState, useEffect, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  Button,
  TextField,
  Banner,
  Box,
  Select,
  Popover,
  ChoiceList,
  Collapsible,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import {
  getPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
} from "../models/purchase-order.server";
import type { EditItem, ColKey } from "../components/POSpreadsheet";
import { ALL_COLS, DEFAULT_VISIBLE, POSpreadsheet } from "../components/POSpreadsheet";
import type { PickedProduct } from "../components/ProductPickerButton";
import { ProductPickerButton } from "../components/ProductPickerButton";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { tone: "info" | "warning" | "success" | "critical" | undefined; label: string }> = {
  draft:              { tone: undefined,  label: "Draft"               },
  open:               { tone: "info",     label: "Open"                },
  in_transit:         { tone: "warning",  label: "In Transit"          },
  partially_received: { tone: "warning",  label: "Partially Received"  },
  received:           { tone: "success",  label: "Received"            },
  cancelled:          { tone: "critical", label: "Cancelled"           },
};

const STATUS_TRANSITIONS: Record<string, { label: string; next: string; critical?: boolean }[]> = {
  draft:              [{ label: "Send to Supplier", next: "open" }],
  open:               [{ label: "Mark In Transit",  next: "in_transit" }, { label: "Cancel", next: "cancelled", critical: true }],
  in_transit:         [],
  partially_received: [],
  received:           [],
  cancelled:          [],
};

const EDITABLE = new Set(["draft", "open"]);

const CURRENCY_OPTIONS = [
  { label: "USD", value: "USD" }, { label: "CAD", value: "CAD" },
  { label: "EUR", value: "EUR" }, { label: "GBP", value: "GBP" },
  { label: "AUD", value: "AUD" }, { label: "JPY", value: "JPY" },
  { label: "CNY", value: "CNY" },
];

// ---------------------------------------------------------------------------
// Loader & Action
// ---------------------------------------------------------------------------

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const po = await getPurchaseOrder(session.shop, params.id!);
  if (!po) throw new Response("Not Found", { status: 404 });
  return json({ po });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "save") {
    await updatePurchaseOrder(session.shop, params.id!, {
      notes:        (fd.get("notes") as string)                     || null,
      exchangeRate: parseFloat(fd.get("exchangeRate") as string)    || 1,
      freightCost:  parseFloat(fd.get("freightCost")  as string)    || 0,
      tax:          parseFloat(fd.get("tax")          as string)    || 0,
      discounts:    parseFloat(fd.get("discounts")    as string)    || 0,
      otherCosts:   parseFloat(fd.get("otherCosts")   as string)    || 0,
      adjustment:   parseFloat(fd.get("adjustment")   as string)    || 0,
      lineItems:    JSON.parse((fd.get("lineItemsJson")  as string) || "[]"),
      removedIds:   JSON.parse((fd.get("removedIdsJson") as string) || "[]"),
    });
    return json({ saved: true });
  }

  if (intent === "updateStatus") {
    await updatePurchaseOrderStatus(session.shop, params.id!, fd.get("status") as string);
    return json({ ok: true });
  }

  return json({ ok: true });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toNum = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

function calcLanded(sub: number, freight: number, tax: number, disc: number, other: number, rate: number, adj: number) {
  return (sub + freight + tax + other - disc) * (rate || 1) + adj;
}

function fmt(n: number) { return `$${n.toFixed(2)}`; }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PurchaseOrderDetail() {
  const { po }   = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher  = useFetcher<{ saved?: boolean; ok?: boolean }>();

  const canEdit     = EDITABLE.has(po.status);
  const badge       = STATUS_BADGE[po.status] ?? { tone: undefined, label: po.status };
  const transitions = STATUS_TRANSITIONS[po.status] ?? [];
  const canReceive   = ["open", "in_transit", "partially_received"].includes(po.status);
  const saving      = fetcher.state !== "idle";
  const justSaved   = fetcher.state === "idle" && (fetcher.data as any)?.saved;

  // ── Line items ─────────────────────────────────────────────────────────
  const [items, setItems] = useState<EditItem[]>(() =>
    po.lineItems.map((li) => ({
      id:          li.id,
      description: li.description  ?? "",
      supplierSku: li.supplierSku  ?? "",
      qtyOrdered:  String(li.qtyOrdered),
      unitCost:    String(li.unitCost),
      qtyReceived: li.qtyReceived,
      qtyRejected: li.qtyRejected,
      product:     (li as any).product ?? null,
    })),
  );
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  // ── Cost fields ──────────────────────────────────────────────────────────
  const [freight,      setFreight]      = useState(String(po.freightCost));
  const [tax,          setTax]          = useState(String(po.tax));
  const [discounts,    setDiscounts]    = useState(String(po.discounts));
  const [otherCosts,   setOtherCosts]   = useState(String(po.otherCosts));
  const [adjustment,   setAdjustment]   = useState(String(po.adjustment));
  const [exchangeRate, setExchangeRate] = useState(String(po.exchangeRate));
  const [currency,     setCurrency]     = useState(po.currency);
  const [notes,        setNotes]        = useState(po.notes ?? "");

  // ── UI state ─────────────────────────────────────────────────────────────
  const [dirty,          setDirty]          = useState(false);
  const [costExpanded,   setCostExpanded]   = useState(true);
  const [colPopoverOpen, setColPopoverOpen] = useState(false);
  const [visibleColKeys, setVisibleColKeys] = useState<ColKey[]>(
    () => Array.from(DEFAULT_VISIBLE) as ColKey[],
  );

  useEffect(() => {
    if (fetcher.state === "idle" && (fetcher.data as any)?.saved) {
      setDirty(false);
      setRemovedIds([]);
    }
  }, [fetcher.state, fetcher.data]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const subtotal        = items.reduce((s, i) => s + toNum(i.qtyOrdered) * toNum(i.unitCost), 0);
  const totalQty        = items.reduce((s, i) => s + toNum(i.qtyOrdered), 0);
  const fNum            = toNum(freight);
  const tNum            = toNum(tax);
  const dNum            = toNum(discounts);
  const oNum            = toNum(otherCosts);
  const aNum            = toNum(adjustment);
  const rNum            = toNum(exchangeRate) || 1;
  const totalLandedCost = calcLanded(subtotal, fNum, tNum, dNum, oNum, rNum, aNum);
  const landedPerUnit   = totalQty > 0 ? totalLandedCost / totalQty : 0;
  const visibleCols     = new Set(visibleColKeys);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = useCallback((
    id: string,
    field: keyof Pick<EditItem, "description" | "supplierSku" | "qtyOrdered" | "unitCost">,
    value: string,
  ) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    setDirty(true);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (!id.startsWith("new-")) setRemovedIds((prev) => [...prev, id]);
    setDirty(true);
  }, []);

  function handleAddRow() {
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, description: "", supplierSku: "", qtyOrdered: "1", unitCost: "0", qtyReceived: 0, qtyRejected: 0, product: null },
    ]);
    setDirty(true);
  }

  const handleProductPick = useCallback((picked: PickedProduct) => {
    setItems((prev) => [
      ...prev,
      {
        id:               `new-${Date.now()}`,
        description:      picked.title,
        supplierSku:      picked.supplierSku ?? "",
        qtyOrdered:       "1",
        unitCost:         picked.suggestedUnitCost != null ? String(picked.suggestedUnitCost) : "0",
        qtyReceived:      0,
        qtyRejected:      0,
        product:          null,
        pickedImageUrl:   picked.imageUrl,
        pickedTitle:      picked.title,
        pickedSku:        picked.sku,
        pickedBarcode:    picked.barcode,
        pickedRetailPrice: picked.retailPrice,
        pendingProductId: picked.productId,
      },
    ]);
    setDirty(true);
  }, []);

  function handleSave() {
    const fd = new FormData();
    fd.append("intent",        "save");
    fd.append("notes",         notes);
    fd.append("exchangeRate",  exchangeRate);
    fd.append("freightCost",   freight);
    fd.append("tax",           tax);
    fd.append("discounts",     discounts);
    fd.append("otherCosts",    otherCosts);
    fd.append("adjustment",    adjustment);
    fd.append("lineItemsJson",  JSON.stringify(items.map((i) => ({
      id:          i.id,
      description: i.description,
      supplierSku: i.supplierSku || null,
      qtyOrdered:  toNum(i.qtyOrdered),
      unitCost:    toNum(i.unitCost),
      productId:   i.product?.id ?? i.pendingProductId ?? null,
    }))));
    fd.append("removedIdsJson", JSON.stringify(removedIds));
    fetcher.submit(fd, { method: "post" });
  }

  function changeStatus(next: string) {
    const fd = new FormData();
    fd.append("intent", "updateStatus");
    fd.append("status", next);
    fetcher.submit(fd, { method: "post" });
  }

  // ── Column toggle ─────────────────────────────────────────────────────────
  const toggleChoices = ALL_COLS
    .filter((c) => !c.alwaysVisible)
    .map((c) => ({ label: c.label || c.key, value: c.key }));

  function handleColChange(selected: string[]) {
    const always = ALL_COLS.filter((c) => c.alwaysVisible).map((c) => c.key) as ColKey[];
    setVisibleColKeys([...always, ...(selected as ColKey[])]);
  }

  const toggleableSelected = visibleColKeys.filter((k) => {
    const col = ALL_COLS.find((c) => c.key === k);
    return col && !col.alwaysVisible;
  });

  // ── Row for cost breakdown (only shows non-zero items) ────────────────────
  function CostRow({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
    return (
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm" tone="subdued">{label}</Text>
        <Text as="span" variant="bodySm" tone={tone}>{value}</Text>
      </InlineStack>
    );
  }

  // ── Editable cost field ───────────────────────────────────────────────────
  function CF({ label, value, onChange, prefix = "$", helpText }: {
    label: string; value: string; onChange: (v: string) => void;
    prefix?: string; helpText?: string;
  }) {
    return (
      <TextField
        label={label}
        value={value}
        onChange={(v) => { onChange(v); setDirty(true); }}
        type="number"
        prefix={prefix}
        helpText={helpText}
        autoComplete="off"
        disabled={!canEdit}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Page fullWidth>
      {/* Responsive grid styles injected inline */}
      <style>{`
        .po-detail-outer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 288px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .po-detail-outer { grid-template-columns: 1fr; }
          .po-detail-panel { position: static !important; }
        }
      `}</style>

      <TitleBar title={po.poNumber}>
        <button onClick={() => navigate("/app/purchase-orders")}>All POs</button>
        {canEdit && (
          <button variant="primary" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
          </button>
        )}
      </TitleBar>

      <BlockStack gap="300">

        {/* ── Banners ─────────────────────────────────────────────────────── */}
        {dirty && (
          <Banner tone="warning">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodyMd">You have unsaved changes.</Text>
              <Button size="slim" onClick={handleSave} loading={saving}>Save now</Button>
            </InlineStack>
          </Banner>
        )}
        {justSaved && (
          <Banner tone="success" onDismiss={() => {}}>
            <Text as="p" variant="bodyMd">Saved successfully.</Text>
          </Banner>
        )}

        {/* ── PO header ───────────────────────────────────────────────────── */}
        <Card>
          <InlineStack align="space-between" blockAlign="center" wrap={false} gap="400">
            <BlockStack gap="100">
              <InlineStack gap="300" blockAlign="center">
                <Text as="h1" variant="headingLg" fontWeight="bold">{po.poNumber}</Text>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                {po.supplier.name} · {items.length} item{items.length !== 1 ? "s" : ""} · {totalQty} units · {new Date(po.createdAt).toLocaleDateString()}
              </Text>
            </BlockStack>

            <InlineStack gap="200">
              {canReceive && (
                <Button
                  size="slim"
                  variant="primary"
                  onClick={() => navigate(`/app/purchase-orders/${po.id}/receiving`)}
                >
                  Receive Stock
                </Button>
              )}
              {transitions.map((t) => (
                <Button key={t.next} size="slim"
                  tone={t.critical ? "critical" : undefined}
                  variant={t.critical ? undefined : "primary"}
                  onClick={() => changeStatus(t.next)} loading={saving}
                >
                  {t.label}
                </Button>
              ))}
            </InlineStack>
          </InlineStack>
        </Card>

        {/* ── Two-column body ─────────────────────────────────────────────── */}
        <div className="po-detail-outer">

          {/* ── LEFT: line-items table ───────────────────────────────────── */}
          <div>
            <Card padding="0">
              {/* Toolbar */}
              <Box paddingBlock="300" paddingInline="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Line Items</Text>
                  <InlineStack gap="200">
                    {/* Column toggle */}
                    <Popover
                      active={colPopoverOpen}
                      activator={
                        <Button size="slim" onClick={() => setColPopoverOpen((v) => !v)}>
                          {`Columns (${visibleColKeys.length})`}
                        </Button>
                      }
                      onClose={() => setColPopoverOpen(false)}
                      preferredAlignment="right"
                    >
                      <Box padding="400">
                        <BlockStack gap="300">
                          <Text as="p" variant="headingSm">Show / Hide Columns</Text>
                          <ChoiceList
                            title="" titleHidden allowMultiple
                            choices={toggleChoices}
                            selected={toggleableSelected}
                            onChange={handleColChange}
                          />
                        </BlockStack>
                      </Box>
                    </Popover>

                    {canEdit && (
                      <>
                        <ProductPickerButton
                          supplierId={po.supplierId}
                          onPick={handleProductPick}
                          label="Add Product"
                        />
                        <Button size="slim" onClick={handleAddRow}>Add Row</Button>
                      </>
                    )}
                  </InlineStack>
                </InlineStack>
              </Box>

              <Divider />

              <POSpreadsheet
                items={items}
                visibleCols={visibleCols}
                totalLandedCost={totalLandedCost}
                totalQtyOrdered={totalQty}
                onChange={handleChange}
                onRemove={handleRemove}
                disabled={!canEdit}
              />
            </Card>
          </div>

          {/* ── RIGHT: cost summary panel ────────────────────────────────── */}
          <div className="po-detail-panel" style={{ position: "sticky", top: 16 }}>
            <Card>
              <BlockStack gap="400">

                {/* Panel header */}
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Cost Summary</Text>
                  <Button
                    size="slim"
                    variant="plain"
                    onClick={() => setCostExpanded((v) => !v)}
                  >
                    {costExpanded ? "Collapse ▲" : "Expand ▼"}
                  </Button>
                </InlineStack>

                {/* Always-visible totals */}
                <BlockStack gap="200">
                  <CostRow label="Subtotal"   value={fmt(subtotal)} />
                  {fNum > 0 && <CostRow label="Freight"   value={`+${fmt(fNum)}`} />}
                  {tNum > 0 && <CostRow label="Tax"       value={`+${fmt(tNum)}`} />}
                  {oNum > 0 && <CostRow label="Duties"    value={`+${fmt(oNum)}`} />}
                  {dNum > 0 && <CostRow label="Discounts" value={`−${fmt(dNum)}`} tone="success" />}
                  {rNum !== 1 && <CostRow label="Rate" value={`×${rNum.toFixed(4)}`} />}
                  {aNum !== 0 && <CostRow label="Adjustment" value={fmt(aNum)} />}
                </BlockStack>

                <Divider />

                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">Total Landed</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">
                      {fmt(totalLandedCost)}
                    </Text>
                  </InlineStack>
                  {landedPerUnit > 0 && (
                    <BlockStack gap="050">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm" tone="subdued">Avg Landed / Unit</Text>
                        <Text as="span" variant="bodySm">${landedPerUnit.toFixed(3)}</Text>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Allocated from total landed cost across all ordered units.
                      </Text>
                    </BlockStack>
                  )}
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">Currency</Text>
                    <Text as="span" variant="bodySm">{currency}</Text>
                  </InlineStack>
                </BlockStack>

                {/* Expandable cost inputs */}
                <Collapsible open={costExpanded} id="cost-fields">
                  <BlockStack gap="300">
                    <Divider />

                    <Select
                      label="Currency"
                      options={CURRENCY_OPTIONS}
                      value={currency}
                      onChange={(v) => { setCurrency(v); setDirty(true); }}
                      disabled={!canEdit}
                    />
                    <CF label="Exchange Rate" value={exchangeRate} onChange={setExchangeRate} prefix="×" helpText="Applied to subtotal" />
                    <CF label="Freight / Shipping" value={freight}    onChange={setFreight}    />
                    <CF label="Tax"                value={tax}        onChange={setTax}        />
                    <CF label="Duties / Other"     value={otherCosts} onChange={setOtherCosts} />
                    <CF label="Discounts"          value={discounts}  onChange={setDiscounts}  helpText="Subtracted from cost" />
                    <CF label="Adjustment"         value={adjustment} onChange={setAdjustment} helpText="Fixed add after rate" />

                    <Divider />

                    <TextField
                      label="Notes"
                      value={notes}
                      onChange={(v) => { setNotes(v); setDirty(true); }}
                      multiline={3}
                      placeholder="Internal notes…"
                      autoComplete="off"
                      disabled={!canEdit}
                    />
                  </BlockStack>
                </Collapsible>

                {/* Save button */}
                {canEdit && (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleSave}
                    loading={saving}
                    disabled={!dirty}
                  >
                    {dirty ? "Save Changes" : "Saved"}
                  </Button>
                )}

                {/* Source offer link */}
                {(po as any).offer && (
                  <>
                    <Divider />
                    <BlockStack gap="200">
                      <Text as="p" variant="bodySm" tone="subdued">Source Offer</Text>
                      <InlineStack align="space-between" blockAlign="center">
                        <Button
                          variant="plain"
                          size="slim"
                          onClick={() => navigate(`/app/offers/${(po as any).offer.id}`)}
                        >
                          {`OFF-${(po as any).offer.id.slice(-6).toUpperCase()}`}
                        </Button>
                        <Badge tone="success">Linked</Badge>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm" tone="subdued">Offer Est.</Text>
                        <Text as="span" variant="bodySm">
                          ${(po as any).offer.totalEstimatedCost.toFixed(2)}
                        </Text>
                      </InlineStack>
                    </BlockStack>
                  </>
                )}

                {/* Read-only status notices */}
                {po.status === "received" && (
                  <Box background="bg-surface-success" padding="300" borderRadius="200">
                    <Text as="p" variant="bodySm" alignment="center" tone="success">
                      ✓ This PO has been fully received.
                    </Text>
                  </Box>
                )}
                {po.status === "cancelled" && (
                  <Box background="bg-surface-critical" padding="300" borderRadius="200">
                    <Text as="p" variant="bodySm" alignment="center" tone="critical">
                      This PO was cancelled.
                    </Text>
                  </Box>
                )}

              </BlockStack>
            </Card>
          </div>
        </div>

      </BlockStack>
    </Page>
  );
}
