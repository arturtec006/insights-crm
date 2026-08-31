import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import type { ProspectJob, ProspectingOptions } from "../types/crm";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageState } from "../components/ui/PageState";
import { JobStatusBadge } from "../components/crm/LeadBadges";
import { formatDateTime, sourceLabel } from "../components/crm/leadDisplay";
import { RoleGate } from "../components/ui/RoleGate";
import { formatNumber } from "../lib/format";

const inputClass = "w-full rounded-lg border px-3 py-2 text-sm";
const inputStyle = {
  background: "var(--surface-1)",
  borderColor: "var(--border-strong)",
  color: "var(--text-primary)",
};

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function ProspectingPage() {
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState("overpass");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("SP");
  const [radiusKm, setRadiusKm] = useState(15);
  const [limit, setLimit] = useState(60);
  const [scoringProfile, setScoringProfile] = useState("completeness");
  const [error, setError] = useState<string | null>(null);

  const { data: options } = useQuery({
    queryKey: ["prospecting-options"],
    queryFn: () => apiFetch<ProspectingOptions>("/prospecting/options"),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["prospect-jobs"],
    queryFn: () => apiFetch<{ jobs: ProspectJob[] }>("/prospecting/jobs"),
    // Poll only while something is actually running, so an idle screen makes
    // no requests at all.
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      return jobs.some((j) => j.status === "running" || j.status === "queued") ? 4000 : false;
    },
  });

  const activeJob = data?.jobs.find((j) => j.status === "running" || j.status === "queued");
  // The effect below depends on the id alone, not the job object: polling
  // replaces that object every few seconds, and depending on it would tear down
  // and restart the drive loop on every refetch.
  const activeJobId = activeJob?.id;

  // On a serverless host nothing runs between requests, so this screen is what
  // drives the work: while a job is unfinished it keeps asking the server to
  // process another slice. Each tick is a normal request that returns when its
  // slice is done, and the server holds a lock, so overlapping ticks are safe
  // and a second tab cannot double-import.
  //
  // On an always-on host the background loop finishes the job on its own and
  // these ticks simply find nothing left to do.
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;

    const drive = async () => {
      while (!cancelled) {
        try {
          const result = await apiFetch<{ done: boolean }>(`/prospecting/jobs/${activeJobId}/tick`, {
            method: "POST",
          });
          void queryClient.invalidateQueries({ queryKey: ["prospect-jobs"] });
          if (result.done) {
            // The leads this run produced are now worth re-fetching.
            void queryClient.invalidateQueries({ queryKey: ["leads"] });
            void queryClient.invalidateQueries({ queryKey: ["lead-facets"] });
            return;
          }
        } catch {
          // A failed tick is not fatal: the job keeps its cursor, so stop
          // driving and let the next poll or a reload pick it back up.
          return;
        }
      }
    };

    void drive();
    return () => {
      cancelled = true;
    };
  }, [activeJobId, queryClient]);

  const startJob = useMutation({
    mutationFn: () =>
      apiFetch<{ job: ProspectJob }>("/prospecting/jobs", {
        method: "POST",
        body: JSON.stringify({
          provider,
          query: niche,
          city: city.trim(),
          state: state.trim() || undefined,
          radiusMeters: radiusKm * 1000,
          limit,
          scoringProfile,
        }),
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["prospect-jobs"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Não consegui iniciar a busca."),
  });

  const cancelJob = useMutation({
    mutationFn: (jobId: string) => apiFetch(`/prospecting/jobs/${jobId}/cancel`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["prospect-jobs"] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Não consegui cancelar."),
  });

  if (isLoading) return <PageState kind="loading" />;
  if (isError || !data) return <PageState kind="error" />;

  const canSubmit = Boolean(niche && city.trim()) && !activeJob && !startJob.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Garimpo de leads
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Escolha um nicho e uma cidade. O sistema busca os negócios, visita o site de cada um para achar e-mail,
          Instagram e WhatsApp, remove duplicados e joga tudo pontuado direto no CRM.
        </p>
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

      <RoleGate allow={["ADMIN", "MANAGER"]}>
        <Card>
          <CardHeader title="Nova busca" subtitle="Uma busca por vez, para não sobrecarregar a fonte de dados" />
          <div className="grid grid-cols-1 gap-4 p-5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            <Labeled label="Nicho">
              <select className={inputClass} style={inputStyle} value={niche} onChange={(e) => setNiche(e.target.value)}>
                <option value="">Escolha o tipo de negócio…</option>
                {options?.niches.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </Labeled>

            <Labeled label="Cidade">
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="Campinas"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </Labeled>

            <Labeled label="Estado (UF)">
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="SP"
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
              />
            </Labeled>

            <Labeled label={`Raio: ${radiusKm} km`} hint="A partir do centro da cidade">
              <input
                type="range"
                min={1}
                max={50}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </Labeled>

            <Labeled label={`Limite: ${limit} negócios`} hint="Quanto maior, mais demorada a busca">
              <input
                type="range"
                min={10}
                max={200}
                step={10}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </Labeled>

            <Labeled label="Fonte">
              <select
                className={inputClass}
                style={inputStyle}
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                {options?.providers.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.available}>
                    {p.label}
                    {p.available ? "" : " — não configurada"}
                  </option>
                ))}
              </select>
            </Labeled>

            <div className="sm:col-span-2 lg:col-span-3">
              <Labeled
                label="Como pontuar os leads"
                hint={options?.scoringProfiles.find((p) => p.id === scoringProfile)?.description}
              >
                <select
                  className={inputClass}
                  style={inputStyle}
                  value={scoringProfile}
                  onChange={(e) => setScoringProfile(e.target.value)}
                >
                  {options?.scoringProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Labeled>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 pb-5">
            <Button disabled={!canSubmit} onClick={() => startJob.mutate()}>
              {startJob.isPending ? "Iniciando…" : "Iniciar garimpo"}
            </Button>
            {activeJob && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Já existe uma busca em andamento.
              </span>
            )}
          </div>
        </Card>
      </RoleGate>

      <Card>
        <CardHeader title="Buscas" subtitle="Histórico e progresso ao vivo" />
        <div className="p-5 pt-3">
          {data.jobs.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhuma busca ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase" style={{ color: "var(--text-muted)" }}>
                    <th className="pb-2 font-medium">Busca</th>
                    <th className="pb-2 font-medium">Fonte</th>
                    <th className="pb-2 text-right font-medium">Encontrados</th>
                    <th className="pb-2 text-right font-medium">Novos</th>
                    <th className="pb-2 text-right font-medium">Duplicados</th>
                    <th className="pb-2 font-medium">Quando</th>
                    <th className="pb-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((job) => (
                    <tr key={job.id} className="border-t align-top" style={{ borderColor: "var(--border-strong)" }}>
                      <td className="py-3 pr-3">
                        <span style={{ color: "var(--text-primary)" }}>
                          {job.query} · {job.city}
                          {job.state ? `/${job.state}` : ""}
                        </span>
                        {job.error && (
                          <p className="mt-0.5 text-xs" style={{ color: "var(--status-critical)" }}>
                            {job.error}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3" style={{ color: "var(--text-secondary)" }}>
                        {sourceLabel[job.provider] ?? job.provider}
                      </td>
                      <td className="tabular-nums py-3 pr-3 text-right" style={{ color: "var(--text-secondary)" }}>
                        {formatNumber(job.foundCount)}
                      </td>
                      <td className="tabular-nums py-3 pr-3 text-right font-medium" style={{ color: "var(--status-good-text)" }}>
                        {job.createdCount > 0 ? (
                          <Link to={`/leads?jobId=${job.id}`} className="hover:underline">
                            {formatNumber(job.createdCount)}
                          </Link>
                        ) : (
                          formatNumber(job.createdCount)
                        )}
                      </td>
                      <td className="tabular-nums py-3 pr-3 text-right" style={{ color: "var(--text-muted)" }}>
                        {formatNumber(job.duplicateCount)}
                      </td>
                      <td className="py-3 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDateTime(job.createdAt)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <JobStatusBadge status={job.status} />
                          {(job.status === "running" || job.status === "queued") && (
                            <RoleGate allow={["ADMIN", "MANAGER"]}>
                              <button
                                className="text-xs hover:underline"
                                style={{ color: "var(--status-critical)" }}
                                onClick={() => cancelJob.mutate(job.id)}
                              >
                                cancelar
                              </button>
                            </RoleGate>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          O que esperar
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          <li>
            • O OpenStreetMap é alimentado por voluntários: espere <strong>nome e endereço em quase todos</strong>, mas
            telefone em cerca de 40% e site em cerca de 25% dos negócios.
          </li>
          <li>• Negócios já capturados antes contam como duplicados e não entram de novo.</li>
          <li>
            • Quem pediu para não ser contatado é pulado automaticamente, mesmo aparecendo de novo na fonte.
          </li>
          <li>• Uma busca de 60 negócios costuma levar de 1 a 3 minutos por causa do enriquecimento.</li>
        </ul>
      </Card>
    </div>
  );
}
