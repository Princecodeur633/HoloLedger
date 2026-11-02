import { type GroupStatus, STATUS } from "@/lib/group";
import { cn } from "@/lib/utils";

export function StatusChip({ status, className }: { status: GroupStatus; className?: string }) {
  const meta = STATUS[status];
  return (
    <span
      className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", meta.chip, className)}
    >
      {meta.label}
    </span>
  );
}

/** One small colored dot per period (members table). */
export function StatusDots({ statuses }: { statuses: GroupStatus[] }) {
  return (
    <span className="flex gap-1" aria-label={statuses.map((s) => STATUS[s].label).join(", ")}>
      {statuses.map((status, i) => (
        <span
          key={i}
          className={cn("size-2.5 rounded-full", STATUS[status].dot)}
          title={STATUS[status].label}
        />
      ))}
    </span>
  );
}
