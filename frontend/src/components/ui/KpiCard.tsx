import type { ReactNode } from "react";
import { Card } from "./Card";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean } | null;
  hint?: string;
  icon?: ReactNode;
}

export function KpiCard({ label, value, delta, hint, icon }: KpiCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: "var(--text-muted)" }} aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tabular-nums text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {value}
        </span>
        {delta && (
          <span
            className="text-xs font-medium"
            style={{ color: delta.positive ? "var(--status-good-text)" : "var(--status-critical)" }}
          >
            {delta.positive ? "↑" : "↓"} {delta.value}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </Card>
  );
}
