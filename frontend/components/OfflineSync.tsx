"use client";

import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { flushOutbox, useOutbox } from "@/lib/outbox";

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

async function sync() {
  const { sent, rejected } = await flushOutbox();
  if (sent)
    toast.success(
      `${sent} opération${sent > 1 ? "s" : ""} hors ligne synchronisée${sent > 1 ? "s" : ""}`,
    );
  for (const item of rejected) toast.error(`Refusé par le serveur : ${item.label}`);
}

/** Replays offline writes on start-up, when the connection comes back and every minute. */
export function OfflineSync() {
  const { user } = useAuth();
  const pending = useOutbox().length;
  const online = useOnline();

  useEffect(() => {
    if (user && online && pending > 0) sync();
  }, [user, online, pending]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      if (navigator.onLine) sync();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [user]);

  return null;
}

export function OfflineBanner() {
  const online = useOnline();
  const pending = useOutbox().length;
  if (online && pending === 0) return null;
  return (
    <div
      role="status"
      className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      {online ? "Synchronisation en cours… " : "Hors ligne — les données affichées peuvent dater. "}
      {pending > 0 && `${pending} opération${pending > 1 ? "s" : ""} en attente d’envoi.`}
    </div>
  );
}
