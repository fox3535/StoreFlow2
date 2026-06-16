import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Button,
  Divider,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ---------------------------------------------------------------------------
// Shared status metadata (matches PO list page)
// ---------------------------------------------------------------------------
const STATUS_META: Record<string, { tone: "info" | "warning" | "success" | "critical" | "attention" | undefined; label: string }> = {
  draft:              { tone: undefined,   label: "Draft" },
  open:               { tone: "info",      label: "Open" },
  in_transit:         { tone: "attention", label: "In Transit" },
  partially_received: { tone: "warning",   label: "Partial" },
  received:           { tone: "success",   label: "Received" },
  cancelled:          { tone: "critical",  label: "Cancelled" },
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [
    openPOs,
    openOffers,
    supplierCount,
    productCount,
    recentPOs,
    candidatePendingReceiptPOs,
  ] = await Promise.all([
    prisma.purchaseOrder.count({ where: { shop, status: { in: ["open", "in_transit"] } } }),
    prisma.offer.count({ where: { shop, status: { in: ["draft", "reserved", "partial"] } } }),
    prisma.supplier.count({ where: { shop } }),
    prisma.product.count({ where: { shop } }),
    prisma.purchaseOrder.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        supplier: { select: { name: true } },
        _count: { select: { lineItems: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { shop, status: { in: ["open", "in_transit", "partially_received"] } },
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { name: true } },
        lineItems: { select: { qtyOrdered: true, qtyReceived: true, qtyRejected: true } },
      },
    }),
  ]);

  const pendingReceiptPOs = candidatePendingReceiptPOs.filter((po) =>
    po.lineItems.some((l) => l.qtyOrdered - l.qtyReceived - l.qtyRejected > 0),
  );

  // Financial KPIs computed from pending/active POs
  const valueOnOrder = candidatePendingReceiptPOs.reduce((s, p) => s + p.totalLandedCost, 0);
  const unitsOnOrder = candidatePendingReceiptPOs.reduce(
    (s, p) => s + p.lineItems.reduce((ls, l) => ls + Math.max(0, l.qtyOrdered - l.qtyReceived - l.qtyRejected), 0),
    0,
  );

  return {
    openPOs, openOffers, pendingReceipts: pendingReceiptPOs.length,
    supplierCount, productCount, valueOnOrder, unitsOnOrder,
    recentPOs, pendingReceiptPOs,
  };
};

// ---------------------------------------------------------------------------
// StatCard — uniform height, CSS hover on clickable cards
// ---------------------------------------------------------------------------
function StatCard({
  label, value, sub, tone, onClick,
}: {
  label: string; value: string | number; sub?: string;
  tone?: "success" | "warning" | "critical" | "info" | "attention";
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);

  return (
    <div
      className={[
        "dash-kpi",
        clickable && "dash-kpi--clickable",
        tone && `dash-kpi--tone-${tone}`,
      ].filter(Boolean).join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick!(); } : undefined}
    >
      {clickable && <span className="dash-kpi__hint" aria-hidden="true">View →</span>}
      <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
      <Text as="p" variant="headingXl" fontWeight="bold">{String(value)}</Text>
      <div className="dash-kpi__footer">
        {sub
          ? <Text as="p" variant="bodySm" tone="subdued">{sub}</Text>
          : <span aria-hidden="true" className="dash-kpi__spacer" />}
        {tone
          ? (
            <Badge tone={tone}>
              {tone === "success" ? "On track" : tone === "warning" || tone === "attention" ? "Needs attention" : tone === "critical" ? "Action required" : "Active"}
            </Badge>
          )
          : <span aria-hidden="true" className="dash-kpi__spacer" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const {
    openPOs, openOffers, pendingReceipts, supplierCount, productCount,
    valueOnOrder, unitsOnOrder, recentPOs, pendingReceiptPOs,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const thBase: React.CSSProperties = {
    padding: "8px 16px",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#6d7175",
    whiteSpace: "nowrap",
    background: "#fafbfb",
  };

  const recentPoCols: { key: string; label: string; align: "left" | "center" | "right" }[] = [
    { key: "po",         label: "PO #",        align: "left"   },
    { key: "supplier",   label: "Supplier",    align: "left"   },
    { key: "items",      label: "Items",       align: "center" },
    { key: "status",     label: "Status",      align: "left"   },
    { key: "date",       label: "Date",        align: "left"   },
    { key: "landedCost", label: "Landed Cost", align: "right"  },
  ];
  const recentPoColWidth = `${100 / recentPoCols.length}%`;

  const pendingCols: { label: string; align: "left" | "center" | "right" }[] = [
    { label: "PO #",         align: "left"   },
    { label: "Supplier",     align: "left"   },
    { label: "Status",       align: "left"   },
    { label: "Landed Cost",  align: "right"  },
    { label: "Outstanding",  align: "right"  },
    { label: "Action",       align: "right"  },
  ];

  return (
    <Page fullWidth>
      <style>{`
        .dash-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          align-items: stretch;
        }
        .dash-kpi {
          position: relative;
          height: 100%;
          min-height: 136px;
          padding: 16px 20px;
          background: #fff;
          border-radius: 12px;
          border: 2px solid #e1e3e5;
          box-shadow: 0 1px 0 rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }
        .dash-kpi--tone-info {
          background: linear-gradient(180deg, #f4f8ff 0%, #fff 100%);
          border-color: #95b8f0;
        }
        .dash-kpi--tone-attention {
          background: linear-gradient(180deg, #fff8e6 0%, #fff 100%);
          border-color: #ffc453;
        }
        .dash-kpi--tone-warning {
          background: linear-gradient(180deg, #fff5ea 0%, #fff 100%);
          border-color: #ffb84d;
        }
        .dash-kpi--tone-success {
          background: linear-gradient(180deg, #eefbf5 0%, #fff 100%);
          border-color: #86d4b3;
        }
        .dash-kpi--tone-critical {
          background: linear-gradient(180deg, #fff4f4 0%, #fff 100%);
          border-color: #f4a4a4;
        }
        .dash-kpi--clickable { cursor: pointer; }
        .dash-kpi--clickable:hover,
        .dash-kpi--clickable:focus-visible {
          transform: translateY(-4px);
          border-color: #005bd3;
          background: #eef4ff;
          box-shadow: 0 10px 28px rgba(0, 91, 211, 0.22), 0 0 0 1px rgba(0, 91, 211, 0.12);
        }
        .dash-kpi--clickable:focus-visible {
          outline: 2px solid #005bd3;
          outline-offset: 2px;
        }
        .dash-kpi--clickable:active { transform: translateY(-1px); }
        .dash-kpi__hint {
          position: absolute;
          top: 14px;
          right: 16px;
          font-size: 12px;
          font-weight: 600;
          color: #005bd3;
          opacity: 0;
          transform: translateX(-4px);
          transition: opacity 0.18s ease, transform 0.18s ease;
        }
        .dash-kpi--clickable:hover .dash-kpi__hint,
        .dash-kpi--clickable:focus-visible .dash-kpi__hint {
          opacity: 1;
          transform: translateX(0);
        }
        .dash-kpi__footer {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 44px;
          justify-content: flex-end;
        }
        .dash-kpi__spacer { display: block; min-height: 20px; }
      `}</style>

      <TitleBar title="ShelfFlow" />

      <BlockStack gap="600">
        {/* ── Row 1: Operational counts ─────────────────────────────────── */}
        <div className="dash-kpi-grid">
          <StatCard
            label="Open Purchase Orders"
            value={openPOs}
            tone={openPOs > 0 ? "info" : undefined}
            onClick={() => navigate("/app/purchase-orders")}
          />
          <StatCard
            label="Open Offers / Reserves"
            value={openOffers}
            tone={openOffers > 0 ? "info" : undefined}
            onClick={() => navigate("/app/offers")}
          />
          <StatCard
            label="Pending Receipts"
            value={pendingReceipts}
            tone={pendingReceipts > 0 ? "attention" : undefined}
            sub={pendingReceipts > 0 ? "Awaiting stock" : undefined}
            onClick={() => navigate("/app/receiving")}
          />
          <StatCard label="Suppliers" value={supplierCount} onClick={() => navigate("/app/suppliers")} />
        </div>

        {/* ── Row 2: Financial / inventory KPIs ─────────────────────────── */}
        <div className="dash-kpi-grid">
          <StatCard
            label="$ Value on Order"
            value={`$${valueOnOrder.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub="Active POs (landed)"
          />
          <StatCard
            label="Units on Order"
            value={unitsOnOrder.toLocaleString()}
            sub="Outstanding qty"
          />
          <StatCard
            label="Products Synced"
            value={productCount}
            sub="From Shopify"
            onClick={() => navigate("/app/products")}
          />
          <StatCard label="Open Offers" value={openOffers} onClick={() => navigate("/app/offers")} />
        </div>

        {/* ── Row 3: Recent activity + Quick actions ─────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, alignItems: "start" }}>
          {/* Left: Recent POs + Pending Receipts */}
          <BlockStack gap="400">
            {/* Recent Purchase Orders */}
            <Card padding="0">
              <Box paddingBlock="300" paddingInline="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Recent Purchase Orders</Text>
                  <Button variant="plain" size="slim" onClick={() => navigate("/app/purchase-orders")}>
                    View all
                  </Button>
                </InlineStack>
              </Box>
              <Divider />
              {recentPOs.length === 0 ? (
                <Box paddingBlock="800" paddingInline="400">
                  <BlockStack gap="300" align="center">
                    <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                      No purchase orders yet.
                    </Text>
                    <Button variant="primary" size="slim" onClick={() => navigate("/app/purchase-orders/new")}>
                      Create first PO
                    </Button>
                  </BlockStack>
                </Box>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      {recentPoCols.map((col) => (
                        <col key={col.label} style={{ width: recentPoColWidth }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                        {recentPoCols.map((col) => (
                          <th key={col.label} style={{ ...thBase, textAlign: col.align }}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentPOs.map((po) => {
                        const meta = STATUS_META[po.status] ?? { tone: undefined, label: po.status };
                        const cellValue: Record<string, React.ReactNode> = {
                          po: po.poNumber,
                          supplier: po.supplier.name,
                          items: po._count.lineItems,
                          status: <Badge tone={meta.tone}>{meta.label}</Badge>,
                          date: fmtDate(po.createdAt),
                          landedCost: `$${po.totalLandedCost.toFixed(2)}`,
                        };
                        return (
                          <tr
                            key={po.id}
                            onClick={() => navigate(`/app/purchase-orders/${po.id}`)}
                            style={{ cursor: "pointer", borderBottom: "1px solid #f1f2f3" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#f6f6f7"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                          >
                            {recentPoCols.map((col) => (
                              <td
                                key={col.key}
                                style={{
                                  padding: "10px 16px",
                                  textAlign: col.align,
                                  fontWeight: col.key === "po" || col.key === "landedCost" ? 600 : undefined,
                                  color: col.key === "date" ? "#6d7175" : undefined,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {cellValue[col.key]}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Pending Receipts */}
            <Card padding="0">
              <Box paddingBlock="300" paddingInline="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Pending Receipts</Text>
                  <Button variant="plain" size="slim" onClick={() => navigate("/app/receiving")}>
                    View queue
                  </Button>
                </InlineStack>
              </Box>
              <Divider />
              {pendingReceiptPOs.length === 0 ? (
                <Box paddingBlock="600" paddingInline="400">
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    No items pending receipt.
                  </Text>
                </Box>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "12%" }} />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                        {pendingCols.map((col) => (
                          <th key={col.label} style={{ ...thBase, textAlign: col.align }}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pendingReceiptPOs.map((po) => {
                        const meta = STATUS_META[po.status] ?? { tone: undefined, label: po.status };
                        const outstanding = po.lineItems.reduce(
                          (s, l) => s + Math.max(0, l.qtyOrdered - l.qtyReceived - l.qtyRejected),
                          0,
                        );
                        return (
                          <tr
                            key={po.id}
                            style={{ cursor: "pointer", borderBottom: "1px solid #f1f2f3" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#f6f6f7"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                          >
                            <td style={{ padding: "10px 16px", fontWeight: 600, whiteSpace: "nowrap" }}
                                onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                              {po.poNumber}
                            </td>
                            <td style={{ padding: "10px 16px" }}
                                onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                              {po.supplier.name}
                            </td>
                            <td style={{ padding: "10px 16px" }}
                                onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}
                                onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                              ${po.totalLandedCost.toFixed(2)}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}
                                onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>
                              {outstanding} units
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right" }}>
                              <Button size="slim" variant="plain"
                                onClick={() => navigate(`/app/purchase-orders/${po.id}/receiving`)}>
                                Receive
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </BlockStack>

          {/* Right: Quick actions + Shopify sync */}
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Quick Actions</Text>
                <Divider />
                <BlockStack gap="200">
                  <Button fullWidth textAlign="left" onClick={() => navigate("/app/purchase-orders/new")}>
                    Create Purchase Order
                  </Button>
                  <Button fullWidth textAlign="left" onClick={() => navigate("/app/offers/new")}>
                    Create Offer / Reserve
                  </Button>
                  <Button fullWidth textAlign="left" onClick={() => navigate("/app/receiving")}>
                    Receive Stock
                  </Button>
                  <Button fullWidth textAlign="left" onClick={() => navigate("/app/products")}>
                    View Products
                  </Button>
                  <Button fullWidth textAlign="left" onClick={() => navigate("/app/imports")}>
                    Import CSV
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Shopify Sync</Text>
                <Divider />
                <Text as="p" variant="bodySm" tone="subdued">
                  Sync products from your Shopify store to keep inventory data up to date.
                </Text>
                <Button fullWidth onClick={() => navigate("/app/products")}>
                  Manage Products
                </Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </BlockStack>
    </Page>
  );
}
