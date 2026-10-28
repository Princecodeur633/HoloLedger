"use client";

import { CircleCheck, Circle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { readJSON, writeJSON } from "@/lib/storage";
import type { Summary } from "@/lib/types";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "holoLedger.gettingStartedDismissed";

/** First-run checklist, derived from the summary; disappears once done or dismissed. */
export function GettingStarted({ summary }: { summary: Summary }) {
  const [dismissed, setDismissed] = useState(() => readJSON(DISMISSED_KEY, false));

  const steps = [
    {
      label: "Ajoutez votre compte Mobile Money ou bancaire",
      // Every account starts with an automatic "Espèces" (cash) one.
      done: summary.accounts.some((a) => a.type !== "cash") || summary.accounts.length > 1,
      href: "/accounts",
    },
    {
      label: "Indiquez l’argent que vous avez déjà",
      done: Number(summary.balance) !== 0,
      href: "/accounts",
    },
    {
      label: "Enregistrez votre première opération",
      done: summary.recent_transactions.length > 0,
      href: "/transactions/new",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (dismissed || doneCount === steps.length) return null;

  return (
    <div className="bg-card animate-in fade-in slide-in-from-bottom-2 rounded-xl border p-4 duration-300">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Bien démarrer</p>
          <p className="text-muted-foreground text-xs">
            {doneCount} sur {steps.length} étapes terminées
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Masquer"
          onClick={() => {
            writeJSON(DISMISSED_KEY, true);
            setDismissed(true);
          }}
        >
          <X />
        </Button>
      </div>
      <div className="bg-muted mb-3 h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-income h-full rounded-full transition-[width] duration-500"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ol className="flex flex-col">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cn(
                "hover:bg-muted -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                step.done && "text-muted-foreground line-through",
              )}
            >
              {step.done ? (
                <CircleCheck className="text-income size-5 shrink-0" />
              ) : (
                <Circle className="text-muted-foreground size-5 shrink-0" />
              )}
              {step.label}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
