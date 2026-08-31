interface Item {
  label: string;
  value: number;
}

interface Props {
  items: Item[];
  color?: string;
  formatter?: (v: number) => string;
}

export function BarList({ items, color = "var(--series-1)", formatter = (v) => String(v) }: Props) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
            <span className="tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
              {formatter(item.value)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((item.value / max) * 100, 3)}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
