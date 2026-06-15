import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Box,
  Button,
  Divider,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [openPOs, openOffers, supplierCount, recentPOs, pendingReceiptPOs] =
    await Promise.all([
      prisma.purchaseOrder.count({ where: { shop, status: { in: ["open", "in_transit"] } } }),
      prisma.offer.count({ where: { shop, status: { in: ["draft", "reserved", "partial"] } } }),
      prisma.supplier.count({ where: { shop } }),
      prisma.purchaseOrder.findMany({
        where: { shop },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { supplier: { select: { name: true } } },
      }),
      // Only POs actually in transit or partially received need action
      prisma.purchaseOrder.findMany({
        where: { shop, status: { in: ["in_transit", "partially_received"] } },
        orderBy: { createdAt: "desc" },
        include: { supplier: { select: { name: true } } },
      }),
    ]);

  return { openPOs, openOffers, pendingReceipts: pendingReceiptPOs.length, supplierCount, recentPOs, pendingReceiptPOs };
};

function StatCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "critical" | "info";
  onClick?: () => void;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="heading2xl" fontWeight="bold">
          {String(value)}
        </Text>
        {tone && (
          <Badge tone={tone}>
            {tone === "success"
              ? "On track"
              : tone === "warning"
                ? "Needs attention"
                : tone === "critical"
                  ? "Action required"
                  : "Active"}
          </Badge>
        )}
      </BlockStack>
    </Card>
  );
}

export default function Dashboard() {
  const { openPOs, openOffers, pendingReceipts, supplierCount, recentPOs, pendingReceiptPOs } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page>
      <TitleBar title="ShelfFlow" />
      <BlockStack gap="600">
        <InlineGrid columns={4} gap="400">
          <StatCard label="Open Purchase Orders" value={openPOs} tone={openPOs > 0 ? "info" : undefined} />
          <StatCard label="Open Offers / Reserves" value={openOffers} tone={openOffers > 0 ? "info" : undefined} />
          <StatCard label="Pending Receipts" value={pendingReceipts} tone={pendingReceipts > 0 ? "warning" : undefined} />
          <StatCard label="Suppliers" value={supplierCount} />
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Recent Purchase Orders
                    </Text>
                    <Button
                      variant="plain"
                      onClick={() => navigate("/app/purchase-orders")}
                    >
                      View all
                    </Button>
                  </InlineStack>
                  <Divider />
                  {recentPOs.length === 0 ? (
                    <Box paddingBlock="600">
                      <BlockStack gap="200" align="center">
                        <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                          No purchase orders yet.
                        </Text>
                        <Button variant="primary" onClick={() => navigate("/app/purchase-orders/new")}>
                          Create first PO
                        </Button>
                      </BlockStack>
                    </Box>
                  ) : (
                    <BlockStack gap="200">
                      {recentPOs.map((po) => (
                        <InlineStack key={po.id} align="space-between" blockAlign="center">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">{po.poNumber}</Text>
                          <Text as="span" variant="bodyMd" tone="subdued">{po.supplier.name}</Text>
                          <Text as="span" variant="bodyMd">${po.totalLandedCost.toFixed(2)}</Text>
                          <Badge tone={po.status === "received" ? "success" : po.status === "open" ? "info" : undefined}>
                            {po.status}
                          </Badge>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Pending Receipts
                    </Text>
                    <Button
                      variant="plain"
                      onClick={() => navigate("/app/receiving")}
                    >
                      View all
                    </Button>
                  </InlineStack>
                  <Divider />
                  {pendingReceiptPOs.length === 0 ? (
                    <Box paddingBlock="600">
                      <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                        No items pending receipt.
                      </Text>
                    </Box>
                  ) : (
                    <BlockStack gap="200">
                      {pendingReceiptPOs.map((po) => (
                        <InlineStack key={po.id} align="space-between" blockAlign="center">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">{po.poNumber}</Text>
                          <Text as="span" variant="bodyMd" tone="subdued">{po.supplier.name}</Text>
                          <Badge tone={po.status === "partially_received" ? "warning" : "info"}>
                            {po.status === "partially_received" ? "Partial" : "In Transit"}
                          </Badge>
                          <Button
                            variant="plain"
                            onClick={() => navigate(`/app/receiving`)}
                          >
                            Receive
                          </Button>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Quick Actions
                  </Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Button
                      fullWidth
                      textAlign="left"
                      onClick={() => navigate("/app/purchase-orders")}
                    >
                      Create Purchase Order
                    </Button>
                    <Button
                      fullWidth
                      textAlign="left"
                      onClick={() => navigate("/app/offers")}
                    >
                      Create Offer / Reserve
                    </Button>
                    <Button
                      fullWidth
                      textAlign="left"
                      onClick={() => navigate("/app/receiving")}
                    >
                      Receive Stock
                    </Button>
                    <Button
                      fullWidth
                      textAlign="left"
                      onClick={() => navigate("/app/imports")}
                    >
                      Import CSV
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Shopify Sync
                  </Text>
                  <Divider />
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No pending inventory or price updates.
                  </Text>
                  <Button fullWidth disabled>
                    Review &amp; Sync
                  </Button>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
