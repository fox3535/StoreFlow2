import React, { useEffect, useRef } from "react";
import { Button } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useFetcher } from "@remix-run/react";

export type PickedProduct = {
  shopifyProductId: string;
  shopifyVariantId: string;
  title: string;
  imageUrl: string | null;
  sku: string | null;
  barcode: string | null;
  retailPrice: string;
  supplierSku: string | null;
  suggestedUnitCost: number | null;
  productId: string | null;
};

type LookupResult = {
  productId: string;
  supplierSku: string | null;
  unitCost: number | null;
};

type Props = {
  supplierId?: string;
  onPick: (product: PickedProduct) => void;
  disabled?: boolean;
  label?: string;
};

export function ProductPickerButton({ supplierId, onPick, disabled, label = "Add Product" }: Props) {
  const shopify  = useAppBridge();
  const fetcher  = useFetcher<LookupResult>();

  // Hold the partial product data while waiting for the server lookup
  const pendingRef = useRef<Omit<PickedProduct, "supplierSku" | "suggestedUnitCost" | "productId"> | null>(null);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && pendingRef.current) {
      const { productId, supplierSku, unitCost } = fetcher.data;
      onPick({
        ...pendingRef.current,
        productId,
        supplierSku,
        suggestedUnitCost: unitCost,
      });
      pendingRef.current = null;
    }
  }, [fetcher.state, fetcher.data, onPick]);

  async function handleClick() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] | null = await (shopify as any).resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
      filter: { hidden: false, variants: false },
    });

    if (!result || result.length === 0) return;

    const product = result[0];
    const variant = product.variants?.[0] ?? {};

    // Strip GID prefixes
    const shopifyProductId = String(product.id).replace("gid://shopify/Product/", "");
    const shopifyVariantId = String(variant.id ?? product.id).replace("gid://shopify/ProductVariant/", "");
    const imageUrl: string | null =
      product.images?.[0]?.originalSrc ??
      product.featuredImage?.url ??
      null;

    const partial: Omit<PickedProduct, "supplierSku" | "suggestedUnitCost" | "productId"> = {
      shopifyProductId,
      shopifyVariantId,
      title:       product.title ?? "",
      imageUrl,
      sku:         variant.sku    ?? null,
      barcode:     variant.barcode ?? null,
      retailPrice: String(variant.price ?? "0"),
    };

    pendingRef.current = partial;

    fetcher.submit(
      {
        shopifyVariantId,
        shopifyProductId,
        supplierId:  supplierId ?? "",
        title:       partial.title,
        imageUrl:    imageUrl ?? "",
        sku:         partial.sku    ?? "",
        barcode:     partial.barcode ?? "",
        price:       partial.retailPrice,
      },
      { method: "post", action: "/api/product-lookup" },
    );
  }

  return (
    <Button
      size="slim"
      onClick={handleClick}
      disabled={disabled}
      loading={fetcher.state !== "idle"}
      icon={
        <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
          <path d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" />
        </svg>
      }
    >
      {label}
    </Button>
  );
}
