import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate, useNavigation, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getPurchaseOrder, receivePurchaseOrder } from "../models/purchase-order.server";
import { LocalInventoryNotice } from "../components/LocalInventoryNotice";

type ReceiveDraft = Record<string, { receive: string; reject: string; backorder: string }>;

const STATUS_BADGE: Record<string, { tone: "info" | "warning" | "success" | "critical" | undefined; label: string }> = {
  draft:              { tone: undefined,  label: "Draft" },
  open:               { tone: "info",     label: "Open" },
  in_transit:         { tone: "warning",  label: "In Transit" },
  partially_received: { tone: "warning",  label: "Partially Received" },
  received:           { tone: "success",  label: "Received" },
  cancelled:          { tone: "critical", label: "Cancelled" },
};

const toInt = (value: string) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const po = await getPurchaseOrder(session.shop, params.id!);
  if (!po) throw new Response("Not Found", { status: 404 });
  return json({ po });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  let lines: unknown;
  try {
    lines = JSON.parse((formData.get("linesJson") as string) || "[]");
  } catch {
    return json({ ok: false, error: "Receiving quantities could not be read. Please try again." }, { status: 400 });
  }

  if (!Array.isArray(lines)) {
    return json({ ok: false, error: "Receiving quantities are invalid. Please try again." }, { status: 400 });
  }

  const result = await receivePurchaseOrder(session.shop, params.id!, lines);
  return json(result, { status: result.ok ? 200 : 400 });
};

export default function PurchaseOrderReceiving() {
  const { po } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();

  const loading = navigation.state !== "idle";
  const badge = STATUS_BADGE[po.status] ?? { tone: undefined, label: po.status };

  const initialDraft = useMemo<ReceiveDraft>(() => {
    return Object.fromEntries(
      po.lineItems.map((line) => [line.id, { receive: "0", reject: "0", backorder: "0" }]),
    );
  }, [po.lineItems]);

  const [draft, setDraft] = useState<ReceiveDraft>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const totalOrdered = po.lineItems.reduce((sum, line) => sum + line.qtyOrdered, 0);
  const totalReceived = po.lineItems.reduce((sum, line) => sum + line.qtyReceived, 0);
  const totalRejected = po.lineItems.reduce((sum, line) => sum + line.qtyRejected, 0);
  const totalBackordered = po.lineItems.reduce((sum, line) => sum + line.qtyBackordered, 0);
  const avgLandedPerUnit = totalOrdered > 0 ? po.totalLandedCost / totalOrdered : 0;
  const isClosed = po.status === "received" || po.status === "cancelled";

  function remainingFor(line: typeof po.lineItems[number]) {
    return Math.max(0, line.qtyOrdered - line.qtyReceived - line.qtyRejected);
  }

  function updateDraft(lineId: string, field: keyof ReceiveDraft[string], value: string) {
    setDraft((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value },
    }));
  }

  function receiveAll() {
    setDraft(Object.fromEntries(
      po.lineItems.map((line) => [
        line.id,
        { receive: String(remainingFor(line)), reject: "0", backorder: "0" },
      ]),
    ));
  }

  function backorderRemaining() {
    setDraft(Object.fromEntries(
      po.lineItems.map((line) => [
        line.id,
        { receive: "0", reject: "0", backorder: String(remainingFor(line)) },
      ]),
    ));
  }

  function clearDraft() {
    setDraft(initialDraft);
  }

  function submitReceiving() {
    const lines = po.lineItems.map((line) => ({
      lineItemId: line.id,
      qtyReceived: toInt(draft[line.id]?.receive ?? "0"),
      qtyRejected: toInt(draft[line.id]?.reject ?? "0"),
      qtyBackordered: toInt(draft[line.id]?.backorder ?? "0"),
    }));

    const formData = new FormData();
    formData.append("linesJson", JSON.stringify(lines));
    submit(formData, { method: "post" });
  }

  const overAllocatedLines = po.lineItems.filter((line) => {
    const lineDraft = draft[line.id] ?? { receive: "0", reject: "0", backorder: "0" };
    const enteredQty = toInt(lineDraft.receive) + toInt(lineDraft.reject) + toInt(lineDraft.backorder);
    return enteredQty > remainingFor(line);
  });
  const hasOverAllocatedLines = overAllocatedLines.length > 0;

  const thStyle: React.CSSProperties = {
    padding: "8px 6px",
    background: "#f6f6f7",
    borderBottom: "2px solid #e1e3e5",
    color: "#6d7175",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "6px",
    borderBottom: "1px solid #e1e3e5",
    verticalAlign: "middle",
    fontSize: 13,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 30,
    padding: "0 7px",
    border: "1.5px solid #c9cccf",
    borderRadius: 4,
    fontSize: 13,
    textAlign: "right",
    boxSizing: "border-box",
  };

  return (
    <Page fullWidth>
      <TitleBar title={`Receive ${po.poNumber}`}>
        <button onClick={() => navigate(`/app/purchase-orders/${po.id}`)}>Back to PO</button>
      </TitleBar>

      <BlockStack gap="400">
        <LocalInventoryNotice />
        {actionData && !actionData.ok && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              {"error" in actionData ? actionData.error : "Receiving could not be saved."}
            </Text>
          </Banner>
        )}
        {actionData?.ok && (
          <Banner tone="success">
            <Text as="p" variant="bodyMd">Receiving saved. ShelfFlow local stock and cost basis were updated.</Text>
          </Banner>
        )}
        {isClosed && (
          <Banner tone={po.status === "received" ? "success" : "warning"}>
            <Text as="p" variant="bodyMd">
              {po.status === "received"
                ? "This purchase order is fully received. Receiving inputs are locked."
                : "This purchase order is cancelled. Receiving inputs are locked."}
            </Text>
          </Banner>
        )}
        {hasOverAllocatedLines && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              One or more rows exceeds the open quantity. Reduce receive, reject, or backorder quantities before saving.
            </Text>
          </Banner>
        )}

        <Card>
          <InlineStack align="space-between" blockAlign="center" gap="400">
            <BlockStack gap="100">
              <InlineStack gap="300" blockAlign="center">
                <Text as="h1" variant="headingLg">{po.poNumber}</Text>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                {po.supplier.name} - {totalOrdered} ordered - {totalReceived} received - {totalRejected} rejected - {totalBackordered} backordered
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              <Button onClick={receiveAll} disabled={isClosed}>Receive all</Button>
              <Button onClick={backorderRemaining} disabled={isClosed}>Backorder remaining</Button>
              <Button onClick={clearDraft}>Clear</Button>
              <Button variant="primary" onClick={submitReceiving} loading={loading} disabled={isClosed || hasOverAllocatedLines}>
                Save receipt
              </Button>
            </InlineStack>
          </InlineStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Receiving Summary</Text>
            <Divider />
            <InlineStack gap="600" wrap>
              <BlockStack gap="050">
                <Text as="p" variant="bodySm" tone="subdued">Avg landed / unit used for cost basis</Text>
                <Text as="p" variant="headingMd">${avgLandedPerUnit.toFixed(3)}</Text>
              </BlockStack>
              <BlockStack gap="050">
                <Text as="p" variant="bodySm" tone="subdued">Formula</Text>
                <Text as="p" variant="bodyMd">PO total landed divided by total ordered units</Text>
              </BlockStack>
              <BlockStack gap="050">
                <Text as="p" variant="bodySm" tone="subdued">Inventory update</Text>
                <Text as="p" variant="bodyMd">Rejected units do not enter stock; backordered units stay outstanding</Text>
              </BlockStack>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card padding="0">
          <Box paddingBlock="300" paddingInline="400">
            <Text as="h2" variant="headingMd">Items to Receive</Text>
          </Box>
          <Divider />
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1120, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 48 }} />
                <col style={{ width: 250 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 106 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "center" }} />
                  <th style={{ ...thStyle, textAlign: "left" }}>Product</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Supplier SKU</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Ordered</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Received</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Rejected</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Backorder</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Open</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Receive</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Reject</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Backorder Qty</th>
                </tr>
              </thead>
              <tbody>
                {po.lineItems.map((line) => {
                  const product = (line as any).product as { title: string; imageUrl: string | null; sku: string | null; barcode: string | null } | null;
                  const imageUrl = product?.imageUrl ?? null;
                  const displayTitle = line.description ?? product?.title ?? "Untitled product";
                  const subtitle = product?.sku ? `SKU: ${product.sku}` : product?.barcode ? `Barcode: ${product.barcode}` : null;
                  const openQty = remainingFor(line);
                  const lineDraft = draft[line.id] ?? { receive: "0", reject: "0", backorder: "0" };
                  const enteredQty = toInt(lineDraft.receive) + toInt(lineDraft.reject) + toInt(lineDraft.backorder);
                  const isOverAllocated = enteredQty > openQty;
                  const disabled = openQty <= 0 || isClosed;

                  return (
                    <tr key={line.id}>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 4, background: "#f6f6f7", border: imageUrl ? "none" : "1px dashed #d1d5db", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                          {imageUrl
                            ? <img src={imageUrl} alt={displayTitle} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 8, color: "#c9cccf" }}>IMG</span>
                          }
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{displayTitle}</div>
                        {subtitle && <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#6d7175", fontSize: 11, marginTop: 2 }}>{subtitle}</div>}
                      </td>
                      <td style={{ ...tdStyle, color: line.supplierSku ? "#202223" : "#6d7175" }}>{line.supplierSku ?? "-"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{line.qtyOrdered}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{line.qtyReceived}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{line.qtyRejected}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{line.qtyBackordered}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: isOverAllocated ? "#d72c0d" : "#202223" }}>
                        {openQty}
                        {isOverAllocated && <div style={{ fontSize: 11, color: "#d72c0d", marginTop: 2 }}>Over entered</div>}
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min="0"
                          max={openQty}
                          value={lineDraft.receive}
                          onChange={(event) => updateDraft(line.id, "receive", event.target.value)}
                          disabled={disabled}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min="0"
                          max={openQty}
                          value={lineDraft.reject}
                          onChange={(event) => updateDraft(line.id, "reject", event.target.value)}
                          disabled={disabled}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min="0"
                          max={openQty}
                          value={lineDraft.backorder}
                          onChange={(event) => updateDraft(line.id, "backorder", event.target.value)}
                          disabled={disabled}
                          style={inputStyle}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </BlockStack>
    </Page>
  );
}
