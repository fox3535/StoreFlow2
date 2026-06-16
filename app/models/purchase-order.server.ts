import prisma from "../db.server";

export type LineItemInput = {
  description: string;
  supplierSku?: string;
  qtyOrdered: number;
  unitCost: number;
  action?: string;
  productId?: string | null;
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

export type ReceiveLineInput = {
  lineItemId: string;
  qtyReceived: number;
  qtyRejected: number;
  qtyBackordered: number;
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

function weightedAverage(currentQty: number, currentAvg: number, addedQty: number, addedCost: number) {
  if (addedQty <= 0) return currentAvg;
  const nextQty = currentQty + addedQty;
  if (nextQty <= 0) return addedCost;
  return ((currentQty * currentAvg) + (addedQty * addedCost)) / nextQty;
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

  const totalQty = data.lineItems.reduce((sum, item) => sum + item.qtyOrdered, 0);
  const landedPerUnit = totalQty > 0 ? totalLandedCost / totalQty : 0;

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
          productId: item.productId ?? null,
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
  productId?: string | null;
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
              productId: item.productId ?? null,
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

export async function receivePurchaseOrder(
  shop: string,
  poId: string,
  lines: ReceiveLineInput[],
) {
  const cleanLines = lines
    .map((line) => ({
      lineItemId: line.lineItemId,
      qtyReceived: Math.max(0, Math.floor(line.qtyReceived || 0)),
      qtyRejected: Math.max(0, Math.floor(line.qtyRejected || 0)),
      qtyBackordered: Math.max(0, Math.floor(line.qtyBackordered || 0)),
    }))
    .filter((line) => line.qtyReceived > 0 || line.qtyRejected > 0 || line.qtyBackordered > 0);

  if (!cleanLines.length) {
    return { ok: false, error: "Enter at least one received, rejected, or backordered quantity." };
  }

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { shop, id: poId },
      include: {
        lineItems: { include: { product: true } },
      },
    });

    if (!po) return { ok: false, error: "Purchase order not found." };
    if (po.status === "cancelled" || po.status === "received") {
      return { ok: false, error: "This purchase order is not open for receiving." };
    }

    const totalOrderedQty = po.lineItems.reduce((sum, item) => sum + item.qtyOrdered, 0);
    const avgLandedPerUnit = totalOrderedQty > 0 ? po.totalLandedCost / totalOrderedQty : 0;
    const productCostState = new Map(
      po.lineItems
        .filter((line) => line.productId && line.product)
        .map((line) => [
          line.productId!,
          {
            currentQuantity: line.product!.currentQuantity,
            avgCost: line.product!.avgCost,
            avgLandedCost: line.product!.avgLandedCost,
          },
        ]),
    );

    for (const input of cleanLines) {
      const line = po.lineItems.find((item) => item.id === input.lineItemId);
      if (!line) return { ok: false, error: "Receiving line item not found." };

      const openQty = Math.max(0, line.qtyOrdered - line.qtyReceived - line.qtyRejected);
      const qtyReceived = Math.min(input.qtyReceived, openQty);
      const afterReceiveOpenQty = Math.max(0, openQty - qtyReceived);
      const qtyRejected = Math.min(input.qtyRejected, afterReceiveOpenQty);
      const afterRejectOpenQty = Math.max(0, afterReceiveOpenQty - qtyRejected);
      const qtyBackordered = Math.min(input.qtyBackordered, afterRejectOpenQty);

      if (qtyReceived <= 0 && qtyRejected <= 0 && qtyBackordered <= 0) continue;

      await tx.receivingRecord.create({
        data: {
          shop,
          poId,
          lineItemId: line.id,
          productId: line.productId,
          qtyReceived,
          qtyRejected,
          qtyBackordered,
          action: line.action,
        },
      });

      await tx.purchaseOrderLineItem.update({
        where: { id: line.id },
        data: {
          qtyReceived: { increment: qtyReceived },
          qtyRejected: { increment: qtyRejected },
          // Received or rejected goods reduce previously backordered units first.
          qtyBackordered: Math.max(0, line.qtyBackordered - qtyReceived - qtyRejected) + qtyBackordered,
        },
      });

      if (qtyReceived > 0 && line.productId && line.product) {
        const currentState = productCostState.get(line.productId) ?? {
          currentQuantity: line.product.currentQuantity,
          avgCost: line.product.avgCost,
          avgLandedCost: line.product.avgLandedCost,
        };
        const unitCostBasis = line.unitCost * (po.exchangeRate || 1);
        const nextAvgCost = weightedAverage(currentState.currentQuantity, currentState.avgCost, qtyReceived, unitCostBasis);
        const nextAvgLandedCost = weightedAverage(
          currentState.currentQuantity,
          currentState.avgLandedCost,
          qtyReceived,
          avgLandedPerUnit,
        );
        const nextQuantity = currentState.currentQuantity + qtyReceived;

        await tx.product.update({
          where: { id: line.productId },
          data: {
            currentQuantity: { increment: qtyReceived },
            avgCost: nextAvgCost,
            avgLandedCost: nextAvgLandedCost,
          },
        });
        productCostState.set(line.productId, {
          currentQuantity: nextQuantity,
          avgCost: nextAvgCost,
          avgLandedCost: nextAvgLandedCost,
        });

        await tx.supplierSkuMapping.updateMany({
          where: {
            shop,
            supplierId: po.supplierId,
            productId: line.productId,
            ...(line.supplierSku ? { supplierSku: line.supplierSku } : {}),
          },
          data: { lastUsedCost: line.unitCost },
        });

        if (po.offerId) {
          const offerItem = await tx.offerItem.findFirst({
            where: {
              offerId: po.offerId,
              OR: [
                { productId: line.productId },
                ...(line.supplierSku ? [{ supplierSku: line.supplierSku }] : []),
                ...(line.description ? [{ description: line.description }] : []),
              ],
            },
            orderBy: { id: "asc" },
          });

          if (offerItem) {
            await tx.offerItem.update({
              where: { id: offerItem.id },
              data: { qtyFulfilled: Math.min(offerItem.qtyReserved, offerItem.qtyFulfilled + qtyReceived) },
            });
          }
        }
      }
    }

    const updatedItems = await tx.purchaseOrderLineItem.findMany({ where: { poId } });
    const anyProcessed = updatedItems.some(
      (item) => item.qtyReceived > 0 || item.qtyRejected > 0 || item.qtyBackordered > 0,
    );
    const allAccountedFor = updatedItems.every(
      (item) => item.qtyReceived + item.qtyRejected >= item.qtyOrdered,
    );

    const nextStatus = allAccountedFor
      ? "received"
      : anyProcessed
        ? "partially_received"
        : po.status;

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: nextStatus },
    });

    if (po.offerId) {
      const offerItems = await tx.offerItem.findMany({ where: { offerId: po.offerId } });
      const allFulfilled = offerItems.length > 0 && offerItems.every((item) => item.qtyFulfilled >= item.qtyReserved);
      const anyFulfilled = offerItems.some((item) => item.qtyFulfilled > 0);

      await tx.offer.update({
        where: { id: po.offerId },
        data: { status: allFulfilled ? "completed" : anyFulfilled ? "partial" : "reserved" },
      });
    }

    return { ok: true, status: nextStatus };
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
