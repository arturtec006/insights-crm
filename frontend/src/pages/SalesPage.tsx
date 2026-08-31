import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { SalesData } from "../types/analytics";
import { Card, CardHeader } from "../components/ui/Card";
import { RevenueTrendChart } from "../components/charts/RevenueTrendChart";
import { BarList } from "../components/charts/BarList";
import { formatCurrency } from "../lib/format";
import { PageState } from "../components/ui/PageState";

export function SalesPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["sales"], queryFn: () => apiFetch<SalesData>("/analytics/sales") });

  if (isLoading) return <PageState kind="loading" />;
  if (isError || !data) return <PageState kind="error" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Receita vs. meta" subtitle="Últimos 12 meses" />
        <div className="px-2 pb-4 pt-2">
          <RevenueTrendChart data={data.revenueOverTime} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Receita por produto
          </h3>
          <BarList items={data.byProduct.map((p) => ({ label: p.product, value: p.revenue }))} formatter={formatCurrency} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Receita por região
          </h3>
          <BarList
            items={data.byRegion.map((r) => ({ label: r.region, value: r.revenue }))}
            color="var(--series-3)"
            formatter={formatCurrency}
          />
        </Card>
      </div>
    </div>
  );
}
