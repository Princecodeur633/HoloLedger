"use client";

import { CircleCheck, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { readJSON, writeJSON } from "@/lib/storage";
import type { User } from "@/lib/types";
import { useWhatsAppEnabled } from "@/lib/whatsapp";

const WHATSAPP_BUTTON = "bg-[#25D366] text-white hover:bg-[#1ebe5b]";
const REMINDER_KEY = "holoLedger.whatsappReminderDismissed";

/** Profile section: verified badge, or the two steps to verify the number. */
export function WhatsAppVerify() {
  const { user, setUser } = useAuth();
  const enabled = useWhatsAppEnabled();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user?.phone) {
    return (
      <p className="text-muted-foreground text-sm">Ajoutez un numéro de téléphone ci-dessus.</p>
    );
  }
  if (user.whatsapp_verified) {
    return (
      <p className="text-income flex items-center gap-2 text-sm font-medium">
        <CircleCheck className="size-4" /> Numéro WhatsApp vérifié
      </p>
    );
  }
  if (!enabled) {
    return (
      <p className="text-muted-foreground text-sm">
        La vérification par WhatsApp n’est pas encore disponible.
      </p>
    );
  }

  async function start() {
    setBusy(true);
    try {
      setLink((await api<{ url: string }>("/auth/whatsapp/verify/", { method: "POST" })).url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    setBusy(true);
    try {
      const me = await api<User>("/auth/me/");
      setUser(me);
      if (me.whatsapp_verified) toast.success("Numéro WhatsApp vérifié");
      else toast.info("Message pas encore reçu. Attendez quelques secondes et réessayez.");
    } catch {
      toast.error(OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Vérifiez votre numéro pour pouvoir récupérer votre mot de passe par WhatsApp si vous
        l’oubliez.
      </p>
      {!link ? (
        <Button className={`self-start ${WHATSAPP_BUTTON}`} onClick={start} disabled={busy}>
          <MessageCircle /> Vérifier sur WhatsApp
        </Button>
      ) : (
        <>
          <p className="text-sm">Envoyez le message déjà écrit dans WhatsApp, puis revenez ici.</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ className: WHATSAPP_BUTTON })}
            >
              <MessageCircle /> Ouvrir WhatsApp
            </a>
            <Button variant="outline" onClick={check} disabled={busy}>
              J’ai envoyé le message
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Dismissible dashboard reminder shown until the number is verified. */
export function WhatsAppReminder() {
  const { user } = useAuth();
  const enabled = useWhatsAppEnabled();
  const [dismissed, setDismissed] = useState(() => readJSON(REMINDER_KEY, false));

  if (!enabled || !user?.phone || user.whatsapp_verified || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 p-3 text-sm">
      <MessageCircle className="size-5 shrink-0 text-[#1ebe5b]" />
      <Link href="/profile" className="flex-1">
        <span className="font-medium">Vérifiez votre numéro WhatsApp</span>
        <span className="text-muted-foreground block text-xs">
          Utile pour récupérer votre mot de passe en cas d’oubli.
        </span>
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Masquer"
        onClick={() => {
          writeJSON(REMINDER_KEY, true);
          setDismissed(true);
        }}
      >
        <X />
      </Button>
    </div>
  );
}
