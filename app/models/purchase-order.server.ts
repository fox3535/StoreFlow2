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
  offerId?: string | null;
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
    include: {
      supplier: true,
      offer: { select: { id: true, status: true, totalEstimatedCost: true, createdAt: true } },
      lineItems: {
        include: { product: true },
        orderBy: { id: "asc" },
      },
    },
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
      offerId: data.offerId ?? null,
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

export type LineItemSave = {
  id: string; // "new-xxx" = create, real id = update
  description: string;
  supplierSku: string | null;
  qtyOrdered: number;
  unitCost: number;
};

export async function updatePurchaseOrder(
  shop: string,
  id: string,
  data: {
    notes?: string | null;
    exchangeRate?: number;
    freightCost?: number;
    tax?: number;
    discounts?: number;
    otherCosts?: number;
    adjustment?: number;
    lineItems?: LineItemSave[];
    removedIds?: string[];
  },
) {
  const po = await prisma.purchaseOrder.findFirst({ where: { shop, id } });
  if (!po) return null;

  const exchangeRate = data.exchangeRate ?? po.exchangeRate;
  const freightCost  = data.freightCost  ?? po.freightCost;
  const tax          = data.tax          ?? po.tax;
  const discounts    = data.discounts    ?? po.discounts;
  const otherCosts   = data.otherCosts   ?? po.otherCosts;
  const adjustment   = data.adjustment   ?? po.adjustment;

  return prisma.$transaction(async (tx) => {
    // Delete removed rows
    if (data.removedIds?.length) {
      await tx.purchaseOrderLineItem.deleteMany({
        where: { id: { in: data.removedIds }, poId: id },
      });
    }

    // Update or create line items
    if (data.lineItems) {
      for (const item of data.lineItems) {
        if (item.id.startsWith("new-")) {
          await tx.purchaseOrderLineItem.create({
            data: {
              poId: id,
              description: item.description || null,
              supplierSku: item.supplierSku || null,
              qtyOrdered: item.qtyOrdered,
              unitCost: item.unitCost,
              landedCostPerUnit: 0,
              action: "restock",
            },
          });
        } else {
          await tx.purchaseOrderLineItem.update({
            where: { id: item.id },
            data: {
              description: item.description || null,
              supplierSku: item.supplierSku || null,
              qtyOrdered: item.qtyOrdered,
              unitCost: item.unitCost,
            },
          });
        }
      }
    }

    // Recalculate from all remaining line items
    const allItems = await tx.purchaseOrderLineItem.findMany({ where: { poId: id } });
    const subtotal  = allItems.reduce((s, i) => s + i.qtyOrdered * i.unitCost, 0);
    const totalLandedCost = calcLandedCost(subtotal, freightCost, tax, discounts, otherCosts, exchangeRate, adjustment);
    const totalQty  = allItems.reduce((s, i) => s + i.qtyOrdered, 0);
    const landedPerUnit = totalQty > 0 ? totalLandedCost / totalQty : 0;

    // Stamp landed cost per unit on every row
    await tx.purchaseOrderLineItem.updateMany({
      where: { poId: id },
      data: { landedCostPerUnit: landedPerUnit },
    });

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        notes: data.notes !== undefined ? data.notes : po.notes,
        exchangeRate,
        freightCost,
        tax,
        discounts,
        otherCosts,
        adjustment,
        subtotal,
        totalLandedCost,
      },
    });
  });
}

export async function addLineItemToPO(
  shop: string,
  poId: string,
) {
  const po = await prisma.purchaseOrder.findFirst({ where: { shop, id: poId } });
  if (!po) return null;
  return prisma.purchaseOrderLineItem.create({
    data: { poId, qtyOrdered: 1, unitCost: 0, landedCostPerUnit: 0, action: "restock" },
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
