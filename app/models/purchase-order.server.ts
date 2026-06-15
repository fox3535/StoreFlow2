import prisma from "../db.server";

export type LineItemInput = {
  description: string;
  supplierSku?: string;
  qtyOrdered: number;
  unitCost: number;
  action?: string;
};

export type PurchaseOrderInput = {
  supplierId: string;
  status?: string;
  currency?: string;
  exchangeRate?: number;
  freightCost?: number;
  tax?: number;
  discounts?: number;
  otherCosts?: number;
  adjustment?: number;
  notes?: string | null;
  lineItems: LineItemInput[];
};

function calcLandedCost(
  subtotal: number,
  freight: number,
  tax: number,
  discounts: number,
  other: number,
  rate: number,
  adjustment: number,
): number {
  return (subtotal + freight + tax + other - discounts) * rate + adjustment;
}

async function nextPoNumber(shop: string): Promise<string> {
  const count = await prisma.purchaseOrder.count({ where: { shop } });
  const seq = String(count + 1).padStart(4, "0");
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `PO-${ymd}-${seq}`;
}

export async function getPurchaseOrders(shop: string) {
  return prisma.purchaseOrder.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      _count: { select: { lineItems: true } },
    },
  });
}

export async function getPurchaseOrder(shop: string, id: string) {
  return prisma.purchaseOrder.findFirst({
    where: { shop, id },
    include: { supplier: true, lineItems: true },
  });
}

export async function createPurchaseOrder(
  shop: string,
  data: PurchaseOrderInput,
) {
  const poNumber = await nextPoNumber(shop);

  const exchangeRate = data.exchangeRate ?? 1;
  const freightCost = data.freightCost ?? 0;
  const tax = data.tax ?? 0;
  const discounts = data.discounts ?? 0;
  const otherCosts = data.otherCosts ?? 0;
  const adjustment = data.adjustment ?? 0;

  const subtotal = data.lineItems.reduce(
    (sum, item) => sum + item.qtyOrdered * item.unitCost,
    0,
  );

  const totalLandedCost = calcLandedCost(
    subtotal,
    freightCost,
    tax,
    discounts,
    otherCosts,
    exchangeRate,
    adjustment,
  );

  const lineCount = data.lineItems.length;
  const landedPerUnit = lineCount > 0 ? totalLandedCost / lineCount : 0;

  return prisma.purchaseOrder.create({
    data: {
      shop,
      poNumber,
      supplierId: data.supplierId,
      status: data.status ?? "draft",
      currency: data.currency ?? "USD",
      exchangeRate,
      subtotal,
      freightCost,
      tax,
      discounts,
      otherCosts,
      adjustment,
      totalLandedCost,
      notes: data.notes ?? null,
      lineItems: {
        create: data.lineItems.map((item) => ({
          description: item.description,
          supplierSku: item.supplierSku ?? null,
          qtyOrdered: item.qtyOrdered,
          unitCost: item.unitCost,
          landedCostPerUnit: landedPerUnit,
          action: item.action ?? "restock",
        })),
      },
    },
    include: { lineItems: true, supplier: true },
  });
}

export async function updatePurchaseOrderStatus(
  shop: string,
  id: string,
  status: string,
) {
  return prisma.purchaseOrder.updateMany({
    where: { shop, id },
    data: { status },
  });
}
