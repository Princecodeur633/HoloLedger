import { ArrowDownLeft, ArrowUpRight, Landmark, Scale } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BalanceCard({
  balance,
  currency,
  label = "Solde actuel",
}: {
  balance: string;
  currency: string;
  label?: string;
}) {
  const negative = Number(balance) < 0;
  return (
    <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-2xl p-6 shadow-sm">
      {/* Decorative bank drawn into the card background, partly cut off by the edges. */}
      <Landmark
        className="pointer-events-none absolute -right-6 -bottom-8 size-44 -rotate-6 opacity-[0.12] sm:size-52"
        strokeWidth={1.25}
        aria-hidden
      />
      <div
        className="bg-primary-foreground/5 pointer-events-none absolute -top-16 -right-16 size-48 rounded-full"
        aria-hidden
      />
      <div className="relative min-w-0 pr-24 sm:pr-32">
        <p className="text-sm opacity-70">{label}</p>
        <p
          className={cn(
            "mt-2 text-4xl font-semibold tracking-tight tabular-nums",
            negative && "text-red-300 dark:text-red-600",
          )}
        >
          {formatMoney(balance, currency)}
        </p>
      </div>
    </div>
  );
}

const VARIANTS = {
  income: {
    icon: ArrowDownLeft,
    className: "text-income bg-income/15",
    card: "bg-income/5 border-income/20",
  },
  expense: {
    icon: ArrowUpRight,
    className: "text-expense bg-expense/15",
    card: "bg-expense/5 border-expense/20",
  },
  net: { icon: Scale, className: "text-foreground bg-muted", card: "bg-muted/50" },
};

export function StatCard({
  label,
  value,
  currency,
  variant,
}: {
  label: string;
  value: string;
  currency: string;
  variant: keyof typeof VARIANTS;
}) {
  const { icon: Icon, className, card } = VARIANTS[variant];
  const n = Number(value);
  const display =
    variant === "net" && n > 0 ? `+${formatMoney(value, currency)}` : formatMoney(value, currency);
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-xl border p-3", card)}>
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full p-1", className)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="text-muted-foreground truncate text-xs">{label}</span>
      </div>
      <p
        className={cn(
          "truncate text-base font-semibold tabular-nums sm:text-lg",
          variant === "net" && n < 0 && "text-expense",
          variant === "net" && n > 0 && "text-income",
        )}
        title={display}
      >
        {display}
      </p>
    </div>
  );
}
