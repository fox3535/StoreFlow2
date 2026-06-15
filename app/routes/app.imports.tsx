import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  Box,
  List,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

function StepIndicator({ step, current }: { step: number; current: number }) {
  const done = step < current;
  const active = step === current;
  return (
    <InlineStack gap="200" blockAlign="center">
      <Box
        background={done ? "bg-fill-success" : active ? "bg-fill-emphasis" : "bg-fill-disabled"}
        borderRadius="full"
        minWidth="28px"
        minHeight="28px"
      >
        <Text
          as="span"
          variant="bodySm"
          fontWeight="semibold"
          tone={done || active ? undefined : "disabled"}
          alignment="center"
        >
          {done ? "✓" : String(step)}
        </Text>
      </Box>
      <Text
        as="span"
        variant="bodyMd"
        fontWeight={active ? "semibold" : undefined}
        tone={!done && !active ? "disabled" : undefined}
      >
        {step === 1 && "Upload CSV"}
        {step === 2 && "Map Columns"}
        {step === 3 && "Review Rows"}
        {step === 4 && "Import"}
      </Text>
    </InlineStack>
  );
}

export default function Imports() {
  const currentStep = 1;

  return (
    <Page>
      <TitleBar title="Import CSV" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="600" blockAlign="center">
                  <StepIndicator step={1} current={currentStep} />
                  <Text as="span" tone="disabled">→</Text>
                  <StepIndicator step={2} current={currentStep} />
                  <Text as="span" tone="disabled">→</Text>
                  <StepIndicator step={3} current={currentStep} />
                  <Text as="span" tone="disabled">→</Text>
                  <StepIndicator step={4} current={currentStep} />
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Upload Supplier CSV
                </Text>
                <Divider />
                <Box
                  background="bg-surface-secondary"
                  borderRadius="200"
                  borderWidth="025"
                  borderColor="border-secondary"
                  padding="800"
                >
                  <BlockStack gap="300" align="center">
                    <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                      Drop your CSV file here or click to browse
                    </Text>
                    <Button>Choose file</Button>
                    <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                      Supports .csv files up to 10MB
                    </Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Matching Rules
                </Text>
                <Divider />
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="success">Supported</Badge>
                    <Text as="span" variant="bodyMd">SKU</Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="success">Supported</Badge>
                    <Text as="span" variant="bodyMd">Barcode</Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="success">Supported</Badge>
                    <Text as="span" variant="bodyMd">Supplier SKU</Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="critical">Not required</Badge>
                    <Text as="span" variant="bodyMd">Product ID</Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Notes
                </Text>
                <Divider />
                <List>
                  <List.Item>
                    Product must exist in Shopify to be matched
                  </List.Item>
                  <List.Item>
                    Supplier mappings are created or updated automatically
                  </List.Item>
                  <List.Item>
                    Unmatched rows are flagged for manual review
                  </List.Item>
                  <List.Item>
                    Never include Shopify product IDs in the file
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
