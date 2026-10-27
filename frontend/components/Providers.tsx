"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";

import { OfflineSync } from "@/components/OfflineSync";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";

function useServiceWorker() {
  useEffect(() => {
    // Only in production: a service worker caching dev bundles makes local work confusing.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useServiceWorker();
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
