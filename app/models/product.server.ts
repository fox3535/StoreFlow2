import prisma from "../db.server";

export async function getProducts(shop: string) {
  return prisma.product.findMany({
    where: { shop },
    orderBy: { title: "asc" },
    include: { _count: { select: { supplierMappings: true } } },
  });
}

export async function upsertProduct(
  shop: string,
  data: {
    shopifyProductId: string;
    shopifyVariantId: string;
    sku?: string;
    barcode?: string;
    title: string;
    currentPrice?: number;
    currentQuantity?: number;
  },
) {
  return prisma.product.upsert({
    where: { shop_shopifyVariantId: { shop, shopifyVariantId: data.shopifyVariantId } },
    create: {
      shop,
      shopifyProductId: data.shopifyProductId,
      shopifyVariantId: data.shopifyVariantId,
      sku: data.sku ?? null,
      barcode: data.barcode ?? null,
      title: data.title,
      currentPrice: data.currentPrice ?? 0,
      currentQuantity: data.currentQuantity ?? 0,
    },
    update: {
      sku: data.sku ?? null,
      barcode: data.barcode ?? null,
      title: data.title,
      currentPrice: data.currentPrice ?? 0,
      currentQuantity: data.currentQuantity ?? 0,
    },
  });
}

export async function findProductBySku(shop: string, sku: string) {
  return prisma.product.findFirst({ where: { shop, sku } });
}

export async function findProductByBarcode(shop: string, barcode: string) {
  return prisma.product.findFirst({ where: { shop, barcode } });
}
