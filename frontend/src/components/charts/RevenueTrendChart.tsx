import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { formatCurrency } from "../../lib/format";

interface Props {
  data: { month: string; revenue: number; target: number }[];
}

const compact = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);

export function RevenueTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border-strong)" strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <YAxis tickFormatter={compact} tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<ChartTooltip formatter={formatCurrency} />} cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }} />
        <Legend
          verticalAlign="top"
          height={28}
          align="right"
          wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
        />
        <Line
          type="monotone"
          dataKey="target"
          name="Meta"
          stroke="var(--baseline)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Receita"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
