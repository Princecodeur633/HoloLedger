"use client";

import { ArrowDown, ArrowUp, Shuffle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { Field, MoneyInput } from "@/components/form";
import { MemberSheet } from "@/components/group/MemberSheet";
import { StatusDots } from "@/components/group/StatusChip";
import { PhoneInput } from "@/components/PhoneInput";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { formatMoney, parseAmount } from "@/lib/format";
import type { GroupBoard, GroupMemberRow } from "@/lib/group";
import { DEFAULT_COUNTRY, phoneBody, phoneValue, type PhoneValue } from "@/lib/phone";
import { MASK, useHidden } from "@/lib/privacy";
import { useCurrency, useSpace } from "@/lib/space";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type Draft = { id?: string; name: string; phone: PhoneValue; expected_amount: string };

const ROLE = { owner: "Créateur", manager: "Gestionnaire", member: "" };

export default function GroupMembersPage() {
  const { current } = useSpace();
  const currency = useCurrency();
  const hidden = useHidden();
  const money = (v: string | number) => (hidden ? MASK : formatMoney(v, currency));
  const { data: board, reload } = useApi<GroupBoard>("/group/");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const manager = board?.me.is_manager ?? false;
  const [opened, setOpened] = useState<string | null>(null);
  const openedMember = board?.members.find((m) => m.id === opened) ?? null;

  function editMember(m: GroupMemberRow) {
    setOpened(null);
    setDraft({
      id: m.id,
      name: m.name,
      phone: phoneValue(m.phone || null),
      expected_amount: m.expected_amount ? String(Number(m.expected_amount)) : "",
    });
  }

  function toggleManager(m: GroupMemberRow) {
    run(
      () =>
        api(`/group/members/${m.id}/role/`, {
          method: "POST",
          body: { manager: m.role !== "manager" },
        }),
      m.role === "manager" ? "N’est plus gestionnaire" : "Nommé gestionnaire",
    );
  }

  function removeMember(m: GroupMemberRow) {
    if (!window.confirm(`Retirer ${m.name} ? Ses versements restent dans l’historique.`)) return;
    setOpened(null);
    run(() => api(`/group/members/${m.id}/`, { method: "DELETE" }), "Membre retiré");
  }
  const tontine = current?.kind === "tontine";

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!draft) return;
    const body = {
      name: draft.name,
      ...(draft.phone.number ? phoneBody(draft.phone) : { phone: "" }),
      expected_amount: draft.expected_amount ? parseAmount(draft.expected_amount) : null,
    };
    run(
      () =>
        api(draft.id ? `/group/members/${draft.id}/` : "/group/members/", {
          method: draft.id ? "PATCH" : "POST",
          body,
        }).then(() => setDraft(null)),
      draft.id ? "Membre modifié" : "Membre ajouté au carnet",
    );
  }

  function move(member: GroupMemberRow, step: -1 | 1) {
    const list = board!.members;
    const other = list[list.findIndex((m) => m.id === member.id) + step];
    if (!other) return;
    run(
      () =>
        Promise.all([
          api(`/group/members/${member.id}/`, {
            method: "PATCH",
            body: { position: other.position },
          }),
          api(`/group/members/${other.id}/`, {
            method: "PATCH",
            body: { position: member.position },
          }),
        ]),
      "Ordre modifié",
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Membres"
        action={
          manager && (
            <Button
              variant="outline"
              onClick={() =>
                setDraft({
                  name: "",
                  phone: { country: DEFAULT_COUNTRY, number: "" },
                  expected_amount: "",
                })
              }
            >
              <UserPlus /> Carnet
            </Button>
          )
        }
      />

      {manager && (
        <div className="bg-muted flex flex-col gap-1 rounded-xl p-3 text-xs">
          <p>
            <span className="font-semibold">Membre carnet</span> : quelqu’un sans l’app. Vous notez
            ses versements à sa place.
          </p>
          <p>
            <span className="font-semibold">Membre avec l’app</span> :{" "}
            <Link href={`/spaces/${current?.id}`} className="underline">
              invitez-le par son numéro
            </Link>
            , il déclare lui-même ses versements.
          </p>
        </div>
      )}

      {tontine && manager && (
        <Button
          variant="outline"
          className="self-start"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Tirer au sort l’ordre de passage (qui mange en premier) ?"))
              run(() => api("/group/members/shuffle/", { method: "POST" }), "Ordre tiré au sort");
          }}
        >
          <Shuffle /> Tirer au sort l’ordre
        </Button>
      )}

      {!board ? (
        <ListSkeleton />
      ) : (
        <ul className="flex flex-col gap-2">
          {board.members.map((m, i) => (
            <li
              key={m.id}
              className={cn(
                "bg-card rounded-xl border p-3",
                m.late_count > 0 && "border-expense/40",
              )}
            >
              <button
                type="button"
                onClick={() => setOpened(m.id)}
                className="flex w-full items-center gap-3 text-left"
              >
                {tontine && (
                  <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {i + 1}
                  </span>
                )}
                <UserAvatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium", m.late_count > 0 && "text-expense")}>
                    {m.name}
                    {m.role && ROLE[m.role] && (
                      <span className="text-muted-foreground font-normal"> · {ROLE[m.role]}</span>
                    )}
                    {!m.user && (
                      <span className="text-muted-foreground font-normal"> · carnet</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {money(m.paid)} versés
                    {Number(m.arrears) > 0 && (
                      <span className={cn("font-medium", m.late_count > 0 && "text-expense")}>
                        {" "}
                        · {money(m.arrears)} {m.late_count > 0 ? "en retard" : "à payer"}
                      </span>
                    )}
                    {Number(m.advance) > 0 && (
                      <span className="text-income"> · {money(m.advance)} d’avance</span>
                    )}
                    {Number(m.penalty) > 0 && ` · pénalités ${money(m.penalty)}`}
                  </p>
                </div>
                <StatusDots statuses={m.statuses} />
              </button>

              {manager && tontine && (
                <div className="mt-2 flex items-center gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Monter"
                    disabled={i === 0 || busy}
                    onClick={() => move(m, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Descendre"
                    disabled={i === board.members.length - 1 || busy}
                    onClick={() => move(m, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <span className="text-muted-foreground text-xs">Ordre de passage</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-xs">
        Touchez un membre pour voir sa fiche complète. Les points résument les{" "}
        {tontine ? "séances" : "dernières périodes"} : vert payé, orange à valider, rouge en retard,
        gris à venir.
      </p>

      {board && (
        <MemberSheet
          member={openedMember}
          board={board}
          onClose={() => setOpened(null)}
          onEdit={editMember}
          onToggleManager={toggleManager}
          onRemove={removeMember}
        />
      )}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Modifier le membre" : "Ajouter un membre au carnet"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              id="member-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Field label="Nom" htmlFor="m-name">
                <Input
                  id="m-name"
                  required
                  maxLength={80}
                  placeholder="Ex : Tonton Jean"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="h-10"
                />
              </Field>
              <Field
                label="Téléphone (facultatif)"
                htmlFor="m-phone"
                hint="S’il installe l’app un jour, il retrouvera son historique."
              >
                <PhoneInput
                  id="m-phone"
                  value={draft.phone}
                  onChange={(phone) => setDraft({ ...draft, phone })}
                />
              </Field>
              {!tontine && (
                <Field
                  label="Cotisation propre à ce membre (facultatif)"
                  htmlFor="m-amount"
                  hint={`Sinon : ${formatMoney(board?.rules.contribution_amount ?? 0, currency)}`}
                >
                  <MoneyInput
                    id="m-amount"
                    currency={currency}
                    value={draft.expected_amount}
                    onChange={(e) => setDraft({ ...draft, expected_amount: e.target.value })}
                  />
                </Field>
              )}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="member-form" disabled={busy}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!manager && (
        <Link href="/group/pay" className={buttonVariants({ size: "lg", className: "h-11" })}>
          J’ai versé ma cotisation
        </Link>
      )}
    </div>
  );
}
