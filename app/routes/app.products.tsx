import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Thumbnail,
  EmptyState,
  useIndexResourceState,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { ImageIcon } from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import { getProducts } from "../models/product.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const products = await getProducts(session.shop);
  return { products };
};

// keep type for row shape
const _unused: {
  id: string;
  title: string;
  sku: string;
  barcode: string;
  currentQuantity: number;
  currentPrice: string;
  avgCost: string;
  avgLandedCost: string;
  image?: string;
}[] = [];

export default function Products() {
  const { products } = useLoaderData<typeof loader>();
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(products);

  const rowMarkup = products.map(
    (
      { id, title, sku, barcode, currentQuantity, currentPrice, avgCost, avgLandedCost },
      index,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center">
            <Thumbnail
              source={ImageIcon}
              alt={title}
              size="small"
            />
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {title}
            </Text>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{sku}</IndexTable.Cell>
        <IndexTable.Cell>{barcode}</IndexTable.Cell>
        <IndexTable.Cell>{currentQuantity}</IndexTable.Cell>
        <IndexTable.Cell>{currentPrice}</IndexTable.Cell>
        <IndexTable.Cell>{avgCost}</IndexTable.Cell>
        <IndexTable.Cell>{avgLandedCost}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="No products synced yet"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <Text as="p" variant="bodyMd">
        Sync products from your Shopify store to track SKUs, average cost,
        landed cost, and stock levels alongside your purchase orders.
      </Text>
    </EmptyState>
  );

  return (
    <Page>
      <TitleBar title="Products">
        <button variant="primary">Sync from Shopify</button>
      </TitleBar>
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "product", plural: "products" }}
          itemCount={products.length}
          selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          emptyState={emptyStateMarkup}
          headings={[
            { title: "Product" },
            { title: "SKU" },
            { title: "Barcode" },
            { title: "Stock" },
            { title: "Price" },
            { title: "Avg Cost" },
            { title: "Avg Landed Cost" },
          ]}
          bulkActions={[
            { content: "Push to Shopify", onAction: () => {} },
            { content: "Export", onAction: () => {} },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
