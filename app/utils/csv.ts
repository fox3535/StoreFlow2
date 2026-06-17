/** Strip UTF-8 BOM and normalize line endings. */
function normalizeCsvText(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function detectDelimiter(line: string): string {
  const candidates: { delim: string; count: number }[] = [
    { delim: ",", count: 0 },
    { delim: ";", count: 0 },
    { delim: "\t", count: 0 },
  ];
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes) {
      for (const c of candidates) {
        if (ch === c.delim) c.count += 1;
      }
    }
  }
  const best = candidates.reduce((a, b) => (b.count > a.count ? b : a));
  return best.count > 0 ? best.delim : ",";
}

/** Minimal RFC-4180 CSV parser (no external deps). Supports comma, semicolon, or tab. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const normalized = normalizeCsvText(text);
  const firstLineEnd = normalized.indexOf("\n");
  const firstLine = firstLineEnd >= 0 ? normalized.slice(0, firstLineEnd) : normalized;
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    const next = normalized[i + 1];

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
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
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

  const headers = nonEmpty[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  const dataRows = nonEmpty.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return { headers, rows: dataRows };
}

export function normalizeHeader(h: string): string {
  return h.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[\s_./-]+/g, "");
}

export function findHeaderIndex(headers: string[], mappedHeader: string): number {
  if (!mappedHeader) return -1;
  const exact = headers.indexOf(mappedHeader);
  if (exact >= 0) return exact;
  const target = normalizeHeader(mappedHeader);
  return headers.findIndex((h) => normalizeHeader(h) === target);
}

export function guessColumnMap(headers: string[]): Record<string, string | null> {
  const norm = normalizeHeader;
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

  const shopifySkuDedicated = find("shopsku", "shopifysku", "productsku");
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
    barcode: find("barcode", "upc", "ean", "gtin", "variantbarcode", "isbn"),
    pack_size: find("packsize", "pack", "casepack", "moq", "qtyperpack"),
    currency: find("currency", "curr"),
  };
}
