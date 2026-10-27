"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { bucketLabel } from "@/lib/dates";
import { formatCompact, formatMoney } from "@/lib/format";
import type { Insights } from "@/lib/types";

export function BalanceHistoryChart({
  history,
  currency,
  bucket,
}: {
  history: Insights["balance_history"];
  currency: string;
  bucket: "day" | "week" | "month";
}) {
  const data = history.map((p) => ({
    label: bucketLabel(p.start, bucket),
    Solde: Number(p.balance),
  }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--income)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--income)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            minTickGap={16}
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
            formatter={(value) => formatMoney(Number(value), currency)}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="Solde"
            stroke="var(--income)"
            strokeWidth={2}
            fill="url(#balanceFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
