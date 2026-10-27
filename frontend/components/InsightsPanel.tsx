import { ArrowDown, ArrowUp } from "lucide-react";

import { BalanceHistoryChart } from "@/components/BalanceHistoryChart";
import { TransactionList } from "@/components/TransactionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, paymentMethodLabel } from "@/lib/format";
import type { Insights } from "@/lib/types";
import { cn } from "@/lib/utils";

function Change({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const good = value === 0 || value > 0 === goodWhenUp;
  const Icon = value >= 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        good ? "text-income" : "text-expense",
      )}
    >
      <Icon className="size-3" />
      {Math.abs(value).toLocaleString("fr-FR")} %
    </span>
  );
}

function Metric({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-1 rounded-xl border p-3">
      <span className="text-muted-foreground truncate text-xs">{label}</span>
      <span className="truncate text-base font-semibold tabular-nums">{children}</span>
      {hint && <span className="text-muted-foreground truncate text-xs">{hint}</span>}
    </div>
  );
}

/** Advanced statistics for the selected period (comparison, savings rate, projection…). */
export function InsightsPanel({ insights }: { insights: Insights }) {
  const { currency, current, previous, change, projection } = insights;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Dépenses vs période précédente"
          hint={`avant : ${formatMoney(previous.expense, currency)}`}
        >
          <Change value={change.expense} goodWhenUp={false} />
        </Metric>
        <Metric
          label="Revenus vs période précédente"
          hint={`avant : ${formatMoney(previous.income, currency)}`}
        >
          <Change value={change.income} goodWhenUp />
        </Metric>
        <Metric label="Taux d’épargne" hint="part des revenus non dépensée">
          <span
            className={cn(
              insights.savings_rate !== null && insights.savings_rate < 0 && "text-expense",
            )}
          >
            {insights.savings_rate === null
              ? "—"
              : `${insights.savings_rate.toLocaleString("fr-FR")} %`}
          </span>
        </Metric>
        <Metric
          label="Dépense moyenne / jour"
          hint={`sur ${insights.days_elapsed} jour${insights.days_elapsed > 1 ? "s" : ""}`}
        >
          {insights.average_daily_expense === null
            ? "—"
            : formatMoney(insights.average_daily_expense, currency)}
        </Metric>
      </div>

      {projection && (
        <div className="rounded-xl border border-dashed p-4 text-sm">
          <p className="font-medium">Projection de fin de période</p>
          <p className="text-muted-foreground mt-1">
            À ce rythme, vos dépenses atteindront{" "}
            <span className="text-foreground font-medium">
              {formatMoney(projection.expense, currency)}
            </span>{" "}
            et votre résultat sera de{" "}
            <span
              className={cn(
                "font-medium",
                Number(projection.net) < 0 ? "text-expense" : "text-income",
              )}
            >
              {Number(projection.net) > 0 ? "+" : ""}
              {formatMoney(projection.net, currency)}
            </span>
            .
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Évolution du solde</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceHistoryChart
            history={insights.balance_history}
            currency={currency}
            bucket={insights.balance_history_bucket}
          />
        </CardContent>
      </Card>

      {insights.top_expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plus grosses dépenses</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <TransactionList transactions={insights.top_expenses} grouped={false} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {insights.by_account.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Par compte</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {insights.by_account.map((a) => (
                  <li key={a.account} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-income tabular-nums">
                      +{formatMoney(a.income, currency)}
                    </span>
                    <span className="tabular-nums">−{formatMoney(a.expense, currency)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {insights.by_payment_method.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Dépenses par moyen de paiement</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {insights.by_payment_method.map((p) => (
                  <li key={p.payment_method} className="flex justify-between gap-2">
                    <span>{paymentMethodLabel(p.payment_method)}</span>
                    <span className="tabular-nums">{formatMoney(p.total, currency)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {current.count} opération(s) sur la période, contre {previous.count} sur la période
        précédente.
      </p>
    </div>
  );
}
