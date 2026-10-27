"use client";

import { ChartColumn, FileDown, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/BalanceCard";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { EmptyState } from "@/components/EmptyState";
import { IncomeExpenseChart } from "@/components/IncomeExpenseChart";
import { InsightsPanel } from "@/components/InsightsPanel";
import { PeriodSelector } from "@/components/PeriodSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { download } from "@/lib/api";
import { periodLabel, today } from "@/lib/dates";
import type { CategoryStats, Insights, Period, PeriodStats, TransactionType } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ReportsPage() {
  const [range, setRange] = useState<{ period: Period; date: string }>({
    period: "month",
    date: today(),
  });
  const [breakdownType, setBreakdownType] = useState<TransactionType>("expense");

  const { data: stats, error } = useApi<PeriodStats>("/stats/period/", range);
  const { data: categories } = useApi<CategoryStats>("/stats/categories/", {
    ...range,
    type: breakdownType,
  });
  const { data: insights } = useApi<Insights>("/stats/insights/", range);

  async function exportCsv() {
    try {
      await download("/transactions/export/", range, "operations.csv");
    } catch {
      toast.error("Export impossible.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Rapports"
        action={
          <div className="flex gap-1 print:hidden">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <FileDown /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer /> PDF
            </Button>
          </div>
        }
      />

      <div className="print:hidden">
        <PeriodSelector period={range.period} date={range.date} onChange={setRange} />
      </div>
      <p className="hidden text-lg font-medium print:block">
        Rapport — {periodLabel(range.date, range.period)}
      </p>

      {error && <p className="text-destructive text-sm">{error.message}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatCard
              label="Revenus"
              value={stats.income}
              currency={stats.currency}
              variant="income"
            />
            <StatCard
              label="Dépenses"
              value={stats.expense}
              currency={stats.currency}
              variant="expense"
            />
            <div className="col-span-2 sm:col-span-1">
              <StatCard
                label="Solde de la période"
                value={stats.net}
                currency={stats.currency}
                variant="net"
              />
            </div>
          </div>

          <Card className="break-inside-avoid">
            <CardHeader>
              <CardTitle>Revenus et dépenses</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.count > 0 ? (
                <IncomeExpenseChart stats={stats} />
              ) : (
                <EmptyState icon={ChartColumn} message="Aucune opération sur cette période." />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="break-inside-avoid">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Répartition par catégorie</CardTitle>
          <Tabs value={breakdownType} onValueChange={(v) => setBreakdownType(v as TransactionType)}>
            <TabsList>
              <TabsTrigger value="expense">Dépenses</TabsTrigger>
              <TabsTrigger value="income">Revenus</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {categories && stats ? (
            <CategoryBreakdown shares={categories.categories} currency={stats.currency} />
          ) : (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          )}
        </CardContent>
      </Card>

      {insights && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Analyse</h2>
          <InsightsPanel insights={insights} />
        </section>
      )}
    </div>
  );
}
