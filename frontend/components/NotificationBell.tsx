"use client";

import { Bell, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SpaceIcon } from "@/components/SpaceIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useSpace } from "@/lib/space";
import type { SpaceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Item {
  space: { id: string; name: string; icon: string; kind: SpaceKind } | null;
  text: string;
  href: string;
  tone: "info" | "warning" | "danger";
}

const TONE = { info: "bg-foreground/40", warning: "bg-warning", danger: "bg-expense" };
const REFRESH = 2 * 60_000;

/** One place for everything that needs attention, in every space. */
export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const { current, switchTo } = useSpace();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      api<{ items: Item[] }>("/notifications/")
        .then((res) => !cancelled && setItems(res.items))
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, REFRESH);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [current?.id]);

  function go(item: Item) {
    if (item.space) switchTo(item.space.id);
    setOpen(false);
    router.push(item.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={items.length ? `${items.length} notifications` : "Notifications"}
        className={cn("hover:bg-muted relative rounded-full p-2", className)}
      >
        <Bell className="size-5" />
        {items.length > 0 && (
          <span className="bg-expense absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-bold text-white">
            {items.length}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>À faire</DialogTitle>
          </DialogHeader>
          {items.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Rien à signaler pour le moment.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((item, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => go(item)}
                    className="hover:bg-muted flex w-full items-center gap-3 rounded-xl p-3 text-left"
                  >
                    <span className="relative">
                      <SpaceIcon icon={item.space?.icon} kind={item.space?.kind} />
                      <span
                        className={cn(
                          "ring-background absolute -top-0.5 -right-0.5 size-3 rounded-full ring-2",
                          TONE[item.tone],
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.text}</span>
                      {item.space && (
                        <span className="text-muted-foreground block text-xs">
                          {item.space.name}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="text-muted-foreground size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
