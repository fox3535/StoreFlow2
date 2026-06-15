import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
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
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";

import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../models/settings.server";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getSettings(session.shop);
  return json({ settings, shop: session.shop });
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const defaultCurrency = (formData.get("defaultCurrency") as string) || "USD";
  const receivingDefault = (formData.get("receivingDefault") as string) || "restock";
  const syncMode = (formData.get("syncMode") as string) || "manual";

  await saveSettings(session.shop, { defaultCurrency, receivingDefault, syncMode });

  return json({ success: true });
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CURRENCY_OPTIONS = [
  { label: "USD — US Dollar", value: "USD" },
  { label: "CAD — Canadian Dollar", value: "CAD" },
  { label: "GBP — British Pound", value: "GBP" },
  { label: "EUR — Euro", value: "EUR" },
  { label: "AUD — Australian Dollar", value: "AUD" },
  { label: "JPY — Japanese Yen", value: "JPY" },
  { label: "CNY — Chinese Yuan", value: "CNY" },
];

const RECEIVING_CHOICES = [
  { label: "Restock — add quantity to Shopify inventory", value: "restock" },
  { label: "Credit — log receipt without updating stock", value: "credit" },
  { label: "Ignore — receive but take no action", value: "ignore" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Settings() {
  const { settings, shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isSaving = navigation.state === "submitting";

  const [currency, setCurrency] = useState(settings.defaultCurrency);
  const [receivingDefault, setReceivingDefault] = useState([settings.receivingDefault]);
  const [syncMode, setSyncMode] = useState([settings.syncMode]);

  useEffect(() => {
    if ((actionData as any)?.success) {
      shopify.toast.show("Settings saved");
    }
  }, [actionData, shopify]);

  function handleSave() {
    const formData = new FormData();
    formData.append("defaultCurrency", currency);
    formData.append("receivingDefault", receivingDefault[0]);
    formData.append("syncMode", syncMode[0]);
    submit(formData, { method: "post" });
  }

  return (
    <Page>
      <TitleBar title="Settings">
        <button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </TitleBar>

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {(actionData as any)?.success && (
              <Banner tone="success">Settings saved successfully.</Banner>
            )}

            {/* Store connection */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Store Connection</Text>
                <Divider />
                <InlineStack gap="300" blockAlign="center">
                  <Text as="p" variant="bodyMd" tone="subdued">Status</Text>
                  <Badge tone="success">Connected</Badge>
                </InlineStack>
                <TextField
                  label="Store domain"
                  value={shop}
                  disabled
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            {/* Default currency */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Default Currency</Text>
                <Divider />
                <Select
                  label="Base currency for new purchase orders"
                  options={CURRENCY_OPTIONS}
                  value={currency}
                  onChange={setCurrency}
                />
                <Text as="p" variant="bodySm" tone="subdued">
                  Exchange rates can be overridden per purchase order.
                </Text>
              </BlockStack>
            </Card>

            {/* Receiving defaults */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Receiving Defaults</Text>
                <Divider />
                <ChoiceList
                  title="Default action when receiving items"
                  choices={RECEIVING_CHOICES}
                  selected={receivingDefault}
                  onChange={setReceivingDefault}
                />
              </BlockStack>
            </Card>

            {/* Shopify sync */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Shopify Sync</Text>
                <Divider />
                <ChoiceList
                  title="Inventory and price sync mode"
                  choices={[
                    { label: "Manual — review and confirm before every sync", value: "manual" },
                  ]}
                  selected={syncMode}
                  onChange={setSyncMode}
                />
                <Text as="p" variant="bodySm" tone="subdued">
                  Sync is always manual in ShelfFlow. Price updates must be reviewed before write-back.
                </Text>
              </BlockStack>
            </Card>

            <Box paddingBlockStart="200">
              <InlineStack gap="300">
                <Button variant="primary" onClick={handleSave} loading={isSaving}>
                  Save Settings
                </Button>
              </InlineStack>
            </Box>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">About ShelfFlow</Text>
                <Divider />
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Version</Text>
                  <Text as="p" variant="bodyMd">1.0.0</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Stack</Text>
                  <Text as="p" variant="bodyMd">React Router · Polaris · Prisma · SQLite</Text>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Data</Text>
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
