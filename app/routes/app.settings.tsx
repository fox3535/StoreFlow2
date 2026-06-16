import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
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
import { LocalInventoryNotice } from "../components/LocalInventoryNotice";
import { getSettings, saveSettings } from "../models/settings.server";

// ---------------------------------------------------------------------------
// Loader / Action
// ---------------------------------------------------------------------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getSettings(session.shop);
  return json({ settings, shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const defaultCurrency  = (formData.get("defaultCurrency")  as string) || "USD";
  const receivingDefault = (formData.get("receivingDefault") as string) || "restock";
  const syncMode         = (formData.get("syncMode")         as string) || "manual";

  await saveSettings(session.shop, { defaultCurrency, receivingDefault, syncMode });
  return json({ success: true });
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CURRENCY_OPTIONS = [
  { label: "USD — US Dollar",         value: "USD" },
  { label: "CAD — Canadian Dollar",   value: "CAD" },
  { label: "GBP — British Pound",     value: "GBP" },
  { label: "EUR — Euro",              value: "EUR" },
  { label: "AUD — Australian Dollar", value: "AUD" },
  { label: "JPY — Japanese Yen",      value: "JPY" },
  { label: "CNY — Chinese Yuan",      value: "CNY" },
];

const RECEIVING_CHOICES = [
  { label: "Restock — update ShelfFlow local quantity (Shopify unchanged in V1)", value: "restock" },
  { label: "Credit — log receipt without updating local stock", value: "credit" },
  { label: "Ignore — receive but take no stock action", value: "ignore" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Settings() {
  const { settings, shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit     = useSubmit();
  const navigation = useNavigation();
  const shopify    = useAppBridge();

  const isSaving = navigation.state === "submitting";

  const [currency,          setCurrency]         = useState(settings.defaultCurrency);
  const [receivingDefault,  setReceivingDefault] = useState([settings.receivingDefault]);
  const [syncMode,          setSyncMode]         = useState([settings.syncMode]);

  useEffect(() => {
    if ((actionData as any)?.success) shopify.toast.show("Settings saved");
  }, [actionData, shopify]);

  function handleSave() {
    const fd = new FormData();
    fd.append("defaultCurrency",  currency);
    fd.append("receivingDefault", receivingDefault[0]);
    fd.append("syncMode",         syncMode[0]);
    submit(fd, { method: "post" });
  }

  return (
    <Page fullWidth>
      <TitleBar title="Settings">
        <button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save Settings"}
        </button>
      </TitleBar>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, alignItems: "start" }}>
        {/* Left: setting sections */}
        <BlockStack gap="400">
          {(actionData as any)?.success && (
            <Banner tone="success" onDismiss={() => {}}>Settings saved successfully.</Banner>
          )}

          {/* Store connection */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Store Connection</Text>
                <Badge tone="success">Connected</Badge>
              </InlineStack>
              <Divider />
              <TextField
                label="Store domain"
                value={shop}
                disabled
                autoComplete="off"
                helpText="Your Shopify store domain. ShelfFlow data is scoped to this store."
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
                Exchange rates can be overridden per purchase order. This only affects new POs.
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
              <Text as="p" variant="bodySm" tone="subdued">
                Receiving updates ShelfFlow local stock and average costs only. Shopify inventory is not modified in V1.
              </Text>
            </BlockStack>
          </Card>

          <LocalInventoryNotice />

          {/* Shopify sync */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Shopify Sync Mode</Text>
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
                Sync is always manual in ShelfFlow V1. Price and inventory write-backs must be reviewed before applying to Shopify.
              </Text>
            </BlockStack>
          </Card>

          <Box>
            <InlineStack gap="300">
              <Button variant="primary" onClick={handleSave} loading={isSaving}>
                Save Settings
              </Button>
            </InlineStack>
          </Box>
        </BlockStack>

        {/* Right: about + data */}
        <div style={{ position: "sticky", top: 16 }}>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">About ShelfFlow</Text>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="p" variant="bodySm" tone="subdued">Version</Text>
                  <Badge>1.0.0</Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" variant="bodySm" tone="subdued">Framework</Text>
                  <Text as="p" variant="bodySm">Remix + Polaris</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" variant="bodySm" tone="subdued">Database</Text>
                  <Text as="p" variant="bodySm">PostgreSQL (Neon)</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" variant="bodySm" tone="subdued">ORM</Text>
                  <Text as="p" variant="bodySm">Prisma</Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Data & Privacy</Text>
                <Divider />
                <Text as="p" variant="bodySm" tone="subdued">
                  All ShelfFlow data is stored separately from Shopify in your dedicated Neon PostgreSQL database. Syncing is always explicit and store-scoped.
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  No data is shared between stores.
                </Text>
                <Box paddingBlockStart="100">
                  <Button variant="plain" tone="critical" disabled>
                    Clear all app data
                  </Button>
                </Box>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </div>
    </Page>
  );
}
