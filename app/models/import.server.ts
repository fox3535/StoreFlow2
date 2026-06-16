import prisma from "../db.server";
import { findProductByBarcode, findProductBySku } from "./product.server";
import { findProductBySupplierSku, upsertSupplierSkuMapping } from "./supplier-mapping.server";

export type ImportFieldKey =
  | "supplier_sku"
  | "description"
  | "unit_cost"
  | "sku"
  | "barcode"
  | "pack_size"
  | "currency";

export type ImportRowInput = {
  rowIndex: number;
  supplierSku: string;
  description: string;
  unitCost: number;
  sku?: string;
  barcode?: string;
  packSize: number;
  currency: string;
};

export type ImportPreviewRow = ImportRowInput & {
  productId: string | null;
  productTitle: string | null;
  matchMethod: "sku" | "barcode" | "supplier_sku" | "title" | null;
  status: "matched" | "unmatched";
};

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  unmatched: number;
};

async function matchProduct(
  shop: string,
  supplierId: string,
  row: ImportRowInput,
): Promise<{ productId: string | null; productTitle: string | null; matchMethod: ImportPreviewRow["matchMethod"] }> {
  if (row.sku?.trim()) {
    const bySku = await findProductBySku(shop, row.sku.trim());
    if (bySku) return { productId: bySku.id, productTitle: bySku.title, matchMethod: "sku" };
  }

  if (row.barcode?.trim()) {
    const byBarcode = await findProductByBarcode(shop, row.barcode.trim());
    if (byBarcode) return { productId: byBarcode.id, productTitle: byBarcode.title, matchMethod: "barcode" };
  }

  if (row.supplierSku.trim()) {
    const bySupplierSku = await findProductBySupplierSku(shop, supplierId, row.supplierSku.trim());
    if (bySupplierSku) {
      return { productId: bySupplierSku.id, productTitle: bySupplierSku.title, matchMethod: "supplier_sku" };
    }
  }

  if (row.description.trim()) {
    const needle = row.description.trim().toLowerCase();
    const products = await prisma.product.findMany({
      where: { shop },
      select: { id: true, title: true },
      take: 500,
    });
    const exact = products.find((p) => p.title.toLowerCase() === needle);
    if (exact) return { productId: exact.id, productTitle: exact.title, matchMethod: "title" };

    const fuzzy = products.find((p) => p.title.toLowerCase().includes(needle) || needle.includes(p.title.toLowerCase()));
    if (fuzzy) return { productId: fuzzy.id, productTitle: fuzzy.title, matchMethod: "title" };
  }

  return { productId: null, productTitle: null, matchMethod: null };
}

export async function previewCsvImport(
  shop: string,
  supplierId: string,
  rows: ImportRowInput[],
): Promise<ImportPreviewRow[]> {
  const supplier = await prisma.supplier.findFirst({ where: { shop, id: supplierId } });
  if (!supplier) throw new Error("Supplier not found.");

  const results: ImportPreviewRow[] = [];
  for (const row of rows) {
    const match = await matchProduct(shop, supplierId, row);
    results.push({
      ...row,
      productId: match.productId,
      productTitle: match.productTitle,
      matchMethod: match.matchMethod,
      status: match.productId ? "matched" : "unmatched",
    });
  }
  return results;
}

export async function executeCsvImport(
  shop: string,
  supplierId: string,
  rows: ImportRowInput[],
): Promise<ImportResult> {
  const supplier = await prisma.supplier.findFirst({ where: { shop, id: supplierId } });
  if (!supplier) throw new Error("Supplier not found.");

  const preview = await previewCsvImport(shop, supplierId, rows);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const row of preview) {
    if (!row.productId) {
      unmatched += 1;
      skipped += 1;
      continue;
    }

    const existing = await prisma.supplierSkuMapping.findFirst({
      where: { shop, supplierId, supplierSku: row.supplierSku },
    });

    await upsertSupplierSkuMapping(shop, supplierId, row.productId, {
      supplierSku: row.supplierSku,
      unitCost: row.unitCost,
      packSize: row.packSize,
      currency: row.currency || supplier.currency,
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated, skipped, unmatched };
}
