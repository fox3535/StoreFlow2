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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getOffers } from "../models/offer.server";

const STATUS_BADGE: Record<string, { tone: "info" | "warning" | "success" | undefined; label: string }> = {
  draft:     { tone: undefined,  label: "Draft" },
  reserved:  { tone: "info",     label: "Reserved" },
  partial:   { tone: "warning",  label: "Partial" },
  completed: { tone: "success",  label: "Completed" },
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const offers = await getOffers(session.shop);
  return { offers };
};

export default function OffersIndex() {
  const { offers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(offers);

  const rowMarkup = offers.map(
    ({ id, supplierId, supplier, status, _count, totalEstimatedCost, eta, endDate, createdAt }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {`OFF-${id.slice(-6).toUpperCase()}`}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{supplier.name}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={STATUS_BADGE[status]?.tone}>
            {STATUS_BADGE[status]?.label ?? status}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{_count.items}</IndexTable.Cell>
        <IndexTable.Cell>${totalEstimatedCost.toFixed(2)}</IndexTable.Cell>
        <IndexTable.Cell>
          {eta ? new Date(eta).toLocaleDateString() : "—"}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {endDate ? new Date(endDate).toLocaleDateString() : "—"}
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="No offers or reserves yet"
      action={{ content: "Create Offer", onAction: () => navigate("/app/offers/new") }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <Text as="p" variant="bodyMd">
        Track pre-purchase commitments and prevent double ordering before
        converting to purchase orders.
      </Text>
    </EmptyState>
  );

  return (
    <Page>
      <TitleBar title="Offers / Reserves">
        <button variant="primary" onClick={() => navigate("/app/offers/new")}>
          Create Offer
        </button>
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
