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
import { TitleBar } from "@shopify/app-bridge-react";

import type { LineItem } from "../components/LineItemsTable";
import { LineItemsTable } from "../components/LineItemsTable";
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

export default function NewOffer() {
  const { suppliers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [eta, setEta] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  // Reuse LineItem type — qtyOrdered maps to qtyReserved on submit
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", supplierSku: "", qtyOrdered: "1", unitCost: "0" },
  ]);

  const supplierOptions = suppliers.length
    ? suppliers.map((s) => ({ label: s.name, value: s.id }))
    : [{ label: "No suppliers yet — add one first", value: "" }];

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", supplierSku: "", qtyOrdered: "1", unitCost: "0" },
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: string, field: keyof Omit<LineItem, "id">, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  const totalEstimated = items.reduce((sum, item) => {
    return sum + (parseFloat(item.qtyOrdered) || 0) * (parseFloat(item.unitCost) || 0);
  }, 0);

  function handleSave(status: "draft" | "reserved") {
    const serializedItems = items.map((item) => ({
      description: item.description,
      supplierSku: item.supplierSku,
      qtyReserved: parseInt(item.qtyOrdered) || 0,
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
                  <LineItemsTable
                    items={items}
                    onChange={updateItem}
                    onRemove={removeItem}
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
                    {items.reduce((s, i) => s + (parseInt(i.qtyOrdered) || 0), 0)}
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
