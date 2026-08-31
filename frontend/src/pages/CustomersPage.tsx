import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { CustomersData } from "../types/analytics";
import { Card, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { GroupedBarChart } from "../components/charts/GroupedBarChart";
import { BarList } from "../components/charts/BarList";
import { Badge } from "../components/ui/Badge";
import { formatCurrency, formatNumber, formatPct } from "../lib/format";
import { PageState } from "../components/ui/PageState";

const statusTone: Record<string, "good" | "critical" | "neutral"> = {
  active: "good",
  churned: "critical",
  prospect: "neutral",
};

const statusLabel: Record<string, string> = {
  active: "Ativo",
  churned: "Perdido",
  prospect: "Prospect",
};

export function CustomersPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["customers"], queryFn: () => apiFetch<CustomersData>("/analytics/customers") });

  if (isLoading) return <PageState kind="loading" />;
  if (isError || !data) return <PageState kind="error" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total de clientes" value={formatNumber(data.summary.total)} />
        <KpiCard label="Clientes ativos" value={formatNumber(data.summary.active)} />
        <KpiCard
          label="Taxa de churn"
          value={formatPct(data.summary.churnRatePct)}
          hint={`${formatNumber(data.summary.churned)} clientes perdidos`}
        />
        <KpiCard label="LTV médio" value={formatCurrency(data.summary.avgLtv)} />
      </div>

      <Card>
        <CardHeader title="Aquisição vs. churn" subtitle="Novos clientes e perdas por mês" />
        <div className="px-2 pb-4 pt-2">
          <GroupedBarChart
            data={data.acquisitionOverTime}
            xKey="month"
            series={[
              { key: "acquired", name: "Novos clientes", color: "var(--series-3)" },
              { key: "churned", name: "Churn", color: "var(--series-2)" },
            ]}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Clientes por segmento
          </h3>
          <BarList items={data.bySegment.map((s) => ({ label: s.segment, value: s.count }))} color="var(--series-7)" formatter={formatNumber} />
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Top clientes por valor (LTV)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase" style={{ color: "var(--text-muted)" }}>
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium">Segmento</th>
                  <th className="pb-2 text-right font-medium">LTV</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((c) => (
                  <tr key={c.id} className="border-t" style={{ borderColor: "var(--border-strong)" }}>
                    <td className="py-2" style={{ color: "var(--text-primary)" }}>
                      {c.name}
                    </td>
                    <td className="py-2" style={{ color: "var(--text-secondary)" }}>
                      {c.segment}
                    </td>
                    <td className="tabular-nums py-2 text-right font-medium" style={{ color: "var(--text-primary)" }}>
                      {formatCurrency(c.lifetimeValue)}
                    </td>
                    <td className="py-2 text-right">
                      <Badge tone={statusTone[c.status] ?? "neutral"}>{statusLabel[c.status] ?? c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
