import { useMemo, useRef, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
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
  Select,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getSuppliers } from "../models/supplier.server";
import {
  executeCsvImport,
  previewCsvImport,
  type ImportFieldKey,
  type ImportPreviewRow,
  type ImportResult,
  type ImportRowInput,
} from "../models/import.server";
import { guessColumnMap, parseCsv, findHeaderIndex } from "../utils/csv";

const FIELD_DEFS: { key: ImportFieldKey; label: string; required: boolean }[] = [
  { key: "supplier_sku", label: "Supplier SKU", required: true },
  { key: "description", label: "Description", required: true },
  { key: "unit_cost", label: "Unit Cost", required: true },
  { key: "sku", label: "Shopify SKU", required: false },
  { key: "barcode", label: "Barcode", required: false },
  { key: "pack_size", label: "Pack Size", required: false },
  { key: "currency", label: "Currency", required: false },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const suppliers = await getSuppliers(session.shop);
  return json({ suppliers });
};

function buildRows(
  headers: string[],
  rows: string[][],
  columnMap: Record<ImportFieldKey, string>,
  supplierCurrency: string,
): ImportRowInput[] {
  const colIndex = (key: ImportFieldKey) => findHeaderIndex(headers, columnMap[key]);

  return rows.map((row, rowIndex) => {
    const get = (key: ImportFieldKey) => {
      const idx = colIndex(key);
      return idx >= 0 ? (row[idx] ?? "").trim() : "";
    };
    const supplierSku = get("supplier_sku") || get("sku");
    const description = get("description") || supplierSku;
    const unitCost = parseFloat(get("unit_cost").replace(/[$,]/g, "")) || 0;
    const packSize = parseInt(get("pack_size"), 10);

    return {
      rowIndex: rowIndex + 1,
      supplierSku,
      description,
      unitCost,
      sku: get("sku") || undefined,
      barcode: get("barcode") || undefined,
      packSize: Number.isFinite(packSize) && packSize > 0 ? packSize : 1,
      currency: get("currency") || supplierCurrency,
    };
  }).filter((r) => r.supplierSku);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const supplierId = String(formData.get("supplierId") ?? "");

  let rows: ImportRowInput[] = [];
  try {
    rows = JSON.parse(String(formData.get("rowsJson") ?? "[]"));
  } catch {
    return json({ ok: false, error: "Import rows could not be read." }, { status: 400 });
  }

  if (!supplierId) {
    return json({ ok: false, error: "Select a supplier." }, { status: 400 });
  }

  if (intent === "preview") {
    const preview = await previewCsvImport(session.shop, supplierId, rows);
    return json({ ok: true, preview });
  }

  if (intent === "import") {
    const result = await executeCsvImport(session.shop, supplierId, rows);
    return json({ ok: true, result });
  }

  return json({ ok: false }, { status: 400 });
};

function StepCircle({ step, current }: { step: number; current: number }) {
  const done = step < current;
  const active = step === current;
  const bg = done ? "#008060" : active ? "#005bd3" : "#e4e5e7";
  const color = done || active ? "#fff" : "#8c9196";
  const labels = ["", "Upload", "Map Columns", "Review", "Import"];
  return (
    <InlineStack gap="200" blockAlign="center">
      <div style={{
        width: 28, height: 28, borderRadius: "50%", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontWeight: 700, fontSize: 13, color,
      }}>
        {done ? "✓" : step}
      </div>
      <Text as="span" variant="bodyMd" fontWeight={active ? "semibold" : undefined} tone={!done && !active ? "disabled" : undefined}>
        {labels[step]}
      </Text>
    </InlineStack>
  );
}

export default function Imports() {
  const { suppliers } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<ImportFieldKey, string>>({
    supplier_sku: "", description: "", unit_cost: "", sku: "", barcode: "", pack_size: "", currency: "",
  });
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const isBusy = fetcher.state !== "idle";

  const importRows = useMemo(() => {
    if (!headers.length) return [];
    return buildRows(headers, rawRows, columnMap, supplier?.currency ?? "USD");
  }, [headers, rawRows, columnMap, supplier?.currency]);

  const previewRows: ImportPreviewRow[] | null =
    fetcher.data?.ok && fetcher.data && "preview" in fetcher.data
      ? fetcher.data.preview as ImportPreviewRow[]
      : null;
  const importResult: ImportResult | null =
    fetcher.data?.ok && fetcher.data && "result" in fetcher.data
      ? fetcher.data.result as ImportResult
      : null;

  const headerOptions = [{ label: "— Skip —", value: "" }, ...headers.map((h) => ({ label: h, value: h }))];

  async function loadFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    const guessed = guessColumnMap(parsed.headers);
    setSelectedFile(file);
    setCsvText(text);
    setHeaders(parsed.headers);
    setRawRows(parsed.rows);
    setColumnMap({
      supplier_sku: guessed.supplier_sku ?? "",
      description: guessed.description ?? "",
      unit_cost: guessed.unit_cost ?? "",
      sku: guessed.sku ?? "",
      barcode: guessed.barcode ?? "",
      pack_size: guessed.pack_size ?? "",
      currency: guessed.currency ?? "",
    });
    setStep(2);
  }

  function runPreview() {
    const fd = new FormData();
    fd.set("intent", "preview");
    fd.set("supplierId", supplierId);
    fd.set("rowsJson", JSON.stringify(importRows));
    fetcher.submit(fd, { method: "post" });
    setStep(3);
  }

  function runImport() {
    const fd = new FormData();
    fd.set("intent", "import");
    fd.set("supplierId", supplierId);
    fd.set("rowsJson", JSON.stringify(importRows));
    fetcher.submit(fd, { method: "post" });
    setStep(4);
  }

  function resetWizard() {
    setStep(1);
    setSelectedFile(null);
    setCsvText("");
    setHeaders([]);
    setRawRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const mappingValid = columnMap.supplier_sku && columnMap.description && columnMap.unit_cost && supplierId;

  return (
    <Page fullWidth>
      <TitleBar title="Import CSV" />

      {suppliers.length === 0 && (
        <Box paddingBlockEnd="400">
          <Banner tone="warning">
            <Text as="p">Add at least one supplier before importing CSV mappings.</Text>
          </Banner>
        </Box>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, alignItems: "start" }}>
        <BlockStack gap="400">
          <Card>
            <InlineStack gap="400" blockAlign="center" wrap={false}>
              <StepCircle step={1} current={step} />
              <Text as="span" tone="disabled">→</Text>
              <StepCircle step={2} current={step} />
              <Text as="span" tone="disabled">→</Text>
              <StepCircle step={3} current={step} />
              <Text as="span" tone="disabled">→</Text>
              <StepCircle step={4} current={step} />
            </InlineStack>
          </Card>

          {fetcher.data && !fetcher.data.ok && "error" in fetcher.data && (
            <Banner tone="critical"><Text as="p">{String(fetcher.data.error)}</Text></Banner>
          )}

          {step === 1 && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Upload Supplier CSV</Text>
                <Divider />
                {selectedFile ? (
                  <Banner tone="success">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" fontWeight="semibold">{selectedFile.name}</Text>
                      <Button size="slim" onClick={resetWizard}>Remove</Button>
                    </InlineStack>
                  </Banner>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".csv")) void loadFile(f); }}
                    style={{
                      border: `2px dashed ${dragOver ? "#005bd3" : "#c9cccf"}`,
                      borderRadius: 8, padding: "48px 24px",
                      background: dragOver ? "#f3f6ff" : "#fafbfb",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 12, cursor: "pointer",
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div style={{ fontSize: 32 }}>📂</div>
                    <Text as="p" tone="subdued" alignment="center">Drop your CSV file here or click to browse</Text>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button onClick={() => fileInputRef.current?.click()}>Choose File</Button>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); }} />
              </BlockStack>
            </Card>
          )}

          {step >= 2 && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Map Columns</Text>
                <Divider />
                <Select
                  label="Supplier"
                  options={suppliers.map((s) => ({ label: s.name, value: s.id }))}
                  value={supplierId}
                  onChange={setSupplierId}
                />
                {FIELD_DEFS.map((field) => (
                  <Select
                    key={field.key}
                    label={`${field.label}${field.required ? " *" : ""}`}
                    options={headerOptions}
                    value={columnMap[field.key]}
                    onChange={(v) => setColumnMap((prev) => ({ ...prev, [field.key]: v }))}
                  />
                ))}
                <Text as="p" variant="bodySm" tone="subdued">
                  {rawRows.length} row{rawRows.length === 1 ? "" : "s"} in file
                  {" · "}
                  {importRows.length > 0
                    ? `${importRows.length} ready to import from ${selectedFile?.name ?? "file"}.`
                    : "none mapped yet — check column mapping above."}
                </Text>
                {rawRows.length > 0 && importRows.length === 0 && (
                  <Banner tone="warning">
                    <Text as="p">
                      No importable rows yet. Map <strong>Supplier SKU</strong>, <strong>Description</strong>, and{" "}
                      <strong>Unit Cost</strong> to the correct columns. A lone SKU column is accepted as the supplier code.
                    </Text>
                  </Banner>
                )}
                <InlineStack gap="200">
                  <Button onClick={() => setStep(1)}>Back</Button>
                  <Button variant="primary" disabled={!mappingValid || isBusy} onClick={runPreview}>
                    Preview matches →
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          )}

          {step >= 3 && (isBusy || previewRows) && (
            <Card>
              <BlockStack gap="400">
                {isBusy && !previewRows ? (
                  <Text as="p" tone="subdued">Matching rows…</Text>
                ) : previewRows ? (
                  <>
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">Review Rows</Text>
                      <Text as="span" variant="bodyMd">
                        {previewRows.filter((r) => r.status === "matched").length} matched
                      </Text>
                    </InlineStack>
                    <Divider />
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={["Supplier SKU", "Description", "Cost", "Match", "Product"]}
                      rows={previewRows.slice(0, 50).map((row) => [
                        row.supplierSku,
                        row.description,
                        `$${row.unitCost.toFixed(2)}`,
                        row.status === "matched" ? (row.matchMethod ?? "matched") : "unmatched",
                        row.productTitle ?? "—",
                      ])}
                    />
                    {previewRows.length > 50 && (
                      <Text as="p" variant="bodySm" tone="subdued">Showing first 50 of {previewRows.length} rows.</Text>
                    )}
                    <InlineStack gap="200">
                      <Button onClick={() => setStep(2)}>Back</Button>
                      <Button
                        variant="primary"
                        loading={isBusy}
                        disabled={!previewRows.some((r) => r.status === "matched")}
                        onClick={runImport}
                      >
                        {`Import ${previewRows.filter((r) => r.status === "matched").length} matched rows`}
                      </Button>
                    </InlineStack>
                  </>
                ) : null}
              </BlockStack>
            </Card>
          )}

          {step === 4 && importResult && (
            <Card>
              <BlockStack gap="400">
                <Banner tone="success">
                  <Text as="p" fontWeight="semibold">Import complete</Text>
                  <Text as="p">
                    {importResult.created} created, {importResult.updated} updated, {importResult.unmatched} unmatched (skipped).
                  </Text>
                </Banner>
                <Button onClick={resetWizard}>Import another file</Button>
              </BlockStack>
            </Card>
          )}
        </BlockStack>

        <div style={{ position: "sticky", top: 16 }}>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Matching Rules</Text>
                <Divider />
                <List>
                  <List.Item>Match by Shopify SKU first</List.Item>
                  <List.Item>Then barcode</List.Item>
                  <List.Item>Then existing supplier SKU mapping</List.Item>
                  <List.Item>Then product title (fuzzy)</List.Item>
                </List>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Notes</Text>
                <Divider />
                <List>
                  <List.Item>Products must be synced from Shopify first</List.Item>
                  <List.Item>Unmatched rows are skipped — fix SKUs and re-import</List.Item>
                  <List.Item>Matched rows create or update supplier SKU mappings</List.Item>
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </div>
    </Page>
  );
}
