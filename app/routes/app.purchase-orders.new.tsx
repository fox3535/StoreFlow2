import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
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
} from "@shopify/polaris";
import type { LineItem } from "../components/LineItemsTable";
import { LineItemsTable } from "../components/LineItemsTable";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getSuppliers } from "../models/supplier.server";
import { createPurchaseOrder } from "../models/purchase-order.server";
import { getSettings } from "../models/settings.server";
import type { PickedProduct } from "../components/ProductPickerButton";
import { ProductPickerButton } from "../components/ProductPickerButton";

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

  const supplierId = formData.get("supplierId") as string;
  const currency = (formData.get("currency") as string) || "USD";
  const exchangeRate = parseFloat((formData.get("exchangeRate") as string) || "1");
  const freightCost = parseFloat((formData.get("freightCost") as string) || "0");
  const tax = parseFloat((formData.get("tax") as string) || "0");
  const discounts = parseFloat((formData.get("discounts") as string) || "0");
  const otherCosts = parseFloat((formData.get("otherCosts") as string) || "0");
  const adjustment = parseFloat((formData.get("adjustment") as string) || "0");
  const notes = (formData.get("notes") as string) || null;
  const status = (formData.get("status") as string) || "draft";
  const lineItemsJson = formData.get("lineItemsJson") as string;

  // Validation
  const errors: Record<string, string> = {};
  if (!supplierId) errors.supplierId = "Supplier is required.";

  let lineItems: { description: string; supplierSku: string; qtyOrdered: number; unitCost: number }[] = [];
  try {
    lineItems = JSON.parse(lineItemsJson || "[]");
  } catch {
    errors.lineItems = "Invalid line items.";
  }

  if (lineItems.length === 0) errors.lineItems = "Add at least one line item.";
  for (const item of lineItems) {
    if (!item.description?.trim()) { errors.lineItems = "Each line item needs a description."; break; }
    if (item.qtyOrdered <= 0) { errors.lineItems = "Quantity must be greater than 0."; break; }
    if (item.unitCost < 0) { errors.lineItems = "Unit cost cannot be negative."; break; }
  }

  if (Object.keys(errors).length > 0) return { errors };

  const po = await createPurchaseOrder(session.shop, {
    supplierId,
    status,
    currency,
    exchangeRate,
    freightCost,
    tax,
    discounts,
    otherCosts,
    adjustment,
    notes,
    lineItems,
  });

  return redirect(`/app/purchase-orders`);
};



// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NewPurchaseOrder() {
  const { suppliers, settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [currency, setCurrency] = useState(settings.defaultCurrency);
  const [exchangeRate, setExchangeRate] = useState("1");
  const [freightCost, setFreightCost] = useState("0");
  const [tax, setTax] = useState("0");
  const [discounts, setDiscounts] = useState("0");
  const [otherCosts, setOtherCosts] = useState("0");
  const [adjustment, setAdjustment] = useState("0");
  const [notes, setNotes] = useState("");
  const defaultAction = settings.receivingDefault;
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", supplierSku: "", qtyOrdered: "1", unitCost: "0" },
  ]);

  const supplierOptions = suppliers.length
    ? suppliers.map((s) => ({ label: s.name, value: s.id }))
    : [{ label: "No suppliers yet — add one first", value: "" }];

  const currencyOptions = [
    { label: "USD", value: "USD" },
    { label: "CAD", value: "CAD" },
    { label: "GBP", value: "GBP" },
    { label: "EUR", value: "EUR" },
    { label: "AUD", value: "AUD" },
    { label: "JPY", value: "JPY" },
  ];

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", supplierSku: "", qtyOrdered: "1", unitCost: "0" },
    ]);
  }

  function handleProductPick(picked: PickedProduct) {
    setLineItems((prev) => [
      ...prev,
      {
        id:               crypto.randomUUID(),
        description:      picked.title,
        supplierSku:      picked.supplierSku ?? "",
        qtyOrdered:       "1",
        unitCost:         picked.suggestedUnitCost != null ? String(picked.suggestedUnitCost) : "0",
        imageUrl:         picked.imageUrl,
        pickedTitle:      picked.title,
        pendingProductId: picked.productId,
      },
    ]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateLineItem(id: string, field: keyof Omit<LineItem, "id">, value: string) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  const subtotal = lineItems.reduce((sum, item) => {
    const qty = parseFloat(item.qtyOrdered) || 0;
    const cost = parseFloat(item.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  const totalLandedCost =
    (subtotal +
      parseFloat(freightCost || "0") +
      parseFloat(tax || "0") +
      parseFloat(otherCosts || "0") -
      parseFloat(discounts || "0")) *
      parseFloat(exchangeRate || "1") +
    parseFloat(adjustment || "0");

  function handleSave(status: "draft" | "open") {
    const serializedItems = lineItems.map((item) => ({
      description: item.description,
      supplierSku: item.supplierSku,
      qtyOrdered:  parseInt(item.qtyOrdered) || 0,
      unitCost:    parseFloat(item.unitCost) || 0,
      productId:   item.pendingProductId ?? null,
    }));

    const formData = new FormData();
    formData.append("supplierId", supplierId);
    formData.append("currency", currency);
    formData.append("exchangeRate", exchangeRate);
    formData.append("freightCost", freightCost);
    formData.append("tax", tax);
    formData.append("discounts", discounts);
    formData.append("otherCosts", otherCosts);
    formData.append("adjustment", adjustment);
    formData.append("notes", notes);
    formData.append("status", status);
    formData.append("lineItemsJson", JSON.stringify(serializedItems));

    submit(formData, { method: "post" });
  }

  const errors = (actionData as any)?.errors ?? {};

  // tableRows replaced by LineItemsTable component for stable focus management

  return (
    <Page>
      <TitleBar title="Create Purchase Order">
        <button onClick={() => navigate("/app/purchase-orders")}>Cancel</button>
        <button variant="primary" onClick={() => handleSave("open")}>
          Save as Open
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {errors.supplierId || errors.lineItems ? (
          <Banner tone="critical">
            <BlockStack gap="100">
              {errors.supplierId && <Text as="p" variant="bodyMd">{errors.supplierId}</Text>}
              {errors.lineItems && <Text as="p" variant="bodyMd">{errors.lineItems}</Text>}
            </BlockStack>
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              {/* Header info */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Order Details</Text>
                  <Divider />
                  <InlineGrid columns={3} gap="400">
                    <Select
                      label="Supplier"
                      options={supplierOptions}
                      value={supplierId}
                      onChange={setSupplierId}
                      error={errors.supplierId}
                    />
                    <Select
                      label="Currency"
                      options={currencyOptions}
                      value={currency}
                      onChange={setCurrency}
                    />
                    <TextField
                      label="Exchange Rate"
                      type="number"
                      value={exchangeRate}
                      onChange={setExchangeRate}
                      helpText="Multiply cost × rate for local currency"
                      autoComplete="off"
                    />
                  </InlineGrid>
                </BlockStack>
              </Card>

              {/* Line items */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Line Items</Text>
                    <InlineStack gap="200">
                      <ProductPickerButton
                        supplierId={supplierId}
                        onPick={handleProductPick}
                        label="Add Product"
                      />
                      <Button size="slim" onClick={addLineItem}>Add Row</Button>
                    </InlineStack>
                  </InlineStack>
                  <Divider />
                  {errors.lineItems && (
                    <Text as="p" variant="bodyMd" tone="critical">{errors.lineItems}</Text>
                  )}
                  <LineItemsTable
                    items={lineItems}
                    onChange={updateLineItem}
                    onRemove={removeLineItem}
                  />
                </BlockStack>
              </Card>

              {/* Notes */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Notes</Text>
                  <Divider />
                  <TextField
                    label=""
                    labelHidden
                    multiline={3}
                    placeholder="Internal notes for this purchase order…"
                    value={notes}
                    onChange={setNotes}
                    autoComplete="off"
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Cost summary sidebar */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Cost Summary</Text>
                <Divider />

                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd" tone="subdued">Subtotal</Text>
                  <Text as="span" variant="bodyMd">${subtotal.toFixed(2)}</Text>
                </InlineStack>

                <TextField
                  label="Freight"
                  type="number"
                  prefix="$"
                  value={freightCost}
                  onChange={setFreightCost}
                  autoComplete="off"
                />
                <TextField
                  label="Tax"
                  type="number"
                  prefix="$"
                  value={tax}
                  onChange={setTax}
                  autoComplete="off"
                />
                <TextField
                  label="Discounts"
                  type="number"
                  prefix="$"
                  value={discounts}
                  onChange={setDiscounts}
                  autoComplete="off"
                />
                <TextField
                  label="Other Costs"
                  type="number"
                  prefix="$"
                  value={otherCosts}
                  onChange={setOtherCosts}
                  autoComplete="off"
                />
                <TextField
                  label="Adjustment"
                  type="number"
                  prefix="$"
                  value={adjustment}
                  onChange={setAdjustment}
                  autoComplete="off"
                />

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    Total Landed Cost
                  </Text>
                  <Text as="span" variant="headingMd" fontWeight="bold">
                    ${totalLandedCost.toFixed(2)}
                  </Text>
                </InlineStack>

                <Box paddingBlockStart="300">
                  <BlockStack gap="200">
                    <Button variant="primary" fullWidth onClick={() => handleSave("open")}>
                      Save as Open
                    </Button>
                    <Button fullWidth onClick={() => handleSave("draft")}>
                      Save as Draft
                    </Button>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
