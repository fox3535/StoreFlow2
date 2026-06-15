import { TextField, Text, Button, InlineStack, Box } from "@shopify/polaris";

export type LineItem = {
  id: string;
  description: string;
  supplierSku: string;
  qtyOrdered: string;
  unitCost: string;
};

type Props = {
  items: LineItem[];
  onChange: (id: string, field: keyof Omit<LineItem, "id">, value: string) => void;
  onRemove: (id: string) => void;
};

// Defined outside parent component so React tracks identity by key, not position.
// This prevents focus loss on every keystroke.
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
  const total = (parseFloat(item.qtyOrdered) || 0) * (parseFloat(item.unitCost) || 0);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1.2fr 80px 110px 80px 70px",
        gap: "8px",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #e1e3e5",
      }}
    >
      <TextField
        label=""
        labelHidden
        placeholder="Description / SKU"
        value={item.description}
        onChange={(v) => onChange(item.id, "description", v)}
        autoComplete="off"
      />
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
      <Text as="span" variant="bodyMd">
        ${total.toFixed(2)}
      </Text>
      <Button
        variant="plain"
        tone="critical"
        onClick={() => onRemove(item.id)}
        disabled={isOnly}
      >
        Remove
      </Button>
    </div>
  );
}

export function LineItemsTable({ items, onChange, onRemove }: Props) {
  return (
    <Box>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.2fr 80px 110px 80px 70px",
          gap: "8px",
          padding: "0 0 8px 0",
          borderBottom: "2px solid #e1e3e5",
        }}
      >
        {["Description / SKU", "Supplier SKU", "Qty", "Unit Cost", "Total", ""].map(
          (h) => (
            <Text key={h} as="span" variant="bodySm" fontWeight="semibold" tone="subdued">
              {h}
            </Text>
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
    </Box>
  );
}
