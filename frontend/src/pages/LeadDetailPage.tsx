import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import type { ActivityType, LeadDetail } from "../types/crm";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Badge } from "../components/ui/Badge";
import { PageState } from "../components/ui/PageState";
import { formatCurrency } from "../lib/format";
import { LeadStatusBadge, ScoreBar } from "../components/crm/LeadBadges";
import { activityIcon, activityLabel, formatDateTime, formatPhone, sourceLabel, whatsappLink } from "../components/crm/leadDisplay";

const inputClass = "w-full rounded-lg border px-3 py-2 text-sm";
const inputStyle = {
  background: "var(--surface-1)",
  borderColor: "var(--border-strong)",
  color: "var(--text-primary)",
};

const LOGGABLE: ActivityType[] = ["note", "call", "whatsapp", "email", "meeting", "task"];

function ActivityIcon({ type, size = 14 }: { type: ActivityType; size?: number }) {
  const Glyph = Icon[activityIcon[type]];
  return <Glyph size={size} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-sm" style={{ color: "var(--text-primary)" }}>
        {children}
      </dd>
    </div>
  );
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activityType, setActivityType] = useState<ActivityType>("note");
  const [activityText, setActivityText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => apiFetch<{ lead: LeadDetail }>(`/leads/${id}`),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["lead", id] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : "Algo deu errado. Tente de novo.");

  const addActivity = useMutation({
    mutationFn: () =>
      apiFetch("/activities", {
        method: "POST",
        body: JSON.stringify({ leadId: id, type: activityType, content: activityText.trim() }),
      }),
    onSuccess: () => {
      setActivityText("");
      invalidate();
    },
    onError: fail,
  });

  const createDeal = useMutation({
    mutationFn: (title: string) =>
      apiFetch<{ deal: { id: string } }>("/deals", { method: "POST", body: JSON.stringify({ leadId: id, title }) }),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      navigate("/funil");
    },
    onError: fail,
  });

  const convert = useMutation({
    mutationFn: () => apiFetch("/leads/" + id + "/convert", { method: "POST", body: JSON.stringify({ segment: "SMB" }) }),
    onSuccess: invalidate,
    onError: fail,
  });

  const suppress = useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/leads/${id}/suppress`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: invalidate,
    onError: fail,
  });

  if (isLoading) return <PageState kind="loading" />;
  if (isError || !data) return <PageState kind="error" />;

  const lead = data.lead;
  const wa = whatsappLink(lead.phone);
  const busy = convert.isPending || suppress.isPending || createDeal.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/leads" className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>
            ← Voltar para leads
          </Link>
          <h1 className="mt-1 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {lead.companyName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <LeadStatusBadge status={lead.status} />
            <ScoreBar score={lead.score} />
            <Badge tone="neutral">{sourceLabel[lead.source] ?? lead.source}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Qualifying and opening a deal are one action: deciding a lead is
              worth pursuing is what puts it in the funnel. Keeping them apart
              produced leads marked "qualified" that existed in neither the work
              queue nor the board. */}
          {lead.status === "new" && (
            <Button disabled={busy} onClick={() => createDeal.mutate(`${lead.companyName} - proposta`)}>
              Qualificar e abrir negócio
            </Button>
          )}
          {/* Leads qualified before the two actions were merged can still have
              no deal; this gets them onto the board. */}
          {lead.status === "qualified" && lead.deals.length === 0 && (
            <Button disabled={busy} onClick={() => createDeal.mutate(`${lead.companyName} - proposta`)}>
              Abrir negócio no funil
            </Button>
          )}
          {lead.status !== "converted" && (
            <Button variant="secondary" disabled={busy} onClick={() => convert.mutate()}>
              Converter em cliente
            </Button>
          )}
          {lead.status !== "disqualified" && lead.status !== "converted" && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                // Suppression is not just a status change — it writes the phone,
                // domain and e-mail to the do-not-contact list permanently, so
                // it deserves an explicit confirmation.
                const reason = window.prompt(
                  "Motivo do descarte (fica registrado). Isso adiciona o telefone/domínio à lista de não-contactar."
                );
                if (reason !== null) suppress.mutate(reason || "Pediu para não ser contatado");
              }}
            >
              Não contatar
            </Button>
          )}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Registrar contato" subtitle="Tudo que você fizer com esse lead fica no histórico abaixo" />
            <div className="space-y-3 p-5 pt-3">
              <div className="flex flex-wrap gap-2">
                {LOGGABLE.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActivityType(t)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      background: activityType === t ? "var(--accent-soft)" : "var(--surface-2)",
                      color: activityType === t ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    <ActivityIcon type={t} size={13} />
                    {activityLabel[t]}
                  </button>
                ))}
              </div>
              <textarea
                className={inputClass}
                style={inputStyle}
                rows={3}
                placeholder="O que aconteceu nesse contato?"
                value={activityText}
                onChange={(e) => setActivityText(e.target.value)}
              />
              <Button
                disabled={!activityText.trim() || addActivity.isPending}
                onClick={() => addActivity.mutate()}
              >
                {addActivity.isPending ? "Salvando…" : "Registrar"}
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Histórico" subtitle={`${lead.activities.length} evento(s)`} />
            <div className="p-5 pt-3">
              {lead.activities.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Nenhum contato registrado ainda.
                </p>
              ) : (
                <ol className="space-y-4">
                  {lead.activities.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                      >
                        <ActivityIcon type={a.type} size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {activityLabel[a.type]}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {formatDateTime(a.createdAt)}
                            {a.user ? ` · ${a.user.name}` : ""}
                          </span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm" style={{ color: "var(--text-secondary)" }}>
                          {a.content}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Dados" />
            <dl className="space-y-3 p-5 pt-3">
              <Field label="Telefone">
                <span className="tabular-nums">{formatPhone(lead.phone)}</span>
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className="ml-2 text-xs hover:underline" style={{ color: "var(--accent-text)" }}>
                    WhatsApp
                  </a>
                )}
              </Field>
              <Field label="E-mail">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="hover:underline" style={{ color: "var(--accent-text)" }}>
                    {lead.email}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Site">
                {lead.website ? (
                  <a href={lead.website} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--accent-text)" }}>
                    {lead.websiteDomain}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Instagram">
                {lead.instagram ? (
                  <a
                    href={`https://instagram.com/${lead.instagram}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                    style={{ color: "var(--accent-text)" }}
                  >
                    @{lead.instagram}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Endereço">{lead.addressLine ?? "—"}</Field>
              <Field label="Cidade">{[lead.city, lead.state].filter(Boolean).join(" / ") || "—"}</Field>
              <Field label="Categoria">{lead.category ?? "—"}</Field>
              <Field label="Responsável">{lead.owner?.name ?? "Sem responsável"}</Field>
              {lead.disqualifyReason && <Field label="Motivo do descarte">{lead.disqualifyReason}</Field>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Por que esse score" subtitle={`${lead.score} de 100`} />
            <div className="p-5 pt-3">
              {lead.signals.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Sem sinais registrados.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lead.signals.map((s) => (
                    <li key={s.label} className="flex items-center justify-between text-sm">
                      <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                      <span
                        className="tabular-nums font-medium"
                        style={{ color: s.points >= 0 ? "var(--status-good-text)" : "var(--status-critical)" }}
                      >
                        {s.points >= 0 ? "+" : ""}
                        {s.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {lead.job && (
            <Card>
              <CardHeader title="Origem" />
              <div className="p-5 pt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                Capturado pela busca <strong style={{ color: "var(--text-primary)" }}>&ldquo;{lead.job.query}&rdquo;</strong> em{" "}
                {lead.job.city}, via {sourceLabel[lead.job.provider] ?? lead.job.provider}, em {formatDateTime(lead.job.createdAt)}.
              </div>
            </Card>
          )}

          {lead.deals.length > 0 && (
            <Card>
              <CardHeader title="Negócios" />
              <ul className="space-y-2 p-5 pt-3">
                {lead.deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--text-primary)" }}>{d.title}</span>
                    <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {formatCurrency(d.value)} · {d.stage.name}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
