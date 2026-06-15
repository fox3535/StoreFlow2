import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Card,
  IndexTable,
  Text,
  EmptyState,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const suppliers: { id: string; name: string; currency: string; leadTimeDays: number; contact: string; skuCount: number }[] = [];

export default function Suppliers() {
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(suppliers);

  const rowMarkup = suppliers.map(
    ({ id, name, currency, leadTimeDays, contact, skuCount }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{currency}</IndexTable.Cell>
        <IndexTable.Cell>{leadTimeDays} days</IndexTable.Cell>
        <IndexTable.Cell>{contact}</IndexTable.Cell>
        <IndexTable.Cell>{skuCount}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="Add your first supplier"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <Text as="p" variant="bodyMd">
        Manage supplier contacts, currencies, lead times, and SKU mappings for
        purchase orders.
      </Text>
    </EmptyState>
  );

  return (
    <Page>
      <TitleBar title="Suppliers">
        <button variant="primary">Add Supplier</button>
      </TitleBar>
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "supplier", plural: "suppliers" }}
          itemCount={suppliers.length}
          selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          emptyState={emptyStateMarkup}
          headings={[
            { title: "Name" },
            { title: "Currency" },
            { title: "Lead Time" },
            { title: "Contact" },
            { title: "SKUs" },
          ]}
          bulkActions={[
            { content: "Delete", onAction: () => {} },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
