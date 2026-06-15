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
  DataTable,
  Box,
  InlineGrid,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getSuppliers } from "../models/supplier.server";
import { createOffer } from "../models/offer.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const suppliers = await getSuppliers(session.shop);
  return { suppliers };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const supplierId = formData.get("supplierId") as string;
  const eta = (formData.get("eta") as string) || null;
  const endDate = (formData.get("endDate") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const status = (formData.get("status") as string) || "draft";
  const itemsJson = formData.get("itemsJson") as string;

  const errors: Record<string, string> = {};
  if (!supplierId) errors.supplierId = "Supplier is required.";

  let items: { description: string; supplierSku: string; qtyReserved: number; unitCost: number }[] = [];
  try {
    items = JSON.parse(itemsJson || "[]");
  } catch {
    errors.items = "Invalid items.";
  }

  if (items.length === 0) errors.items = "Add at least one item.";
  for (const item of items) {
    if (!item.description?.trim()) { errors.items = "Each item needs a description."; break; }
    if (item.qtyReserved <= 0) { errors.items = "Quantity must be greater than 0."; break; }
  }

  if (Object.keys(errors).length > 0) return { errors };

  await createOffer(session.shop, {
    supplierId,
    status,
    eta,
    endDate,
    notes,
    items,
  });

  return redirect("/app/offers");
};

type OfferItem = {
  id: string;
  description: string;
  supplierSku: string;
  qtyReserved: string;
  unitCost: string;
};

export default function NewOffer() {
  const { suppliers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [eta, setEta] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OfferItem[]>([
    { id: crypto.randomUUID(), description: "", supplierSku: "", qtyReserved: "1", unitCost: "0" },
  ]);

  const supplierOptions = suppliers.length
    ? suppliers.map((s) => ({ label: s.name, value: s.id }))
    : [{ label: "No suppliers yet — add one first", value: "" }];

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", supplierSku: "", qtyReserved: "1", unitCost: "0" },
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: string, field: keyof Omit<OfferItem, "id">, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  const totalEstimated = items.reduce((sum, item) => {
    return sum + (parseFloat(item.qtyReserved) || 0) * (parseFloat(item.unitCost) || 0);
  }, 0);

  function handleSave(status: "draft" | "reserved") {
    const serializedItems = items.map((item) => ({
      description: item.description,
      supplierSku: item.supplierSku,
      qtyReserved: parseInt(item.qtyReserved) || 0,
      unitCost: parseFloat(item.unitCost) || 0,
    }));

    const formData = new FormData();
    formData.append("supplierId", supplierId);
    formData.append("eta", eta);
    formData.append("endDate", endDate);
    formData.append("notes", notes);
    formData.append("status", status);
    formData.append("itemsJson", JSON.stringify(serializedItems));

    submit(formData, { method: "post" });
  }

  const errors = (actionData as any)?.errors ?? {};

  const tableRows = items.map((item) => [
    <TextField
      key={`desc-${item.id}`}
      label=""
      labelHidden
      placeholder="Description / SKU"
      value={item.description}
      onChange={(v) => updateItem(item.id, "description", v)}
      autoComplete="off"
    />,
    <TextField
      key={`ssku-${item.id}`}
      label=""
      labelHidden
      placeholder="Supplier SKU"
      value={item.supplierSku}
      onChange={(v) => updateItem(item.id, "supplierSku", v)}
      autoComplete="off"
    />,
    <TextField
      key={`qty-${item.id}`}
      label=""
      labelHidden
      type="number"
      value={item.qtyReserved}
      min="0"
      onChange={(v) => updateItem(item.id, "qtyReserved", v)}
      autoComplete="off"
    />,
    <TextField
      key={`cost-${item.id}`}
      label=""
      labelHidden
      type="number"
      value={item.unitCost}
      min="0"
      prefix="$"
      onChange={(v) => updateItem(item.id, "unitCost", v)}
      autoComplete="off"
    />,
    <Text key={`total-${item.id}`} as="span" variant="bodyMd">
      ${((parseFloat(item.qtyReserved) || 0) * (parseFloat(item.unitCost) || 0)).toFixed(2)}
    </Text>,
    <Button
      key={`rm-${item.id}`}
      variant="plain"
      tone="critical"
      onClick={() => removeItem(item.id)}
      disabled={items.length === 1}
    >
      Remove
    </Button>,
  ]);

  return (
    <Page>
      <TitleBar title="Create Offer / Reserve">
        <button onClick={() => navigate("/app/offers")}>Cancel</button>
        <button variant="primary" onClick={() => handleSave("reserved")}>
          Save as Reserved
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {errors.supplierId || errors.items ? (
          <Banner tone="critical">
            <BlockStack gap="100">
              {errors.supplierId && <Text as="p" variant="bodyMd">{errors.supplierId}</Text>}
              {errors.items && <Text as="p" variant="bodyMd">{errors.items}</Text>}
            </BlockStack>
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Offer Details</Text>
                  <Divider />
                  <InlineGrid columns={3} gap="400">
                    <Select
                      label="Supplier"
                      options={supplierOptions}
                      value={supplierId}
                      onChange={setSupplierId}
                      error={errors.supplierId}
                    />
                    <TextField
                      label="ETA"
                      type="date"
                      value={eta}
                      onChange={setEta}
                      autoComplete="off"
                    />
                    <TextField
                      label="End Date"
                      type="date"
                      value={endDate}
                      onChange={setEndDate}
                      autoComplete="off"
                    />
                  </InlineGrid>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Items</Text>
                    <Button onClick={addItem}>Add Item</Button>
                  </InlineStack>
                  <Divider />
                  {errors.items && (
                    <Text as="p" variant="bodyMd" tone="critical">{errors.items}</Text>
                  )}
                  <DataTable
                    columnContentTypes={["text", "text", "numeric", "numeric", "numeric", "text"]}
                    headings={["Description / SKU", "Supplier SKU", "Qty Reserved", "Unit Cost", "Total", ""]}
                    rows={tableRows}
                    truncate
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Notes</Text>
                  <Divider />
                  <TextField
                    label=""
                    labelHidden
                    multiline={3}
                    placeholder="Internal notes…"
                    value={notes}
                    onChange={setNotes}
                    autoComplete="off"
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Summary</Text>
                <Divider />

                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd" tone="subdued">Items</Text>
                  <Text as="span" variant="bodyMd">{items.length}</Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd" tone="subdued">Total Qty</Text>
                  <Text as="span" variant="bodyMd">
                    {items.reduce((s, i) => s + (parseInt(i.qtyReserved) || 0), 0)}
                  </Text>
                </InlineStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">Est. Total</Text>
                  <Text as="span" variant="headingMd" fontWeight="bold">
                    ${totalEstimated.toFixed(2)}
                  </Text>
                </InlineStack>

                <Box paddingBlockStart="300">
                  <BlockStack gap="200">
                    <Button variant="primary" fullWidth onClick={() => handleSave("reserved")}>
                      Save as Reserved
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
