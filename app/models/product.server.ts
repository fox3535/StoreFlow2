import prisma from "../db.server";

export async function getProducts(shop: string) {
  return prisma.product.findMany({
    where: { shop },
    orderBy: { title: "asc" },
    include: {
      supplierMappings: {
        include: { supplier: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      },
      poLineItems: {
        where: { purchaseOrder: { status: { not: "cancelled" } } },
        select: {
          qtyOrdered: true,
          qtyReceived: true,
          qtyRejected: true,
        },
      },
      offerItems: {
        where: { offer: { status: { in: ["draft", "reserved", "partial"] } } },
        select: {
          qtyReserved: true,
          qtyFulfilled: true,
        },
      },
      _count: { select: { supplierMappings: true } },
    },
  });
}

export async function upsertProduct(
  shop: string,
  data: {
    shopifyProductId: string;
    shopifyVariantId: string;
    sku?: string | null;
    barcode?: string | null;
    title: string;
    imageUrl?: string | null;
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
      imageUrl: data.imageUrl ?? null,
      currentPrice: data.currentPrice ?? 0,
      currentQuantity: data.currentQuantity ?? 0,
    },
    update: {
      sku: data.sku ?? null,
      barcode: data.barcode ?? null,
      title: data.title,
      imageUrl: data.imageUrl ?? null,
      currentPrice: data.currentPrice ?? 0,
      currentQuantity: data.currentQuantity ?? 0,
    },
  });
}

export async function lookupSupplierSku(shop: string, productId: string, supplierId: string) {
  return prisma.supplierSkuMapping.findFirst({
    where: { shop, productId, supplierId },
  });
}

export async function findProductBySku(shop: string, sku: string) {
  return prisma.product.findFirst({ where: { shop, sku } });
}

export async function findProductByBarcode(shop: string, barcode: string) {
  return prisma.product.findFirst({ where: { shop, barcode } });
}

export async function deleteProducts(shop: string, ids: string[]) {
  if (!ids.length) return { count: 0 };

  return prisma.$transaction(async (tx) => {
    await tx.purchaseOrderLineItem.updateMany({
      where: { productId: { in: ids }, purchaseOrder: { shop } },
      data: { productId: null },
    });
    await tx.offerItem.updateMany({
      where: { productId: { in: ids }, offer: { shop } },
      data: { productId: null },
    });
    await tx.receivingRecord.updateMany({
      where: { productId: { in: ids }, shop },
      data: { productId: null },
    });
    return tx.product.deleteMany({ where: { shop, id: { in: ids } } });
  });
}
