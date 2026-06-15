import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
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
import { getSuppliers } from "../models/supplier.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const suppliers = await getSuppliers(session.shop);
  return { suppliers };
};

export default function SuppliersIndex() {
  const { suppliers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(suppliers);

  const rowMarkup = suppliers.map(
    ({ id, name, currency, leadTimeDays, contactInfo, _count }, index) => (
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
        <IndexTable.Cell>{contactInfo ?? "—"}</IndexTable.Cell>
        <IndexTable.Cell>{_count.skuMappings}</IndexTable.Cell>
        <IndexTable.Cell>{_count.purchaseOrders}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="Add your first supplier"
      action={{ content: "Add Supplier", onAction: () => navigate("/app/suppliers/new") }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <Text as="p" variant="bodyMd">
        Suppliers are required before creating purchase orders or offers.
      </Text>
    </EmptyState>
  );

  return (
    <Page>
      <TitleBar title="Suppliers">
        <button variant="primary" onClick={() => navigate("/app/suppliers/new")}>
          Add Supplier
        </button>
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
            { title: "SKU Mappings" },
            { title: "POs" },
          ]}
          bulkActions={[{ content: "Delete", onAction: () => {} }]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
