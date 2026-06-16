import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import { getSettings, saveUiPreferences } from "../models/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getSettings(session.shop);
  return json({ uiPreferences: settings.uiPreferences, shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveColumnPrefs") {
    const key = formData.get("key");
    const raw = formData.get("value");
    if (key !== "poColumns" && key !== "productColumns") {
      return json({ ok: false, error: "Invalid preference key." }, { status: 400 });
    }
    let values: string[] = [];
    try {
      const parsed = JSON.parse(String(raw ?? "[]"));
      if (!Array.isArray(parsed)) throw new Error("invalid");
      values = parsed.filter((v) => typeof v === "string");
    } catch {
      return json({ ok: false, error: "Invalid column list." }, { status: 400 });
    }

    await saveUiPreferences(session.shop, { [key]: values });
    return json({ ok: true, key, values });
  }

  return json({ ok: false }, { status: 400 });
};
