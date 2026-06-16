import prisma from "../db.server";

export async function upsertSupplierSkuMapping(
  shop: string,
  supplierId: string,
  productId: string,
  data: {
    supplierSku: string;
    unitCost: number;
    packSize?: number;
    currency?: string;
  },
) {
  return prisma.supplierSkuMapping.upsert({
    where: {
      shop_supplierId_supplierSku: {
        shop,
        supplierId,
        supplierSku: data.supplierSku,
      },
    },
    create: {
      shop,
      supplierId,
      productId,
      supplierSku: data.supplierSku,
      unitCost: data.unitCost,
      packSize: data.packSize ?? 1,
      currency: data.currency ?? "USD",
      lastUsedCost: data.unitCost,
    },
    update: {
      productId,
      unitCost: data.unitCost,
      packSize: data.packSize ?? 1,
      currency: data.currency ?? "USD",
      lastUsedCost: data.unitCost,
    },
  });
}

export async function findProductBySupplierSku(
  shop: string,
  supplierId: string,
  supplierSku: string,
) {
  const mapping = await prisma.supplierSkuMapping.findFirst({
    where: { shop, supplierId, supplierSku },
    include: { product: true },
  });
  return mapping?.product ?? null;
}
