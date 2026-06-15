import prisma from "../db.server";

export type OfferItemInput = {
  description: string;
  supplierSku?: string;
  qtyReserved: number;
  unitCost: number;
};

export type OfferInput = {
  supplierId: string;
  status?: string;
  eta?: string | null;
  endDate?: string | null;
  notes?: string | null;
  items: OfferItemInput[];
};

export async function getOffers(shop: string) {
  return prisma.offer.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function getOffer(shop: string, id: string) {
  return prisma.offer.findFirst({
    where: { shop, id },
    include: { supplier: true, items: true },
  });
}

export async function createOffer(shop: string, data: OfferInput) {
  const totalEstimatedCost = data.items.reduce(
    (sum, item) => sum + item.qtyReserved * item.unitCost,
    0,
  );

  return prisma.offer.create({
    data: {
      shop,
      supplierId: data.supplierId,
      status: data.status ?? "draft",
      totalEstimatedCost,
      eta: data.eta ? new Date(data.eta) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      notes: data.notes ?? null,
      items: {
        create: data.items.map((item) => ({
          description: item.description,
          supplierSku: item.supplierSku ?? null,
          qtyReserved: item.qtyReserved,
          unitCost: item.unitCost,
        })),
      },
    },
    include: { items: true, supplier: true },
  });
}

export async function updateOfferStatus(
  shop: string,
  id: string,
  status: string,
) {
  return prisma.offer.updateMany({ where: { shop, id }, data: { status } });
}
