interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  color?: string;
  value?: number | string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatter?: (v: number) => string;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--surface-1)", borderColor: "var(--border-strong)" }}
    >
      <div className="mb-1 font-medium" style={{ color: "var(--text-primary)" }}>
        {label}
      </div>
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={String(entry.dataKey ?? i)} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
            <span style={{ color: "var(--text-secondary)" }}>{entry.name}:</span>
            <span className="tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
              {formatter && typeof entry.value === "number" ? formatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
