import { Banner, Text } from "@shopify/polaris";

export function LocalInventoryNotice() {
  return (
    <Banner tone="info">
      <Text as="p" variant="bodyMd">
        <strong>ShelfFlow local inventory only.</strong> Receiving updates costs and quantities in ShelfFlow.
        Shopify store inventory is <strong>not</strong> changed in V1 — sync from Shopify to refresh live stock levels.
      </Text>
    </Banner>
  );
}
