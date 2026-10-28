"use client";

import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Landmark, Scale } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatMoney } from "@/lib/format";
import { MASK, toggleHidden, useHidden } from "@/lib/privacy";
import { cn } from "@/lib/utils";

/** Rolls the displayed number to `target` (from 0 on first show), unless reduced motion is on. */
function useCountUp(target: number, duration = 700) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const t = reduce ? 1 : Math.min((now - began) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      const value = start + (target - start) * eased;
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown;
}

/**
 * The headline amount: large, heavy digits with the currency kept smaller beside them.
 * The size follows the screen width so a long balance still fits on one line on a phone.
 */
function MainAmount({ text, className }: { text: string; className?: string }) {
  const match = /^(.*\d)\s*(\D*)$/.exec(text);
  const [digits, unit] = match ? [match[1], match[2]] : [text, ""];
  return (
    <p
      className={cn(
        "mt-2 flex flex-wrap items-baseline gap-x-2 leading-none tabular-nums",
        className,
      )}
    >
      <span className="text-[clamp(2.25rem,11vw,3.5rem)] font-extrabold tracking-tight">
        {digits}
      </span>
      {unit && <span className="text-lg font-semibold opacity-75 sm:text-xl">{unit}</span>}
    </p>
  );
}

/** Discreet 30-day trend line (no axes, no numbers): only the direction matters. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const range = Math.max(...points) - min || 1;
  const path = points
    .map((v, i) => `${(i / (points.length - 1)) * 100},${28 - ((v - min) / range) * 24}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden
      className="mt-4 h-8 w-full overflow-visible opacity-60"
    >
      <polyline
        points={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function BalanceCard({
  balance,
  currency,
  label = "Solde actuel",
  trend,
}: {
  balance: string;
  currency: string;
  label?: string;
  /** Balance at the end of each of the last days, oldest first. */
  trend?: string[];
}) {
  const negative = Number(balance) < 0;
  const shown = useCountUp(Number(balance));
  const hidden = useHidden();
  return (
    // Dark mode: a dark card instead of the light "primary" one, which glares at night.
    <div className="bg-foreground text-background dark:bg-card dark:text-card-foreground dark:ring-foreground/10 relative overflow-hidden rounded-2xl p-6 shadow-sm dark:ring-1">
      {/* Decorative bank drawn into the card background, partly cut off by the edges. */}
      <Landmark
        className="pointer-events-none absolute -right-6 -bottom-8 size-44 -rotate-6 opacity-[0.12] sm:size-52"
        strokeWidth={1.25}
        aria-hidden
      />
      <div
        className="bg-background/5 dark:bg-foreground/5 pointer-events-none absolute -top-16 -right-16 size-48 rounded-full"
        aria-hidden
      />
      <div className="relative min-w-0 pr-10 sm:pr-24">
        <div className="flex items-center gap-2">
          <p className="text-sm opacity-70">{label}</p>
          <button
            type="button"
            onClick={toggleHidden}
            aria-label={hidden ? "Afficher les montants" : "Masquer les montants"}
            className="rounded-full p-1 opacity-70 transition-opacity hover:opacity-100"
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <MainAmount
          text={
            hidden
              ? `${MASK} ${formatMoney(0, currency).replace(/[\d\s.,]/g, "")}`
              : formatMoney(shown === Number(balance) ? balance : Math.round(shown), currency)
          }
          className={cn(negative && !hidden && "text-red-300")}
        />
      </div>
      {trend && <Sparkline points={trend.map(Number)} />}
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
  const hidden = useHidden();
  const n = Number(value);
  const display = hidden
    ? MASK
    : variant === "net" && n > 0
      ? `+${formatMoney(value, currency)}`
      : formatMoney(value, currency);
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
