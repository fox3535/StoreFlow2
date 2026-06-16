import React from "react";
import { TextField, Text, Button, InlineStack } from "@shopify/polaris";

export type LineItem = {
  id: string;
  description: string;
  supplierSku: string;
  qtyOrdered: string;
  unitCost: string;
  imageUrl?: string | null;
  pickedTitle?: string | null;
  pendingProductId?: string | null;
};

type Props = {
  items: LineItem[];
  onChange: (
    id: string,
    field: keyof Pick<LineItem, "description" | "supplierSku" | "qtyOrdered" | "unitCost">,
    value: string,
  ) => void;
  onRemove: (id: string) => void;
};

const COLS = "48px 2fr 1.4fr 76px 108px 90px 72px";

const thStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#6d7175",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  userSelect: "none",
};

// Defined at module level — prevents React from remounting on every keystroke.
function LineItemRow({
  item,
  onChange,
  onRemove,
  isOnly,
}: {
  item: LineItem;
  onChange: Props["onChange"];
  onRemove: Props["onRemove"];
  isOnly: boolean;
}) {
  const total       = (parseFloat(item.qtyOrdered) || 0) * (parseFloat(item.unitCost) || 0);
  const hasImage    = Boolean(item.imageUrl);
  const displayTitle = item.pickedTitle ?? null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: COLS,
        gap: "8px",
        alignItems: "start",
        padding: "8px 0",
        borderBottom: "1px solid #e1e3e5",
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 4,
          background: "#f6f6f7",
          border: hasImage ? "none" : "1px dashed #d1d5db",
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 4,
        }}
      >
        {hasImage ? (
          <img
            src={item.imageUrl!}
            alt={displayTitle ?? item.description}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 8, color: "#c9cccf" }}>IMG</span>
        )}
      </div>

      {/* Description — with optional product-title subtitle */}
      <div>
        <TextField
          label=""
          labelHidden
          placeholder="Search or type product name…"
          value={item.description}
          onChange={(v) => onChange(item.id, "description", v)}
          autoComplete="off"
        />
        {displayTitle && displayTitle !== item.description && (
          <div
            style={{
              fontSize: 11,
              color: "#6d7175",
              marginTop: 3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayTitle}
          </div>
        )}
      </div>

      <TextField
        label=""
        labelHidden
        placeholder="Supplier SKU"
        value={item.supplierSku}
        onChange={(v) => onChange(item.id, "supplierSku", v)}
        autoComplete="off"
      />
      <TextField
        label=""
        labelHidden
        type="number"
        value={item.qtyOrdered}
        min="0"
        onChange={(v) => onChange(item.id, "qtyOrdered", v)}
        autoComplete="off"
      />
      <TextField
        label=""
        labelHidden
        type="number"
        value={item.unitCost}
        min="0"
        prefix="$"
        onChange={(v) => onChange(item.id, "unitCost", v)}
        autoComplete="off"
      />

      {/* Row total */}
      <div style={{ paddingTop: 7, fontSize: 13, color: "#202223", fontWeight: 500, textAlign: "right" }}>
        ${total.toFixed(2)}
      </div>

      {/* Remove */}
      <div style={{ paddingTop: 4 }}>
        <Button
          variant="plain"
          tone="critical"
          onClick={() => onRemove(item.id)}
          disabled={isOnly}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

export function LineItemsTable({ items, onChange, onRemove }: Props) {
  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          gap: "8px",
          padding: "0 0 8px 0",
          borderBottom: "2px solid #e1e3e5",
          alignItems: "center",
        }}
      >
        {(["", "Description / Product", "Supplier SKU", "Qty", "Unit Cost", "Row Total", ""] as const).map(
          (h, i) => (
            <span key={i} style={{ ...thStyle, textAlign: i >= 3 && i <= 5 ? "right" : "left" }}>
              {h}
            </span>
          ),
        )}
      </div>

      {/* Rows */}
      {items.map((item) => (
        <LineItemRow
          key={item.id}
          item={item}
          onChange={onChange}
          onRemove={onRemove}
          isOnly={items.length === 1}
        />
      ))}
    </div>
  );
}
