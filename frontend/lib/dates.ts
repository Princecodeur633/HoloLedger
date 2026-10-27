import type { Period } from "./types";

/** Local YYYY-MM-DD (toISOString would shift the day across time zones). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISODate(new Date());
}

export const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "quarter", label: "Trimestre" },
  { value: "semester", label: "Semestre" },
  { value: "year", label: "Année" },
];

/** Move the reference date by one period forward (+1) or backward (-1). */
export function shiftPeriod(ref: string, period: Period, step: 1 | -1): string {
  const d = parseISODate(ref);
  switch (period) {
    case "day":
      d.setDate(d.getDate() + step);
      break;
    case "week":
      d.setDate(d.getDate() + 7 * step);
      break;
    default: {
      const months = { month: 1, quarter: 3, semester: 6, year: 12 }[period];
      d.setDate(1);
      d.setMonth(d.getMonth() + months * step);
    }
  }
  return toISODate(d);
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", options);
const dayFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortFmt = fmt({ day: "numeric", month: "short" });
const monthFmt = fmt({ month: "long", year: "numeric" });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Human label for the period that contains `ref`, e.g. "Octobre 2026", "T4 2026". */
export function periodLabel(ref: string, period: Period): string {
  const d = parseISODate(ref);
  const year = d.getFullYear();
  switch (period) {
    case "day":
      return capitalize(dayFmt.format(d));
    case "week": {
      const start = new Date(d);
      start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${shortFmt.format(start)} – ${shortFmt.format(end)} ${end.getFullYear()}`;
    }
    case "month":
      return capitalize(monthFmt.format(d));
    case "quarter":
      return `T${Math.floor(d.getMonth() / 3) + 1} ${year}`;
    case "semester":
      return `S${d.getMonth() < 6 ? 1 : 2} ${year}`;
    case "year":
      return String(year);
  }
}

export function formatDate(value: string): string {
  return fmt({ day: "2-digit", month: "short", year: "numeric" }).format(parseISODate(value));
}

export function formatDayHeading(value: string): string {
  if (value === today()) return "Aujourd’hui";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (value === toISODate(yesterday)) return "Hier";
  return capitalize(dayFmt.format(parseISODate(value)));
}

/** Tick label on charts depending on the bucket size. */
export function bucketLabel(value: string, bucket: "day" | "week" | "month"): string {
  const d = parseISODate(value);
  if (bucket === "month") return capitalize(fmt({ month: "short" }).format(d));
  return shortFmt.format(d);
}
