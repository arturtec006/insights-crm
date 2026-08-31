import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import type { BoardResponse, Deal } from "../types/crm";
import { Card } from "../components/ui/Card";
import { PageState } from "../components/ui/PageState";
import { Badge } from "../components/ui/Badge";
import { formatCurrency } from "../lib/format";
import { formatDate, formatPhone } from "../components/crm/leadDisplay";

// Drag and drop uses the browser's own HTML5 API rather than a library: a
// kanban only needs "pick up a card, drop it on a column", and that is exactly
// what dragstart/dragover/drop give us — with keyboard-accessible <select>
// fallback on each card for anyone not using a mouse.

function DealCard({ deal, onDragStart }: { deal: Deal; onDragStart: (id: string) => void }) {
  const overdue =
    deal.expectedCloseAt != null && deal.status === "open" && new Date(deal.expectedCloseAt) < new Date();

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", deal.id);
        onDragStart(deal.id);
      }}
      className="cursor-grab rounded-lg border p-3 active:cursor-grabbing"
      style={{ background: "var(--surface-2)", borderColor: "var(--border-strong)" }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {deal.title}
      </p>

      <p className="mt-1 tabular-nums text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {formatCurrency(deal.value)}
        <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
          {deal.probability}% de chance
        </span>
      </p>

      {deal.lead && (
        <Link
          to={`/leads/${deal.lead.id}`}
          className="mt-1 block text-xs hover:underline"
          style={{ color: "var(--accent)" }}
        >
          {deal.lead.companyName}
          {deal.lead.phone ? ` · ${formatPhone(deal.lead.phone)}` : ""}
        </Link>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {deal.owner && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {deal.owner.name}
          </span>
        )}
        {deal.expectedCloseAt && (
          <Badge tone={overdue ? "critical" : "neutral"}>
            {overdue ? "Atrasado desde " : "Previsto "}
            {formatDate(deal.expectedCloseAt)}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function PipelinePage() {
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["board"],
    queryFn: () => apiFetch<BoardResponse>("/deals/board"),
  });

  const moveDeal = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      apiFetch(`/deals/${dealId}`, { method: "PATCH", body: JSON.stringify({ stageId }) }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Não consegui mover o negócio."),
  });

  if (isLoading) return <PageState kind="loading" />;
  if (isError || !data) return <PageState kind="error" />;

  const openValue = data.columns
    .filter((c) => c.stage.kind === "open")
    .reduce((sum, c) => sum + c.totalValue, 0);
  const wonValue = data.columns.filter((c) => c.stage.kind === "won").reduce((sum, c) => sum + c.totalValue, 0);
  // Weighting each deal by its stage probability is the difference between
  // "what is on the board" and "what is realistic to close".
  const weighted = data.columns
    .filter((c) => c.stage.kind === "open")
    .reduce((sum, c) => sum + c.deals.reduce((s, d) => s + (d.value * d.probability) / 100, 0), 0);

  const allStages = data.columns.map((c) => c.stage);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {data.pipeline.name}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {formatCurrency(openValue)} em aberto · {formatCurrency(weighted)} ponderado pela chance ·{" "}
            {formatCurrency(wonValue)} ganho
          </p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ minWidth: `${data.columns.length * 260}px` }}>
          {data.columns.map((column) => {
            const isTarget = dragOverStage === column.stage.id;
            return (
              <div
                key={column.stage.id}
                className="flex w-64 shrink-0 flex-col rounded-xl border transition-colors"
                style={{
                  background: isTarget ? "var(--accent-soft)" : "var(--surface-1)",
                  borderColor: isTarget ? "var(--accent)" : "var(--border-strong)",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverStage(column.stage.id);
                }}
                onDragLeave={() => setDragOverStage((s) => (s === column.stage.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  const dealId = e.dataTransfer.getData("text/plain") || dragging;
                  setDragOverStage(null);
                  setDragging(null);
                  if (dealId) moveDeal.mutate({ dealId, stageId: column.stage.id });
                }}
              >
                <div className="border-b px-4 py-3" style={{ borderColor: "var(--border-strong)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {column.stage.name}
                    </span>
                    <span
                      className="tabular-nums rounded-full px-2 py-0.5 text-xs"
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      {column.deals.length}
                    </span>
                  </div>
                  <p className="mt-0.5 tabular-nums text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatCurrency(column.totalValue)}
                  </p>
                </div>

                <div className="flex-1 space-y-2 p-3">
                  {column.deals.length === 0 ? (
                    <p className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      Arraste um negócio para cá
                    </p>
                  ) : (
                    column.deals.map((deal) => (
                      <div key={deal.id} className="space-y-1">
                        <DealCard deal={deal} onDragStart={setDragging} />
                        {/* Keyboard-accessible equivalent of dragging the card. */}
                        <label className="sr-only" htmlFor={`move-${deal.id}`}>
                          Mover {deal.title} para outra etapa
                        </label>
                        <select
                          id={`move-${deal.id}`}
                          className="w-full rounded border px-2 py-1 text-xs"
                          style={{
                            background: "var(--surface-1)",
                            borderColor: "var(--border-strong)",
                            color: "var(--text-muted)",
                          }}
                          value={deal.stage.id}
                          onChange={(e) => moveDeal.mutate({ dealId: deal.id, stageId: e.target.value })}
                        >
                          {allStages.map((s) => (
                            <option key={s.id} value={s.id}>
                              Mover para: {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="p-4">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Arraste um card para mudar de etapa — soltar em <strong>Ganho</strong> ou <strong>Perdido</strong> fecha o
          negócio. Cada movimento fica registrado no histórico do lead.
        </p>
      </Card>
    </div>
  );
}
