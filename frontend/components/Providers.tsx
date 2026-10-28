"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { toast } from "sonner";

import { OfflineSync } from "@/components/OfflineSync";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;
const VERSION_CHECK_INTERVAL = 5 * 60_000;

function useServiceWorker() {
  useEffect(() => {
    // Only in production: a service worker caching dev bundles makes local work confusing.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`).catch(() => {});
  }, []);
}

/** Tabs left open across a deployment run old code: offer a reload once a newer one is live. */
function useUpdateNotice() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    let notified = false;

    async function check() {
      if (notified || document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const res = await fetch("/version", { cache: "no-store" });
        const { version } = (await res.json()) as { version?: string };
        if (!version || version === APP_VERSION) return;
        notified = true;
        toast("Nouvelle version de HoloLedger disponible", {
          duration: Infinity,
          action: { label: "Recharger", onClick: () => window.location.reload() },
        });
      } catch {
        // Offline or server asleep: try again on the next check.
      }
    }

    const timer = window.setInterval(check, VERSION_CHECK_INTERVAL);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useServiceWorker();
  useUpdateNotice();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        {children}
        <OfflineSync />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </ThemeProvider>
  );
}
