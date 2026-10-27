"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PERIODS, periodLabel, shiftPeriod, today } from "@/lib/dates";
import type { Period } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PeriodSelector({
  period,
  date,
  onChange,
}: {
  period: Period;
  date: string;
  onChange: (value: { period: Period; date: string }) => void;
}) {
  const isFuture = shiftPeriod(date, period, 1) > today();

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={p.value === period}
            onClick={() => onChange({ period: p.value, date })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
              p.value === period
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Période précédente"
          onClick={() => onChange({ period, date: shiftPeriod(date, period, -1) })}
        >
          <ChevronLeft />
        </Button>
        <span className="text-center font-medium">{periodLabel(date, period)}</span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Période suivante"
          disabled={isFuture}
          onClick={() => onChange({ period, date: shiftPeriod(date, period, 1) })}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
