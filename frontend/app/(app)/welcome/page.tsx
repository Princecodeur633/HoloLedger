"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SpaceIcon } from "@/components/SpaceIcon";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSpace } from "@/lib/space";
import type { Space, SpaceKind } from "@/lib/types";

const CHOICES: { kind: SpaceKind; title: string; text: string; name: string }[] = [
  { kind: "personal", title: "Moi", text: "Mes dépenses, mes revenus, mon solde.", name: "" },
  {
    kind: "couple",
    title: "Mon couple",
    text: "Les dépenses communes, à deux.",
    name: "Notre couple",
  },
  {
    kind: "business",
    title: "Mon business",
    text: "Ventes, dépenses et bénéfice.",
    name: "Mon business",
  },
  {
    kind: "tontine",
    title: "Ma tontine",
    text: "Cotisations et tours de rôle.",
    name: "Ma tontine",
  },
  {
    kind: "family",
    title: "Ma famille",
    text: "Caisse familiale et cotisations.",
    name: "Ma famille",
  },
];

/** Right after sign-up: start in the space that matches why the person came. */
export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { switchTo, reload } = useSpace();
  const [busy, setBusy] = useState(false);

  async function choose(choice: (typeof CHOICES)[number]) {
    if (choice.kind === "personal") {
      router.replace("/dashboard");
      return;
    }
    setBusy(true);
    try {
      const space = await api<Space>("/spaces/", {
        method: "POST",
        body: { kind: choice.kind, name: choice.name },
      });
      switchTo(space.id);
      reload();
      // Next useful step for each kind: invite the partner, or set the group's rules.
      router.replace(
        choice.kind === "couple"
          ? `/spaces/${space.id}`
          : choice.kind === "business"
            ? "/dashboard"
            : "/group/rules",
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 pt-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bienvenue {user?.username}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Vous utilisez HoloLedger surtout pour…</p>
      </div>
      <ul className="flex flex-col gap-2">
        {CHOICES.map((choice) => (
          <li key={choice.kind}>
            <button
              type="button"
              disabled={busy}
              onClick={() => choose(choice)}
              className="bg-card hover:bg-muted flex w-full items-center gap-3 rounded-xl border p-4 text-left disabled:opacity-50"
            >
              <SpaceIcon kind={choice.kind} className="size-11" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{choice.title}</span>
                <span className="text-muted-foreground block text-xs">{choice.text}</span>
              </span>
              <ChevronRight className="text-muted-foreground size-4" />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-center text-xs">
        Votre espace personnel existe toujours. Vous pourrez ajouter d’autres espaces à tout moment
        dans « Mes espaces ».
      </p>
    </div>
  );
}
