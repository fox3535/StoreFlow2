export type UiPreferences = {
  poColumns?: string[];
  productColumns?: string[];
};

export function parseUiPreferences(raw: unknown): UiPreferences {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const prefs: UiPreferences = {};
  if (Array.isArray(obj.poColumns)) {
    prefs.poColumns = obj.poColumns.filter((v): v is string => typeof v === "string");
  }
  if (Array.isArray(obj.productColumns)) {
    prefs.productColumns = obj.productColumns.filter((v): v is string => typeof v === "string");
  }
  return prefs;
}

export function storageKey(shop: string, key: "poColumns" | "productColumns") {
  return `shelfflow:${shop}:${key}`;
}

export function readLocalColumns(shop: string, key: "poColumns" | "productColumns"): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(shop, key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : null;
  } catch {
    return null;
  }
}

export function writeLocalColumns(shop: string, key: "poColumns" | "productColumns", values: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(shop, key), JSON.stringify(values));
}
