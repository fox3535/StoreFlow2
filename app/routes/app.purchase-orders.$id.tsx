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
  InlineGrid,
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

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { tone: "info" | "warning" | "success" | "critical" | undefined; label: string }> = {
  draft:              { tone: undefined,  label: "Draft" },
  open:               { tone: "info",     label: "Open" },
  in_transit:         { tone: "warning",  label: "In Transit" },
  partially_received: { tone: "warning",  label: "Partially Received" },
  received:           { tone: "success",  label: "Received" },
  cancelled:          { tone: "critical", label: "Cancelled" },
};

const STATUS_TRANSITIONS: Record<string, { label: string; next: string; critical?: boolean }[]> = {
  draft:              [{ label: "Send to Supplier",  next: "open" }],
  open:               [{ label: "Mark In Transit",   next: "in_transit" }, { label: "Cancel PO", next: "cancelled", critical: true }],
  in_transit:         [{ label: "Mark Received",     next: "received" }],
  partially_received: [{ label: "Mark Received",     next: "received" }],
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
      notes:        (fd.get("notes") as string)       || null,
      exchangeRate: parseFloat(fd.get("exchangeRate") as string) || 1,
      freightCost:  parseFloat(fd.get("freightCost")  as string) || 0,
      tax:          parseFloat(fd.get("tax")          as string) || 0,
      discounts:    parseFloat(fd.get("discounts")    as string) || 0,
      otherCosts:   parseFloat(fd.get("otherCosts")   as string) || 0,
      adjustment:   parseFloat(fd.get("adjustment")   as string) || 0,
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PurchaseOrderDetail() {
  const { po }   = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher  = useFetcher<{ saved?: boolean; ok?: boolean }>();

  const canEdit      = EDITABLE.has(po.status);
  const badge        = STATUS_BADGE[po.status] ?? { tone: undefined, label: po.status };
  const transitions  = STATUS_TRANSITIONS[po.status] ?? [];
  const saving       = fetcher.state !== "idle";
  const justSaved    = fetcher.state === "idle" && (fetcher.data as any)?.saved;

  // ── Line items ────────────────────────────────────────────────────────────
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

  // ── Cost fields ───────────────────────────────────────────────────────────
  const [freight,      setFreight]      = useState(String(po.freightCost));
  const [tax,          setTax]          = useState(String(po.tax));
  const [discounts,    setDiscounts]    = useState(String(po.discounts));
  const [otherCosts,   setOtherCosts]   = useState(String(po.otherCosts));
  const [adjustment,   setAdjustment]   = useState(String(po.adjustment));
  const [exchangeRate, setExchangeRate] = useState(String(po.exchangeRate));
  const [currency,     setCurrency]     = useState(po.currency);
  const [notes,        setNotes]        = useState(po.notes ?? "");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [dirty,           setDirty]           = useState(false);
  const [costOpen,        setCostOpen]        = useState(true);
  const [colPopoverOpen,  setColPopoverOpen]  = useState(false);
  const [visibleColKeys,  setVisibleColKeys]  = useState<ColKey[]>(
    () => Array.from(DEFAULT_VISIBLE) as ColKey[],
  );

  useEffect(() => {
    if (fetcher.state === "idle" && (fetcher.data as any)?.saved) {
      setDirty(false);
      setRemovedIds([]);
    }
  }, [fetcher.state, fetcher.data]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + toNum(i.qtyOrdered) * toNum(i.unitCost), 0);
  const totalQty = items.reduce((s, i) => s + toNum(i.qtyOrdered), 0);
  const totalLandedCost = calcLanded(subtotal, toNum(freight), toNum(tax), toNum(discounts), toNum(otherCosts), toNum(exchangeRate), toNum(adjustment));
  const visibleCols = new Set(visibleColKeys);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = useCallback((id: string, field: keyof Pick<EditItem, "description" | "supplierSku" | "qtyOrdered" | "unitCost">, value: string) => {
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

  function handleSave() {
    const fd = new FormData();
    fd.append("intent", "save");
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

  // ── Cost field component ──────────────────────────────────────────────────
  function CF({ label, value, onChange, helpText, prefix = "$" }: {
    label: string; value: string; onChange: (v: string) => void;
    helpText?: string; prefix?: string;
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
      <TitleBar title={po.poNumber}>
        <button onClick={() => navigate("/app/purchase-orders")}>Back to POs</button>
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

        {/* ── Header bar ──────────────────────────────────────────────────── */}
        <Card>
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <BlockStack gap="050">
              <InlineStack gap="300" blockAlign="center">
                <Text as="h1" variant="headingLg" fontWeight="bold">{po.poNumber}</Text>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                {po.supplier.name} · {items.length} item{items.length !== 1 ? "s" : ""} · {totalQty} units · Created {new Date(po.createdAt).toLocaleDateString()}
              </Text>
            </BlockStack>

            <InlineStack gap="200" blockAlign="center">
              {transitions.map((t) => (
                <Button
                  key={t.next}
                  tone={t.critical ? "critical" : undefined}
                  variant={t.critical ? undefined : "primary"}
                  size="slim"
                  onClick={() => changeStatus(t.next)}
                  loading={saving}
                >
                  {t.label}
                </Button>
              ))}
              {po.status === "received" && (
                <Badge tone="success">Fully Received</Badge>
              )}
              {po.status === "cancelled" && (
                <Badge tone="critical">Cancelled</Badge>
              )}
            </InlineStack>
          </InlineStack>
        </Card>

        {/* ── Spreadsheet ─────────────────────────────────────────────────── */}
        <Card padding="0">
          {/* Table toolbar */}
          <Box paddingBlock="300" paddingInline="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">Line Items</Text>
              <InlineStack gap="200">
                {/* Column visibility toggle */}
                <Popover
                  active={colPopoverOpen}
                  activator={
                    <Button
                      size="slim"
                      onClick={() => setColPopoverOpen((v) => !v)}
                    >
                      {`Columns (${visibleColKeys.length})`}
                    </Button>
                  }
                  onClose={() => setColPopoverOpen(false)}
                  preferredAlignment="right"
                >
                  <Box padding="400" minWidth="200px">
                    <BlockStack gap="300">
                      <Text as="p" variant="headingSm">Show / Hide Columns</Text>
                      <ChoiceList
                        title=""
                        titleHidden
                        allowMultiple
                        choices={toggleChoices}
                        selected={toggleableSelected}
                        onChange={handleColChange}
                      />
                    </BlockStack>
                  </Box>
                </Popover>

                {canEdit && (
                  <Button size="slim" onClick={handleAddRow}>
                    Add Row
                  </Button>
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

        {/* ── Cost Summary (collapsible) ────────────────────────────────── */}
        <Card>
          {/* Always-visible summary strip */}
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="500" blockAlign="center">
              <Text as="h2" variant="headingMd">Cost Summary</Text>
              <InlineStack gap="400">
                <BlockStack gap="0">
                  <Text as="span" variant="bodySm" tone="subdued">Subtotal</Text>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">${subtotal.toFixed(2)}</Text>
                </BlockStack>
                {toNum(freight) > 0 && (
                  <BlockStack gap="0">
                    <Text as="span" variant="bodySm" tone="subdued">Freight</Text>
                    <Text as="span" variant="bodyMd">+${toNum(freight).toFixed(2)}</Text>
                  </BlockStack>
                )}
                {toNum(tax) > 0 && (
                  <BlockStack gap="0">
                    <Text as="span" variant="bodySm" tone="subdued">Tax</Text>
                    <Text as="span" variant="bodyMd">+${toNum(tax).toFixed(2)}</Text>
                  </BlockStack>
                )}
                {toNum(discounts) > 0 && (
                  <BlockStack gap="0">
                    <Text as="span" variant="bodySm" tone="subdued">Discount</Text>
                    <Text as="span" variant="bodyMd" tone="success">−${toNum(discounts).toFixed(2)}</Text>
                  </BlockStack>
                )}
                <BlockStack gap="0">
                  <Text as="span" variant="bodySm" tone="subdued">Total Landed</Text>
                  <Text as="span" variant="headingMd" fontWeight="bold">${totalLandedCost.toFixed(2)}</Text>
                </BlockStack>
                {totalQty > 0 && (
                  <BlockStack gap="0">
                    <Text as="span" variant="bodySm" tone="subdued">Per Unit</Text>
                    <Text as="span" variant="bodyMd">${(totalLandedCost / totalQty).toFixed(3)}</Text>
                  </BlockStack>
                )}
              </InlineStack>
            </InlineStack>

            <InlineStack gap="200">
              {canEdit && dirty && (
                <Button variant="primary" size="slim" onClick={handleSave} loading={saving}>
                  Save Changes
                </Button>
              )}
              <Button
                size="slim"
                onClick={() => setCostOpen((v) => !v)}
              >
                {costOpen ? "Hide Cost Fields ▲" : "Edit Costs ▼"}
              </Button>
            </InlineStack>
          </InlineStack>

          {/* Expandable cost fields */}
          <Collapsible open={costOpen} id="cost-summary-fields">
            <Box paddingBlockStart="400">
              <Divider />
              <Box paddingBlockStart="400">
                <BlockStack gap="400">
                  <InlineGrid columns={{ xs: 2, sm: 3, md: 4, lg: 7 }} gap="300">
                    <Select
                      label="Currency"
                      options={CURRENCY_OPTIONS}
                      value={currency}
                      onChange={(v) => { setCurrency(v); setDirty(true); }}
                      disabled={!canEdit}
                    />
                    <CF label="Exchange Rate" value={exchangeRate} onChange={setExchangeRate} prefix="×" helpText="Multiplied" />
                    <CF label="Freight" value={freight}    onChange={setFreight}    />
                    <CF label="Tax"     value={tax}        onChange={setTax}        />
                    <CF label="Duties / Other" value={otherCosts} onChange={setOtherCosts} />
                    <CF label="Discounts" value={discounts} onChange={setDiscounts} helpText="Subtracted" />
                    <CF label="Adjustment" value={adjustment} onChange={setAdjustment} helpText="Fixed adj." />
                  </InlineGrid>

                  <TextField
                    label="Notes"
                    value={notes}
                    onChange={(v) => { setNotes(v); setDirty(true); }}
                    multiline={2}
                    placeholder="Internal notes about this PO…"
                    autoComplete="off"
                    disabled={!canEdit}
                  />
                </BlockStack>
              </Box>
            </Box>
          </Collapsible>
        </Card>

      </BlockStack>
    </Page>
  );
}
