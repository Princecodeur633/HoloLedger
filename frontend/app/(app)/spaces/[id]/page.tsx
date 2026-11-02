"use client";

import { ChevronLeft, LogOut, MessageCircle, Trash2, UserPlus, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { Field } from "@/components/form";
import { PhoneInput } from "@/components/PhoneInput";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPhone, DEFAULT_COUNTRY, phoneBody, type PhoneValue } from "@/lib/phone";
import { SPACE_KINDS, useSpace } from "@/lib/space";
import { SPACE_ICONS } from "@/lib/space-icons";
import type { Space } from "@/lib/types";
import { cn } from "@/lib/utils";

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : OFFLINE_MESSAGE;
}

const WHATSAPP = "bg-[#25D366] text-white hover:bg-[#1ebe5b]";

function SpaceSettings({ space }: { space: Space }) {
  const router = useRouter();
  const { user } = useAuth();
  const { reload, switchTo, spaces } = useSpace();
  const [form, setForm] = useState({ name: space.name, icon: space.icon });
  const [phone, setPhone] = useState<PhoneValue>({ country: DEFAULT_COUNTRY, number: "" });
  const [sent, setSent] = useState<{ registered: boolean; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = space.role === "owner";
  const shared = space.kind !== "personal";
  const group = space.kind === "tontine" || space.kind === "family";
  const seats = (group ? 50 : 2) - space.members.length - space.pending_invitations.length;
  const partnerWord =
    space.kind === "couple" ? "votre partenaire" : group ? "un membre (avec l’app)" : "un associé";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      await api(`/spaces/${space.id}/`, { method: "PATCH", body: form });
      reload();
      toast.success("Espace mis à jour");
    });

  const invite = () =>
    run(async () => {
      const res = await api<{ registered: boolean; whatsapp_url: string }>(
        `/spaces/${space.id}/invite/`,
        { method: "POST", body: phoneBody(phone) },
      );
      setSent({ registered: res.registered, url: res.whatsapp_url });
      setPhone({ ...phone, number: "" });
      reload();
    });

  const cancelInvite = (id: string) =>
    run(async () => {
      await api(`/invitations/${id}/cancel/`, { method: "POST" });
      reload();
    });

  const removeMember = (memberId: string, name: string) => {
    if (!window.confirm(`Retirer ${name} de l’espace ?`)) return;
    run(async () => {
      await api(`/spaces/${space.id}/remove-member/`, { method: "POST", body: { user: memberId } });
      reload();
    });
  };

  const leaveOrDelete = (mode: "leave" | "delete") => {
    const message =
      mode === "leave"
        ? `Quitter « ${space.name} » ? L’espace et son historique restent pour l’autre membre.`
        : `Supprimer « ${space.name} » et TOUTES ses données ? C’est définitif.`;
    if (!window.confirm(message)) return;
    run(async () => {
      await api(mode === "leave" ? `/spaces/${space.id}/leave/` : `/spaces/${space.id}/`, {
        method: mode === "leave" ? "POST" : "DELETE",
      });
      const personal = spaces?.find((s) => s.kind === "personal");
      if (personal) switchTo(personal.id);
      reload();
      toast.success(mode === "leave" ? "Vous avez quitté l’espace" : "Espace supprimé");
      router.push("/spaces");
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Nom et icône</CardTitle>
          <CardDescription>{SPACE_KINDS[space.kind].label}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Nom" htmlFor="s-name">
            <Input
              id="s-name"
              maxLength={60}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {SPACE_ICONS[space.kind].map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setForm({ ...form, icon })}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border text-lg",
                  form.icon === icon && "ring-foreground ring-2",
                )}
              >
                {icon}
              </button>
            ))}
          </div>
          <Button className="self-start" onClick={save} disabled={busy || !form.name.trim()}>
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      {shared && (
        <Card>
          <CardHeader>
            <CardTitle>Membres</CardTitle>
            <CardDescription>
              {space.kind === "couple"
                ? "Un espace couple réunit 2 personnes."
                : group
                  ? "Membres qui ont l’app (50 au maximum). Les membres sans l’app s’ajoutent dans « Membres » (carnet)."
                  : "Seul ou avec un associé (2 personnes au maximum)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {space.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <UserAvatar name={m.username} />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {m.username}
                    {m.id === user?.id && <span className="text-muted-foreground"> (vous)</span>}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {m.role === "owner" ? "Créateur" : "Membre"}
                  </span>
                  {isOwner && m.id !== user?.id && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Retirer ${m.username}`}
                      onClick={() => removeMember(m.id, m.username)}
                    >
                      <X />
                    </Button>
                  )}
                </li>
              ))}
              {space.pending_invitations.map((inv) => (
                <li key={inv.id} className="text-muted-foreground flex items-center gap-3 text-sm">
                  <span className="bg-muted flex size-9 items-center justify-center rounded-full">
                    ⏳
                  </span>
                  <span className="flex-1">{formatPhone(inv.phone)} · invitation en attente</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Annuler l’invitation"
                    onClick={() => cancelInvite(inv.id)}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>

            {seats > 0 && (
              <form
                className="flex flex-col gap-2 border-t pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  invite();
                }}
              >
                <p className="text-sm font-medium">Inviter {partnerWord}</p>
                <PhoneInput id="invite-phone" required value={phone} onChange={setPhone} />
                <Button type="submit" className="self-start" disabled={busy || !phone.number}>
                  <UserPlus /> Inviter
                </Button>
              </form>
            )}

            {sent && (
              <div className="bg-muted flex flex-col gap-2 rounded-lg p-3 text-sm">
                <p>
                  {sent.registered
                    ? "Invitation envoyée : elle apparaît dans son app. Vous pouvez aussi le prévenir :"
                    : "Cette personne n’a pas encore de compte. Envoyez-lui le lien d’inscription : l’invitation l’attendra."}
                </p>
                <a
                  href={sent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "sm", className: `self-start ${WHATSAPP}` })}
                >
                  <MessageCircle /> Envoyer sur WhatsApp
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {shared && (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={() => leaveOrDelete("leave")}
            disabled={busy}
          >
            <LogOut /> Quitter l’espace
          </Button>
          {isOwner && (
            <Button
              variant="destructive"
              className="h-11"
              onClick={() => leaveOrDelete("delete")}
              disabled={busy}
            >
              <Trash2 /> Supprimer l’espace et ses données
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SpaceSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { spaces } = useSpace();
  const space = spaces?.find((s) => s.id === id);

  return (
    <div>
      <PageHeader
        title={space ? `${space.icon} ${space.name}` : "Espace"}
        action={
          <Button variant="ghost" size="sm" onClick={() => router.push("/spaces")}>
            <ChevronLeft /> Mes espaces
          </Button>
        }
      />
      {spaces === null ? (
        <ListSkeleton />
      ) : space ? (
        <SpaceSettings key={space.id} space={space} />
      ) : (
        <p className="text-muted-foreground text-sm">Espace introuvable.</p>
      )}
    </div>
  );
}
