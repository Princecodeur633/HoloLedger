"use client";

import { CalendarCheck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { parseISODate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { MASK, useHidden } from "@/lib/privacy";
import { readJSON, writeJSON } from "@/lib/storage";
import type { Summary } from "@/lib/types";

const DISMISSED_KEY = "holoLedger.recapDismissed";
const SHOWN_DAYS = 7; // only at the start of the month

/** "de mars", "d’octobre": French elision before a vowel. */
function ofMonth(iso: string) {
  const name = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(parseISODate(iso));
  return /^[aeiouy]/i.test(name) ? `d’${name}` : `de ${name}`;
}

/** "Bilan d'octobre": shown during the first week of the next month, once per month. */
export function MonthlyRecap({ summary }: { summary: Summary }) {
  const recap = summary.last_month;
  const [dismissed, setDismissed] = useState(
    () => readJSON<string | null>(DISMISSED_KEY, null) === recap.start,
  );
  const hidden = useHidden();

  const expense = Number(recap.expense);
  const previous = Number(recap.previous_expense);
  if (
    dismissed ||
    new Date().getDate() > SHOWN_DAYS ||
    (expense === 0 && Number(recap.income) === 0)
  )
    return null;

  const change = previous > 0 ? Math.round(((expense - previous) / previous) * 100) : null;
  const money = (v: string | number) => (hidden ? MASK : formatMoney(v, summary.currency));

  return (
    <div className="bg-card animate-in fade-in slide-in-from-bottom-2 rounded-xl border p-4 duration-300">
      <div className="flex items-start gap-3">
        <CalendarCheck className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Bilan {ofMonth(recap.start)}</p>
          <p className="text-muted-foreground mt-1">
            <span className="text-foreground font-medium">{money(expense)}</span> dépensés
            {change !== null && (
              <>
                {" · "}
                <span className={change > 0 ? "text-expense" : "text-income"}>
                  {change > 0 ? "+" : ""}
                  {change} %
                </span>{" "}
                par rapport au mois d’avant
              </>
            )}
            {recap.top_category && (
              <>
                {" · "}Poste n°1 :{" "}
                <span className="text-foreground">{recap.top_category.category.name}</span>
              </>
            )}
          </p>
          <Link
            href="/reports"
            className="mt-2 inline-block text-sm font-medium underline-offset-4 hover:underline"
          >
            Voir le détail
          </Link>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Masquer"
          onClick={() => {
            writeJSON(DISMISSED_KEY, recap.start);
            setDismissed(true);
          }}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
