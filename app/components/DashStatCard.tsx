import { Text, Badge } from "@shopify/polaris";

export type DashKpiTone = "success" | "warning" | "critical" | "info" | "attention";

export function DashKpiStyles() {
  return (
    <style>{`
      .dash-kpi-grid {
        display: grid;
        gap: 16px;
        align-items: stretch;
      }
      .dash-kpi {
        position: relative;
        height: 100%;
        min-height: 136px;
        padding: 16px 20px;
        background: #fff;
        border-radius: 12px;
        border: 2px solid #e1e3e5;
        box-shadow: 0 1px 0 rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        gap: 8px;
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
      }
      .dash-kpi--tone-info {
        background: linear-gradient(180deg, #f4f8ff 0%, #fff 100%);
        border-color: #95b8f0;
      }
      .dash-kpi--tone-attention {
        background: linear-gradient(180deg, #fff8e6 0%, #fff 100%);
        border-color: #ffc453;
      }
      .dash-kpi--tone-warning {
        background: linear-gradient(180deg, #fff5ea 0%, #fff 100%);
        border-color: #ffb84d;
      }
      .dash-kpi--tone-success {
        background: linear-gradient(180deg, #eefbf5 0%, #fff 100%);
        border-color: #86d4b3;
      }
      .dash-kpi--tone-critical {
        background: linear-gradient(180deg, #fff4f4 0%, #fff 100%);
        border-color: #f4a4a4;
      }
      .dash-kpi--clickable { cursor: pointer; }
      .dash-kpi--clickable:hover,
      .dash-kpi--clickable:focus-visible {
        transform: translateY(-4px);
        border-color: #005bd3;
        background: #eef4ff;
        box-shadow: 0 10px 28px rgba(0, 91, 211, 0.22), 0 0 0 1px rgba(0, 91, 211, 0.12);
      }
      .dash-kpi--clickable:focus-visible {
        outline: 2px solid #005bd3;
        outline-offset: 2px;
      }
      .dash-kpi--clickable:active { transform: translateY(-1px); }
      .dash-kpi__hint {
        position: absolute;
        top: 14px;
        right: 16px;
        font-size: 12px;
        font-weight: 600;
        color: #005bd3;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity 0.18s ease, transform 0.18s ease;
      }
      .dash-kpi--clickable:hover .dash-kpi__hint,
      .dash-kpi--clickable:focus-visible .dash-kpi__hint {
        opacity: 1;
        transform: translateX(0);
      }
      .dash-kpi__footer {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 44px;
        justify-content: flex-end;
      }
      .dash-kpi__spacer { display: block; min-height: 20px; }
    `}</style>
  );
}

export function DashKpiGrid({
  columns,
  children,
}: {
  columns: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="dash-kpi-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

export function DashStatCard({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: DashKpiTone;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);

  return (
    <div
      className={[
        "dash-kpi",
        clickable && "dash-kpi--clickable",
        tone && `dash-kpi--tone-${tone}`,
      ].filter(Boolean).join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick!(); } : undefined}
    >
      {clickable && <span className="dash-kpi__hint" aria-hidden="true">View →</span>}
      <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
      <Text as="p" variant="headingXl" fontWeight="bold">{String(value)}</Text>
      <div className="dash-kpi__footer">
        {sub
          ? <Text as="p" variant="bodySm" tone="subdued">{sub}</Text>
          : <span aria-hidden="true" className="dash-kpi__spacer" />}
        {tone
          ? (
            <Badge tone={tone}>
              {tone === "success" ? "On track" : tone === "warning" || tone === "attention" ? "Needs attention" : tone === "critical" ? "Action required" : "Active"}
            </Badge>
          )
          : <span aria-hidden="true" className="dash-kpi__spacer" />}
      </div>
    </div>
  );
}
