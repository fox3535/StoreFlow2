import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Card, Text, BlockStack, EmptyState } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Products() {
  return (
    <Page>
      <TitleBar title="Products" />
      <Card>
        <BlockStack gap="400">
          <EmptyState
            heading="No products synced yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p" variant="bodyMd">
              Products from your Shopify store will appear here with SKU
              mappings, average cost, average landed cost, and current stock
              levels.
            </Text>
          </EmptyState>
        </BlockStack>
      </Card>
    </Page>
  );
}
