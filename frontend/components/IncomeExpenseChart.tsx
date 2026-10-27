"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { bucketLabel } from "@/lib/dates";
import { formatCompact, formatMoney } from "@/lib/format";
import type { PeriodStats } from "@/lib/types";

export function IncomeExpenseChart({
  stats,
  height = 240,
}: {
  stats: PeriodStats;
  height?: number;
}) {
  const data = stats.series.map((p) => ({
    label: bucketLabel(p.start, stats.bucket),
    Revenus: Number(p.income),
    Dépenses: Number(p.expense),
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: -12, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            minTickGap={12}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={48}
            tickFormatter={formatCompact}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(value) => formatMoney(Number(value), stats.currency)}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Revenus" fill="var(--income)" radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Bar dataKey="Dépenses" fill="var(--expense)" radius={[3, 3, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
