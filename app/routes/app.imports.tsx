import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Card, Text, BlockStack, EmptyState } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Imports() {
  return (
    <Page>
      <TitleBar title="Imports" />
      <Card>
        <BlockStack gap="400">
          <EmptyState
            heading="No imports yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p" variant="bodyMd">
              Upload a supplier CSV to import purchase order lines. Map columns
              by SKU, barcode, or supplier SKU. Unmatched rows are flagged for
              review.
            </Text>
          </EmptyState>
        </BlockStack>
      </Card>
    </Page>
  );
}
