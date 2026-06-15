import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import {
  getPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
} from "../models/purchase-order.server";
import type { EditItem } from "../components/POSpreadsheet";
import { POSpreadsheet } from "../components/POSpreadsheet";

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

const STATUS_TRANSITIONS: Record<string, { label: string; next: string; tone?: "critical" }[]> = {
  draft:              [{ label: "Send to Supplier (Open)",  next: "open" }],
  open:               [{ label: "Mark as In Transit",       next: "in_transit" }, { label: "Cancel PO", next: "cancelled", tone: "critical" }],
  in_transit:         [{ label: "Mark as Received",         next: "received" }],
  partially_received: [{ label: "Mark as Received",         next: "received" }],
  received:           [],
  cancelled:          [],
};

const EDITABLE_STATUSES = new Set(["draft", "open"]);

const CURRENCY_OPTIONS = [
  { label: "USD", value: "USD" },
  { label: "CAD", value: "CAD" },
  { label: "EUR", value: "EUR" },
  { label: "GBP", value: "GBP" },
  { label: "AUD", value: "AUD" },
  { label: "JPY", value: "JPY" },
  { label: "CNY", value: "CNY" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const po = await getPurchaseOrder(session.shop, params.id!);
  if (!po) throw new Response("Not Found", { status: 404 });
  return json({ po });
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save") {
    const lineItemsJson  = formData.get("lineItemsJson")  as string;
    const removedIdsJson = formData.get("removedIdsJson") as string;

    const lineItems  = JSON.parse(lineItemsJson  || "[]");
    const removedIds = JSON.parse(removedIdsJson || "[]");

    await updatePurchaseOrder(session.shop, params.id!, {
      notes:        (formData.get("notes")        as string) || null,
      exchangeRate: parseFloat(formData.get("exchangeRate") as string) || 1,
      freightCost:  parseFloat(formData.get("freightCost")  as string) || 0,
      tax:          parseFloat(formData.get("tax")          as string) || 0,
      discounts:    parseFloat(formData.get("discounts")    as string) || 0,
      otherCosts:   parseFloat(formData.get("otherCosts")   as string) || 0,
      adjustment:   parseFloat(formData.get("adjustment")   as string) || 0,
      lineItems,
      removedIds,
    });
    return json({ saved: true });
  }

  if (intent === "updateStatus") {
    const status = formData.get("status") as string;
    await updatePurchaseOrderStatus(session.shop, params.id!, status);
    return json({ ok: true });
  }

  return json({ ok: true });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcTotal(
  subtotal: number,
  freight: number,
  tax: number,
  discounts: number,
  other: number,
  rate: number,
  adj: number,
) {
  return (subtotal + freight + tax + other - discounts) * rate + adj;
}

function toNum(s: string) {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Editable cost field
// ---------------------------------------------------------------------------

function CostField({
  label,
  value,
  onChange,
  prefix = "$",
  helpText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  helpText?: string;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      type="number"
      prefix={prefix}
      helpText={helpText}
      autoComplete="off"
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PurchaseOrderDetail() {
  const { po } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher<{ saved?: boolean; ok?: boolean }>();

  const canEdit = EDITABLE_STATUSES.has(po.status);
  const badge   = STATUS_BADGE[po.status] ?? { tone: undefined, label: po.status };
  const transitions = STATUS_TRANSITIONS[po.status] ?? [];

  // ── Line item state ──────────────────────────────────────────────────────
  const [items, setItems] = useState<EditItem[]>(() =>
    po.lineItems.map((li) => ({
      id:          li.id,
      description: li.description ?? "",
      supplierSku: li.supplierSku ?? "",
      qtyOrdered:  String(li.qtyOrdered),
      unitCost:    String(li.unitCost),
      qtyReceived: li.qtyReceived,
      qtyRejected: li.qtyRejected,
      product:     (li as any).product ?? null,
    })),
  );
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  // ── Cost summary state ───────────────────────────────────────────────────
  const [freight,      setFreight]      = useState(String(po.freightCost));
  const [tax,          setTax]          = useState(String(po.tax));
  const [discounts,    setDiscounts]    = useState(String(po.discounts));
  const [otherCosts,   setOtherCosts]   = useState(String(po.otherCosts));
  const [adjustment,   setAdjustment]   = useState(String(po.adjustment));
  const [exchangeRate, setExchangeRate] = useState(String(po.exchangeRate));
  const [currency,     setCurrency]     = useState(po.currency);
  const [notes,        setNotes]        = useState(po.notes ?? "");

  // ── Dirty tracking ───────────────────────────────────────────────────────
  const [dirty, setDirty] = useState(false);

  // Reset dirty flag after successful save (fetcher revalidates loader)
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.saved) {
      setDirty(false);
      setRemovedIds([]);
    }
  }, [fetcher.state, fetcher.data]);

  // ── Derived totals (live, client-side) ───────────────────────────────────
  const subtotal = items.reduce((s, i) => s + toNum(i.qtyOrdered) * toNum(i.unitCost), 0);
  const totalQty = items.reduce((s, i) => s + toNum(i.qtyOrdered), 0);
  const totalLandedCost = calcTotal(
    subtotal,
    toNum(freight),
    toNum(tax),
    toNum(discounts),
    toNum(otherCosts),
    toNum(exchangeRate) || 1,
    toNum(adjustment),
  );

  // ── Item handlers ─────────────────────────────────────────────────────────
  function handleChange(id: string, field: keyof Pick<EditItem, "description" | "supplierSku" | "qtyOrdered" | "unitCost">, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    setDirty(true);
  }

  function handleRemove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (!id.startsWith("new-")) setRemovedIds((prev) => [...prev, id]);
    setDirty(true);
  }

  function handleAddRow() {
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, description: "", supplierSku: "", qtyOrdered: "1", unitCost: "0", qtyReceived: 0, qtyRejected: 0, product: null },
    ]);
    setDirty(true);
  }

  // ── Save handler ─────────────────────────────────────────────────────────
  function handleSave() {
    const fd = new FormData();
    fd.append("intent", "save");
    fd.append("notes",        notes);
    fd.append("exchangeRate", exchangeRate);
    fd.append("freightCost",  freight);
    fd.append("tax",          tax);
    fd.append("discounts",    discounts);
    fd.append("otherCosts",   otherCosts);
    fd.append("adjustment",   adjustment);
    fd.append("lineItemsJson", JSON.stringify(
      items.map((i) => ({
        id:          i.id,
        description: i.description,
        supplierSku: i.supplierSku || null,
        qtyOrdered:  toNum(i.qtyOrdered),
        unitCost:    toNum(i.unitCost),
      })),
    ));
    fd.append("removedIdsJson", JSON.stringify(removedIds));
    fetcher.submit(fd, { method: "post" });
  }

  function changeStatus(next: string) {
    const fd = new FormData();
    fd.append("intent", "updateStatus");
    fd.append("status", next);
    fetcher.submit(fd, { method: "post" });
  }

  const saving = fetcher.state !== "idle";
  const justSaved = fetcher.state === "idle" && fetcher.data?.saved;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Page>
      <TitleBar title={po.poNumber}>
        <button onClick={() => navigate("/app/purchase-orders")}>Back</button>
        {canEdit && (
          <button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
          </button>
        )}
      </TitleBar>

      <BlockStack gap="400">
        {/* Unsaved changes warning */}
        {dirty && (
          <Banner tone="warning">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodyMd">You have unsaved changes.</Text>
              <Button size="slim" onClick={handleSave} loading={saving}>Save now</Button>
            </InlineStack>
          </Banner>
        )}
        {justSaved && (
          <Banner tone="success">
            <Text as="p" variant="bodyMd">Changes saved successfully.</Text>
          </Banner>
        )}

        {/* PO Header */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h1" variant="headingLg">{po.poNumber}</Text>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {po.supplier.name} · Created {new Date(po.createdAt).toLocaleDateString()}
                </Text>
              </BlockStack>
              <InlineStack gap="200">
                {transitions.map((t) => (
                  <Button
                    key={t.next}
                    tone={t.tone ?? undefined}
                    size="slim"
                    onClick={() => changeStatus(t.next)}
                    loading={saving}
                  >
                    {t.label}
                  </Button>
                ))}
              </InlineStack>
            </InlineStack>
          </BlockStack>
        </Card>

        <Layout>
          {/* ── Main: Spreadsheet ─────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Line Items</Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {items.length} item{items.length !== 1 ? "s" : ""} · {totalQty} units
                  </Text>
                </InlineStack>
                <Divider />
                <POSpreadsheet
                  items={items}
                  totalLandedCost={totalLandedCost}
                  totalQtyOrdered={totalQty}
                  onChange={handleChange}
                  onRemove={handleRemove}
                  onAddRow={handleAddRow}
                  disabled={!canEdit}
                />
              </BlockStack>
            </Card>

            {/* Notes */}
            {canEdit && (
              <Box paddingBlockStart="400">
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">Notes</Text>
                    <Divider />
                    <TextField
                      label=""
                      labelHidden
                      multiline={3}
                      value={notes}
                      onChange={(v) => { setNotes(v); setDirty(true); }}
                      placeholder="Internal notes about this PO…"
                      autoComplete="off"
                    />
                  </BlockStack>
                </Card>
              </Box>
            )}
            {!canEdit && po.notes && (
              <Box paddingBlockStart="400">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">Notes</Text>
                    <Text as="p" variant="bodyMd">{po.notes}</Text>
                  </BlockStack>
                </Card>
              </Box>
            )}
          </Layout.Section>

          {/* ── Sidebar: Cost summary ─────────────────────────────────── */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">

              {/* Editable cost fields */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Cost Summary</Text>
                  <Divider />

                  <InlineGrid columns={2} gap="300">
                    <Select
                      label="Currency"
                      options={CURRENCY_OPTIONS}
                      value={currency}
                      onChange={(v) => { setCurrency(v); setDirty(true); }}
                      disabled={!canEdit}
                    />
                    <CostField
                      label="Exchange Rate"
                      value={exchangeRate}
                      onChange={(v) => { setExchangeRate(v); setDirty(true); }}
                      prefix="×"
                    />
                  </InlineGrid>

                  <CostField label="Freight / Shipping" value={freight}    onChange={(v) => { setFreight(v);    setDirty(true); }} />
                  <CostField label="Tax"                value={tax}        onChange={(v) => { setTax(v);        setDirty(true); }} />
                  <CostField label="Duties / Other"     value={otherCosts} onChange={(v) => { setOtherCosts(v); setDirty(true); }} />
                  <CostField
                    label="Discounts"
                    value={discounts}
                    onChange={(v) => { setDiscounts(v); setDirty(true); }}
                    helpText="Subtracted from cost"
                  />
                  <CostField
                    label="Adjustment"
                    value={adjustment}
                    onChange={(v) => { setAdjustment(v); setDirty(true); }}
                    helpText="Fixed add/subtract after rate"
                  />

                  <Divider />

                  {/* Breakdown */}
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Subtotal</Text>
                      <Text as="span" variant="bodyMd">${subtotal.toFixed(2)}</Text>
                    </InlineStack>
                    {toNum(freight) > 0 && (
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd" tone="subdued">Freight</Text>
                        <Text as="span" variant="bodyMd">+${toNum(freight).toFixed(2)}</Text>
                      </InlineStack>
                    )}
                    {toNum(tax) > 0 && (
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd" tone="subdued">Tax</Text>
                        <Text as="span" variant="bodyMd">+${toNum(tax).toFixed(2)}</Text>
                      </InlineStack>
                    )}
                    {toNum(otherCosts) > 0 && (
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd" tone="subdued">Duties / Other</Text>
                        <Text as="span" variant="bodyMd">+${toNum(otherCosts).toFixed(2)}</Text>
                      </InlineStack>
                    )}
                    {toNum(discounts) > 0 && (
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd" tone="subdued">Discounts</Text>
                        <Text as="span" variant="bodyMd" tone="success">−${toNum(discounts).toFixed(2)}</Text>
                      </InlineStack>
                    )}
                    {(toNum(exchangeRate) !== 1) && (
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd" tone="subdued">Rate</Text>
                        <Text as="span" variant="bodyMd">×{toNum(exchangeRate).toFixed(4)}</Text>
                      </InlineStack>
                    )}
                    {toNum(adjustment) !== 0 && (
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd" tone="subdued">Adjustment</Text>
                        <Text as="span" variant="bodyMd">${toNum(adjustment).toFixed(2)}</Text>
                      </InlineStack>
                    )}
                  </BlockStack>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">Total Landed Cost</Text>
                    <Text as="span" variant="headingLg" fontWeight="bold">
                      ${totalLandedCost.toFixed(2)}
                    </Text>
                  </InlineStack>

                  {totalQty > 0 && (
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" tone="subdued">Landed Cost / Unit</Text>
                      <Text as="span" variant="bodySm">
                        ${(totalLandedCost / totalQty).toFixed(4)}
                      </Text>
                    </InlineStack>
                  )}

                  {canEdit && (
                    <Box paddingBlockStart="200">
                      <Button
                        variant="primary"
                        fullWidth
                        onClick={handleSave}
                        loading={saving}
                        disabled={!dirty}
                      >
                        {dirty ? "Save Changes" : "Saved"}
                      </Button>
                    </Box>
                  )}
                </BlockStack>
              </Card>

              {/* PO metadata */}
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">Details</Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Supplier</Text>
                    <Text as="span" variant="bodyMd">{po.supplier.name}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Currency</Text>
                    <Text as="span" variant="bodyMd">{po.currency}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Created</Text>
                    <Text as="span" variant="bodyMd">{new Date(po.createdAt).toLocaleDateString()}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Updated</Text>
                    <Text as="span" variant="bodyMd">{new Date(po.updatedAt).toLocaleDateString()}</Text>
                  </InlineStack>
                </BlockStack>
              </Card>

            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
