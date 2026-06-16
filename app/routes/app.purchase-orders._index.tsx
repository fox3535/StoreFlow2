import { useState, useMemo } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  Badge,
  EmptyState,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Box,
  Divider,
  Popover,
  ChoiceList,
  Tabs,
  Checkbox,
  Tooltip,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getPurchaseOrders, updatePurchaseOrderStatus } from "../models/purchase-order.server";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------
const STATUS_META: Record<
  string,
  { tone: "info" | "warning" | "success" | "critical" | "attention" | undefined; label: string }
> = {
  draft:              { tone: undefined,     label: "Draft" },
  open:               { tone: "info",        label: "Open" },
  in_transit:         { tone: "attention",   label: "In Transit" },
  partially_received: { tone: "warning",     label: "Partial" },
  received:           { tone: "success",     label: "Received" },
  cancelled:          { tone: "critical",    label: "Cancelled" },
};

type POColKey =
  | "poNumber" | "supplier" | "invoiceNumber" | "status" | "items"
  | "created"  | "expected" | "currency"      | "subtotal" | "landedCost"
  | "progress";

type ColDef = { key: POColKey; label: string; defaultVisible: boolean; numeric?: boolean };

const ALL_PO_COLS: ColDef[] = [
  { key: "poNumber",      label: "PO #",           defaultVisible: true  },
  { key: "supplier",      label: "Supplier",        defaultVisible: true  },
  { key: "status",        label: "Status",          defaultVisible: true  },
  { key: "invoiceNumber", label: "Invoice #",       defaultVisible: false },
  { key: "items",         label: "Items",           defaultVisible: true,  numeric: true },
  { key: "created",       label: "Created",         defaultVisible: true  },
  { key: "expected",      label: "Expected",        defaultVisible: true  },
  { key: "currency",      label: "Currency",        defaultVisible: false },
  { key: "subtotal",      label: "Subtotal",        defaultVisible: false, numeric: true },
  { key: "landedCost",    label: "Landed Cost",     defaultVisible: true,  numeric: true },
  { key: "progress",      label: "Progress",        defaultVisible: true  },
];

const ALWAYS_VISIBLE: POColKey[] = ["poNumber", "supplier", "status"];

const DEFAULT_VISIBLE = new Set<POColKey>(
  ALL_PO_COLS.filter((c) => c.defaultVisible).map((c) => c.key),
);

const TABS = [
  { id: "all",      content: "All",          status: null },
  { id: "draft",    content: "Draft",        status: "draft" },
  { id: "open",     content: "Open",         status: "open" },
  { id: "transit",  content: "In Transit",   status: "in_transit" },
  { id: "partial",  content: "Partial",      status: "partially_received" },
  { id: "received", content: "Received",     status: "received" },
  { id: "archived", content: "Cancelled",    status: "cancelled" },
];

function fmt(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const pos = await getPurchaseOrders(session.shop);
  return json({ pos });
};

// ---------------------------------------------------------------------------
// Action (bulk archive / status change)
// ---------------------------------------------------------------------------
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "bulkArchive") {
    const ids = (formData.get("ids") as string).split(",").filter(Boolean);
    await Promise.all(
      ids.map((id) => updatePurchaseOrderStatus(session.shop, id, "cancelled")),
    );
    return json({ ok: true });
  }

  return json({ ok: false });
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatCard({
  label, value, sub, tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "success" | "warning" | "critical" | "info";
}) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
        <Text as="p" variant="headingXl" fontWeight="bold">{String(value)}</Text>
        {sub && <Text as="p" variant="bodySm" tone="subdued">{sub}</Text>}
        {tone && (
          <Badge tone={tone}>
            {tone === "warning" ? "Needs attention" : tone === "critical" ? "Action required" : tone === "success" ? "On track" : "Active"}
          </Badge>
        )}
      </BlockStack>
    </Card>
  );
}

function ProgressBar({ received, ordered }: { received: number; ordered: number }) {
  if (ordered === 0) return <Text as="span" variant="bodySm" tone="subdued">—</Text>;
  const pct = Math.min(100, Math.round((received / ordered) * 100));
  const color = pct === 100 ? "#008060" : pct > 0 ? "#ffd79d" : "#e4e5e7";
  return (
    <InlineStack gap="200" blockAlign="center">
      <div style={{ width: 64, height: 6, borderRadius: 3, background: "#e4e5e7", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#008060" : "#ffc453", borderRadius: 3 }} />
      </div>
      <Text as="span" variant="bodySm" tone="subdued">{received}/{ordered}</Text>
    </InlineStack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function PurchaseOrdersIndex() {
  const { pos } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit   = useSubmit();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tabIndex,       setTabIndex]       = useState(0);
  const [search,         setSearch]         = useState("");
  const [colPopover,     setColPopover]     = useState(false);
  const [visibleCols,    setVisibleCols]    = useState<Set<POColKey>>(DEFAULT_VISIBLE);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [sortKey,        setSortKey]        = useState<POColKey>("created");
  const [sortDir,        setSortDir]        = useState<"asc" | "desc">("desc");

  // ── Derived: enrich each PO with progress totals ─────────────────────────
  const enriched = useMemo(() => pos.map((po) => ({
    ...po,
    totalOrdered:  po.lineItems.reduce((s, l) => s + l.qtyOrdered,  0),
    totalReceived: po.lineItems.reduce((s, l) => s + l.qtyReceived, 0),
  })), [pos]);

  // ── Summary card numbers ──────────────────────────────────────────────────
  const activeCount   = enriched.filter((p) => ["open", "in_transit"].includes(p.status)).length;
  const pendingCount  = enriched.filter(
    (p) => ["open", "in_transit", "partially_received"].includes(p.status) &&
           p.totalOrdered - p.totalReceived > 0,
  ).length;
  const totalValue    = enriched.reduce((s, p) => s + p.totalLandedCost, 0);

  // ── Tab counts ────────────────────────────────────────────────────────────
  const tabCounts = TABS.map(({ status }) =>
    status ? enriched.filter((p) => p.status === status).length : enriched.length,
  );

  // ── Filter & sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const tabStatus = TABS[tabIndex]?.status;
    let list = tabStatus ? enriched.filter((p) => p.status === tabStatus) : enriched;

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.poNumber.toLowerCase().includes(q) ||
          p.supplier.name.toLowerCase().includes(q) ||
          (p.invoiceNumber ?? "").toLowerCase().includes(q),
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "poNumber":    return dir * a.poNumber.localeCompare(b.poNumber);
        case "supplier":    return dir * a.supplier.name.localeCompare(b.supplier.name);
        case "landedCost":  return dir * (a.totalLandedCost - b.totalLandedCost);
        case "subtotal":    return dir * (a.subtotal - b.subtotal);
        case "items":       return dir * (a._count.lineItems - b._count.lineItems);
        case "progress":    return dir * (a.totalReceived / (a.totalOrdered || 1) - b.totalReceived / (b.totalOrdered || 1));
        case "expected": {
          const da = a.expectedDate ? new Date(a.expectedDate).getTime() : 0;
          const db = b.expectedDate ? new Date(b.expectedDate).getTime() : 0;
          return dir * (da - db);
        }
        default: // created
          return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    });

    return list;
  }, [enriched, tabIndex, search, sortKey, sortDir]);

  // ── Column toggle ─────────────────────────────────────────────────────────
  const toggleChoices = ALL_PO_COLS
    .filter((c) => !ALWAYS_VISIBLE.includes(c.key))
    .map((c) => ({ label: c.label, value: c.key }));

  const toggleableSelected = Array.from(visibleCols).filter(
    (k) => !ALWAYS_VISIBLE.includes(k),
  );

  function handleColChange(selected: string[]) {
    setVisibleCols(new Set([...ALWAYS_VISIBLE, ...(selected as POColKey[])]));
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  function handleSort(key: POColKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortIndicator = (key: POColKey) => {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const someSelected = !allSelected && filtered.some((p) => selectedIds.has(p.id));

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p) => p.id)));
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Bulk archive ──────────────────────────────────────────────────────────
  function handleBulkArchive() {
    const ids = Array.from(selectedIds).join(",");
    const fd = new FormData();
    fd.append("intent", "bulkArchive");
    fd.append("ids", ids);
    submit(fd, { method: "post" });
    setSelectedIds(new Set());
  }

  // ── Table header cell ────────────────────────────────────────────────────
  const th: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#6d7175",
    borderBottom: "1px solid #e1e3e5",
    whiteSpace: "nowrap",
    userSelect: "none",
    cursor: "pointer",
    background: "#fafbfb",
  };
  const thStatic: React.CSSProperties = { ...th, cursor: "default" };
  const td: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f2f3",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };

  const tabItems = TABS.map((t, i) => ({
    id: t.id,
    content: tabCounts[i] > 0 ? `${t.content} (${tabCounts[i]})` : t.content,
    panelID: `panel-${t.id}`,
  }));

  const selectedCount = selectedIds.size;

  return (
    <Page fullWidth>
      <TitleBar title="Purchase Orders">
        <button variant="primary" onClick={() => navigate("/app/purchase-orders/new")}>
          Create PO
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <StatCard label="Total POs"          value={enriched.length} />
          <StatCard label="Active Orders"      value={activeCount}   tone={activeCount > 0 ? "info" : undefined} />
          <StatCard label="Pending Receipts"   value={pendingCount}  tone={pendingCount > 0 ? "warning" : undefined} sub={pendingCount > 0 ? "Awaiting stock" : undefined} />
          <StatCard label="Total Landed Value" value={`$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        </div>

        {/* ── Table card ────────────────────────────────────────────────── */}
        <Card padding="0">
          {/* Tabs */}
          <Tabs tabs={tabItems} selected={tabIndex} onSelect={setTabIndex} />
          <Divider />

          {/* Toolbar */}
          <Box paddingBlock="300" paddingInline="400">
            <InlineStack align="space-between" blockAlign="center" gap="300">
              <div style={{ flex: 1, maxWidth: 360 }}>
                <TextField
                  label="" labelHidden
                  placeholder="Search by PO #, supplier, or invoice…"
                  value={search}
                  onChange={setSearch}
                  clearButton
                  onClearButtonClick={() => setSearch("")}
                  autoComplete="off"
                />
              </div>

              <InlineStack gap="200" blockAlign="center">
                {selectedCount > 0 && (
                  <>
                    <Text as="span" variant="bodySm" tone="subdued">{selectedCount} selected</Text>
                    <Button size="slim" tone="critical" onClick={handleBulkArchive}>
                      Archive selected
                    </Button>
                  </>
                )}

                <Popover
                  active={colPopover}
                  activator={
                    <Button size="slim" onClick={() => setColPopover((v) => !v)}>
                      {`Columns (${visibleCols.size})`}
                    </Button>
                  }
                  onClose={() => setColPopover(false)}
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

                <Button variant="primary" size="slim" onClick={() => navigate("/app/purchase-orders/new")}>
                  Create PO
                </Button>
              </InlineStack>
            </InlineStack>
          </Box>

          {/* Table */}
          {filtered.length === 0 ? (
            <Box paddingBlock="1600">
              <EmptyState
                heading={search ? "No results match your search" : "No purchase orders yet"}
                action={!search ? { content: "Create PO", onAction: () => navigate("/app/purchase-orders/new") } : undefined}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <Text as="p" variant="bodyMd">
                  {search
                    ? "Try a different search term or clear the filter."
                    : "Track incoming inventory, costs, and received progress."}
                </Text>
              </EmptyState>
            </Box>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStatic, width: 40, paddingLeft: 16 }}>
                      <Checkbox
                        label="" labelHidden
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onChange={toggleAll}
                      />
                    </th>

                    {visibleCols.has("poNumber") && (
                      <th style={th} onClick={() => handleSort("poNumber")}>
                        PO #{sortIndicator("poNumber")}
                      </th>
                    )}
                    {visibleCols.has("supplier") && (
                      <th style={th} onClick={() => handleSort("supplier")}>
                        Supplier{sortIndicator("supplier")}
                      </th>
                    )}
                    {visibleCols.has("invoiceNumber") && (
                      <th style={th}>Invoice #</th>
                    )}
                    {visibleCols.has("status") && (
                      <th style={thStatic}>Status</th>
                    )}
                    {visibleCols.has("items") && (
                      <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("items")}>
                        Items{sortIndicator("items")}
                      </th>
                    )}
                    {visibleCols.has("created") && (
                      <th style={th} onClick={() => handleSort("created")}>
                        Created{sortIndicator("created")}
                      </th>
                    )}
                    {visibleCols.has("expected") && (
                      <th style={th} onClick={() => handleSort("expected")}>
                        Expected{sortIndicator("expected")}
                      </th>
                    )}
                    {visibleCols.has("currency") && (
                      <th style={thStatic}>Currency</th>
                    )}
                    {visibleCols.has("subtotal") && (
                      <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("subtotal")}>
                        Subtotal{sortIndicator("subtotal")}
                      </th>
                    )}
                    {visibleCols.has("landedCost") && (
                      <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("landedCost")}>
                        Landed Cost{sortIndicator("landedCost")}
                      </th>
                    )}
                    {visibleCols.has("progress") && (
                      <th style={{ ...th, minWidth: 140 }} onClick={() => handleSort("progress")}>
                        Received{sortIndicator("progress")}
                      </th>
                    )}
                    <th style={{ ...thStatic, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((po) => {
                    const isSelected = selectedIds.has(po.id);
                    const meta = STATUS_META[po.status] ?? { tone: undefined, label: po.status };
                    const needsReceipt =
                      ["open", "in_transit", "partially_received"].includes(po.status) &&
                      po.totalOrdered - po.totalReceived > 0;

                    return (
                      <tr
                        key={po.id}
                        style={{
                          background: isSelected ? "#f3f7ff" : undefined,
                          cursor: "pointer",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "#f6f6f7";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = isSelected ? "#f3f7ff" : "";
                        }}
                      >
                        <td style={{ ...td, paddingLeft: 16, width: 40 }} onClick={(e) => e.stopPropagation()}>
                          <Checkbox label="" labelHidden checked={isSelected} onChange={() => toggleRow(po.id)} />
                        </td>

                        {visibleCols.has("poNumber") && (
                          <td style={td} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            <Text as="span" variant="bodyMd" fontWeight="semibold">{po.poNumber}</Text>
                          </td>
                        )}
                        {visibleCols.has("supplier") && (
                          <td style={td} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            {po.supplier.name}
                          </td>
                        )}
                        {visibleCols.has("invoiceNumber") && (
                          <td style={td} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            {po.invoiceNumber ?? <span style={{ color: "#8c9196" }}>—</span>}
                          </td>
                        )}
                        {visibleCols.has("status") && (
                          <td style={td} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </td>
                        )}
                        {visibleCols.has("items") && (
                          <td style={{ ...td, textAlign: "right" }} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            {po._count.lineItems}
                          </td>
                        )}
                        {visibleCols.has("created") && (
                          <td style={td} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            {fmt(po.createdAt)}
                          </td>
                        )}
                        {visibleCols.has("expected") && (
                          <td style={td} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            {po.expectedDate
                              ? <Text as="span" variant="bodyMd">{fmt(po.expectedDate)}</Text>
                              : <span style={{ color: "#8c9196" }}>—</span>}
                          </td>
                        )}
                        {visibleCols.has("currency") && (
                          <td style={td} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            {po.currency}
                          </td>
                        )}
                        {visibleCols.has("subtotal") && (
                          <td style={{ ...td, textAlign: "right" }} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            ${po.subtotal.toFixed(2)}
                          </td>
                        )}
                        {visibleCols.has("landedCost") && (
                          <td style={{ ...td, textAlign: "right", fontWeight: 600 }} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            ${po.totalLandedCost.toFixed(2)}
                          </td>
                        )}
                        {visibleCols.has("progress") && (
                          <td style={td} onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                            <ProgressBar received={po.totalReceived} ordered={po.totalOrdered} />
                          </td>
                        )}
                        <td style={{ ...td, textAlign: "right" }}>
                          {needsReceipt ? (
                            <Tooltip content="Receive stock for this PO">
                              <Button
                                size="slim"
                                variant="plain"
                                onClick={() => navigate(`/app/purchase-orders/${po.id}/receiving`)}
                              >
                                Receive
                              </Button>
                            </Tooltip>
                          ) : (
                            <Button
                              size="slim"
                              variant="plain"
                              onClick={() => navigate(`/app/purchase-orders/${po.id}`)}
                            >
                              View
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer count */}
          {filtered.length > 0 && (
            <Box paddingBlock="300" paddingInline="400">
              <Text as="p" variant="bodySm" tone="subdued">
                {filtered.length} {filtered.length === 1 ? "purchase order" : "purchase orders"}
                {search ? ` matching "${search}"` : ""}
              </Text>
            </Box>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
