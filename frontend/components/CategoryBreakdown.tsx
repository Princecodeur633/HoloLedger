"use client";

import { ChartPie } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CategoryIcon } from "@/components/CategoryBadge";
import { EmptyState } from "@/components/EmptyState";
import { formatMoney } from "@/lib/format";
import type { CategoryShare } from "@/lib/types";

export function CategoryBreakdown({
  shares,
  currency,
  showChart = true,
}: {
  shares: CategoryShare[];
  currency: string;
  showChart?: boolean;
}) {
  if (shares.length === 0) {
    return <EmptyState icon={ChartPie} message="Aucune donnée sur cette période." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {showChart && (
        <div className="mx-auto h-44 w-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={shares.map((s) => ({ name: s.category.name, value: Number(s.total) }))}
                dataKey="value"
                innerRadius="60%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="none"
              >
                {shares.map((s) => (
                  <Cell key={s.category.id} fill={s.category.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatMoney(Number(value), currency)}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {shares.map((s) => (
          <li key={s.category.id} className="flex items-center gap-3">
            <CategoryIcon icon={s.category.icon} color={s.category.color} className="size-8" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{s.category.name}</span>
                <span className="shrink-0 tabular-nums">{formatMoney(s.total, currency)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.percent}%`, backgroundColor: s.category.color }}
                  />
                </div>
                <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                  {s.percent.toLocaleString("fr-FR")} %
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
