import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { FinancialData } from "../types/analytics";
import { Card, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { GroupedBarChart } from "../components/charts/GroupedBarChart";
import { BarList } from "../components/charts/BarList";
import { formatCurrency, formatPct } from "../lib/format";
import { PageState } from "../components/ui/PageState";

export function FinancialPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["financial"], queryFn: () => apiFetch<FinancialData>("/analytics/financial") });

  if (isLoading) return <PageState kind="loading" />;
  if (isError || !data) return <PageState kind="error" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Receita (12 meses)" value={formatCurrency(data.summary.totalRevenue)} />
        <KpiCard label="Despesas (12 meses)" value={formatCurrency(data.summary.totalExpenses)} />
        <KpiCard label="Margem bruta" value={formatPct(data.summary.grossMarginPct)} />
      </div>

      <Card>
        <CardHeader title="Fluxo de caixa" subtitle="Receita, despesas e resultado líquido por mês" />
        <div className="px-2 pb-4 pt-2">
          <GroupedBarChart
            data={data.cashFlowOverTime}
            xKey="month"
            valueFormatter={formatCurrency}
            series={[
              { key: "revenue", name: "Receita", color: "var(--series-1)" },
              { key: "expenses", name: "Despesas", color: "var(--series-2)" },
              { key: "net", name: "Líquido", color: "var(--series-3)" },
            ]}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Despesas por categoria
        </h3>
        <BarList items={data.expensesByCategory.map((c) => ({ label: c.category, value: c.amount }))} color="var(--series-2)" formatter={formatCurrency} />
      </Card>
    </div>
  );
}
