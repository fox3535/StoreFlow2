import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  EmptyState,
  useIndexResourceState,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getPurchaseOrders } from "../models/purchase-order.server";

const STATUS_BADGE: Record<string, { tone: "info" | "warning" | "success" | "critical" | undefined; label: string }> = {
  draft:               { tone: undefined,   label: "Draft" },
  open:                { tone: "info",      label: "Open" },
  in_transit:          { tone: "warning",   label: "In Transit" },
  partially_received:  { tone: "warning",   label: "Partial" },
  received:            { tone: "success",   label: "Received" },
  cancelled:           { tone: "critical",  label: "Cancelled" },
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const purchaseOrders = await getPurchaseOrders(session.shop);
  return { purchaseOrders };
};

export default function PurchaseOrdersIndex() {
  const { purchaseOrders } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(purchaseOrders);

  const rowMarkup = purchaseOrders.map(
    ({ id, poNumber, supplier, status, _count, subtotal, totalLandedCost, createdAt }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
        onClick={() => {}}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {poNumber}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{supplier.name}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={STATUS_BADGE[status]?.tone}>
            {STATUS_BADGE[status]?.label ?? status}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{_count.lineItems}</IndexTable.Cell>
        <IndexTable.Cell>${subtotal.toFixed(2)}</IndexTable.Cell>
        <IndexTable.Cell>${totalLandedCost.toFixed(2)}</IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(createdAt).toLocaleDateString()}
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first purchase order"
      action={{ content: "Create PO", onAction: () => navigate("/app/purchase-orders/new") }}
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
        <button variant="primary" onClick={() => navigate("/app/purchase-orders/new")}>
          Create PO
        </button>
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
            { content: "Export", onAction: () => {} },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
