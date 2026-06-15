import React from "react";
import { Text } from "@shopify/polaris";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type POLineItemProduct = {
  sku: string | null;
  barcode: string | null;
  title: string;
  currentPrice: number;
  currentQuantity: number;
  avgCost: number;
  avgLandedCost: number;
};

export type EditItem = {
  id: string; // "new-xxx" = unsaved new row
  description: string;
  supplierSku: string;
  qtyOrdered: string;
  unitCost: string;
  // read-only from DB
  qtyReceived: number;
  qtyRejected: number;
  product: POLineItemProduct | null;
};

export type POSpreadsheetProps = {
  items: EditItem[];
  totalLandedCost: number;
  totalQtyOrdered: number;
  onChange: (id: string, field: keyof Pick<EditItem, "description" | "supplierSku" | "qtyOrdered" | "unitCost">, value: string) => void;
  onRemove: (id: string) => void;
  onAddRow: () => void;
  disabled?: boolean;
};

// ---------------------------------------------------------------------------
// Compact native input — avoids Polaris remount / focus-loss issues
// ---------------------------------------------------------------------------

function TI({
  value,
  onChange,
  type = "text",
  placeholder = "",
  align = "left",
  width,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  align?: "left" | "right";
  width?: number;
  disabled?: boolean;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: width ? `${width}px` : "100%",
        height: "28px",
        padding: "0 6px",
        border: `1.5px solid ${focused ? "#005bd3" : "#c9cccf"}`,
        borderRadius: "4px",
        fontSize: "13px",
        textAlign: align,
        background: disabled ? "#f6f6f7" : "#fff",
        boxSizing: "border-box",
        outline: "none",
        boxShadow: focused ? "0 0 0 2px #c4d3f4" : "none",
        transition: "border-color 0.1s",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Read-only cell helper
// ---------------------------------------------------------------------------

function RO({
  value,
  align = "left",
  tone,
}: {
  value: string;
  align?: "left" | "right";
  tone?: "subdued" | "success" | "critical";
}) {
  const color = tone === "subdued" ? "#6d7175" : tone === "success" ? "#1a7a4a" : tone === "critical" ? "#d72c0d" : "#202223";
  return (
    <span style={{ fontSize: "13px", color, display: "block", textAlign: align, whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Column header definitions
// ---------------------------------------------------------------------------

const COLS = [
  { label: "",               width: 40,  align: "center" as const },  // image
  { label: "Description",   width: 190, align: "left"   as const },  // editable
  { label: "Supplier SKU",  width: 105, align: "left"   as const },  // editable
  { label: "SKU",           width: 90,  align: "left"   as const },  // r/o
  { label: "Barcode",       width: 100, align: "left"   as const },  // r/o
  { label: "Qty Ordered",   width: 72,  align: "right"  as const },  // editable
  { label: "Qty Recv",      width: 65,  align: "right"  as const },  // r/o
  { label: "Qty Rej",       width: 60,  align: "right"  as const },  // r/o
  { label: "On Order",      width: 65,  align: "right"  as const },  // r/o
  { label: "Unit Cost",     width: 88,  align: "right"  as const },  // editable
  { label: "Line Total",    width: 88,  align: "right"  as const },  // r/o
  { label: "Landed/Unit",   width: 88,  align: "right"  as const },  // r/o
  { label: "Avg Cost",      width: 80,  align: "right"  as const },  // r/o
  { label: "Markup %",      width: 72,  align: "right"  as const },  // r/o
  { label: "Margin %",      width: 72,  align: "right"  as const },  // r/o
  { label: "Sugg. Price",   width: 88,  align: "right"  as const },  // r/o
  { label: "Curr. Stock",   width: 75,  align: "right"  as const },  // r/o
  { label: "",               width: 48,  align: "center" as const },  // remove
];

// ---------------------------------------------------------------------------
// Row — defined at MODULE LEVEL so React never remounts on parent re-render
// ---------------------------------------------------------------------------

function POLineItemRow({
  item,
  landedPerUnit,
  onChange,
  onRemove,
  isOnly,
  disabled,
}: {
  item: EditItem;
  landedPerUnit: number;
  onChange: POSpreadsheetProps["onChange"];
  onRemove: POSpreadsheetProps["onRemove"];
  isOnly: boolean;
  disabled: boolean;
}) {
  const p = item.product;
  const qty     = parseFloat(item.qtyOrdered) || 0;
  const cost    = parseFloat(item.unitCost)   || 0;
  const lineTotal = qty * cost;

  const lpu = landedPerUnit;
  const avgCost      = p?.avgCost      ?? 0;
  const currentPrice = p?.currentPrice ?? 0;
  const currentQty   = p?.currentQuantity ?? 0;
  const onOrder      = Math.max(0, qty - item.qtyReceived);

  const markup = lpu > 0 && currentPrice > 0
    ? ((currentPrice - lpu) / lpu) * 100
    : null;
  const margin = currentPrice > 0
    ? ((currentPrice - lpu) / currentPrice) * 100
    : null;
  // Suggested price = landed × 1.4 (40% markup target) when not mapped to product
  const suggestedPrice = lpu > 0 ? lpu * 1.4 : null;

  const td: React.CSSProperties = {
    padding: "4px 6px",
    borderBottom: "1px solid #e1e3e5",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };

  return (
    <tr style={{ background: "white" }}>
      {/* Image */}
      <td style={{ ...td, width: 40, textAlign: "center" }}>
        {p ? (
          <div style={{ width: 32, height: 32, background: "#f6f6f7", borderRadius: 4, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, color: "#6d7175" }}>IMG</span>
          </div>
        ) : (
          <div style={{ width: 32, height: 32, background: "#f6f6f7", borderRadius: 4, border: "1px dashed #c9cccf", margin: "0 auto" }} />
        )}
      </td>

      {/* Description — editable */}
      <td style={{ ...td, width: 190 }}>
        <TI
          value={item.description}
          onChange={(v) => onChange(item.id, "description", v)}
          placeholder={p?.title ?? "Description / SKU"}
          disabled={disabled}
        />
        {p && (
          <div style={{ fontSize: 11, color: "#6d7175", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
            {p.title}
          </div>
        )}
      </td>

      {/* Supplier SKU — editable */}
      <td style={{ ...td, width: 105 }}>
        <TI
          value={item.supplierSku}
          onChange={(v) => onChange(item.id, "supplierSku", v)}
          placeholder="SUP-SKU"
          disabled={disabled}
        />
      </td>

      {/* SKU r/o */}
      <td style={{ ...td, width: 90 }}>
        <RO value={p?.sku ?? "—"} tone="subdued" />
      </td>

      {/* Barcode r/o */}
      <td style={{ ...td, width: 100 }}>
        <RO value={p?.barcode ?? "—"} tone="subdued" />
      </td>

      {/* Qty Ordered — editable */}
      <td style={{ ...td, width: 72 }}>
        <TI
          value={item.qtyOrdered}
          onChange={(v) => onChange(item.id, "qtyOrdered", v)}
          type="number"
          align="right"
          disabled={disabled}
        />
      </td>

      {/* Qty Received r/o */}
      <td style={{ ...td, width: 65 }}>
        <RO value={String(item.qtyReceived)} align="right" />
      </td>

      {/* Qty Rejected r/o */}
      <td style={{ ...td, width: 60 }}>
        <RO value={String(item.qtyRejected)} align="right" tone={item.qtyRejected > 0 ? "critical" : undefined} />
      </td>

      {/* On Order r/o */}
      <td style={{ ...td, width: 65 }}>
        <RO value={String(onOrder)} align="right" />
      </td>

      {/* Unit Cost — editable */}
      <td style={{ ...td, width: 88 }}>
        <TI
          value={item.unitCost}
          onChange={(v) => onChange(item.id, "unitCost", v)}
          type="number"
          align="right"
          disabled={disabled}
        />
      </td>

      {/* Line Total r/o */}
      <td style={{ ...td, width: 88 }}>
        <RO value={`$${lineTotal.toFixed(2)}`} align="right" />
      </td>

      {/* Landed/Unit r/o */}
      <td style={{ ...td, width: 88 }}>
        <RO value={lpu > 0 ? `$${lpu.toFixed(2)}` : "—"} align="right" />
      </td>

      {/* Avg Cost r/o */}
      <td style={{ ...td, width: 80 }}>
        <RO value={avgCost > 0 ? `$${avgCost.toFixed(2)}` : "—"} align="right" tone="subdued" />
      </td>

      {/* Markup % r/o */}
      <td style={{ ...td, width: 72 }}>
        <RO
          value={markup !== null ? `${markup.toFixed(1)}%` : "—"}
          align="right"
          tone={markup !== null ? (markup >= 0 ? "success" : "critical") : undefined}
        />
      </td>

      {/* Margin % r/o */}
      <td style={{ ...td, width: 72 }}>
        <RO
          value={margin !== null ? `${margin.toFixed(1)}%` : "—"}
          align="right"
          tone={margin !== null ? (margin >= 0 ? "success" : "critical") : undefined}
        />
      </td>

      {/* Suggested Price r/o */}
      <td style={{ ...td, width: 88 }}>
        <RO
          value={currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : suggestedPrice !== null ? `$${suggestedPrice.toFixed(2)}` : "—"}
          align="right"
        />
      </td>

      {/* Current Stock r/o */}
      <td style={{ ...td, width: 75 }}>
        <RO
          value={p ? String(currentQty) : "—"}
          align="right"
          tone={currentQty <= 0 ? "critical" : undefined}
        />
      </td>

      {/* Remove */}
      <td style={{ ...td, width: 48, textAlign: "center" }}>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={isOnly || disabled}
          style={{
            background: "none",
            border: "none",
            cursor: isOnly || disabled ? "default" : "pointer",
            color: isOnly || disabled ? "#c9cccf" : "#d72c0d",
            fontSize: 18,
            lineHeight: 1,
            padding: "2px 4px",
          }}
          title="Remove row"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Spreadsheet table
// ---------------------------------------------------------------------------

export function POSpreadsheet({
  items,
  totalLandedCost,
  totalQtyOrdered,
  onChange,
  onRemove,
  onAddRow,
  disabled = false,
}: POSpreadsheetProps) {
  const landedPerUnit = totalQtyOrdered > 0 ? totalLandedCost / totalQtyOrdered : 0;

  const thStyle: React.CSSProperties = {
    padding: "6px 6px",
    background: "#f6f6f7",
    borderBottom: "2px solid #e1e3e5",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6d7175",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  return (
    <div>
      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: COLS.reduce((s, c) => s + c.width, 0) }}>
          <thead>
            <tr>
              {COLS.map((col, i) => (
                <th key={i} style={{ ...thStyle, width: col.width, textAlign: col.align }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} style={{ padding: "32px", textAlign: "center", color: "#6d7175", fontSize: 14 }}>
                  No line items. Click "Add Row" to begin.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <POLineItemRow
                  key={item.id}
                  item={item}
                  landedPerUnit={landedPerUnit}
                  onChange={onChange}
                  onRemove={onRemove}
                  isOnly={items.length === 1}
                  disabled={disabled}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={onAddRow}
            style={{
              background: "none",
              border: "1px dashed #c9cccf",
              borderRadius: 6,
              padding: "6px 16px",
              cursor: "pointer",
              fontSize: 13,
              color: "#005bd3",
              width: "100%",
            }}
          >
            + Add Row
          </button>
        </div>
      )}
    </div>
  );
}
