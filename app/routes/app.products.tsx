import { useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  Thumbnail,
  EmptyState,
  InlineStack,
  BlockStack,
  Button,
  Banner,
  Box,
  Popover,
  ChoiceList,
  Badge,
  Checkbox,
  TextField,
  Modal,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { ImageIcon } from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import { deleteProducts, getProducts } from "../models/product.server";
import { syncShopifyProducts } from "../models/shopify-product-sync.server";
import { getSettings } from "../models/settings.server";
import { usePersistedColumns } from "../hooks/usePersistedColumns";

type ColKey =
  | "image"
  | "product"
  | "sku"
  | "barcode"
  | "supplierSku"
  | "stock"
  | "ordered"
  | "available"
  | "cost"
  | "lastUsedCost"
  | "mappingState";

const ALL_COLS: { key: ColKey; label: string; defaultVisible: boolean; align: "left" | "right" | "center"; width: number }[] = [
  { key: "image", label: "", defaultVisible: true, align: "center", width: 52 },
  { key: "product", label: "Product", defaultVisible: true, align: "left", width: 280 },
  { key: "sku", label: "SKU", defaultVisible: true, align: "left", width: 130 },
  { key: "barcode", label: "Barcode", defaultVisible: true, align: "left", width: 140 },
  { key: "supplierSku", label: "Supplier Code / SKU", defaultVisible: true, align: "left", width: 180 },
  { key: "stock", label: "Stock", defaultVisible: true, align: "right", width: 80 },
  { key: "ordered", label: "On Order", defaultVisible: true, align: "right", width: 92 },
  { key: "available", label: "Available", defaultVisible: true, align: "right", width: 92 },
  { key: "cost", label: "Cost", defaultVisible: true, align: "right", width: 100 },
  { key: "lastUsedCost", label: "Last Used Cost", defaultVisible: true, align: "right", width: 120 },
  { key: "mappingState", label: "Mapping", defaultVisible: true, align: "center", width: 110 },
];

const DEFAULT_VISIBLE = ALL_COLS.filter((col) => col.defaultVisible).map((col) => col.key);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [products, settings] = await Promise.all([
    getProducts(session.shop),
    getSettings(session.shop),
  ]);
  return { products, shop: session.shop, uiPreferences: settings.uiPreferences };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "deleteProducts") {
    const ids = formData.getAll("ids").map(String).filter(Boolean);
    const result = await deleteProducts(session.shop, ids);
    return json({ ok: true, deleted: result.count });
  }

  if (intent !== "syncShopifyProducts") return json({ ok: true });

  try {
    const { synced } = await syncShopifyProducts(admin, session.shop);
    return json({ ok: true, synced });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shopify sync failed.";
    return json({ ok: false, error: message }, { status: 500 });
  }
};

export default function Products() {
  const { products, shop, uiPreferences } = useLoaderData<typeof loader>();
  const syncFetcher = useFetcher<typeof action>();
  const deleteFetcher = useFetcher<typeof action>();
  const [colPopoverOpen, setColPopoverOpen] = useState(false);
  const [visibleColKeys, setVisibleColKeys] = usePersistedColumns<ColKey>(
    shop,
    "productColumns",
    DEFAULT_VISIBLE,
    uiPreferences.productColumns as ColKey[] | undefined,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const isSyncing = syncFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.title.toLowerCase().includes(q)
      || (p.sku ?? "").toLowerCase().includes(q)
      || (p.barcode ?? "").toLowerCase().includes(q)
      || p.supplierMappings.some((m) =>
        m.supplierSku.toLowerCase().includes(q) || m.supplier.name.toLowerCase().includes(q),
      ),
    );
  }, [products, search]);

  const activeCols = useMemo(
    () => ALL_COLS.filter((col) => visibleColKeys.includes(col.key)),
    [visibleColKeys],
  );

  const CHECKBOX_W = 48;
  const ACTION_W = 88;
  const totalDataWidth = activeCols.reduce((s, c) => s + c.width, 0);
  const totalTableWidth = CHECKBOX_W + totalDataWidth + ACTION_W;
  const tableMinWidth = totalTableWidth;

  function weightedPct(width: number) {
    return `${(width / totalTableWidth) * 100}%`;
  }
  const selectedCount = selectedIds.size;
  const allSelected = filteredProducts.length > 0 && selectedCount === filteredProducts.length;
  const someSelected = selectedCount > 0 && !allSelected;

  function triggerSync() {
    syncFetcher.submit({ intent: "syncShopifyProducts" }, { method: "post" });
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filteredProducts.map((p) => p.id)));
  }

  function requestDelete(ids: string[]) {
    if (!ids.length) return;
    setPendingDeleteIds(ids);
    setDeleteModalOpen(true);
  }

  function confirmDelete() {
    const ids = pendingDeleteIds;
    if (!ids.length) return;
    const fd = new FormData();
    fd.set("intent", "deleteProducts");
    ids.forEach((id) => fd.append("ids", id));
    deleteFetcher.submit(fd, { method: "post" });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setDeleteModalOpen(false);
    setPendingDeleteIds([]);
  }

  const emptyStateMarkup = (
    <EmptyState
      heading="No products synced yet"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <Text as="p" variant="bodyMd">
        Use <strong>Sync from Shopify</strong> in the top-right to import products and track SKUs,
        average cost, landed cost, and stock levels alongside your purchase orders.
      </Text>
    </EmptyState>
  );

  const thStyle: React.CSSProperties = {
    padding: "10px 16px",
    background: "#fafbfb",
    borderBottom: "1px solid #e1e3e5",
    color: "#6d7175",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 16px",
    borderBottom: "1px solid #f1f2f3",
    verticalAlign: "middle",
    fontSize: 13,
  };

  function cell(key: ColKey, content: React.ReactNode) {
    if (!visibleColKeys.includes(key)) return null;
    const col = ALL_COLS.find((candidate) => candidate.key === key)!;
    return <td key={key} style={{ ...tdStyle, textAlign: col.align }}>{content}</td>;
  }

  return (
    <Page fullWidth>
      <TitleBar title="Products">
        <button type="button" variant="primary" disabled={isSyncing} onClick={triggerSync}>
          {isSyncing ? "Syncing…" : "Sync from Shopify"}
        </button>
      </TitleBar>
      <style>{`
        .products-page {
          max-width: 100%;
          min-width: 0;
        }
        .products-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .products-toolbar-search {
          flex: 1 1 200px;
          min-width: 0;
          max-width: 360px;
        }
        .products-toolbar-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
      `}</style>
      <div className="products-page">
      <BlockStack gap="400">
        {syncFetcher.data && !syncFetcher.data.ok && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">{"error" in syncFetcher.data ? String(syncFetcher.data.error) : "Shopify sync failed."}</Text>
          </Banner>
        )}
        {syncFetcher.data?.ok && "synced" in syncFetcher.data && (
          <Banner tone="success">
            <Text as="p" variant="bodyMd">Synced {String(syncFetcher.data.synced)} Shopify variant{syncFetcher.data.synced === 1 ? "" : "s"}.</Text>
          </Banner>
        )}
        {deleteFetcher.data?.ok && "deleted" in deleteFetcher.data && Number(deleteFetcher.data.deleted) > 0 && (
          <Banner tone="success">
            <Text as="p" variant="bodyMd">
              Removed {String(deleteFetcher.data.deleted)} product{Number(deleteFetcher.data.deleted) === 1 ? "" : "s"} from ShelfFlow.
            </Text>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h1" variant="headingLg">Products</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {filteredProducts.length} of {products.length} product{products.length === 1 ? "" : "s"} shown.
                Delete removes ShelfFlow records only — Shopify products are not affected.
              </Text>
            </BlockStack>
            <div className="products-toolbar">
              <div className="products-toolbar-search">
                <TextField
                  label="" labelHidden
                  placeholder="Search by title, SKU, barcode, supplier code…"
                  value={search}
                  onChange={setSearch}
                  clearButton
                  onClearButtonClick={() => setSearch("")}
                  autoComplete="off"
                />
              </div>
              <div className="products-toolbar-actions">
                {selectedCount > 0 && (
                  <>
                    <Text as="span" variant="bodySm" tone="subdued">{selectedCount} selected</Text>
                    <Button
                      tone="critical"
                      loading={isDeleting}
                      onClick={() => requestDelete([...selectedIds])}
                    >
                      Delete selected
                    </Button>
                  </>
                )}
                <Popover
                  active={colPopoverOpen}
                  activator={
                    <Button onClick={() => setColPopoverOpen((open) => !open)}>
                      {`Columns (${visibleColKeys.length})`}
                    </Button>
                  }
                  onClose={() => setColPopoverOpen(false)}
                  preferredAlignment="right"
                >
                  <Box padding="400">
                    <ChoiceList
                      title="Product columns"
                      allowMultiple
                      choices={ALL_COLS.filter((col) => col.key !== "product").map((col) => ({
                        label: col.label || "Image",
                        value: col.key,
                      }))}
                      selected={visibleColKeys.filter((key) => key !== "product")}
                      onChange={(selected) => setVisibleColKeys(["product", ...(selected as ColKey[])])}
                    />
                  </Box>
                </Popover>
              </div>
            </div>
          </BlockStack>
        </Card>

        {products.length === 0 ? (
          <Card>{emptyStateMarkup}</Card>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <Box padding="800">
              <Text as="p" alignment="center" tone="subdued">No products match your search.</Text>
            </Box>
          </Card>
        ) : (
          <Card padding="0">
            <div style={{ overflowX: "auto", width: "100%", maxWidth: "100%" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: tableMinWidth, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: weightedPct(CHECKBOX_W) }} />
                  {activeCols.map((col) => <col key={col.key} style={{ width: weightedPct(col.width) }} />)}
                  <col style={{ width: weightedPct(ACTION_W) }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "center", paddingLeft: 16 }}>
                      <Checkbox
                        label="" labelHidden
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onChange={toggleAll}
                      />
                    </th>
                    {activeCols.map((col) => (
                      <th key={col.key} style={{ ...thStyle, textAlign: col.align }}>
                        {col.label}
                      </th>
                    ))}
                    <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const isSelected = selectedIds.has(product.id);
                    const mappings = product.supplierMappings;
                    const primaryMapping = mappings[0];
                    const supplierSkuLabel = mappings.length
                      ? mappings.map((mapping) => `${mapping.supplier.name}: ${mapping.supplierSku}`).join(", ")
                      : "—";
                    const outstanding = product.poLineItems.reduce(
                      (sum, line) => sum + Math.max(0, line.qtyOrdered - line.qtyReceived - line.qtyRejected),
                      0,
                    );
                    const reserved = product.offerItems.reduce(
                      (sum, item) => sum + Math.max(0, item.qtyReserved - item.qtyFulfilled),
                      0,
                    );
                    const available = Math.max(0, product.currentQuantity - reserved);
                    const image = product.imageUrl || ImageIcon;

                    return (
                      <tr
                        key={product.id}
                        style={{ background: isSelected ? "#f3f7ff" : undefined }}
                      >
                        <td style={{ ...tdStyle, paddingLeft: 16 }}>
                          <Checkbox
                            label="" labelHidden
                            checked={isSelected}
                            onChange={() => toggleRow(product.id)}
                          />
                        </td>
                        {cell("image", <Thumbnail source={image} alt={product.title} size="small" />)}
                        {cell("product", (
                          <InlineStack gap="300" blockAlign="center" wrap>
                            {!visibleColKeys.includes("image") && <Thumbnail source={image} alt={product.title} size="small" />}
                            <BlockStack gap="050">
                              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                <Text as="span" variant="bodyMd" fontWeight="semibold">{product.title}</Text>
                              </span>
                              <Text as="span" variant="bodySm" tone="subdued">Variant {product.shopifyVariantId}</Text>
                            </BlockStack>
                          </InlineStack>
                        ))}
                        {cell("sku", product.sku || "—")}
                        {cell("barcode", product.barcode || "—")}
                        {cell("supplierSku", (
                          <span title={supplierSkuLabel} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {supplierSkuLabel}
                          </span>
                        ))}
                        {cell("stock", String(product.currentQuantity))}
                        {cell("ordered", String(outstanding))}
                        {cell("available", String(available))}
                        {cell("cost", (
                          <BlockStack gap="050">
                            <Text as="span" variant="bodySm">${product.avgCost.toFixed(2)}</Text>
                            <Text as="span" variant="bodySm" tone="subdued">Landed ${product.avgLandedCost.toFixed(2)}</Text>
                          </BlockStack>
                        ))}
                        {cell("lastUsedCost", primaryMapping?.lastUsedCost != null ? `$${primaryMapping.lastUsedCost.toFixed(2)}` : "—")}
                        {cell("mappingState", (
                          <Badge tone={mappings.length > 0 ? "success" : "warning"}>
                            {mappings.length > 0 ? `${mappings.length} mapped` : "Unmapped"}
                          </Badge>
                        ))}
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <Button
                            size="slim"
                            tone="critical"
                            variant="plain"
                            loading={isDeleting}
                            onClick={() => requestDelete([product.id])}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </BlockStack>
      </div>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Remove products from ShelfFlow?"
        primaryAction={{
          content: "Delete",
          destructive: true,
          loading: isDeleting,
          onAction: confirmDelete,
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => setDeleteModalOpen(false) }]}
      >
        <Modal.Section>
          <Text as="p">
            This will remove {pendingDeleteIds.length} product record{pendingDeleteIds.length === 1 ? "" : "s"} from ShelfFlow.
            Shopify products are not deleted. PO and offer line links will be cleared.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
