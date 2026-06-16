import { upsertProduct } from "./product.server";

type AdminGraphql = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

type SyncVariant = {
  id: string;
  title?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price?: string | null;
  inventoryQuantity?: number | null;
  image?: { url?: string | null } | null;
};

type SyncProduct = {
  id: string;
  title: string;
  featuredMedia?: { preview?: { image?: { url?: string | null } | null } | null } | null;
  variants?: {
    nodes?: SyncVariant[];
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  } | null;
};

type ProductsPage = {
  data?: {
    products?: {
      nodes?: SyncProduct[];
      pageInfo?: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: { message?: string }[];
};

function stripGid(value: string, type: "Product" | "ProductVariant") {
  return value.replace(`gid://shopify/${type}/`, "");
}

async function fetchVariantPage(
  admin: AdminGraphql,
  productId: string,
  after: string | null,
): Promise<{ nodes: SyncVariant[]; hasNextPage: boolean; endCursor: string | null }> {
  const response = await admin.graphql(
    `#graphql
      query ShelfFlowVariantPage($id: ID!, $first: Int!, $after: String) {
        product(id: $id) {
          variants(first: $first, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              title
              sku
              barcode
              price
              inventoryQuantity
              image { url }
            }
          }
        }
      }
    `,
    { variables: { id: productId, first: 100, after } },
  );
  const payload = await response.json() as {
    data?: { product?: { variants?: { nodes?: SyncVariant[]; pageInfo?: { hasNextPage: boolean; endCursor: string | null } } } };
    errors?: { message?: string }[];
  };
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Variant sync failed.");
  }
  const variants = payload.data?.product?.variants;
  return {
    nodes: variants?.nodes ?? [],
    hasNextPage: variants?.pageInfo?.hasNextPage ?? false,
    endCursor: variants?.pageInfo?.endCursor ?? null,
  };
}

async function fetchAllVariants(admin: AdminGraphql, product: SyncProduct): Promise<SyncVariant[]> {
  const firstPage = product.variants?.nodes ?? [];
  let all = [...firstPage];
  let hasNext = product.variants?.pageInfo?.hasNextPage ?? false;
  let cursor = product.variants?.pageInfo?.endCursor ?? null;

  while (hasNext && cursor) {
    const page = await fetchVariantPage(admin, product.id, cursor);
    all = all.concat(page.nodes);
    hasNext = page.hasNextPage;
    cursor = page.endCursor;
  }
  return all;
}

export async function syncShopifyProducts(admin: AdminGraphql, shop: string) {
  let synced = 0;
  let productCursor: string | null = null;
  let hasMoreProducts = true;

  while (hasMoreProducts) {
    const response = await admin.graphql(
      `#graphql
        query ShelfFlowProductSync($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              title
              featuredMedia {
                preview { image { url } }
              }
              variants(first: 100) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  title
                  sku
                  barcode
                  price
                  inventoryQuantity
                  image { url }
                }
              }
            }
          }
        }
      `,
      { variables: { first: 50, after: productCursor } },
    );

    const payload = await response.json() as ProductsPage;
    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message ?? "Shopify sync failed.");
    }

    const products = payload.data?.products?.nodes ?? [];
    for (const product of products) {
      const productImage = product.featuredMedia?.preview?.image?.url ?? null;
      const variants = await fetchAllVariants(admin, product);

      for (const variant of variants) {
        const variantTitle = variant.title && variant.title !== "Default Title"
          ? `${product.title} - ${variant.title}`
          : product.title;

        await upsertProduct(shop, {
          shopifyProductId: stripGid(product.id, "Product"),
          shopifyVariantId: stripGid(variant.id, "ProductVariant"),
          title: variantTitle,
          sku: variant.sku ?? null,
          barcode: variant.barcode ?? null,
          imageUrl: variant.image?.url ?? productImage,
          currentPrice: parseFloat(variant.price ?? "0") || 0,
          currentQuantity: variant.inventoryQuantity ?? 0,
        });
        synced += 1;
      }
    }

    hasMoreProducts = payload.data?.products?.pageInfo?.hasNextPage ?? false;
    productCursor = payload.data?.products?.pageInfo?.endCursor ?? null;
  }

  return { synced };
}
