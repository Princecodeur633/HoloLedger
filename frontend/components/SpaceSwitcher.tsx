"use client";

import { Check, ChevronDown, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SpaceIcon } from "@/components/SpaceIcon";
import { formatMoney } from "@/lib/format";
import { MASK, useHidden } from "@/lib/privacy";
import { SPACE_KINDS, useSpace } from "@/lib/space";
import { cn } from "@/lib/utils";

/** Button showing the current space; opens the list of spaces, each with its own balance. */
export function SpaceSwitcher({ className }: { className?: string }) {
  const { spaces, current, invitations, switchTo } = useSpace();
  const hidden = useHidden();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hover:bg-muted relative flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
          className,
        )}
        aria-label="Changer d’espace"
      >
        <SpaceIcon icon={current?.icon} kind={current?.kind} className="size-6" />
        <span className="truncate font-medium">{current?.name ?? "Personnel"}</span>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        {invitations.length > 0 && (
          <span
            className="bg-expense absolute -top-1 -right-1 size-2.5 rounded-full"
            aria-label="Invitation reçue"
          />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mes espaces</DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col gap-1">
            {(spaces ?? []).map((space) => (
              <li key={space.id}>
                <button
                  type="button"
                  onClick={() => {
                    switchTo(space.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "hover:bg-muted flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors",
                    current?.id === space.id && "bg-muted",
                  )}
                >
                  <SpaceIcon icon={space.icon} kind={space.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{space.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {SPACE_KINDS[space.kind].label}
                      {space.members.length > 1 &&
                        ` · ${space.members.map((m) => m.username).join(" & ")}`}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {hidden ? MASK : formatMoney(space.balance, space.currency)}
                  </span>
                  {current?.id === space.id && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/spaces"
            onClick={() => setOpen(false)}
            className="hover:bg-muted flex items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-sm font-medium"
          >
            <Settings2 className="size-4" /> Gérer, créer un espace
            {invitations.length > 0 && (
              <span className="bg-expense rounded-full px-2 py-0.5 text-xs text-white">
                {invitations.length} invitation{invitations.length > 1 ? "s" : ""}
              </span>
            )}
          </Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
