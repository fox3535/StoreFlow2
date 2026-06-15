import type { LoaderFunctionArgs } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
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
  const navigate = useNavigate();

  return (
    <Page>
      <TitleBar title="ShelfFlow" />
      <BlockStack gap="600">
        <InlineGrid columns={4} gap="400">
          <StatCard label="Open Purchase Orders" value={0} tone="info" />
          <StatCard label="Open Offers / Reserves" value={0} tone="info" />
          <StatCard label="Pending Receipts" value={0} tone="warning" />
          <StatCard label="Suppliers" value={0} />
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
                  <Box paddingBlock="600">
                    <BlockStack gap="200" align="center">
                      <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                        No purchase orders yet.
                      </Text>
                      <Button
                        variant="primary"
                        onClick={() => navigate("/app/purchase-orders")}
                      >
                        Create first PO
                      </Button>
                    </BlockStack>
                  </Box>
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
                  <Box paddingBlock="600">
                    <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                      No items pending receipt.
                    </Text>
                  </Box>
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
