"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { Field, MoneyInput, NativeSelect } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { today } from "@/lib/dates";
import { parseAmount } from "@/lib/format";
import type { GroupBoard } from "@/lib/group";
import { useCurrency } from "@/lib/space";
import { useApi } from "@/lib/use-api";

function PayForm({ board, preset }: { board: GroupBoard; preset: string | null }) {
  const router = useRouter();
  const currency = useCurrency();
  const manager = board.me.is_manager;
  const me = board.members.find((m) => m.id === board.me.member);
  // Coming from a member's record: that member is preselected (managers only).
  const target = (board.me.is_manager && board.members.find((m) => m.id === preset)) || me;
  const [form, setForm] = useState({
    member: target?.id ?? board.members[0]?.id ?? "",
    amount: target ? String(Number(target.amount)) : "",
    date: today(),
    reference: "",
    note: "",
    record_in_personal: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const forMe = form.member === board.me.member;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/group/contributions/", {
        method: "POST",
        body: {
          ...form,
          amount: parseAmount(form.amount),
          record_in_personal: forMe && form.record_in_personal,
        },
      });
      navigator.vibrate?.(20);
      toast.success(
        manager ? "Versement enregistré" : "Versement déclaré : en attente de validation",
      );
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {manager ? (
        <Field label="Membre" htmlFor="p-member">
          <NativeSelect
            id="p-member"
            value={form.member}
            onChange={(e) => {
              const member = board.members.find((m) => m.id === e.target.value);
              setForm({
                ...form,
                member: e.target.value,
                amount: member ? String(Number(member.amount)) : form.amount,
              });
            }}
          >
            {board.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === board.me.member ? " (moi)" : !m.user ? " · carnet" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        !me && (
          <p className="text-destructive text-sm">Vous n’êtes pas encore membre de ce groupe.</p>
        )
      )}
      <Field label="Montant versé" htmlFor="p-amount">
        <MoneyInput
          id="p-amount"
          required
          currency={currency}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="p-date">
          <Input
            id="p-date"
            type="date"
            max={today()}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="h-10"
          />
        </Field>
        <Field label="Référence (facultatif)" htmlFor="p-ref">
          <Input
            id="p-ref"
            maxLength={80}
            placeholder="Ex : ID MoMo"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            className="h-10"
          />
        </Field>
      </div>
      <Field label="Note (facultatif)" htmlFor="p-note">
        <Input
          id="p-note"
          maxLength={255}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="h-10"
        />
      </Field>
      {forMe && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 size-4"
            checked={form.record_in_personal}
            onChange={(e) => setForm({ ...form, record_in_personal: e.target.checked })}
          />
          <span>
            Noter aussi dans mon espace personnel
            <span className="text-muted-foreground block text-xs">
              Comptée comme dépense « Cotisations », pour que votre solde perso reste juste.
            </span>
          </span>
        </label>
      )}
      <p className="text-muted-foreground text-xs">
        {manager
          ? "En tant que gestionnaire, le versement est validé tout de suite."
          : "Le gestionnaire vérifiera puis validera votre versement."}
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button
        type="submit"
        size="lg"
        className="h-12 text-base"
        disabled={saving || (!manager && !me)}
      >
        {manager ? "Enregistrer le versement" : "J’ai versé"}
      </Button>
    </form>
  );
}

function GroupPay() {
  const router = useRouter();
  const preset = useSearchParams().get("member");
  const { data: board } = useApi<GroupBoard>("/group/");
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title={board?.me.is_manager ? "Enregistrer un versement" : "Déclarer un versement"}
        action={
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft /> Retour
          </Button>
        }
      />
      {board ? <PayForm board={board} preset={preset} /> : <ListSkeleton />}
    </div>
  );
}

export default function GroupPayPage() {
  return (
    <Suspense>
      <GroupPay />
    </Suspense>
  );
}
