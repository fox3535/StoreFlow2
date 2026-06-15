import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Card, Text, BlockStack, EmptyState } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Offers() {
  return (
    <Page>
      <TitleBar title="Offers / Reserves" />
      <Card>
        <BlockStack gap="400">
          <EmptyState
            heading="No offers or reserves yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p" variant="bodyMd">
              Track pre-purchase offers and reserved inventory before purchase
              orders are created. Prevent double ordering and monitor ETAs.
            </Text>
          </EmptyState>
        </BlockStack>
      </Card>
    </Page>
  );
}
