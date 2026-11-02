"use client";

import { Check, ChevronRight, Settings2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { MASK, useHidden } from "@/lib/privacy";
import { SPACE_KINDS, useSpace } from "@/lib/space";
import { SPACE_ICONS } from "@/lib/space-icons";
import type { Space } from "@/lib/types";
import { cn } from "@/lib/utils";

type NewSpace = { kind: "couple" | "business" | "tontine" | "family"; name: string; icon: string };

const CREATE = [
  {
    kind: "couple" as const,
    title: "Espace couple",
    text: "Gérez les dépenses communes à deux : budgets, compte commun, projets.",
  },
  {
    kind: "business" as const,
    title: "Espace business",
    text: "Suivez une activité : ventes, dépenses, bénéfice. Seul ou avec un associé.",
  },
  {
    kind: "tontine" as const,
    title: "Tontine (ristourne)",
    text: "Cotisations à tour de rôle : qui a payé, qui mange, les retards.",
  },
  {
    kind: "family" as const,
    title: "Caisse familiale",
    text: "Qui a cotisé combien, les retards, et à quoi l’argent a servi.",
  },
];

const TITLES: Record<NewSpace["kind"], string> = {
  couple: "Nouvel espace couple",
  business: "Nouvel espace business",
  tontine: "Nouvelle tontine",
  family: "Nouvelle caisse familiale",
};

const PLACEHOLDERS: Record<NewSpace["kind"], string> = {
  couple: "Ex : Awa & Paul",
  business: "Ex : Boutique Mama",
  tontine: "Ex : Tontine du quartier",
  family: "Ex : Famille Mabiala",
};

const HINTS: Record<NewSpace["kind"], string> = {
  couple: "Ensuite, invitez votre partenaire avec son numéro de téléphone.",
  business: "Vous pourrez inviter un associé plus tard (2 personnes au maximum).",
  tontine: "Vous en serez le gestionnaire. Ensuite : fixez les règles, ajoutez les membres.",
  family: "Vous en serez le gestionnaire. Ensuite : fixez la cotisation, ajoutez les membres.",
};

export default function SpacesPage() {
  const router = useRouter();
  const { spaces, current, invitations, switchTo, reload } = useSpace();
  const hidden = useHidden();
  const [draft, setDraft] = useState<NewSpace | null>(null);
  const [saving, setSaving] = useState(false);
  const inCouple = (spaces ?? []).some((s) => s.kind === "couple");

  function open(space: Space) {
    switchTo(space.id);
    router.push("/dashboard");
  }

  async function respond(id: string, action: "accept" | "decline") {
    try {
      const res = await api<Space | undefined>(`/invitations/${id}/${action}/`, { method: "POST" });
      reload();
      if (action === "accept" && res) {
        toast.success(`Bienvenue dans « ${res.name} »`);
        switchTo(res.id);
      } else {
        toast.success("Invitation refusée");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    }
  }

  async function create() {
    if (!draft) return;
    setSaving(true);
    try {
      const space = await api<Space>("/spaces/", { method: "POST", body: draft });
      reload();
      switchTo(space.id);
      setDraft(null);
      toast.success(`Espace « ${space.name} » créé`);
      // A couple space is only useful once the partner is invited.
      router.push(
        space.kind === "couple"
          ? `/spaces/${space.id}`
          : space.kind === "tontine" || space.kind === "family"
            ? "/group/rules"
            : "/dashboard",
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Mes espaces" />

      {invitations.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Invitations reçues</h2>
          {invitations.map((inv) => (
            <div key={inv.id} className="bg-card flex items-center gap-3 rounded-xl border p-3">
              <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full text-lg">
                {inv.space.icon}
              </span>
              <p className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{inv.inviter}</span> vous invite dans l’espace{" "}
                <span className="font-medium">« {inv.space.name} »</span>
              </p>
              <Button
                size="icon-sm"
                aria-label="Accepter"
                onClick={() => respond(inv.id, "accept")}
              >
                <Check />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Refuser"
                onClick={() => respond(inv.id, "decline")}
              >
                <X />
              </Button>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Vos espaces</h2>
        {spaces === null ? (
          <ListSkeleton />
        ) : (
          spaces.map((space) => (
            <div
              key={space.id}
              className={cn(
                "bg-card flex items-center gap-3 rounded-xl border p-3",
                current?.id === space.id && "ring-foreground ring-1",
              )}
            >
              <button
                type="button"
                onClick={() => open(space)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-full text-xl">
                  {space.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{space.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {SPACE_KINDS[space.kind].label}
                    {space.members.length > 1 &&
                      ` · ${space.members.map((m) => m.username).join(" & ")}`}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {hidden ? MASK : formatMoney(space.balance, space.currency)}
                </span>
              </button>
              <Link
                href={`/spaces/${space.id}`}
                aria-label={`Réglages de ${space.name}`}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <Settings2 className="size-4" />
              </Link>
            </div>
          ))
        )}
        <p className="text-muted-foreground text-xs">
          Chaque espace garde ses propres comptes et totaux : rien ne se mélange.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Créer un espace</h2>
        {CREATE.map((option) => {
          const blocked = option.kind === "couple" && inCouple;
          return (
            <button
              key={option.kind}
              type="button"
              disabled={blocked}
              onClick={() =>
                setDraft({
                  kind: option.kind,
                  name: "",
                  icon: SPACE_ICONS[option.kind][0],
                })
              }
              className="bg-card hover:bg-muted flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50"
            >
              <span className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-full text-xl">
                {SPACE_KINDS[option.kind].icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{option.title}</span>
                <span className="text-muted-foreground block text-xs">
                  {blocked ? "Vous avez déjà un espace couple." : option.text}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-4" />
            </button>
          );
        })}
      </section>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft && TITLES[draft.kind]}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              id="space-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <Field label="Nom" htmlFor="space-name">
                <Input
                  id="space-name"
                  required
                  maxLength={60}
                  placeholder={PLACEHOLDERS[draft.kind]}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="h-10"
                />
              </Field>
              <Field label="Icône">
                <div className="flex flex-wrap gap-2">
                  {SPACE_ICONS[draft.kind].map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setDraft({ ...draft, icon })}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full border text-lg",
                        draft.icon === icon && "ring-foreground ring-2",
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </Field>
              <p className="text-muted-foreground text-xs">{HINTS[draft.kind]}</p>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="space-form" disabled={saving}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
