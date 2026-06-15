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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getPurchaseOrder, updatePurchaseOrderStatus } from "../models/purchase-order.server";

const STATUS_BADGE: Record<string, { tone: "info" | "warning" | "success" | "critical" | undefined; label: string }> = {
  draft:              { tone: undefined,  label: "Draft" },
  open:               { tone: "info",     label: "Open" },
  in_transit:         { tone: "warning",  label: "In Transit" },
  partially_received: { tone: "warning",  label: "Partially Received" },
  received:           { tone: "success",  label: "Received" },
  cancelled:          { tone: "critical", label: "Cancelled" },
};

const STATUS_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  draft:              [{ label: "Mark as Open",       next: "open" }],
  open:               [{ label: "Mark as In Transit", next: "in_transit" }, { label: "Cancel PO", next: "cancelled" }],
  in_transit:         [{ label: "Receive Stock",      next: "received" }],
  partially_received: [{ label: "Mark as Received",   next: "received" }],
  received:           [],
  cancelled:          [],
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
  const intent = formData.get("intent") as string;

  if (intent === "updateStatus") {
    const status = formData.get("status") as string;
    await updatePurchaseOrderStatus(session.shop, params.id!, status);
    return json({ ok: true });
  }

  return redirect(`/app/purchase-orders/${params.id}`);
};

export default function PurchaseOrderDetail() {
  const { po } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const badge = STATUS_BADGE[po.status] ?? { tone: undefined, label: po.status };
  const transitions = STATUS_TRANSITIONS[po.status] ?? [];

  function changeStatus(next: string) {
    const fd = new FormData();
    fd.append("intent", "updateStatus");
    fd.append("status", next);
    submit(fd, { method: "post" });
  }

  const lineRows = po.lineItems.map((item) => [
    item.description ?? "—",
    item.supplierSku ?? "—",
    String(item.qtyOrdered),
    `$${item.unitCost.toFixed(2)}`,
    `$${(item.qtyOrdered * item.unitCost).toFixed(2)}`,
    `$${item.landedCostPerUnit.toFixed(2)}`,
  ]);

  return (
    <Page>
      <TitleBar title={po.poNumber}>
        <button onClick={() => navigate("/app/purchase-orders")}>Back</button>
      </TitleBar>

      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              {/* Header card */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h1" variant="headingLg">{po.poNumber}</Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Created {new Date(po.createdAt).toLocaleDateString()}
                      </Text>
                    </BlockStack>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </InlineStack>
                  <Divider />
                  <InlineGrid columns={3} gap="400">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Supplier</Text>
                      <Text as="p" variant="bodyMd">{po.supplier.name}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Currency</Text>
                      <Text as="p" variant="bodyMd">{po.currency} (×{po.exchangeRate})</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Last Updated</Text>
                      <Text as="p" variant="bodyMd">{new Date(po.updatedAt).toLocaleDateString()}</Text>
                    </BlockStack>
                  </InlineGrid>
                  {po.notes && (
                    <>
                      <Divider />
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">Notes</Text>
                        <Text as="p" variant="bodyMd">{po.notes}</Text>
                      </BlockStack>
                    </>
                  )}
                </BlockStack>
              </Card>

              {/* Line items */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Line Items</Text>
                  <Divider />
                  {po.lineItems.length === 0 ? (
                    <Text as="p" variant="bodyMd" tone="subdued">No line items.</Text>
                  ) : (
                    <DataTable
                      columnContentTypes={["text", "text", "numeric", "numeric", "numeric", "numeric"]}
                      headings={["Description", "Supplier SKU", "Qty", "Unit Cost", "Line Total", "Landed/Unit"]}
                      rows={lineRows}
                    />
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Cost summary */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Cost Summary</Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Subtotal</Text>
                    <Text as="span" variant="bodyMd">${po.subtotal.toFixed(2)}</Text>
                  </InlineStack>
                  {po.freightCost > 0 && (
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Freight</Text>
                      <Text as="span" variant="bodyMd">${po.freightCost.toFixed(2)}</Text>
                    </InlineStack>
                  )}
                  {po.tax > 0 && (
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Tax</Text>
                      <Text as="span" variant="bodyMd">${po.tax.toFixed(2)}</Text>
                    </InlineStack>
                  )}
                  {po.discounts > 0 && (
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Discounts</Text>
                      <Text as="span" variant="bodyMd" tone="success">−${po.discounts.toFixed(2)}</Text>
                    </InlineStack>
                  )}
                  {po.otherCosts > 0 && (
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Other Costs</Text>
                      <Text as="span" variant="bodyMd">${po.otherCosts.toFixed(2)}</Text>
                    </InlineStack>
                  )}
                  {po.adjustment !== 0 && (
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Adjustment</Text>
                      <Text as="span" variant="bodyMd">${po.adjustment.toFixed(2)}</Text>
                    </InlineStack>
                  )}
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">Total Landed Cost</Text>
                    <Text as="span" variant="headingMd" fontWeight="bold">
                      ${po.totalLandedCost.toFixed(2)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* Status actions */}
              {transitions.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">Actions</Text>
                    <Divider />
                    <BlockStack gap="200">
                      {transitions.map((t) => (
                        <Button
                          key={t.next}
                          variant={t.next === "cancelled" ? undefined : "primary"}
                          tone={t.next === "cancelled" ? "critical" : undefined}
                          fullWidth
                          onClick={() => changeStatus(t.next)}
                        >
                          {t.label}
                        </Button>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>
              )}

              {po.status === "received" && (
                <Banner tone="success">
                  <Text as="p" variant="bodyMd">This PO has been fully received.</Text>
                </Banner>
              )}
              {po.status === "cancelled" && (
                <Banner tone="critical">
                  <Text as="p" variant="bodyMd">This PO has been cancelled.</Text>
                </Banner>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
