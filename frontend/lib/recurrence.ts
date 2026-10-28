import { formatDate, parseISODate, toISODate } from "./dates";
import type { Frequency, RecurringRule } from "./types";

export const FREQUENCIES: { value: Frequency; label: string; one: string; many: string }[] = [
  { value: "daily", label: "Chaque jour", one: "jour", many: "jours" },
  { value: "weekly", label: "Chaque semaine", one: "semaine", many: "semaines" },
  { value: "monthly", label: "Chaque mois", one: "mois", many: "mois" },
  { value: "yearly", label: "Chaque année", one: "an", many: "ans" },
];

export function scheduleLabel(rule: Pick<RecurringRule, "frequency" | "interval">) {
  const f = FREQUENCIES.find((x) => x.value === rule.frequency) ?? FREQUENCIES[2];
  return rule.interval === 1 ? f.label : `Tous les ${rule.interval} ${f.many}`;
}

/** Same rule as the server: monthly/yearly keep the start day, clamped to the month's end. */
function occurrenceAfter(current: Date, start: Date, frequency: Frequency, interval: number) {
  if (frequency === "daily" || frequency === "weekly") {
    const next = new Date(current);
    next.setDate(next.getDate() + interval * (frequency === "weekly" ? 7 : 1));
    return next;
  }
  const months = frequency === "monthly" ? interval : 12 * interval;
  const index = current.getFullYear() * 12 + current.getMonth() + months;
  const year = Math.floor(index / 12);
  const month = index % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(start.getDate(), lastDay));
}

/** Date of the `count`-th occurrence: used as end date for "N times". */
export function lastOccurrence(
  start: string,
  frequency: Frequency,
  interval: number,
  count: number,
) {
  const first = parseISODate(start);
  let current = first;
  for (let i = 1; i < count; i++) current = occurrenceAfter(current, first, frequency, interval);
  return toISODate(current);
}

/** "Tous les 2 jours, du 28 oct. au 26 nov." — plain-language summary shown in the form. */
export function scheduleSummary(
  frequency: Frequency,
  interval: number,
  start: string,
  end: string | null,
) {
  const base = scheduleLabel({ frequency, interval: interval || 1 });
  if (!start) return base;
  return end
    ? `${base}, du ${formatDate(start)} au ${formatDate(end)}`
    : `${base}, à partir du ${formatDate(start)}, sans fin`;
}
