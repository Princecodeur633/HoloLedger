"use client";

import { Repeat, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/AppShell";
import { BalanceCard, StatCard } from "@/components/BalanceCard";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { CategoryIcon } from "@/components/CategoryBadge";
import { IncomeExpenseChart } from "@/components/IncomeExpenseChart";
import { ProgressBar } from "@/components/ProgressBar";
import { TransactionList } from "@/components/TransactionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { periodLabel, today } from "@/lib/dates";
import { accountTypeIcon, formatMoney } from "@/lib/format";
import type { PeriodStats, Summary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, error } = useApi<Summary>("/stats/summary/");
  const { data: monthStats } = useApi<PeriodStats>("/stats/period/", {
    period: "month",
    date: today(),
  });

  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (!summary) return <p className="text-muted-foreground text-sm">Chargement…</p>;

  const { currency, month } = summary;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={`Bonjour ${user?.username ?? ""}`} />

      <BalanceCard balance={summary.balance} currency={currency} />

      {summary.accounts.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {summary.accounts.map((a) => (
            <Link
              key={a.id}
              href="/accounts"
              className="bg-card flex min-w-36 shrink-0 items-center gap-2 rounded-xl border p-2.5"
            >
              <CategoryIcon icon={accountTypeIcon(a.type)} color={a.color} className="size-8" />
              <span className="min-w-0">
                <span className="text-muted-foreground block truncate text-xs">{a.name}</span>
                <span className="block text-sm font-semibold tabular-nums">
                  {formatMoney(a.balance, currency)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {summary.pending_recurring_count > 0 && (
        <Link
          href="/recurring"
          className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
        >
          <Repeat className="size-4 shrink-0 text-amber-600" />
          <span className="flex-1">
            {summary.pending_recurring_count} opération
            {summary.pending_recurring_count > 1 ? "s récurrentes" : " récurrente"} à confirmer
          </span>
          <span className="font-medium">Voir</span>
        </Link>
      )}

      {summary.budget_alerts.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert className="text-expense size-4" /> Budgets à surveiller
            </CardTitle>
            <Link href="/budgets" className="text-muted-foreground hover:text-foreground text-sm">
              Gérer
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {summary.budget_alerts.map((alert) => (
              <div key={alert.budget}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{alert.category.name}</span>
                  <span className="tabular-nums">
                    {formatMoney(alert.spent, currency)} / {formatMoney(alert.amount, currency)}
                  </span>
                </div>
                <ProgressBar percent={alert.percent} tone={alert.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="text-muted-foreground mb-2 text-sm font-medium">
          {periodLabel(today(), "month")}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard label="Revenus" value={month.income} currency={currency} variant="income" />
          <StatCard label="Dépenses" value={month.expense} currency={currency} variant="expense" />
          <div className="col-span-2 sm:col-span-1">
            <StatCard label="Résultat" value={month.net} currency={currency} variant="net" />
          </div>
        </div>
      </section>

      {monthStats && monthStats.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenus vs dépenses</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart stats={monthStats} height={200} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Dernières opérations</CardTitle>
          <Link
            href="/transactions"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Tout voir
          </Link>
        </CardHeader>
        <CardContent className="px-2">
          <TransactionList transactions={summary.recent_transactions} grouped={false} />
        </CardContent>
      </Card>

      {summary.top_expense_categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top des dépenses du mois</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown
              shares={summary.top_expense_categories}
              currency={currency}
              showChart={false}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
