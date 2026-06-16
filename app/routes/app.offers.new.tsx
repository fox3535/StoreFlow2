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
import { createOffer } from "../models/offer.server";
import type { PickedProduct } from "../components/ProductPickerButton";
import { ProductPickerButton } from "../components/ProductPickerButton";
import type { EditItem, ColKey } from "../components/POSpreadsheet";
import { ALL_COLS, DEFAULT_VISIBLE, POSpreadsheet } from "../components/POSpreadsheet";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const suppliers = await getSuppliers(session.shop);
  return { suppliers };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const supplierId = formData.get("supplierId") as string;
  const eta        = (formData.get("eta")      as string) || null;
  const endDate    = (formData.get("endDate")   as string) || null;
  const notes      = (formData.get("notes")     as string) || null;
  const status     = (formData.get("status")    as string) || "draft";
  const itemsJson  = formData.get("itemsJson")  as string;

  const errors: Record<string, string> = {};
  if (!supplierId) errors.supplierId = "Supplier is required.";

  let items: { description: string; supplierSku?: string; qtyReserved: number; unitCost: number; productId?: string | null }[] = [];
  try {
    items = JSON.parse(itemsJson || "[]");
  } catch {
    errors.items = "Invalid items.";
  }

  if (items.length === 0) errors.items = "Add at least one item.";
  for (const item of items) {
    if (!item.description?.trim()) { errors.items = "Each item needs a description."; break; }
    if (item.qtyReserved <= 0)     { errors.items = "Quantity must be greater than 0."; break; }
  }

  if (Object.keys(errors).length > 0) return { errors };

  await createOffer(session.shop, { supplierId, status, eta, endDate, notes, items });
  return redirect("/app/offers");
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const toNum = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

function newRow(): EditItem {
  return {
    id: crypto.randomUUID(),
    description: "", supplierSku: "",
    qtyOrdered: "1", unitCost: "0",
    qtyReceived: 0, qtyRejected: 0,
    product: null,
  };
}

export default function NewOffer() {
  const { suppliers } = useLoaderData<typeof loader>();
  const actionData    = useActionData<typeof action>();
  const navigate      = useNavigate();
  const submit        = useSubmit();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [eta,        setEta]        = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [notes,      setNotes]      = useState("");

  // ── Line items ────────────────────────────────────────────────────────────
  const [items, setItems] = useState<EditItem[]>([newRow()]);

  // ── Column visibility ─────────────────────────────────────────────────────
  const [colPopoverOpen, setColPopoverOpen] = useState(false);
  const [visibleColKeys, setVisibleColKeys] = useState<ColKey[]>(
    () => Array.from(DEFAULT_VISIBLE) as ColKey[],
  );

  const supplierOptions = suppliers.length
    ? suppliers.map((s) => ({ label: s.name, value: s.id }))
    : [{ label: "No suppliers yet — add one first", value: "" }];

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalQty       = items.reduce((s, i) => s + toNum(i.qtyOrdered), 0);
  const totalEstimated = items.reduce((s, i) => s + toNum(i.qtyOrdered) * toNum(i.unitCost), 0);
  const visibleCols    = new Set(visibleColKeys);

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
        id:                crypto.randomUUID(),
        description:       picked.title,
        supplierSku:       picked.supplierSku ?? "",
        qtyOrdered:        "1",
        unitCost:          picked.suggestedUnitCost != null ? String(picked.suggestedUnitCost) : "0",
        qtyReceived:       0,
        qtyRejected:       0,
        product:           null,
        pickedImageUrl:    picked.imageUrl,
        pickedTitle:       picked.title,
        pickedSku:         picked.sku,
        pickedBarcode:     picked.barcode,
        pickedRetailPrice: picked.retailPrice,
        pendingProductId:  picked.productId,
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

  function handleSave(status: "draft" | "reserved") {
    const serializedItems = items.map((i) => ({
      description: i.description,
      supplierSku: i.supplierSku || null,
      qtyReserved: Math.floor(toNum(i.qtyOrdered)),
      unitCost:    toNum(i.unitCost),
      productId:   i.product?.id ?? i.pendingProductId ?? null,
    }));

    const fd = new FormData();
    fd.append("supplierId", supplierId);
    fd.append("eta",        eta);
    fd.append("endDate",    endDate);
    fd.append("notes",      notes);
    fd.append("status",     status);
    fd.append("itemsJson",  JSON.stringify(serializedItems));
    submit(fd, { method: "post" });
  }

  const errors = (actionData as any)?.errors ?? {};

  return (
    <Page fullWidth>
      <style>{`
        .offer-new-outer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 288px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .offer-new-outer  { grid-template-columns: 1fr; }
          .offer-new-panel  { position: static !important; }
        }
      `}</style>

      <TitleBar title="Create Offer / Reserve">
        <button onClick={() => navigate("/app/offers")}>Cancel</button>
        <button variant="primary" onClick={() => handleSave("reserved")}>Save as Reserved</button>
      </TitleBar>

      <BlockStack gap="400">
        {(errors.supplierId || errors.items) && (
          <Banner tone="critical">
            <BlockStack gap="100">
              {errors.supplierId && <Text as="p" variant="bodyMd">{errors.supplierId}</Text>}
              {errors.items      && <Text as="p" variant="bodyMd">{errors.items}</Text>}
            </BlockStack>
          </Banner>
        )}

        {/* Offer details row — spans full width */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Offer Details</Text>
            <Divider />
            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
              <Select label="Supplier" options={supplierOptions} value={supplierId} onChange={setSupplierId} error={errors.supplierId} />
              <TextField label="ETA"      type="date" value={eta}     onChange={setEta}     autoComplete="off" />
              <TextField label="End Date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* Two-column body */}
        <div className="offer-new-outer">

          {/* LEFT — spreadsheet */}
          <div>
            <Card padding="0">
              <Box paddingBlock="300" paddingInline="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Items</Text>
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
              {errors.items && (
                <Box paddingInline="400" paddingBlockStart="200">
                  <Text as="p" variant="bodyMd" tone="critical">{errors.items}</Text>
                </Box>
              )}
              <POSpreadsheet
                items={items}
                visibleCols={visibleCols}
                totalLandedCost={totalEstimated}
                totalQtyOrdered={totalQty}
                onChange={handleChange}
                onRemove={handleRemove}
              />
            </Card>
          </div>

          {/* RIGHT — summary + save */}
          <div className="offer-new-panel" style={{ position: "sticky", top: 16 }}>
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
                  <Text as="span" variant="bodyMd">{totalQty}</Text>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">Est. Total</Text>
                  <Text as="span" variant="headingMd" fontWeight="bold">${totalEstimated.toFixed(2)}</Text>
                </InlineStack>
                <Divider />
                <TextField label="Notes" value={notes} onChange={setNotes} multiline={3} placeholder="Internal notes…" autoComplete="off" />
                <BlockStack gap="200">
                  <Button variant="primary" fullWidth onClick={() => handleSave("reserved")}>Save as Reserved</Button>
                  <Button fullWidth onClick={() => handleSave("draft")}>Save as Draft</Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </div>

        </div>
      </BlockStack>
    </Page>
  );
}
