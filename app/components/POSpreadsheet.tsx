import React from "react";

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export type ColKey =
  | "image" | "description" | "supplierSku" | "sku" | "barcode"
  | "retail" | "cost" | "landed" | "markup" | "margin"
  | "available" | "onOrder" | "qty"
  | "qtyReceived" | "qtyRejected" | "lineTotal";

export type ColDef = {
  key: ColKey;
  label: string;
  width: number;
  align: "left" | "right" | "center";
  defaultVisible: boolean;
  alwaysVisible: boolean;
};

export const ALL_COLS: ColDef[] = [
  { key: "image",       label: "",                   width: 44,  align: "center", defaultVisible: true,  alwaysVisible: true  },
  { key: "description", label: "Product",             width: 200, align: "left",   defaultVisible: true,  alwaysVisible: true  },
  { key: "supplierSku", label: "Supplier Code / SKU", width: 130, align: "left",   defaultVisible: true,  alwaysVisible: false },
  { key: "sku",         label: "SKU",                 width: 100, align: "left",   defaultVisible: true,  alwaysVisible: false },
  { key: "barcode",     label: "Barcode",             width: 115, align: "left",   defaultVisible: false, alwaysVisible: false },
  { key: "retail",      label: "Retail",              width: 82,  align: "right",  defaultVisible: true,  alwaysVisible: false },
  { key: "cost",        label: "Cost",                width: 90,  align: "right",  defaultVisible: true,  alwaysVisible: true  },
  { key: "landed",      label: "Landed",              width: 90,  align: "right",  defaultVisible: true,  alwaysVisible: false },
  { key: "markup",      label: "Markup",              width: 72,  align: "right",  defaultVisible: true,  alwaysVisible: false },
  { key: "margin",      label: "Margin",              width: 72,  align: "right",  defaultVisible: true,  alwaysVisible: false },
  { key: "available",   label: "Available",           width: 75,  align: "right",  defaultVisible: true,  alwaysVisible: false },
  { key: "onOrder",     label: "On Order",            width: 72,  align: "right",  defaultVisible: false, alwaysVisible: false },
  { key: "qty",         label: "Qty",                 width: 72,  align: "right",  defaultVisible: true,  alwaysVisible: true  },
  { key: "qtyReceived", label: "Recv",                width: 60,  align: "right",  defaultVisible: false, alwaysVisible: false },
  { key: "qtyRejected", label: "Rej",                 width: 55,  align: "right",  defaultVisible: false, alwaysVisible: false },
  { key: "lineTotal",   label: "Total",               width: 90,  align: "right",  defaultVisible: false, alwaysVisible: false },
];

export const DEFAULT_VISIBLE = new Set<ColKey>(
  ALL_COLS.filter((c) => c.defaultVisible).map((c) => c.key),
);

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
};

export type EditItem = {
  id: string;
  description: string;
  supplierSku: string;
  qtyOrdered: string;
  unitCost: string;
  qtyReceived: number;
  qtyRejected: number;
  product: POLineItemProduct | null;
};

export type POSpreadsheetProps = {
  items: EditItem[];
  visibleCols: Set<ColKey>;
  totalLandedCost: number;
  totalQtyOrdered: number;
  onChange: (id: string, field: keyof Pick<EditItem, "description" | "supplierSku" | "qtyOrdered" | "unitCost">, value: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
};

// ---------------------------------------------------------------------------
// Compact native input — stable, no Polaris remount issues
// ---------------------------------------------------------------------------

function TI({
  value,
  onChange,
  type = "text",
  placeholder = "",
  align = "left",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  align?: "left" | "right";
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
        width: "100%",
        height: "30px",
        padding: "0 7px",
        border: `1.5px solid ${focused ? "#005bd3" : "#c9cccf"}`,
        borderRadius: "4px",
        fontSize: "13px",
        textAlign: align,
        background: disabled ? "#f6f6f7" : "#fff",
        boxSizing: "border-box",
        outline: "none",
        boxShadow: focused ? "0 0 0 2px #c4d3f4" : "none",
        color: "#202223",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Read-only cell
// ---------------------------------------------------------------------------

function RO({
  value,
  align = "left",
  tone,
  bold,
}: {
  value: string;
  align?: "left" | "right";
  tone?: "subdued" | "success" | "critical" | "warning";
  bold?: boolean;
}) {
  const colors: Record<string, string> = {
    subdued: "#6d7175",
    success: "#1a7a4a",
    critical: "#d72c0d",
    warning: "#b98900",
  };
  return (
    <span
      style={{
        fontSize: "13px",
        color: tone ? colors[tone] : "#202223",
        fontWeight: bold ? 600 : 400,
        display: "block",
        textAlign: align,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Row — defined at MODULE LEVEL for stable React identity
// ---------------------------------------------------------------------------

function POLineItemRow({
  item,
  visibleCols,
  landedPerUnit,
  onChange,
  onRemove,
  isOnly,
  disabled,
}: {
  item: EditItem;
  visibleCols: Set<ColKey>;
  landedPerUnit: number;
  onChange: POSpreadsheetProps["onChange"];
  onRemove: POSpreadsheetProps["onRemove"];
  isOnly: boolean;
  disabled: boolean;
}) {
  const p    = item.product;
  const qty  = parseFloat(item.qtyOrdered) || 0;
  const cost = parseFloat(item.unitCost)   || 0;

  const lineTotal    = qty * cost;
  const retail       = p?.currentPrice    ?? 0;
  const available    = p?.currentQuantity ?? 0;
  const onOrder      = Math.max(0, qty - item.qtyReceived);
  const lpu          = landedPerUnit;

  const markup = retail > 0 && lpu > 0
    ? ((retail - lpu) / lpu)   * 100
    : null;
  const margin = retail > 0
    ? ((retail - lpu) / retail) * 100
    : null;

  const td: React.CSSProperties = {
    padding: "3px 6px",
    borderBottom: "1px solid #e1e3e5",
    verticalAlign: "middle",
  };

  function cell(key: ColKey, content: React.ReactNode, extraStyle?: React.CSSProperties) {
    if (!visibleCols.has(key)) return null;
    const col = ALL_COLS.find((c) => c.key === key)!;
    return (
      <td key={key} style={{ ...td, width: col.width, maxWidth: col.width, textAlign: col.align, ...extraStyle }}>
        {content}
      </td>
    );
  }

  return (
    <tr style={{ background: "white" }}>
      {/* Image */}
      {cell("image",
        <div style={{ width: 34, height: 34, background: "#f6f6f7", borderRadius: 4, border: p ? "none" : "1px dashed #d1d5db", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          {p
            ? <span style={{ fontSize: 9, color: "#6d7175", textAlign: "center", padding: 2 }}>IMG</span>
            : null}
        </div>
      )}

      {/* Product name / description */}
      {cell("description",
        <div>
          <TI
            value={item.description}
            onChange={(v) => onChange(item.id, "description", v)}
            placeholder={p?.title ?? "Product name / SKU…"}
            disabled={disabled}
          />
          {p?.title && (
            <div style={{ fontSize: 11, color: "#6d7175", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 195 }}>
              {p.title}
            </div>
          )}
        </div>
      )}

      {/* Supplier Code / SKU */}
      {cell("supplierSku",
        <TI
          value={item.supplierSku}
          onChange={(v) => onChange(item.id, "supplierSku", v)}
          placeholder="SUP-001"
          disabled={disabled}
        />
      )}

      {/* SKU */}
      {cell("sku", <RO value={p?.sku ?? "—"} tone={p?.sku ? undefined : "subdued"} />)}

      {/* Barcode */}
      {cell("barcode", <RO value={p?.barcode ?? "—"} tone={p?.barcode ? undefined : "subdued"} />)}

      {/* Retail */}
      {cell("retail",
        <RO value={retail > 0 ? `$${retail.toFixed(2)}` : "—"} align="right" tone={retail > 0 ? undefined : "subdued"} />
      )}

      {/* Cost (editable) */}
      {cell("cost",
        <TI value={item.unitCost} onChange={(v) => onChange(item.id, "unitCost", v)} type="number" align="right" disabled={disabled} />
      )}

      {/* Landed cost/unit */}
      {cell("landed",
        <RO value={lpu > 0 ? `$${lpu.toFixed(2)}` : "—"} align="right" tone={lpu > 0 ? undefined : "subdued"} />
      )}

      {/* Markup % */}
      {cell("markup",
        <RO
          value={markup !== null ? `${markup.toFixed(1)}%` : "—"}
          align="right"
          tone={markup === null ? "subdued" : markup >= 0 ? "success" : "critical"}
        />
      )}

      {/* Margin % */}
      {cell("margin",
        <RO
          value={margin !== null ? `${margin.toFixed(1)}%` : "—"}
          align="right"
          tone={margin === null ? "subdued" : margin >= 20 ? "success" : margin >= 0 ? "warning" : "critical"}
        />
      )}

      {/* Available */}
      {cell("available",
        <RO
          value={p ? String(available) : "—"}
          align="right"
          tone={!p ? "subdued" : available <= 0 ? "critical" : undefined}
        />
      )}

      {/* On Order */}
      {cell("onOrder", <RO value={String(onOrder)} align="right" />)}

      {/* Qty Ordered (editable) */}
      {cell("qty",
        <TI value={item.qtyOrdered} onChange={(v) => onChange(item.id, "qtyOrdered", v)} type="number" align="right" disabled={disabled} />
      )}

      {/* Qty Received */}
      {cell("qtyReceived", <RO value={String(item.qtyReceived)} align="right" />)}

      {/* Qty Rejected */}
      {cell("qtyRejected",
        <RO value={String(item.qtyRejected)} align="right" tone={item.qtyRejected > 0 ? "critical" : undefined} />
      )}

      {/* Line Total */}
      {cell("lineTotal", <RO value={`$${lineTotal.toFixed(2)}`} align="right" bold />)}

      {/* Remove */}
      <td style={{ ...td, width: 36, textAlign: "center" }}>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={isOnly || disabled}
          title="Remove row"
          style={{
            background: "none",
            border: "none",
            cursor: isOnly || disabled ? "default" : "pointer",
            color: isOnly || disabled ? "#d1d5db" : "#d72c0d",
            fontSize: 20,
            lineHeight: 1,
            padding: "0 4px",
            display: "flex",
            alignItems: "center",
          }}
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
  visibleCols,
  totalLandedCost,
  totalQtyOrdered,
  onChange,
  onRemove,
  disabled = false,
}: POSpreadsheetProps) {
  const landedPerUnit = totalQtyOrdered > 0 ? totalLandedCost / totalQtyOrdered : 0;

  const activeCols = ALL_COLS.filter((c) => visibleCols.has(c.key));

  const thStyle: React.CSSProperties = {
    padding: "7px 6px",
    background: "#f6f6f7",
    borderBottom: "2px solid #e1e3e5",
    fontSize: "11px",
    fontWeight: 600,
    color: "#6d7175",
    whiteSpace: "nowrap",
    userSelect: "none",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
        <colgroup>
          {activeCols.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
          <col style={{ width: 36 }} />
        </colgroup>
        <thead>
          <tr>
            {activeCols.map((c) => (
              <th key={c.key} style={{ ...thStyle, textAlign: c.align }}>
                {c.label}
              </th>
            ))}
            <th style={{ ...thStyle, width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={activeCols.length + 1}
                style={{ padding: "40px 24px", textAlign: "center", color: "#6d7175", fontSize: 14 }}
              >
                No line items yet. Click <strong>Add Row</strong> to begin.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <POLineItemRow
                key={item.id}
                item={item}
                visibleCols={visibleCols}
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
  );
}
