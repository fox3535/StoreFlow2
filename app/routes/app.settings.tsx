import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Card, Text, BlockStack, FormLayout } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Settings() {
  return (
    <Page>
      <TitleBar title="Settings" />
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            App Settings
          </Text>
          <FormLayout>
            <Text as="p" variant="bodyMd" tone="subdued">
              Settings will be configured here — default currency, sync
              preferences, receiving defaults, and store connection details.
            </Text>
          </FormLayout>
        </BlockStack>
      </Card>
    </Page>
  );
}
