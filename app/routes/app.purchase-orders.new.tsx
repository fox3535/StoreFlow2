import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Button,
  Divider,
  Banner,
  Box,
  InlineGrid,
  Popover,
  ChoiceList,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getSuppliers } from "../models/supplier.server";
import { createPurchaseOrder } from "../models/purchase-order.server";
import { getSettings } from "../models/settings.server";
import type { PickedProduct } from "../components/ProductPickerButton";
import { ProductPickerButton } from "../components/ProductPickerButton";
import type { EditItem, ColKey } from "../components/POSpreadsheet";
import { ALL_COLS, DEFAULT_VISIBLE, POSpreadsheet } from "../components/POSpreadsheet";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [suppliers, settings] = await Promise.all([
    getSuppliers(session.shop),
    getSettings(session.shop),
  ]);
  return { suppliers, settings };
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const supplierId    = formData.get("supplierId") as string;
  const currency      = (formData.get("currency")      as string) || "USD";
  const exchangeRate  = parseFloat((formData.get("exchangeRate")  as string) || "1");
  const freightCost   = parseFloat((formData.get("freightCost")   as string) || "0");
  const tax           = parseFloat((formData.get("tax")           as string) || "0");
  const discounts     = parseFloat((formData.get("discounts")     as string) || "0");
  const otherCosts    = parseFloat((formData.get("otherCosts")    as string) || "0");
  const adjustment    = parseFloat((formData.get("adjustment")    as string) || "0");
  const notes         = (formData.get("notes") as string) || null;
  const status        = (formData.get("status") as string) || "draft";
  const lineItemsJson = formData.get("lineItemsJson") as string;

  const errors: Record<string, string> = {};
  if (!supplierId) errors.supplierId = "Supplier is required.";

  let lineItems: { description: string; supplierSku?: string; qtyOrdered: number; unitCost: number; productId?: string | null }[] = [];
  try {
    lineItems = JSON.parse(lineItemsJson || "[]");
  } catch {
    errors.lineItems = "Invalid line items.";
  }

  if (lineItems.length === 0) errors.lineItems = "Add at least one line item.";
  for (const item of lineItems) {
    if (!item.description?.trim()) { errors.lineItems = "Each line item needs a description."; break; }
    if (item.qtyOrdered <= 0)      { errors.lineItems = "Quantity must be greater than 0."; break; }
    if (item.unitCost < 0)         { errors.lineItems = "Unit cost cannot be negative."; break; }
  }

  if (Object.keys(errors).length > 0) return { errors };

  await createPurchaseOrder(session.shop, {
    supplierId, status, currency, exchangeRate,
    freightCost, tax, discounts, otherCosts, adjustment, notes,
    lineItems,
  });

  return redirect("/app/purchase-orders");
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const toNum = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

const CURRENCY_OPTIONS = [
  { label: "USD", value: "USD" }, { label: "CAD", value: "CAD" },
  { label: "GBP", value: "GBP" }, { label: "EUR", value: "EUR" },
  { label: "AUD", value: "AUD" }, { label: "JPY", value: "JPY" },
];

function newRow(): EditItem {
  return {
    id: crypto.randomUUID(),
    description: "", supplierSku: "",
    qtyOrdered: "1", unitCost: "0",
    qtyReceived: 0, qtyRejected: 0,
    product: null,
  };
}

export default function NewPurchaseOrder() {
  const { suppliers, settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate   = useNavigate();
  const submit     = useSubmit();

  // ── Form fields ───────────────────────────────────────────────────────────
  const [supplierId,   setSupplierId]   = useState(suppliers[0]?.id ?? "");
  const [currency,     setCurrency]     = useState(settings.defaultCurrency);
  const [exchangeRate, setExchangeRate] = useState("1");
  const [freightCost,  setFreightCost]  = useState("0");
  const [tax,          setTax]          = useState("0");
  const [discounts,    setDiscounts]    = useState("0");
  const [otherCosts,   setOtherCosts]   = useState("0");
  const [adjustment,   setAdjustment]   = useState("0");
  const [notes,        setNotes]        = useState("");

  // ── Line items (EditItem — same type as PO detail) ───────────────────────
  const [items, setItems] = useState<EditItem[]>([newRow()]);

  // ── Column visibility (same as PO detail) ────────────────────────────────
  const [colPopoverOpen, setColPopoverOpen] = useState(false);
  const [visibleColKeys, setVisibleColKeys] = useState<ColKey[]>(
    () => Array.from(DEFAULT_VISIBLE) as ColKey[],
  );

  const supplierOptions = suppliers.length
    ? suppliers.map((s) => ({ label: s.name, value: s.id }))
    : [{ label: "No suppliers yet — add one first", value: "" }];

  // ── Derived numbers ───────────────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + toNum(i.qtyOrdered) * toNum(i.unitCost), 0);
  const totalQty = items.reduce((s, i) => s + toNum(i.qtyOrdered), 0);
  const totalLandedCost =
    (subtotal + toNum(freightCost) + toNum(tax) + toNum(otherCosts) - toNum(discounts)) *
    (toNum(exchangeRate) || 1) + toNum(adjustment);
  const visibleCols = new Set(visibleColKeys);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = useCallback((
    id: string,
    field: keyof Pick<EditItem, "description" | "supplierSku" | "qtyOrdered" | "unitCost">,
    value: string,
  ) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  function handleAddRow() {
    setItems((prev) => [...prev, newRow()]);
  }

  function handleProductPick(picked: PickedProduct) {
    setItems((prev) => [
      ...prev,
      {
        id:               crypto.randomUUID(),
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
  }

  function handleColChange(selected: string[]) {
    const always = ALL_COLS.filter((c) => c.alwaysVisible).map((c) => c.key) as ColKey[];
    setVisibleColKeys([...always, ...(selected as ColKey[])]);
  }

  const toggleChoices = ALL_COLS
    .filter((c) => !c.alwaysVisible)
    .map((c) => ({ label: c.label || c.key, value: c.key }));
  const toggleableSelected = visibleColKeys.filter((k) => {
    const col = ALL_COLS.find((c) => c.key === k);
    return col && !col.alwaysVisible;
  });

  function handleSave(status: "draft" | "open") {
    const serializedItems = items.map((i) => ({
      description: i.description,
      supplierSku: i.supplierSku || null,
      qtyOrdered:  Math.floor(toNum(i.qtyOrdered)),
      unitCost:    toNum(i.unitCost),
      productId:   i.product?.id ?? i.pendingProductId ?? null,
    }));

    const fd = new FormData();
    fd.append("supplierId",    supplierId);
    fd.append("currency",      currency);
    fd.append("exchangeRate",  exchangeRate);
    fd.append("freightCost",   freightCost);
    fd.append("tax",           tax);
    fd.append("discounts",     discounts);
    fd.append("otherCosts",    otherCosts);
    fd.append("adjustment",    adjustment);
    fd.append("notes",         notes);
    fd.append("status",        status);
    fd.append("lineItemsJson", JSON.stringify(serializedItems));
    submit(fd, { method: "post" });
  }

  const errors = (actionData as any)?.errors ?? {};

  return (
    <Page fullWidth>
      <style>{`
        .po-new-outer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 288px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .po-new-outer  { grid-template-columns: 1fr; }
          .po-new-panel  { position: static !important; }
        }
      `}</style>

      <TitleBar title="Create Purchase Order">
        <button onClick={() => navigate("/app/purchase-orders")}>Cancel</button>
        <button variant="primary" onClick={() => handleSave("open")}>Save as Open</button>
      </TitleBar>

      <BlockStack gap="400">
        {(errors.supplierId || errors.lineItems) && (
          <Banner tone="critical">
            <BlockStack gap="100">
              {errors.supplierId && <Text as="p" variant="bodyMd">{errors.supplierId}</Text>}
              {errors.lineItems  && <Text as="p" variant="bodyMd">{errors.lineItems}</Text>}
            </BlockStack>
          </Banner>
        )}

        {/* Order details row — spans full width above the two-col grid */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Order Details</Text>
            <Divider />
            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
              <Select label="Supplier" options={supplierOptions} value={supplierId} onChange={setSupplierId} error={errors.supplierId} />
              <Select label="Currency" options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
              <TextField label="Exchange Rate" type="number" value={exchangeRate} onChange={setExchangeRate} helpText="Multiply cost × rate for local currency" autoComplete="off" />
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* Two-column body: wide line-item spreadsheet + sticky cost panel */}
        <div className="po-new-outer">

          {/* LEFT — line-item spreadsheet (same card style as PO detail) */}
          <div>
            <Card padding="0">
              <Box paddingBlock="300" paddingInline="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Line Items</Text>
                  <InlineStack gap="200">
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
                    <ProductPickerButton supplierId={supplierId} onPick={handleProductPick} label="Add Product" />
                    <Button size="slim" onClick={handleAddRow}>Add Row</Button>
                  </InlineStack>
                </InlineStack>
              </Box>
              <Divider />
              {errors.lineItems && (
                <Box paddingInline="400" paddingBlockStart="200">
                  <Text as="p" variant="bodyMd" tone="critical">{errors.lineItems}</Text>
                </Box>
              )}
              <POSpreadsheet
                items={items}
                visibleCols={visibleCols}
                totalLandedCost={totalLandedCost}
                totalQtyOrdered={totalQty}
                onChange={handleChange}
                onRemove={handleRemove}
              />
            </Card>
          </div>

          {/* RIGHT — sticky cost summary + save actions */}
          <div className="po-new-panel" style={{ position: "sticky", top: 16 }}>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Cost Summary</Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Subtotal</Text>
                    <Text as="span" variant="bodyMd">${subtotal.toFixed(2)}</Text>
                  </InlineStack>
                  <TextField label="Freight / Shipping" type="number" prefix="$" value={freightCost} onChange={setFreightCost} autoComplete="off" />
                  <TextField label="Tax"                type="number" prefix="$" value={tax}         onChange={setTax}         autoComplete="off" />
                  <TextField label="Duties / Other"     type="number" prefix="$" value={otherCosts}  onChange={setOtherCosts}  autoComplete="off" />
                  <TextField label="Discounts"          type="number" prefix="$" value={discounts}   onChange={setDiscounts}   helpText="Subtracted from cost" autoComplete="off" />
                  <TextField label="Adjustment"         type="number" prefix="$" value={adjustment}  onChange={setAdjustment}  helpText="Fixed add after rate" autoComplete="off" />
                  <Select label="Currency" options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
                  <TextField label="Exchange Rate" type="number" prefix="×" value={exchangeRate} onChange={setExchangeRate} helpText="Applied to subtotal" autoComplete="off" />
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">Total Landed</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">${totalLandedCost.toFixed(2)}</Text>
                  </InlineStack>
                  {totalQty > 0 && (
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" tone="subdued">Avg landed / unit</Text>
                      <Text as="span" variant="bodySm">${(totalLandedCost / totalQty).toFixed(3)}</Text>
                    </InlineStack>
                  )}
                  <Divider />
                  <TextField label="Notes" value={notes} onChange={setNotes} multiline={3} placeholder="Internal notes…" autoComplete="off" />
                  <BlockStack gap="200">
                    <Button variant="primary" fullWidth onClick={() => handleSave("open")}>Save as Open</Button>
                    <Button fullWidth onClick={() => handleSave("draft")}>Save as Draft</Button>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </div>

        </div>
      </BlockStack>
    </Page>
  );
}
