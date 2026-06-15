import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Card, Text, BlockStack, EmptyState } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function PurchaseOrders() {
  return (
    <Page>
      <TitleBar title="Purchase Orders" />
      <Card>
        <BlockStack gap="400">
          <EmptyState
            heading="No purchase orders yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p" variant="bodyMd">
              Create your first purchase order to start tracking incoming
              inventory, costs, and landed cost calculations.
            </Text>
          </EmptyState>
        </BlockStack>
      </Card>
    </Page>
  );
}
