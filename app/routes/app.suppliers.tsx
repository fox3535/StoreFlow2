import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Card, Text, BlockStack, EmptyState } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Suppliers() {
  return (
    <Page>
      <TitleBar title="Suppliers" />
      <Card>
        <BlockStack gap="400">
          <EmptyState
            heading="No suppliers yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p" variant="bodyMd">
              Add suppliers to manage contacts, currencies, lead times, and SKU
              mappings for your purchase orders.
            </Text>
          </EmptyState>
        </BlockStack>
      </Card>
    </Page>
  );
}
