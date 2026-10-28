"use client";

import { CalendarClock, ChevronRight, Repeat, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/AppShell";
import { BalanceCard, StatCard } from "@/components/BalanceCard";
import { CategoryIcon } from "@/components/CategoryBadge";
import { GettingStarted } from "@/components/GettingStarted";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TransactionList } from "@/components/TransactionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { WhatsAppReminder } from "@/components/WhatsAppVerify";
import { useAuth } from "@/lib/auth";
import { parseISODate, periodLabel, today, toISODate } from "@/lib/dates";
import { accountTypeIcon, formatMoney, formatSigned } from "@/lib/format";
import type { RecurringRule, Summary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const NOTICE = "flex items-center gap-3 rounded-xl border p-3 text-sm";

function inDays(date: string) {
  const days = Math.round((parseISODate(date).getTime() - parseISODate(today()).getTime()) / 864e5);
  return days === 1 ? "demain" : `dans ${days} jours`;
}

/** Recurring operations due in the next 7 days (the ones already due are "à confirmer"). */
function Upcoming({ currency }: { currency: string }) {
  const { data: rules } = useApi<RecurringRule[]>("/recurring/");
  const limit = new Date();
  limit.setDate(limit.getDate() + 7);
  const soon = (rules ?? [])
    .filter(
      (r) => r.is_active && r.next_date && r.next_date > today() && r.next_date <= toISODate(limit),
    )
    .sort((a, b) => a.next_date!.localeCompare(b.next_date!))
    .slice(0, 3);
  if (soon.length === 0) return null;

  return (
    <section>
      <h2 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
        <CalendarClock className="size-4" /> À venir cette semaine
      </h2>
      <ul className="bg-card divide-y rounded-xl border">
        {soon.map((rule) => (
          <li key={rule.id}>
            <Link
              href="/recurring"
              className="hover:bg-muted flex items-center gap-3 px-3 py-2.5 text-sm"
            >
              <CategoryIcon
                icon={rule.category_detail.icon}
                color={rule.category_detail.color}
                className="size-8"
              />
              <span className="min-w-0 flex-1 truncate">
                {rule.description || rule.category_detail.name}
                <span className="text-muted-foreground"> · {inDays(rule.next_date!)}</span>
              </span>
              <span className="font-medium tabular-nums">
                {formatSigned(rule.amount, rule.type, currency)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, error } = useApi<Summary>("/stats/summary/");

  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (!summary) return <DashboardSkeleton />;

  const { currency, month } = summary;
  const alert = summary.budget_alerts[0];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-5 duration-300">
      <PageHeader title={`Bonjour ${user?.username ?? ""}`} />

      <BalanceCard balance={summary.balance} currency={currency} />

      {/*
        One message at a time, by priority: only the first one that renders is shown
        (the components below render nothing when they have nothing to say).
      */}
      <div className="flex flex-col [&>*:nth-child(n+2)]:hidden">
        {summary.pending_recurring_count > 0 && (
          <Link
            href="/recurring"
            className={`${NOTICE} border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40`}
          >
            <Repeat className="size-4 shrink-0 text-amber-600" />
            <span className="flex-1">
              {summary.pending_recurring_count} opération
              {summary.pending_recurring_count > 1 ? "s récurrentes" : " récurrente"} à confirmer
            </span>
            <ChevronRight className="size-4" />
          </Link>
        )}
        {alert && (
          <Link href="/budgets" className={`${NOTICE} border-expense/30 bg-expense/5`}>
            <TriangleAlert className="text-expense size-4 shrink-0" />
            <span className="flex-1">
              Budget <span className="font-medium">{alert.category.name}</span> utilisé à{" "}
              {Math.round(alert.percent)} %
              {summary.budget_alerts.length > 1 && ` (+${summary.budget_alerts.length - 1} autre)`}
            </span>
            <ChevronRight className="size-4" />
          </Link>
        )}
        <GettingStarted summary={summary} />
        <WhatsAppReminder />
        <InstallPrompt />
      </div>

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

      <Upcoming currency={currency} />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Dernières opérations</CardTitle>
          <Link href="/transactions" className="text-primary text-sm font-medium">
            Tout voir
          </Link>
        </CardHeader>
        <CardContent className="px-2">
          <TransactionList transactions={summary.recent_transactions} grouped={false} />
        </CardContent>
      </Card>

      <Link
        href="/reports"
        className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 text-sm"
      >
        Graphiques et répartition par catégorie dans Rapports <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
