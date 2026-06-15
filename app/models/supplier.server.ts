import prisma from "../db.server";

export type SupplierInput = {
  name: string;
  currency?: string;
  leadTimeDays?: number;
  contactInfo?: string;
};

export async function getSuppliers(shop: string) {
  return prisma.supplier.findMany({
    where: { shop },
    orderBy: { name: "asc" },
    include: { _count: { select: { skuMappings: true, purchaseOrders: true } } },
  });
}

export async function getSupplier(shop: string, id: string) {
  return prisma.supplier.findFirst({
    where: { shop, id },
    include: { skuMappings: true },
  });
}

export async function createSupplier(shop: string, data: SupplierInput) {
  return prisma.supplier.create({
    data: {
      shop,
      name: data.name.trim(),
      currency: data.currency ?? "USD",
      leadTimeDays: data.leadTimeDays ?? 0,
      contactInfo: data.contactInfo ?? null,
    },
  });
}

export async function updateSupplier(
  shop: string,
  id: string,
  data: Partial<SupplierInput>,
) {
  return prisma.supplier.updateMany({
    where: { shop, id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.leadTimeDays !== undefined && { leadTimeDays: data.leadTimeDays }),
      ...(data.contactInfo !== undefined && { contactInfo: data.contactInfo }),
    },
  });
}

export async function deleteSupplier(shop: string, id: string) {
  return prisma.supplier.deleteMany({ where: { shop, id } });
}
