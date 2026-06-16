import { useState, useMemo } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  EmptyState,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Box,
  Divider,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getSuppliers } from "../models/supplier.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const suppliers = await getSuppliers(session.shop);
  return { suppliers };
};

export default function SuppliersIndex() {
  const { suppliers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.contactInfo ?? "").toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  const totalPOs = suppliers.reduce((s, sup) => s + sup._count.purchaseOrders, 0);
  const totalMappings = suppliers.reduce((s, sup) => s + sup._count.skuMappings, 0);

  const th: React.CSSProperties = {
    padding: "10px 16px", fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.06em", color: "#6d7175",
    borderBottom: "1px solid #e1e3e5", whiteSpace: "nowrap",
    background: "#fafbfb", overflow: "hidden", textOverflow: "ellipsis",
  };
  const td: React.CSSProperties = {
    padding: "10px 16px", borderBottom: "1px solid #f1f2f3",
    verticalAlign: "middle", whiteSpace: "nowrap",
    overflow: "hidden", textOverflow: "ellipsis",
  };

  const SUPPLIER_COLS = [
    { key: "name",     label: "Name",         align: "left" as const,  width: 200 },
    { key: "currency", label: "Currency",     align: "left" as const,  width: 96  },
    { key: "lead",     label: "Lead Time",    align: "left" as const,  width: 120 },
    { key: "contact",  label: "Contact",      align: "left" as const,  width: 280 },
    { key: "skus",     label: "SKU Mappings", align: "right" as const, width: 120 },
    { key: "pos",      label: "POs",          align: "right" as const, width: 72  },
    { key: "action",   label: "Action",       align: "right" as const, width: 88  },
  ];
  const supplierTableMin = SUPPLIER_COLS.reduce((s, c) => s + c.width, 0);

  return (
    <Page fullWidth>
      <TitleBar title="Suppliers">
        <button variant="primary" onClick={() => navigate("/app/suppliers/new")}>
          Add Supplier
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {/* Summary row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Total Suppliers</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{suppliers.length}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Total Purchase Orders</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{totalPOs}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">SKU Mappings</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{totalMappings}</Text>
            </BlockStack>
          </Card>
        </div>

        {/* Table card */}
        <Card padding="0">
          <Box paddingBlock="300" paddingInline="400">
            <div style={{ maxWidth: 340 }}>
              <TextField
                label="" labelHidden
                placeholder="Search suppliers…"
                value={search}
                onChange={setSearch}
                clearButton
                onClearButtonClick={() => setSearch("")}
                autoComplete="off"
              />
            </div>
          </Box>
          <Divider />

          {filtered.length === 0 ? (
            <Box paddingBlock="1600">
              <EmptyState
                heading={search ? "No suppliers match your search" : "Add your first supplier"}
                action={!search ? { content: "Add Supplier", onAction: () => navigate("/app/suppliers/new") } : undefined}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <Text as="p" variant="bodyMd">
                  {search ? "Try a different search term." : "Suppliers are required before creating purchase orders or offers."}
                </Text>
              </EmptyState>
            </Box>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: supplierTableMin, borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  {SUPPLIER_COLS.map((col) => (
                    <col key={col.key} style={{ width: col.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {SUPPLIER_COLS.map((col) => (
                      <th key={col.key} style={{ ...th, textAlign: col.align }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/app/suppliers/${s.id}`)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#f6f6f7"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                    >
                      <td style={{ ...td, textAlign: "left" }}>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{s.name}</Text>
                      </td>
                      <td style={{ ...td, textAlign: "left" }}>
                        <Badge>{s.currency}</Badge>
                      </td>
                      <td style={{ ...td, textAlign: "left", paddingRight: 32 }}>
                        {s.leadTimeDays > 0 ? `${s.leadTimeDays}d` : <span style={{ color: "#8c9196" }}>—</span>}
                      </td>
                      <td style={{ ...td, textAlign: "left", paddingLeft: 24 }}>
                        {s.contactInfo ?? <span style={{ color: "#8c9196" }}>—</span>}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{s._count.skuMappings}</td>
                      <td style={{ ...td, textAlign: "right" }}>{s._count.purchaseOrders}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <Button size="slim" variant="plain" onClick={() => navigate(`/app/suppliers/${s.id}`)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <Box paddingBlock="300" paddingInline="400">
              <Text as="p" variant="bodySm" tone="subdued">
                {filtered.length} {filtered.length === 1 ? "supplier" : "suppliers"}
              </Text>
            </Box>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
