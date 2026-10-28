"use client";

import { HandCoins, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Field, MoneyInput } from "@/components/form";
import { ProgressBar } from "@/components/ProgressBar";
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
import { UserAvatar } from "@/components/UserAvatar";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, today } from "@/lib/dates";
import { formatMoney, parseAmount } from "@/lib/format";
import { MASK, useHidden } from "@/lib/privacy";
import type { Debt, DebtDirection } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const TABS: { value: DebtDirection; label: string; empty: string }[] = [
  { value: "lent", label: "On me doit", empty: "Personne ne vous doit d’argent." },
  { value: "borrowed", label: "Je dois", empty: "Vous ne devez rien à personne." },
];

type Draft = {
  id?: string;
  direction: DebtDirection;
  person: string;
  amount: string;
  description: string;
  date: string;
  due_date: string;
};

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : OFFLINE_MESSAGE;
}

export default function DebtsPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? "XAF";
  const hidden = useHidden();
  const money = (v: string | number) => (hidden ? MASK : formatMoney(v, currency));
  const { data: debts, reload } = useApi<Debt[]>("/debts/");
  const [tab, setTab] = useState<DebtDirection>("lent");
  const [showSettled, setShowSettled] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [repay, setRepay] = useState<{ debt: Debt; amount: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = (direction: DebtDirection) =>
    (debts ?? [])
      .filter((d) => d.direction === direction)
      .reduce((sum, d) => sum + Number(d.remaining), 0);
  const inTab = (debts ?? []).filter((d) => d.direction === tab);
  const open = inTab.filter((d) => !d.settled);
  const settled = inTab.filter((d) => d.settled);

  async function saveDebt() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const { id, ...body } = draft;
    try {
      await api(id ? `/debts/${id}/` : "/debts/", {
        method: id ? "PATCH" : "POST",
        body: { ...body, amount: parseAmount(body.amount), due_date: body.due_date || null },
      });
      toast.success(id ? "Modifié" : "Enregistré");
      setTab(draft.direction);
      setDraft(null);
      reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveRepayment() {
    if (!repay) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Debt>(`/debts/${repay.debt.id}/payments/`, {
        method: "POST",
        body: { amount: parseAmount(repay.amount), date: today() },
      });
      toast.success(updated.settled ? "Entièrement remboursé 🎉" : "Remboursement enregistré");
      setRepay(null);
      reload();
    } catch (err) {
      setError(
        err instanceof ApiError ? (err.fieldError("amount") ?? err.message) : OFFLINE_MESSAGE,
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(debt: Debt) {
    if (!window.confirm(`Supprimer « ${debt.person} » et ses remboursements ?`)) return;
    try {
      await api(`/debts/${debt.id}/`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function undoPayment(debt: Debt) {
    const last = debt.payments[0];
    if (!last || !window.confirm(`Annuler le remboursement de ${money(last.amount)} ?`)) return;
    try {
      await api(`/debt-payments/${last.id}/`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  function openNew() {
    setError(null);
    setDraft({
      direction: tab,
      person: "",
      amount: "",
      description: "",
      date: today(),
      due_date: "",
    });
  }

  const card = (debt: Debt) => (
    <li key={debt.id} className={cn("bg-card rounded-xl border p-4", debt.settled && "opacity-60")}>
      <div className="flex items-center gap-3">
        <UserAvatar name={debt.person} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{debt.person}</p>
          <p className="text-muted-foreground truncate text-xs">
            {debt.description || formatDate(debt.date)}
            {debt.due_date && !debt.settled && ` · à rendre le ${formatDate(debt.due_date)}`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{money(debt.remaining)}</p>
          <p className="text-muted-foreground text-xs tabular-nums">sur {money(debt.amount)}</p>
        </div>
      </div>
      {Number(debt.repaid) > 0 && (
        <div className="mt-3">
          <ProgressBar percent={debt.percent} />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {!debt.settled && (
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setRepay({ debt, amount: String(Number(debt.remaining)) });
            }}
          >
            <HandCoins /> Remboursement
          </Button>
        )}
        {debt.payments.length > 0 && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Annuler le dernier remboursement"
            title="Annuler le dernier remboursement"
            onClick={() => undoPayment(debt)}
          >
            <Undo2 />
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-auto"
          aria-label="Modifier"
          onClick={() => {
            setError(null);
            setDraft({
              id: debt.id,
              direction: debt.direction,
              person: debt.person,
              amount: String(Number(debt.amount)),
              description: debt.description,
              date: debt.date,
              due_date: debt.due_date ?? "",
            });
          }}
        >
          <Pencil />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Supprimer" onClick={() => remove(debt)}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dettes et prêts"
        action={
          <Button variant="outline" onClick={openNew}>
            <Plus /> Ajouter
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
              tab === t.value ? "border-foreground ring-foreground ring-1" : "hover:bg-muted",
            )}
          >
            <span className="text-muted-foreground text-xs">{t.label}</span>
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                t.value === "lent" ? "text-income" : "text-expense",
              )}
            >
              {money(total(t.value))}
            </span>
          </button>
        ))}
      </div>

      {debts === null ? (
        <ListSkeleton />
      ) : open.length === 0 ? (
        <EmptyState icon={HandCoins} message={TABS.find((t) => t.value === tab)!.empty} />
      ) : (
        <ul className="flex flex-col gap-2">{open.map(card)}</ul>
      )}

      {settled.length > 0 && (
        <div>
          <button
            type="button"
            className="text-muted-foreground text-sm"
            onClick={() => setShowSettled((v) => !v)}
          >
            {showSettled ? "Masquer" : "Voir"} les remboursés ({settled.length})
          </button>
          {showSettled && <ul className="mt-2 flex flex-col gap-2">{settled.map(card)}</ul>}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Les dettes et prêts sont suivis à part : ils ne modifient pas le solde de vos comptes.
      </p>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier" : "Nouvelle dette ou nouveau prêt"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              id="debt-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveDebt();
              }}
            >
              <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
                {(
                  [
                    ["lent", "J’ai prêté"],
                    ["borrowed", "J’ai emprunté"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraft({ ...draft, direction: value })}
                    className={cn(
                      "rounded-md py-1.5 text-sm",
                      draft.direction === value
                        ? "bg-background font-medium shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Field
                label={draft.direction === "lent" ? "À qui ?" : "Auprès de qui ?"}
                htmlFor="d-person"
              >
                <Input
                  id="d-person"
                  required
                  maxLength={80}
                  placeholder="Ex : Paul"
                  value={draft.person}
                  onChange={(e) => setDraft({ ...draft, person: e.target.value })}
                  className="h-10"
                />
              </Field>
              <Field label="Montant" htmlFor="d-amount">
                <MoneyInput
                  id="d-amount"
                  required
                  currency={currency}
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </Field>
              <Field label="Pour quoi ? (facultatif)" htmlFor="d-desc">
                <Input
                  id="d-desc"
                  maxLength={255}
                  placeholder="Ex : Transport, dépannage…"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="h-10"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" htmlFor="d-date">
                  <Input
                    id="d-date"
                    type="date"
                    max={today()}
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    className="h-10"
                  />
                </Field>
                <Field label="À rendre le (facultatif)" htmlFor="d-due">
                  <Input
                    id="d-due"
                    type="date"
                    min={draft.date}
                    value={draft.due_date}
                    onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                    className="h-10"
                  />
                </Field>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="debt-form" disabled={saving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={repay !== null} onOpenChange={(o) => !o && setRepay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {repay?.debt.direction === "lent"
                ? `${repay.debt.person} vous rembourse`
                : `Vous remboursez ${repay?.debt.person ?? ""}`}
            </DialogTitle>
          </DialogHeader>
          {repay && (
            <form
              id="repay-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveRepayment();
              }}
            >
              <Field
                label="Montant remboursé"
                htmlFor="r-amount"
                hint={`Reste à rembourser : ${formatMoney(repay.debt.remaining, currency)}`}
              >
                <MoneyInput
                  id="r-amount"
                  required
                  autoFocus
                  currency={currency}
                  value={repay.amount}
                  onChange={(e) => setRepay({ ...repay, amount: e.target.value })}
                />
              </Field>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepay(null)}>
              Annuler
            </Button>
            <Button type="submit" form="repay-form" disabled={saving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
