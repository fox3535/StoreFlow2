import { useRef, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  Box,
  List,
  Button,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

function StepCircle({ step, current }: { step: number; current: number }) {
  const done   = step < current;
  const active = step === current;
  const bg     = done ? "#008060" : active ? "#005bd3" : "#e4e5e7";
  const color  = done || active ? "#fff" : "#8c9196";
  const labels = ["", "Upload CSV", "Map Columns", "Review Rows", "Import"];
  return (
    <InlineStack gap="200" blockAlign="center">
      <div style={{
        width: 28, height: 28, borderRadius: "50%", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontWeight: 700, fontSize: 13, color,
      }}>
        {done ? "✓" : step}
      </div>
      <Text
        as="span" variant="bodyMd"
        fontWeight={active ? "semibold" : undefined}
        tone={!done && !active ? "disabled" : undefined}
      >
        {labels[step]}
      </Text>
    </InlineStack>
  );
}

export default function Imports() {
  const currentStep = 1;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file && file.name.endsWith(".csv")) setSelectedFile(file);
  }

  return (
    <Page fullWidth>
      <TitleBar title="Import CSV" />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, alignItems: "start" }}>
        {/* Left: steps + upload */}
        <BlockStack gap="400">
          {/* Step indicator */}
          <Card>
            <InlineStack gap="400" blockAlign="center" wrap={false}>
              <StepCircle step={1} current={currentStep} />
              <Text as="span" tone="disabled" variant="bodyMd">→</Text>
              <StepCircle step={2} current={currentStep} />
              <Text as="span" tone="disabled" variant="bodyMd">→</Text>
              <StepCircle step={3} current={currentStep} />
              <Text as="span" tone="disabled" variant="bodyMd">→</Text>
              <StepCircle step={4} current={currentStep} />
            </InlineStack>
          </Card>

          {/* Upload area */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Upload Supplier CSV</Text>
              <Divider />

              {selectedFile ? (
                <Banner tone="success">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">{selectedFile.name}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {(selectedFile.size / 1024).toFixed(1)} KB — ready to map columns
                      </Text>
                    </BlockStack>
                    <Button size="slim" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                      Remove
                    </Button>
                  </InlineStack>
                </Banner>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? "#005bd3" : "#c9cccf"}`,
                    borderRadius: 8,
                    padding: "48px 24px",
                    background: dragOver ? "#f3f6ff" : "#fafbfb",
                    transition: "all 0.15s",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                >
                  <div style={{ fontSize: 32, lineHeight: 1 }}>📂</div>
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    Drop your CSV file here or click to browse
                  </Text>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Choose File
                    </Button>
                  </div>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    Supports .csv files up to 10 MB
                  </Text>
                </div>
              )}

              {/* Hidden real file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />

              {selectedFile && (
                <Box paddingBlockStart="200">
                  <Button variant="primary" disabled>
                    Continue to Column Mapping →
                  </Button>
                </Box>
              )}
            </BlockStack>
          </Card>

          {/* Expected format */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Expected CSV Format</Text>
              <Divider />
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                      {["Column", "Required", "Description"].map((h) => (
                        <th key={h} style={{ padding: "6px 12px", textAlign: "left", color: "#6d7175", fontWeight: 600, fontSize: 11, textTransform: "uppercase", background: "#fafbfb" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["supplier_sku",  "Yes",      "Your supplier's item code"],
                      ["description",   "Yes",      "Product name or description"],
                      ["unit_cost",     "Yes",      "Unit cost in supplier currency"],
                      ["sku",           "Recommended", "Shopify variant SKU for matching"],
                      ["barcode",       "Optional", "Barcode for matching"],
                      ["pack_size",     "Optional", "Units per pack (default: 1)"],
                      ["currency",      "Optional", "Override currency (e.g. CAD)"],
                    ].map(([col, req, desc]) => (
                      <tr key={col} style={{ borderBottom: "1px solid #f1f2f3" }}>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 600, color: "#005bd3" }}>{col}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <Badge tone={req === "Yes" ? "critical" : req === "Recommended" ? "attention" : undefined}>{req}</Badge>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#6d7175" }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </BlockStack>
          </Card>
        </BlockStack>

        {/* Right: rules + notes */}
        <div style={{ position: "sticky", top: 16 }}>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Matching Rules</Text>
                <Divider />
                <BlockStack gap="200">
                  {[
                    { label: "SKU",          tone: "success" as const },
                    { label: "Barcode",       tone: "success" as const },
                    { label: "Supplier SKU",  tone: "success" as const },
                    { label: "Product Title", tone: "attention" as const },
                  ].map(({ label, tone }) => (
                    <InlineStack key={label} gap="200" blockAlign="center">
                      <Badge tone={tone}>{tone === "success" ? "Supported" : "Fuzzy"}</Badge>
                      <Text as="span" variant="bodyMd">{label}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Notes</Text>
                <Divider />
                <List>
                  <List.Item>Product must exist in Shopify to be matched</List.Item>
                  <List.Item>Supplier mappings are created or updated automatically</List.Item>
                  <List.Item>Unmatched rows are flagged for manual review</List.Item>
                  <List.Item>Sync products from Shopify first for best results</List.Item>
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </div>
    </Page>
  );
}
