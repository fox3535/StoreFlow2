import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  EmptyState,
  useIndexResourceState,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

type ReceivingStatus = "open" | "partially_received" | "in_transit";

const statusBadge: Record<ReceivingStatus, { tone: "info" | "warning"; label: string }> = {
  open: { tone: "info", label: "Open" },
  partially_received: { tone: "warning", label: "Partial" },
  in_transit: { tone: "warning", label: "In Transit" },
};

const pendingReceipts: {
  id: string;
  poNumber: string;
  supplier: string;
  status: ReceivingStatus;
  qtyOrdered: number;
  qtyReceived: number;
  qtyPending: number;
  expectedDate: string;
}[] = [];

export default function Receiving() {
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(pendingReceipts);

  const rowMarkup = pendingReceipts.map(
    ({ id, poNumber, supplier, status, qtyOrdered, qtyReceived, qtyPending, expectedDate }, index) => (
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
        <IndexTable.Cell>{qtyOrdered}</IndexTable.Cell>
        <IndexTable.Cell>{qtyReceived}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" tone={qtyPending > 0 ? "caution" : undefined}>
            {qtyPending}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{expectedDate}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="No items pending receipt"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd">
          Open purchase orders with outstanding quantities will appear here for
          receiving.
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Receive all, receive partial, reject, or backorder items. Average
          costs and landed costs update automatically on receipt.
        </Text>
      </BlockStack>
    </EmptyState>
  );

  return (
    <Page>
      <TitleBar title="Receiving" />
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "receipt", plural: "receipts" }}
          itemCount={pendingReceipts.length}
          selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          emptyState={emptyStateMarkup}
          headings={[
            { title: "PO #" },
            { title: "Supplier" },
            { title: "Status" },
            { title: "Ordered" },
            { title: "Received" },
            { title: "Pending" },
            { title: "Expected" },
          ]}
          bulkActions={[
            { content: "Receive all", onAction: () => {} },
            { content: "Mark backordered", onAction: () => {} },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
