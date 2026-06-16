import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  DataTable,
  Button,
  Box,
  Banner,
  InlineGrid,
  ProgressBar,
} from "@shopify/polaris";
import React from "react";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getOffer, updateOfferStatus, convertOfferToPO } from "../models/offer.server";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { tone: "info" | "warning" | "success" | "critical" | undefined; label: string }> = {
  draft:     { tone: undefined,  label: "Draft"     },
  reserved:  { tone: "info",     label: "Reserved"  },
  partial:   { tone: "warning",  label: "Partial"   },
  completed: { tone: "success",  label: "Completed" },
  cancelled: { tone: "critical", label: "Cancelled" },
};

const PO_STATUS_BADGE: Record<string, { tone: "info" | "warning" | "success" | "critical" | undefined }> = {
  draft:              { tone: undefined  },
  open:               { tone: "info"     },
  in_transit:         { tone: "warning"  },
  partially_received: { tone: "warning"  },
  received:           { tone: "success"  },
  cancelled:          { tone: "critical" },
};

// ---------------------------------------------------------------------------
// Loader & Action
// ---------------------------------------------------------------------------

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const offer = await getOffer(session.shop, params.id!);
  if (!offer) throw new Response("Not Found", { status: 404 });
  return json({ offer });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "updateStatus") {
    const status = formData.get("status") as string;
    await updateOfferStatus(session.shop, params.id!, status);
    return json({ ok: true });
  }

  if (intent === "convertToPO") {
    const po = await convertOfferToPO(session.shop, params.id!);
    return redirect(`/app/purchase-orders/${po.id}`);
  }

  return json({ ok: true });
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OfferDetail() {
  const { offer } = useLoaderData<typeof loader>();
  const navigate  = useNavigate();
  const submit    = useSubmit();

  const badge      = STATUS_BADGE[offer.status] ?? { tone: undefined, label: offer.status };
  const shortId    = `OFF-${offer.id.slice(-6).toUpperCase()}`;
  const hasPOs     = offer.purchaseOrders.length > 0;
  const canConvert = ["reserved", "partial"].includes(offer.status) && !hasPOs;
  const isActive   = ["draft", "reserved", "partial"].includes(offer.status);

  // Quantity totals
  const totalReserved = offer.items.reduce((s, i) => s + i.qtyReserved, 0);
  const totalOnOrder  = offer.purchaseOrders.reduce(
    (s, po) => s + po.lineItems.reduce((ls, li) => ls + li.qtyOrdered, 0), 0,
  );
  const totalReceived = offer.purchaseOrders.reduce(
    (s, po) => s + po.lineItems.reduce((ls, li) => ls + li.qtyReceived, 0), 0,
  );
  const fulfillPct = totalReserved > 0 ? Math.min(100, (totalReceived / totalReserved) * 100) : 0;
  const onOrderPct = totalReserved > 0 ? Math.min(100, (totalOnOrder  / totalReserved) * 100) : 0;

  function changeStatus(next: string) {
    const fd = new FormData();
    fd.append("intent", "updateStatus");
    fd.append("status", next);
    submit(fd, { method: "post" });
  }

  function handleConvert() {
    if (!confirm(`Convert "${shortId}" to a Purchase Order? The offer will be marked as Completed.`)) return;
    const fd = new FormData();
    fd.append("intent", "convertToPO");
    submit(fd, { method: "post" });
  }

  // ── Offer items table (image-aware, read-only) ───────────────────────────
  const thStyle: React.CSSProperties = {
    padding: "6px 8px",
    background: "#f6f6f7",
    borderBottom: "2px solid #e1e3e5",
    fontSize: "11px",
    fontWeight: 600,
    color: "#6d7175",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
    userSelect: "none",
  };
  const tdStyle: React.CSSProperties = {
    padding: "5px 8px",
    borderBottom: "1px solid #e1e3e5",
    verticalAlign: "middle",
    fontSize: "13px",
    color: "#202223",
  };

  const poRows = offer.purchaseOrders.map((po) => {
    const poOrdered  = po.lineItems.reduce((s, l) => s + l.qtyOrdered,  0);
    const poReceived = po.lineItems.reduce((s, l) => s + l.qtyReceived, 0);
    return [
      <Button
        key={po.id}
        variant="plain"
        onClick={() => navigate(`/app/purchase-orders/${po.id}`)}
      >
        {po.poNumber}
      </Button>,
      <Badge key={`b-${po.id}`} tone={PO_STATUS_BADGE[po.status]?.tone}>
        {po.status.replace(/_/g, " ")}
      </Badge>,
      String(poOrdered),
      String(poReceived),
      `$${po.totalLandedCost.toFixed(2)}`,
      new Date(po.createdAt).toLocaleDateString(),
    ];
  });

  return (
    <Page>
      <TitleBar title={shortId}>
        <button onClick={() => navigate("/app/offers")}>Back to Offers</button>
        {canConvert && (
          <button variant="primary" onClick={handleConvert}>
            Convert to PO
          </button>
        )}
      </TitleBar>

      <BlockStack gap="500">

        {/* ── Double-order warning ───────────────────────────────────────── */}
        {hasPOs && isActive && (
          <Banner tone="warning">
            <Text as="p" variant="bodyMd">
              This offer has been converted to {offer.purchaseOrders.length} PO{offer.purchaseOrders.length !== 1 ? "s" : ""}. Creating another PO from it may cause double-ordering.
            </Text>
          </Banner>
        )}

        <Layout>
          {/* ── Main: items + linked POs ───────────────────────────────── */}
          <Layout.Section>
            <BlockStack gap="400">

              {/* Header card */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <InlineStack gap="300" blockAlign="center">
                        <Text as="h1" variant="headingLg">{shortId}</Text>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {offer.supplier.name} · {offer.items.length} item{offer.items.length !== 1 ? "s" : ""} · Created {new Date(offer.createdAt).toLocaleDateString()}
                      </Text>
                    </BlockStack>

                    {/* Status actions */}
                    <InlineStack gap="200">
                      {offer.status === "draft" && (
                        <Button size="slim" variant="primary" onClick={() => changeStatus("reserved")}>Mark Reserved</Button>
                      )}
                      {offer.status === "reserved" && (
                        <>
                          <Button size="slim" onClick={() => changeStatus("partial")}>Mark Partial</Button>
                          <Button size="slim" tone="critical" onClick={() => changeStatus("cancelled")}>Cancel</Button>
                        </>
                      )}
                      {offer.status === "partial" && (
                        <Button size="slim" variant="primary" onClick={() => changeStatus("completed")}>Mark Completed</Button>
                      )}
                    </InlineStack>
                  </InlineStack>

                  <Divider />

                  <InlineGrid columns={3} gap="400">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">ETA</Text>
                      <Text as="p" variant="bodyMd">
                        {offer.eta ? new Date(offer.eta).toLocaleDateString() : "—"}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">End Date</Text>
                      <Text as="p" variant="bodyMd">
                        {offer.endDate ? new Date(offer.endDate).toLocaleDateString() : "—"}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Est. Value</Text>
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        ${offer.totalEstimatedCost.toFixed(2)}
                      </Text>
                    </BlockStack>
                  </InlineGrid>

                  {offer.notes && (
                    <>
                      <Divider />
                      <BlockStack gap="050">
                        <Text as="p" variant="bodySm" tone="subdued">Notes</Text>
                        <Text as="p" variant="bodyMd">{offer.notes}</Text>
                      </BlockStack>
                    </>
                  )}
                </BlockStack>
              </Card>

              {/* Reserved items */}
              <Card padding="0">
                <Box paddingBlock="300" paddingInline="400">
                  <Text as="h2" variant="headingMd">Reserved Items</Text>
                </Box>
                <Divider />
                {offer.items.length === 0 ? (
                  <Box paddingBlock="600">
                    <Text as="p" variant="bodyMd" tone="subdued" alignment="center">No items.</Text>
                  </Box>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: 48 }} />
                        <col style={{ width: 220 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 90 }} />
                        <col style={{ width: 96 }} />
                        <col style={{ width: 96 }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, textAlign: "center" }}></th>
                          <th style={{ ...thStyle, textAlign: "left" }}>Product</th>
                          <th style={{ ...thStyle, textAlign: "left" }}>Supplier Code / SKU</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>Qty Reserved</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>Unit Cost</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>Est. Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offer.items.map((item) => {
                          const prod = (item as any).product as { title: string; imageUrl: string | null; sku: string | null; barcode: string | null } | null;
                          const imageUrl    = prod?.imageUrl ?? null;
                          const displayName = item.description ?? prod?.title ?? "—";
                          const subtitle    = prod?.title && prod.title !== displayName ? prod.title : (prod?.sku ?? null);
                          const lineTotal   = item.qtyReserved * item.unitCost;

                          return (
                            <tr key={item.id} style={{ background: "white" }}>
                              <td style={{ ...tdStyle, textAlign: "center" }}>
                                <div style={{ width: 34, height: 34, borderRadius: 4, background: "#f6f6f7", border: imageUrl ? "none" : "1px dashed #d1d5db", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                                  {imageUrl
                                    ? <img src={imageUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    : <span style={{ fontSize: 8, color: "#c9cccf" }}>IMG</span>
                                  }
                                </div>
                              </td>
                              <td style={{ ...tdStyle }}>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 210 }}>{displayName}</div>
                                {subtitle && (
                                  <div style={{ fontSize: 11, color: "#6d7175", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 210, marginTop: 2 }}>{subtitle}</div>
                                )}
                              </td>
                              <td style={{ ...tdStyle, color: item.supplierSku ? "#202223" : "#6d7175" }}>
                                {item.supplierSku ?? "—"}
                              </td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{item.qtyReserved}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>${item.unitCost.toFixed(2)}</td>
                              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>${lineTotal.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                        {/* Totals row */}
                        <tr style={{ background: "#f6f6f7" }}>
                          <td style={{ ...tdStyle }}></td>
                          <td style={{ ...tdStyle, fontWeight: 600, fontSize: 12, color: "#6d7175" }}>TOTAL</td>
                          <td style={{ ...tdStyle }}></td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{totalReserved}</td>
                          <td style={{ ...tdStyle }}></td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>${offer.totalEstimatedCost.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Linked purchase orders */}
              {hasPOs && (
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">Linked Purchase Orders</Text>
                      <Badge>{String(offer.purchaseOrders.length)}</Badge>
                    </InlineStack>
                    <Divider />
                    <DataTable
                      columnContentTypes={["text", "text", "numeric", "numeric", "numeric", "text"]}
                      headings={["PO Number", "Status", "On Order", "Received", "Landed Cost", "Created"]}
                      rows={poRows}
                    />
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>

          {/* ── Sidebar: fulfillment + actions ───────────────────────────── */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">

              {/* Fulfillment status */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Fulfillment Status</Text>
                  <Divider />

                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Reserved</Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">{totalReserved} units</Text>
                    </InlineStack>

                    {hasPOs && (
                      <>
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodyMd" tone="subdued">On Order (POs)</Text>
                          <Text as="span" variant="bodyMd"
                            tone={totalOnOrder >= totalReserved ? "success" : totalOnOrder > 0 ? undefined : "critical"}
                          >
                            {totalOnOrder} units
                          </Text>
                        </InlineStack>

                        <Box paddingBlockStart="100">
                          <BlockStack gap="100">
                            <Text as="p" variant="bodySm" tone="subdued">On Order vs Reserved</Text>
                            <ProgressBar
                              progress={onOrderPct}
                              tone={onOrderPct >= 100 ? "success" : "highlight"}
                              size="small"
                            />
                          </BlockStack>
                        </Box>

                        <InlineStack align="space-between">
                          <Text as="span" variant="bodyMd" tone="subdued">Received</Text>
                          <Text as="span" variant="bodyMd"
                            tone={totalReceived >= totalReserved ? "success" : totalReceived > 0 ? undefined : "subdued"}
                          >
                            {totalReceived} units
                          </Text>
                        </InlineStack>

                        <Box paddingBlockStart="100">
                          <BlockStack gap="100">
                            <Text as="p" variant="bodySm" tone="subdued">Received vs Reserved</Text>
                            <ProgressBar
                              progress={fulfillPct}
                              tone={fulfillPct >= 100 ? "success" : "highlight"}
                              size="small"
                            />
                          </BlockStack>
                        </Box>
                      </>
                    )}

                    {!hasPOs && (
                      <Box paddingBlock="200">
                        <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                          No POs linked yet. Convert this offer to place the order.
                        </Text>
                      </Box>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Summary */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Summary</Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Items</Text>
                    <Text as="span" variant="bodyMd">{offer.items.length}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Total Units</Text>
                    <Text as="span" variant="bodyMd">{totalReserved}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">POs Created</Text>
                    <Text as="span" variant="bodyMd">{offer.purchaseOrders.length}</Text>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">Est. Total</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">
                      ${offer.totalEstimatedCost.toFixed(2)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* Actions */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Actions</Text>
                  <Divider />
                  <BlockStack gap="200">

                    {canConvert && (
                      <Button variant="primary" fullWidth onClick={handleConvert}>
                        Convert to Purchase Order
                      </Button>
                    )}

                    {hasPOs && offer.purchaseOrders.map((po) => (
                      <Button
                        key={po.id}
                        fullWidth
                        onClick={() => navigate(`/app/purchase-orders/${po.id}`)}
                      >
                        View {po.poNumber}
                      </Button>
                    ))}

                    <Button
                      fullWidth
                      onClick={() => navigate(`/app/offers/new`)}
                    >
                      Create New Offer
                    </Button>

                    {offer.status === "cancelled" && (
                      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                        This offer was cancelled.
                      </Text>
                    )}
                    {offer.status === "completed" && !hasPOs && (
                      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                        This offer was marked complete without a linked PO.
                      </Text>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>

            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
