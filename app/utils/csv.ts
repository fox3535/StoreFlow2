/** Minimal RFC-4180 CSV parser (no external deps). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

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
  const norm = (h: string) => h.toLowerCase().replace(/[\s_-]+/g, "");
  const find = (...candidates: string[]) => {
    const idx = headers.findIndex((h) => candidates.includes(norm(h)));
    return idx >= 0 ? headers[idx] : null;
  };

  return {
    supplier_sku: find("suppliersku", "suppliercode", "vendorsku", "skucode"),
    description: find("description", "product", "title", "name", "productname"),
    unit_cost: find("unitcost", "cost", "price", "unitprice", "wholesale"),
    sku: headers.find((h) => norm(h) === "sku") ?? find("shopsku", "variantsku", "shopifysku"),
    barcode: find("barcode", "upc", "ean", "gtin"),
    pack_size: find("packsize", "pack", "casepack", "moq"),
    currency: find("currency", "curr"),
  };
}
