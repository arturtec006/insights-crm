import { Badge } from "../ui/Badge";
import type { LeadStatus, JobStatus } from "../../types/crm";
import { jobStatusLabel, jobStatusTone, leadStatusLabel, leadStatusTone } from "./leadDisplay";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={leadStatusTone[status]}>{leadStatusLabel[status]}</Badge>;
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={jobStatusTone[status]}>{jobStatusLabel[status]}</Badge>;
}

/**
 * The score bar. Colour is a coarse band rather than a gradient, because the
 * useful question is "is this worth a call today?", not "is it 71 or 74?".
 */
export function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "var(--status-good)" : score >= 40 ? "var(--status-warning)" : "var(--baseline)";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full"
        style={{ background: "var(--surface-2)" }}
        role="img"
        aria-label={`Score ${score} de 100`}
      >
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="tabular-nums text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {score}
      </span>
    </div>
  );
}
