/** Minimal RFC-4180 CSV parser (no external deps). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim());
  const dataRows = nonEmpty.slice(1);
  return { headers, rows: dataRows };
}

export function guessColumnMap(headers: string[]): Record<string, string | null> {
  const norm = (h: string) => h.toLowerCase().replace(/[\s_./-]+/g, "");
  const find = (...candidates: string[]) => {
    const idx = headers.findIndex((h) => candidates.includes(norm(h)));
    return idx >= 0 ? headers[idx] : null;
  };

  const supplierSkuDedicated = find(
    "suppliersku", "suppliercode", "supplieritem", "vendorsku", "vendorcode",
    "skucode", "itemcode", "productcode", "partnumber", "partno", "mpn",
  );
  const variantSku = find("variantsku");
  const plainSku = headers.find((h) => norm(h) === "sku") ?? null;
  const supplierSku = supplierSkuDedicated ?? variantSku ?? plainSku;

  const shopifySkuDedicated = find("shopsku", "shopifysku");
  const sku =
    shopifySkuDedicated
    ?? (plainSku && plainSku !== supplierSku ? plainSku : null)
    ?? (variantSku && variantSku !== supplierSku ? variantSku : null);

  return {
    supplier_sku: supplierSku,
    description: find(
      "description", "product", "title", "name", "productname", "producttitle", "itemname",
    ),
    unit_cost: find(
      "unitcost", "cost", "price", "unitprice", "wholesale", "variantprice", "wholesaleprice",
    ),
    sku,
    barcode: find("barcode", "upc", "ean", "gtin", "variantbarcode"),
    pack_size: find("packsize", "pack", "casepack", "moq"),
    currency: find("currency", "curr"),
  };
}
