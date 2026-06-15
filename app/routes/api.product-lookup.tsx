import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { upsertProduct, lookupSupplierSku } from "../models/product.server";

/**
 * Authenticated POST endpoint called by ProductPickerButton after a product is
 * selected via the Shopify ResourcePicker. Upserts the product to the local DB
 * and returns any known supplier SKU mapping for the given supplier.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const fd = await request.formData();
  const shopifyVariantId = (fd.get("shopifyVariantId") as string) ?? "";
  const shopifyProductId = (fd.get("shopifyProductId") as string) ?? "";
  const supplierId       = (fd.get("supplierId")       as string) ?? "";
  const title            = (fd.get("title")            as string) ?? "";
  const imageUrl         = (fd.get("imageUrl")         as string) || null;
  const sku              = (fd.get("sku")              as string) || null;
  const barcode          = (fd.get("barcode")          as string) || null;
  const price            = parseFloat((fd.get("price") as string) || "0");

  if (!shopifyVariantId || !shopifyProductId) {
    return json({ error: "Missing product IDs" }, { status: 400 });
  }

  const product = await upsertProduct(shop, {
    shopifyProductId,
    shopifyVariantId,
    title,
    imageUrl,
    sku,
    barcode,
    currentPrice: price,
  });

  let supplierSku: string | null = null;
  let unitCost:    number | null = null;

  if (supplierId && product?.id) {
    const mapping = await lookupSupplierSku(shop, product.id, supplierId);
    if (mapping) {
      supplierSku = mapping.supplierSku;
      unitCost    = mapping.unitCost;
    }
  }

  return json({
    productId:   product.id,
    supplierSku,
    unitCost,
  });
};
