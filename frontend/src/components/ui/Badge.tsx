import type { ReactNode } from "react";

type Tone = "good" | "warning" | "serious" | "critical" | "neutral";

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: "color-mix(in oklab, var(--status-good) 16%, transparent)", fg: "var(--status-good-text)" },
  warning: { bg: "color-mix(in oklab, var(--status-warning) 20%, transparent)", fg: "var(--status-warning)" },
  serious: { bg: "color-mix(in oklab, var(--status-serious) 18%, transparent)", fg: "var(--status-serious)" },
  critical: { bg: "color-mix(in oklab, var(--status-critical) 16%, transparent)", fg: "var(--status-critical)" },
  neutral: { bg: "var(--surface-2)", fg: "var(--text-secondary)" },
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const s = toneStyles[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {children}
    </span>
  );
}
