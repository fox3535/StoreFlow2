import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Dashboard() {
  return (
    <Page>
      <TitleBar title="ShelfFlow" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Purchase Orders
                  </Text>
                  <Badge tone="info">Coming soon</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Track open, in-transit, and received purchase orders.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Offers / Reserves
                  </Text>
                  <Badge tone="info">Coming soon</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Manage outstanding offers and reserved inventory before POs
                  are created.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Receiving
                  </Text>
                  <Badge tone="info">Coming soon</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Receive, reject, or backorder incoming stock and update
                  average costs.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    ShelfFlow
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Purchase orders, supplier management, inventory receiving,
                    landed cost tracking, and manual Shopify sync — all in one
                    place.
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Stack
                  </Text>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd">
                      React Router (Remix)
                    </Text>
                    <Text as="p" variant="bodyMd">
                      Shopify Polaris
                    </Text>
                    <Text as="p" variant="bodyMd">
                      Shopify App Bridge
                    </Text>
                    <Text as="p" variant="bodyMd">
                      Prisma + SQLite
                    </Text>
                    <Text as="p" variant="bodyMd">
                      TypeScript
                    </Text>
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
