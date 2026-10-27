import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/** Large pale icon + short message (+ optional call to action) for empty lists and charts. */
export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon;
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full">
        <Icon className="size-8" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="text-muted-foreground text-sm">{message}</p>
      {action && (
        <Link href={action.href} className={buttonVariants({ size: "sm" })}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
