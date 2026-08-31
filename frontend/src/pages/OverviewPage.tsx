import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { OverviewData, SalesData } from "../types/analytics";
import { KpiCard } from "../components/ui/KpiCard";
import { Card, CardHeader } from "../components/ui/Card";
import { RevenueTrendChart } from "../components/charts/RevenueTrendChart";
import { BarList } from "../components/charts/BarList";
import { formatCurrency, formatNumber, formatPct } from "../lib/format";
import { PageState } from "../components/ui/PageState";

export function OverviewPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => apiFetch<OverviewData>("/analytics/overview") });
  const sales = useQuery({ queryKey: ["sales"], queryFn: () => apiFetch<SalesData>("/analytics/sales") });

  if (overview.isLoading || sales.isLoading) return <PageState kind="loading" />;
  if (overview.isError || !overview.data || sales.isError || !sales.data) return <PageState kind="error" />;

  const d = overview.data;
  const targetPct = d.revenue.target ? (d.revenue.current / d.revenue.target) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Receita do mês"
          value={formatCurrency(d.revenue.current)}
          delta={{ value: formatPct(Math.abs(d.revenue.growthPct)), positive: d.revenue.growthPct >= 0 }}
          hint={targetPct !== null ? `${formatPct(targetPct)} da meta mensal` : undefined}
        />
        <KpiCard label="Vendas no mês" value={formatNumber(d.salesCount)} hint="Pedidos concluídos" />
        <KpiCard label="Fluxo de caixa líquido" value={formatCurrency(d.netCashFlow)} hint="Receita − despesas do mês" />
        <KpiCard
          label="Clientes ativos"
          value={formatNumber(d.customers.active)}
          hint={`${formatNumber(d.customers.total)} no total · ${d.customers.churnedThisMonth} churn este mês`}
        />
      </div>

      <Card>
        <CardHeader title="Receita vs. meta" subtitle="Últimos 12 meses" />
        <div className="px-2 pb-4 pt-2">
          <RevenueTrendChart data={sales.data.revenueOverTime} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Receita por produto
          </h3>
          <BarList items={sales.data.byProduct.slice(0, 6).map((p) => ({ label: p.product, value: p.revenue }))} formatter={formatCurrency} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Receita por região
          </h3>
          <BarList
            items={sales.data.byRegion.slice(0, 6).map((r) => ({ label: r.region, value: r.revenue }))}
            color="var(--series-3)"
            formatter={formatCurrency}
          />
        </Card>
      </div>
    </div>
  );
}
