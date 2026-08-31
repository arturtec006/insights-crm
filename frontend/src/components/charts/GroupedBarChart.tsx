import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

interface Series {
  key: string;
  name: string;
  color: string;
}

interface Props {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  valueFormatter?: (v: number) => string;
}

export function GroupedBarChart({ data, xKey, series, valueFormatter }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke="var(--border-strong)" strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<ChartTooltip formatter={valueFormatter} />} cursor={{ fill: "var(--accent-soft)" }} />
        <Legend verticalAlign="top" height={28} align="right" wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
