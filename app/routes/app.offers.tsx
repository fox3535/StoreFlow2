import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  EmptyState,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

type OfferStatus = "draft" | "reserved" | "partial" | "completed";

const statusBadge: Record<OfferStatus, { tone: "info" | "warning" | "success" | undefined; label: string }> = {
  draft: { tone: undefined, label: "Draft" },
  reserved: { tone: "info", label: "Reserved" },
  partial: { tone: "warning", label: "Partial" },
  completed: { tone: "success", label: "Completed" },
};

const offers: { id: string; offerNumber: string; supplier: string; status: OfferStatus; items: number; estimatedCost: string; eta: string; endDate: string }[] = [];

export default function Offers() {
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(offers);

  const rowMarkup = offers.map(
    ({ id, offerNumber, supplier, status, items, estimatedCost, eta, endDate }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {offerNumber}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{supplier}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={statusBadge[status].tone}>{statusBadge[status].label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{items}</IndexTable.Cell>
        <IndexTable.Cell>{estimatedCost}</IndexTable.Cell>
        <IndexTable.Cell>{eta}</IndexTable.Cell>
        <IndexTable.Cell>{endDate}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="No offers or reserves yet"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <Text as="p" variant="bodyMd">
        Track pre-purchase commitments before converting them to purchase
        orders. Prevent double ordering and monitor ETAs.
      </Text>
    </EmptyState>
  );

  return (
    <Page>
      <TitleBar title="Offers / Reserves">
        <button variant="primary">Create Offer</button>
      </TitleBar>
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "offer", plural: "offers" }}
          itemCount={offers.length}
          selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          emptyState={emptyStateMarkup}
          headings={[
            { title: "Offer #" },
            { title: "Supplier" },
            { title: "Status" },
            { title: "Items" },
            { title: "Est. Cost" },
            { title: "ETA" },
            { title: "End Date" },
          ]}
          bulkActions={[
            { content: "Convert to PO", onAction: () => {} },
            { content: "Mark completed", onAction: () => {} },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
