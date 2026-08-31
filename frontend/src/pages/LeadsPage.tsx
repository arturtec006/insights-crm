import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import type { LeadFacets, LeadsResponse, LeadStatus } from "../types/crm";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { KpiCard } from "../components/ui/KpiCard";
import { PageState } from "../components/ui/PageState";
import { Icon } from "../components/ui/Icon";
import { formatNumber } from "../lib/format";
import { LeadStatusBadge, ScoreBar } from "../components/crm/LeadBadges";
import { formatPhone, leadStatusLabel, sourceLabel, whatsappLink } from "../components/crm/leadDisplay";

const selectClass = "rounded-lg border px-3 py-2 text-sm";
const selectStyle = {
  background: "var(--surface-1)",
  borderColor: "var(--border-strong)",
  color: "var(--text-primary)",
};

interface Filters {
  q: string;
  status: LeadStatus | "";
  city: string;
  source: string;
  assignment: "any" | "mine" | "unassigned";
  minScore: number;
  sort: "score" | "recent" | "name";
  page: number;
}

// This screen is a work queue, not an archive: it opens on the leads nobody has
// touched yet, so working a lead removes it from the list instead of leaving it
// to be scrolled past forever. The status cards above the table switch to the
// other buckets, so nothing is hidden without a way back.
const INITIAL: Filters = {
  q: "",
  status: "new",
  city: "",
  source: "",
  assignment: "any",
  minScore: 0,
  sort: "score",
  page: 1,
};

const STATUS_CARDS: { status: LeadStatus; label: string; hint: string }[] = [
  { status: "new", label: "Novos", hint: "Sua fila de trabalho" },
  { status: "qualified", label: "Qualificados", hint: "Já estão no funil" },
  { status: "converted", label: "Convertidos", hint: "Viraram cliente" },
  { status: "disqualified", label: "Descartados", hint: "Fora do perfil" },
];

function buildQueryString(filters: Filters): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: "25",
    sort: filters.sort,
    assignment: filters.assignment,
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.city) params.set("city", filters.city);
  if (filters.source) params.set("source", filters.source);
  if (filters.minScore > 0) params.set("minScore", String(filters.minScore));
  return params.toString();
}

export function LeadsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(INITIAL);
  // The text input is held separately so typing does not fire a request per
  // keystroke; the search only commits on Enter or on the button.
  const [searchDraft, setSearchDraft] = useState("");

  // Any filter change resets to page 1 — staying on page 4 of a result set
  // that now has two pages just shows an empty table.
  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  const queryString = buildQueryString(filters);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["leads", queryString],
    queryFn: () => apiFetch<LeadsResponse>(`/leads?${queryString}`),
    placeholderData: keepPreviousData,
  });

  const { data: facets } = useQuery({
    queryKey: ["lead-facets"],
    queryFn: () => apiFetch<LeadFacets>("/leads/facets"),
  });

  if (isLoading) return <PageState kind="loading" />;
  if (isError || !data) return <PageState kind="error" />;

  const counts = data.statusCounts;
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  // The untouched-leads queue with nothing narrowing it further: an empty result
  // here means the work is done, not that the search was too specific.
  const isQueueView =
    filters.status === "new" && !filters.q && !filters.city && !filters.source && filters.minScore === 0;

  return (
    <div className="space-y-6">
      {/* Doubles as the status filter: the numbers already say where the leads
          are, so making them the control avoids a second place to look. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATUS_CARDS.map((card) => {
          const active = filters.status === card.status;
          return (
            <button
              key={card.status}
              type="button"
              onClick={() => update({ status: card.status })}
              aria-pressed={active}
              className="rounded-xl text-left transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ outlineColor: "var(--accent)", boxShadow: active ? "0 0 0 2px var(--accent)" : undefined }}
            >
              <KpiCard label={card.label} value={formatNumber(counts[card.status] ?? 0)} hint={card.hint} />
            </button>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }} htmlFor="lead-search">
              Buscar
            </label>
            <div className="flex gap-2">
              <input
                id="lead-search"
                className={`${selectClass} w-full`}
                style={selectStyle}
                placeholder="Empresa, telefone, e-mail ou site"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") update({ q: searchDraft });
                }}
              />
              <Button variant="secondary" onClick={() => update({ q: searchDraft })}>
                Buscar
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }} htmlFor="lead-status">
              Status
            </label>
            <select
              id="lead-status"
              className={selectClass}
              style={selectStyle}
              value={filters.status}
              onChange={(e) => update({ status: e.target.value as LeadStatus | "" })}
            >
              <option value="">Todos</option>
              {(Object.keys(leadStatusLabel) as LeadStatus[]).map((s) => (
                <option key={s} value={s}>
                  {leadStatusLabel[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }} htmlFor="lead-city">
              Cidade
            </label>
            <select
              id="lead-city"
              className={selectClass}
              style={selectStyle}
              value={filters.city}
              onChange={(e) => update({ city: e.target.value })}
            >
              <option value="">Todas</option>
              {facets?.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }} htmlFor="lead-source">
              Origem
            </label>
            <select
              id="lead-source"
              className={selectClass}
              style={selectStyle}
              value={filters.source}
              onChange={(e) => update({ source: e.target.value })}
            >
              <option value="">Todas</option>
              {facets?.sources.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel[s] ?? s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }} htmlFor="lead-score">
              Score mínimo: {filters.minScore}
            </label>
            <input
              id="lead-score"
              type="range"
              min={0}
              max={100}
              step={10}
              value={filters.minScore}
              onChange={(e) => update({ minScore: Number(e.target.value) })}
              className="w-32 accent-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }} htmlFor="lead-sort">
              Ordenar
            </label>
            <select
              id="lead-sort"
              className={selectClass}
              style={selectStyle}
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as Filters["sort"] })}
            >
              <option value="score">Melhor score</option>
              <option value="recent">Mais recentes</option>
              <option value="name">Nome (A-Z)</option>
            </select>
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              setFilters(INITIAL);
              setSearchDraft("");
            }}
          >
            Limpar
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {formatNumber(data.total)} {data.total === 1 ? "lead" : "leads"}
            {isFetching && <span style={{ color: "var(--text-muted)" }}> · atualizando…</span>}
          </p>
          <Link to="/garimpo">
            <Button variant="secondary">Garimpar mais leads</Button>
          </Link>
        </div>

        {data.leads.length === 0 ? (
          <div className="px-5 pb-8 pt-4 text-center">
            {/* An empty queue is an accomplishment, not a failed search — say so,
                instead of implying the filters are wrong. */}
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {isQueueView ? "Fila zerada — você trabalhou todos os leads novos." : "Nenhum lead com esses filtros."}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {isQueueView
                ? "Rode uma busca no Garimpo para trazer mais, ou veja os outros status acima."
                : "Ajuste os filtros ou rode uma busca automática na aba Garimpo."}
            </p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-320px)] overflow-auto">
            <table className="data-table">
              {/* colgroup = colunas param de pular ao paginar */}
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: 128 }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: 132 }} />
                <col style={{ width: 116 }} />
                <col style={{ width: 128 }} />
                <col style={{ width: 132 }} />
              </colgroup>

              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">Score</th>
                  <th scope="col">Contato</th>
                  <th scope="col">Cidade</th>
                  <th scope="col">Origem</th>
                  <th scope="col">Responsável</th>
                  <th scope="col" data-align="right">Status</th>
                </tr>
              </thead>

              <tbody>
                {data.leads.map((lead, i) => {
                  const wa = whatsappLink(lead.phone);
                  return (
                    <tr
                      key={lead.id}
                      data-clickable
                      className="row-in"
                      style={{ "--i": i } as React.CSSProperties}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <td>
                        {/* o <a> continua existindo: leitor de tela, ctrl+clique,
                            clique do meio e navegação por teclado seguem funcionando */}
                        <Link
                          to={`/leads/${lead.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate text-[14px] font-medium text-ink hover:text-accent-text"
                        >
                          {lead.companyName}
                        </Link>
                        <div className="truncate text-[12px] leading-tight text-ink-3">
                          {lead.contactName ?? lead.category ?? " "}
                        </div>
                      </td>

                      <td><ScoreBar score={lead.score} /></td>

                      <td>
                        <div className="numeric truncate text-[13px] text-ink-2">
                          {formatPhone(lead.phone)}
                        </div>
                        <div className="truncate text-[12px] leading-tight text-ink-3">
                          {lead.email ?? " "}
                        </div>
                      </td>

                      <td className="truncate text-[13px] text-ink-2">{lead.city ?? "—"}</td>
                      <td className="truncate text-[13px] text-ink-3">
                        {sourceLabel[lead.source] ?? lead.source}
                      </td>
                      <td className="truncate text-[13px] text-ink-2">{lead.owner?.name ?? "—"}</td>

                      <td data-align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ação revelada no hover (Folk/Attio): tira o link azul
                              permanente do meio da linha e devolve o acento para a
                              ação primária (o nome da empresa). */}
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Abrir conversa no WhatsApp"
                              aria-label={`WhatsApp de ${lead.companyName}`}
                              className="row-actions grid h-7 w-7 place-items-center rounded-ctl
                                         border border-line-2 bg-surface-1 text-ink-2
                                         hover:bg-surface-3 hover:text-ink"
                            >
                              <Icon.Whatsapp size={14} />
                            </a>
                          )}
                          <LeadStatusBadge status={lead.status} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: "var(--border-strong)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Página {data.page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={data.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={data.page >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
