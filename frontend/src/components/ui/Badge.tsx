import type { ReactNode } from "react";

type Tone = "good" | "warning" | "serious" | "critical" | "neutral" | "accent";

interface BadgeProps {
  tone?: Tone;
  /** Adds a filled dot before the label. */
  dot?: boolean;
  children: ReactNode;
}

// Fill colour and text colour are deliberately different tokens. A status hue
// chosen to read well as a bar or a chart series is almost never legible as
// small text on a pale wash of itself: `--status-warning` on a card measured
// 1.8:1, far under the 4.5:1 that WCAG AA asks for. Each status therefore has a
// darker `-text` companion, used here and nowhere else.
const toneStyles: Record<Tone, { bg: string; fg: string; bd: string }> = {
  good: {
    bg: "color-mix(in oklab, var(--status-good) 14%, transparent)",
    fg: "var(--status-good-text)",
    bd: "color-mix(in oklab, var(--status-good) 28%, transparent)",
  },
  warning: {
    bg: "color-mix(in oklab, var(--status-warning) 18%, transparent)",
    fg: "var(--status-warning-text)",
    bd: "color-mix(in oklab, var(--status-warning) 34%, transparent)",
  },
  serious: {
    bg: "color-mix(in oklab, var(--status-serious) 16%, transparent)",
    fg: "var(--status-serious-text)",
    bd: "color-mix(in oklab, var(--status-serious) 32%, transparent)",
  },
  critical: {
    bg: "color-mix(in oklab, var(--status-critical) 14%, transparent)",
    fg: "var(--status-critical-text)",
    bd: "color-mix(in oklab, var(--status-critical) 30%, transparent)",
  },
  neutral: { bg: "var(--surface-2)", fg: "var(--text-secondary)", bd: "var(--border-strong)" },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent-text)", bd: "transparent" },
};

export function Badge({ tone = "neutral", dot = false, children }: BadgeProps) {
  const s = toneStyles[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[3px] text-[11px] font-semibold"
      style={{ background: s.bg, color: s.fg, borderColor: s.bd }}
    >
      {/* The dot is shape, not colour: it keeps two adjacent badges of similar
          luminance distinguishable to someone with a colour-vision difference. */}
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "currentColor" }} aria-hidden />}
      {children}
    </span>
  );
}
