import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Divider,
  Select,
  TextField,
  ChoiceList,
  Button,
  InlineStack,
  Badge,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Settings() {
  const [currency, setCurrency] = useState("USD");
  const [receivingDefault, setReceivingDefault] = useState(["restock"]);
  const [syncMode, setSyncMode] = useState(["manual"]);

  return (
    <Page>
      <TitleBar title="Settings">
        <button variant="primary">Save</button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Store Connection
                </Text>
                <Divider />
                <InlineStack gap="300" blockAlign="center">
                  <Text as="p" variant="bodyMd">Status</Text>
                  <Badge tone="success">Connected</Badge>
                </InlineStack>
                <TextField
                  label="Store domain"
                  value="storeflow-ud11iprp.myshopify.com"
                  disabled
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Default Currency
                </Text>
                <Divider />
                <Select
                  label="Base currency for purchase orders"
                  options={[
                    { label: "USD — US Dollar", value: "USD" },
                    { label: "CAD — Canadian Dollar", value: "CAD" },
                    { label: "GBP — British Pound", value: "GBP" },
                    { label: "EUR — Euro", value: "EUR" },
                    { label: "AUD — Australian Dollar", value: "AUD" },
                    { label: "JPY — Japanese Yen", value: "JPY" },
                    { label: "CNY — Chinese Yuan", value: "CNY" },
                  ]}
                  value={currency}
                  onChange={setCurrency}
                />
                <Text as="p" variant="bodySm" tone="subdued">
                  Exchange rates can be set per purchase order. This is the
                  default when creating a new PO.
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Receiving Defaults
                </Text>
                <Divider />
                <ChoiceList
                  title="Default action when receiving items"
                  choices={[
                    {
                      label: "Restock — add to Shopify inventory",
                      value: "restock",
                    },
                    {
                      label: "Credit — log receipt without updating stock",
                      value: "credit",
                    },
                    {
                      label: "Ignore — receive but take no action",
                      value: "ignore",
                    },
                  ]}
                  selected={receivingDefault}
                  onChange={setReceivingDefault}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Shopify Sync
                </Text>
                <Divider />
                <ChoiceList
                  title="Inventory and price sync mode"
                  choices={[
                    {
                      label: "Manual — review and confirm before every sync",
                      value: "manual",
                    },
                  ]}
                  selected={syncMode}
                  onChange={setSyncMode}
                />
                <Text as="p" variant="bodySm" tone="subdued">
                  Sync is always manual in ShelfFlow. Price updates must be
                  reviewed before write-back.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  About ShelfFlow
                </Text>
                <Divider />
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Version</Text>
                  <Text as="p" variant="bodyMd">1.0.0</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Stack</Text>
                  <Text as="p" variant="bodyMd">React Router · Polaris · Prisma</Text>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Data
                </Text>
                <Divider />
                <Text as="p" variant="bodyMd" tone="subdued">
                  All ShelfFlow data is stored separately from Shopify. Syncing
                  is always explicit and store-scoped.
                </Text>
                <Box paddingBlockStart="200">
                  <Button variant="plain" tone="critical">
                    Clear all app data
                  </Button>
                </Box>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
