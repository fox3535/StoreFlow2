import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Card, Text, BlockStack, EmptyState } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Receiving() {
  return (
    <Page>
      <TitleBar title="Receiving" />
      <Card>
        <BlockStack gap="400">
          <EmptyState
            heading="No items pending receipt"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p" variant="bodyMd">
              Receive, reject, or backorder items from open purchase orders.
              Average costs and landed costs are updated automatically on
              receipt.
            </Text>
          </EmptyState>
        </BlockStack>
      </Card>
    </Page>
  );
}
