import { cn } from "@/lib/utils";

/** Horizontal gauge; `tone` colors it by budget status. */
export function ProgressBar({
  percent,
  tone = "ok",
  color,
}: {
  percent: number;
  tone?: "ok" | "warning" | "over";
  color?: string;
}) {
  return (
    <div
      className="bg-muted h-2 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          !color && tone === "ok" && "bg-income",
          tone === "warning" && "bg-amber-500",
          tone === "over" && "bg-expense",
        )}
        style={{
          width: `${Math.min(percent, 100)}%`,
          ...(color && tone === "ok" ? { backgroundColor: color } : {}),
        }}
      />
    </div>
  );
}
