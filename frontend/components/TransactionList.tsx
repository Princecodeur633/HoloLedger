import { Receipt, Repeat } from "lucide-react";
import Link from "next/link";

import { CategoryIcon } from "@/components/CategoryBadge";
import { EmptyState } from "@/components/EmptyState";
import { formatDayHeading } from "@/lib/dates";
import { formatSigned, paymentMethodLabel } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

function TransactionRow({ tx }: { tx: Transaction }) {
  const category = tx.category_detail;
  return (
    <Link
      href={`/transactions/${tx.id}/edit`}
      className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
    >
      <CategoryIcon icon={category.icon} color={category.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{tx.description || category.name}</p>
        <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
          {tx.recurring_rule && <Repeat className="size-3 shrink-0" aria-label="Récurrente" />}
          {category.name} · {paymentMethodLabel(tx.payment_method)}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 font-semibold tabular-nums",
          tx.type === "income" ? "text-income" : "text-foreground",
        )}
      >
        {formatSigned(tx.amount, tx.type, tx.currency)}
      </span>
    </Link>
  );
}

/** Transactions grouped under a heading per day ("Aujourd'hui", "Hier", …). */
export function TransactionList({
  transactions,
  grouped = true,
}: {
  transactions: Transaction[];
  grouped?: boolean;
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        message="Aucune opération pour le moment."
        action={{ href: "/transactions/new", label: "Ajouter une opération" }}
      />
    );
  }

  if (!grouped) {
    return (
      <div className="flex flex-col">
        {transactions.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} />
        ))}
      </div>
    );
  }

  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const list = groups.get(tx.date) ?? [];
    list.push(tx);
    groups.set(tx.date, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([date, list]) => (
        <section key={date}>
          <h3 className="text-muted-foreground mb-1 px-2 text-xs font-medium tracking-wide uppercase">
            {formatDayHeading(date)}
          </h3>
          <div className="flex flex-col">
            {list.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
