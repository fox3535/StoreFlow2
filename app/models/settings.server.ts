import prisma from "../db.server";
import { parseUiPreferences, type UiPreferences } from "../utils/ui-preferences";

export type SettingsData = {
  defaultCurrency: string;
  receivingDefault: string;
  syncMode: string;
  uiPreferences: UiPreferences;
};

export async function getSettings(shop: string): Promise<SettingsData> {
  const settings = await prisma.settings.findUnique({ where: { shop } });
  return {
    defaultCurrency: settings?.defaultCurrency ?? "USD",
    receivingDefault: settings?.receivingDefault ?? "restock",
    syncMode: settings?.syncMode ?? "manual",
    uiPreferences: parseUiPreferences(settings?.uiPreferences),
  };
}

export async function saveSettings(shop: string, data: Omit<SettingsData, "uiPreferences"> & { uiPreferences?: UiPreferences }) {
  const existing = await getSettings(shop);
  return prisma.settings.upsert({
    where: { shop },
    create: {
      shop,
      defaultCurrency: data.defaultCurrency,
      receivingDefault: data.receivingDefault,
      syncMode: data.syncMode,
      uiPreferences: data.uiPreferences ?? {},
    },
    update: {
      defaultCurrency: data.defaultCurrency,
      receivingDefault: data.receivingDefault,
      syncMode: data.syncMode,
      ...(data.uiPreferences !== undefined && { uiPreferences: data.uiPreferences }),
    },
  });
}

export async function saveUiPreferences(shop: string, patch: Partial<UiPreferences>) {
  const current = await getSettings(shop);
  const next = { ...current.uiPreferences, ...patch };
  return prisma.settings.upsert({
    where: { shop },
    create: { shop, uiPreferences: next },
    update: { uiPreferences: next },
  });
}
