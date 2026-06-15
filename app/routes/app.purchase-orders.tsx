import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  EmptyState,
  BlockStack,
  InlineStack,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

type POStatus = "draft" | "open" | "in_transit" | "partially_received" | "received" | "cancelled";

const statusBadge: Record<POStatus, { tone: "info" | "warning" | "success" | "critical" | undefined; label: string }> = {
  draft: { tone: undefined, label: "Draft" },
  open: { tone: "info", label: "Open" },
  in_transit: { tone: "warning", label: "In Transit" },
  partially_received: { tone: "warning", label: "Partial" },
  received: { tone: "success", label: "Received" },
  cancelled: { tone: "critical", label: "Cancelled" },
};

const purchaseOrders: { id: string; poNumber: string; supplier: string; status: POStatus; items: number; subtotal: string; landedCost: string; createdAt: string }[] = [];

export default function PurchaseOrders() {
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(purchaseOrders);

  const rowMarkup = purchaseOrders.map(
    ({ id, poNumber, supplier, status, items, subtotal, landedCost, createdAt }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {poNumber}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{supplier}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={statusBadge[status].tone}>{statusBadge[status].label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{items}</IndexTable.Cell>
        <IndexTable.Cell>{subtotal}</IndexTable.Cell>
        <IndexTable.Cell>{landedCost}</IndexTable.Cell>
        <IndexTable.Cell>{createdAt}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first purchase order"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <Text as="p" variant="bodyMd">
        Track incoming inventory, costs, and landed cost calculations from
        supplier to shelf.
      </Text>
    </EmptyState>
  );

  return (
    <Page>
      <TitleBar title="Purchase Orders">
        <button variant="primary">Create PO</button>
      </TitleBar>
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "purchase order", plural: "purchase orders" }}
          itemCount={purchaseOrders.length}
          selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          emptyState={emptyStateMarkup}
          headings={[
            { title: "PO #" },
            { title: "Supplier" },
            { title: "Status" },
            { title: "Items" },
            { title: "Subtotal" },
            { title: "Landed Cost" },
            { title: "Created" },
          ]}
          bulkActions={[
            { content: "Mark received", onAction: () => {} },
            { content: "Export", onAction: () => {} },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
