"use client";

import { Plus, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Field, MoneyInput } from "@/components/form";
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
import { formatDate, today } from "@/lib/dates";
import { formatMoney, parseAmount } from "@/lib/format";
import type { GroupBoard, GroupExpense } from "@/lib/group";
import { MASK, useHidden } from "@/lib/privacy";
import { useCurrency } from "@/lib/space";
import { useApi } from "@/lib/use-api";

export default function GroupExpensesPage() {
  const currency = useCurrency();
  const hidden = useHidden();
  const money = (v: string | number) => (hidden ? MASK : formatMoney(v, currency));
  const { data: board } = useApi<GroupBoard>("/group/");
  const { data: expenses, reload } = useApi<GroupExpense[]>("/group/expenses/");
  const [draft, setDraft] = useState<{
    amount: string;
    purpose: string;
    note: string;
    date: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const manager = board?.me.is_manager ?? false;

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api("/group/expenses/", {
        method: "POST",
        body: { ...draft, amount: parseAmount(draft.amount) },
      });
      toast.success("Dépense enregistrée");
      setDraft(null);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  async function remove(expense: GroupExpense) {
    if (!window.confirm(`Supprimer « ${expense.purpose} » ?`)) return;
    try {
      await api(`/group/expenses/${expense.id}/`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dépenses de la caisse"
        action={
          manager && (
            <Button
              variant="outline"
              onClick={() => setDraft({ amount: "", purpose: "", note: "", date: today() })}
            >
              <Plus /> Dépense
            </Button>
          )
        }
      />
      {board && (
        <p className="text-muted-foreground text-sm">
          Reste en caisse :{" "}
          <span className="text-foreground font-semibold">{money(board.totals.cash)}</span>
        </p>
      )}

      {expenses === null ? (
        <ListSkeleton />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          message="Aucune dépense : chaque sortie d’argent apparaîtra ici avec son but."
        />
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.purpose}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDate(e.date)}
                  {e.created_by_name && ` · par ${e.created_by_name}`}
                  {e.note && ` · ${e.note}`}
                </p>
              </div>
              <span className="font-semibold tabular-nums">−{money(e.amount)}</span>
              {manager && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Supprimer"
                  onClick={() => remove(e)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle dépense de la caisse</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              id="expense-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Field label="Pour quoi ?" htmlFor="e-purpose">
                <Input
                  id="e-purpose"
                  required
                  maxLength={120}
                  placeholder="Ex : Santé de grand-mère"
                  value={draft.purpose}
                  onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
                  className="h-10"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Montant" htmlFor="e-amount">
                  <MoneyInput
                    id="e-amount"
                    required
                    currency={currency}
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  />
                </Field>
                <Field label="Date" htmlFor="e-date">
                  <Input
                    id="e-date"
                    type="date"
                    max={today()}
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    className="h-10"
                  />
                </Field>
              </div>
              <Field label="Détail (facultatif)" htmlFor="e-note">
                <Input
                  id="e-note"
                  maxLength={255}
                  placeholder="Ex : ordonnance, facture n°…"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  className="h-10"
                />
              </Field>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="expense-form" disabled={saving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
