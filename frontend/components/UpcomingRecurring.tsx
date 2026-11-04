"use client";

import { ChevronDown, Repeat } from "lucide-react";
import Link from "next/link";

import { CategoryIcon } from "@/components/CategoryBadge";
import { formatDate, today, toISODate } from "@/lib/dates";
import { formatSigned } from "@/lib/format";
import { MASK, useHidden } from "@/lib/privacy";
import type { RecurringRule } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** History header: recurring operations due now or in the next 7 days, folded by default. */
export function UpcomingRecurring({ currency }: { currency: string }) {
  const { data: rules } = useApi<RecurringRule[]>("/recurring/");
  const hidden = useHidden();
  const limit = new Date();
  limit.setDate(limit.getDate() + 7);
  const soon = (rules ?? [])
    .filter((r) => r.is_active && r.next_date && r.next_date <= toISODate(limit))
    .sort((a, b) => a.next_date!.localeCompare(b.next_date!));
  if (soon.length === 0) return null;
  const toConfirm = soon.filter((r) => r.next_date! <= today() && !r.auto_confirm).length;

  return (
    <details className="group bg-card rounded-xl border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm">
        <Repeat className="text-muted-foreground size-4" />
        <span className="flex-1 font-medium">
          À venir ({soon.length})
          {toConfirm > 0 && (
            <span className="text-warning font-normal"> · {toConfirm} à confirmer</span>
          )}
        </span>
        <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="divide-y border-t">
        {soon.map((rule) => (
          <li key={rule.id}>
            <Link
              href="/recurring"
              className="hover:bg-muted flex items-center gap-3 px-3 py-2 text-sm"
            >
              <CategoryIcon
                icon={rule.category_detail.icon}
                color={rule.category_detail.color}
                className="size-8"
              />
              <span className="min-w-0 flex-1 truncate">
                {rule.description || rule.category_detail.name}
                <span className="text-muted-foreground">
                  {" "}
                  · {rule.next_date! <= today() ? "aujourd’hui" : formatDate(rule.next_date!)}
                </span>
              </span>
              <span className="tabular-nums">
                {hidden ? MASK : formatSigned(rule.amount, rule.type, currency)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
