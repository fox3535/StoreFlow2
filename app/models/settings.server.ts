import prisma from "../db.server";

export type SettingsData = {
  defaultCurrency: string;
  receivingDefault: string;
  syncMode: string;
};

export async function getSettings(shop: string): Promise<SettingsData> {
  const settings = await prisma.settings.findUnique({ where: { shop } });
  return {
    defaultCurrency: settings?.defaultCurrency ?? "USD",
    receivingDefault: settings?.receivingDefault ?? "restock",
    syncMode: settings?.syncMode ?? "manual",
  };
}

export async function saveSettings(shop: string, data: SettingsData) {
  return prisma.settings.upsert({
    where: { shop },
    create: { shop, ...data },
    update: { ...data },
  });
}
