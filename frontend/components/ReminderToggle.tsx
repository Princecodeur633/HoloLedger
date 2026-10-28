"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";

const noopSubscribe = () => () => {};

type Support = "ok" | "unsupported" | "ios-install";

function detectSupport(): Support {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  // iPhone only allows notifications for apps added to the home screen.
  if (ios && !standalone) return "ios-install";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    ? "ok"
    : "unsupported";
}

/** The VAPID public key comes base64url-encoded; the browser wants raw bytes. */
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Settings switch for the daily "did you log your expenses?" notification (19:00). */
export function ReminderToggle() {
  const support = useSyncExternalStore(noopSubscribe, detectSupport, () => "unsupported" as const);
  const { data: server } = useApi<{ enabled: boolean; public_key: string }>("/reminders/push/");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (support !== "ok") return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, [support]);

  async function enable() {
    if (!server?.public_key) return;
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        toast.error("Notifications refusées. Autorisez-les dans les réglages du navigateur.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(server.public_key),
      });
      await api("/reminders/push/subscribe/", { method: "POST", body: sub.toJSON() });
      setSubscribed(true);
      toast.success("Rappel activé : chaque soir à 19 h si rien n’est noté.");
    } catch {
      toast.error("Activation impossible sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("/reminders/push/unsubscribe/", {
          method: "POST",
          body: { endpoint: sub.endpoint },
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Rappel désactivé");
    } finally {
      setBusy(false);
    }
  }

  if (server && !server.enabled) {
    return (
      <p className="text-muted-foreground text-sm">
        Le rappel n’est pas encore activé sur le serveur.
      </p>
    );
  }
  if (support === "ios-install") {
    return (
      <p className="text-muted-foreground text-sm">
        Sur iPhone, installez d’abord l’app : Partager → « Sur l’écran d’accueil », puis ouvrez-la
        depuis l’icône pour activer le rappel.
      </p>
    );
  }
  if (support === "unsupported") {
    return (
      <p className="text-muted-foreground text-sm">
        Ce navigateur ne permet pas les notifications.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Une notification chaque soir à 19 h, seulement les jours où vous n’avez rien noté.
      </p>
      {subscribed ? (
        <Button variant="outline" className="self-start" onClick={disable} disabled={busy}>
          Désactiver le rappel
        </Button>
      ) : (
        <Button
          className="self-start"
          onClick={enable}
          disabled={busy || subscribed === null || !server}
        >
          <BellRing /> Activer le rappel
        </Button>
      )}
    </div>
  );
}
