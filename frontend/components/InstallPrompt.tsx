"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { readJSON, writeJSON } from "@/lib/storage";

const DISMISSED_KEY = "holoLedger.installDismissed";

/** Chromium's install event, not in the TS DOM types yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const noopSubscribe = () => () => {};

/** "iPhone/iPad Safari, not yet installed": iOS has no install event, only a manual path. */
function isIosBrowser() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** Banner offering to add the app to the home screen (Android button, iPhone instructions). */
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => readJSON(DISMISSED_KEY, false));
  const ios = useSyncExternalStore(noopSubscribe, isIosBrowser, () => false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // keep it for our own button instead of the browser's mini-bar
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed || (!installEvent && !ios)) return null;

  function dismiss() {
    writeJSON(DISMISSED_KEY, true);
    setDismissed(true);
  }

  return (
    <div className="bg-card animate-in fade-in slide-in-from-bottom-2 flex items-center gap-3 rounded-xl border p-3 text-sm duration-300">
      <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Download className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Installer HoloLedger</p>
        {installEvent ? (
          <p className="text-muted-foreground text-xs">Accès direct depuis l’écran d’accueil.</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Touchez <Share className="inline size-3.5 align-text-bottom" /> Partager, puis « Sur
            l’écran d’accueil ».
          </p>
        )}
      </div>
      {installEvent && (
        <Button
          size="sm"
          onClick={async () => {
            await installEvent.prompt();
            const { outcome } = await installEvent.userChoice;
            setInstallEvent(null);
            if (outcome === "accepted") dismiss();
          }}
        >
          Installer
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label="Masquer" onClick={dismiss}>
        <X />
      </Button>
    </div>
  );
}
