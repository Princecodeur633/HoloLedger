"use client";

import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { CategoryIcon } from "@/components/CategoryBadge";
import { Field, MoneyInput, NativeSelect } from "@/components/form";
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
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { periodLabel, shiftPeriod, today } from "@/lib/dates";
import { formatMoney, parseAmount } from "@/lib/format";
import type { Budget, Category } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type Draft = { id?: string; category: string; amount: string; alert_threshold: string };

const STATUS_LABEL = { ok: "", warning: "Bientôt atteint", over: "Dépassé" };

export default function BudgetsPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? "XAF";
  const [month, setMonth] = useState(today());
  const { data: budgets, reload } = useApi<Budget[]>("/budgets/", { date: month });
  const { data: categories } = useApi<Category[]>("/categories/");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const expenseCategories = (categories ?? []).filter((c) => c.type !== "income");
  const usedCategories = new Set((budgets ?? []).map((b) => b.category));
  const totalBudget = (budgets ?? []).reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = (budgets ?? []).reduce((s, b) => s + Number(b.usage?.spent ?? 0), 0);
  const isCurrentMonth = shiftPeriod(month, "month", 1) > today();

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const { id, ...body } = draft;
    try {
      await api(id ? `/budgets/${id}/` : "/budgets/", {
        method: id ? "PATCH" : "POST",
        body: {
          ...body,
          amount: parseAmount(body.amount),
          alert_threshold: Number(body.alert_threshold),
        },
      });
      toast.success(id ? "Budget modifié" : "Budget créé");
      setDraft(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de contacter le serveur.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(budget: Budget) {
    if (!window.confirm(`Supprimer le budget « ${budget.category_detail.name} » ?`)) return;
    try {
      await api(`/budgets/${budget.id}/`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Suppression impossible.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Budgets"
        action={
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              setDraft({ category: "", amount: "", alert_threshold: "80" });
            }}
          >
            <Plus /> Budget
          </Button>
        }
      />

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Mois précédent"
          onClick={() => setMonth(shiftPeriod(month, "month", -1))}
        >
          <ChevronLeft />
        </Button>
        <span className="font-medium">{periodLabel(month, "month")}</span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Mois suivant"
          disabled={isCurrentMonth}
          onClick={() => setMonth(shiftPeriod(month, "month", 1))}
        >
          <ChevronRight />
        </Button>
      </div>

      {budgets && budgets.length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Total dépensé</span>
            <span className="tabular-nums">
              <span className="font-semibold">{formatMoney(totalSpent, currency)}</span>
              {" / "}
              {formatMoney(totalBudget, currency)}
            </span>
          </div>
          <ProgressBar
            percent={totalBudget ? (totalSpent / totalBudget) * 100 : 0}
            tone={
              totalSpent > totalBudget ? "over" : totalSpent >= totalBudget * 0.8 ? "warning" : "ok"
            }
          />
        </div>
      )}

      {budgets === null && <p className="text-muted-foreground text-sm">Chargement…</p>}
      {budgets?.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Fixez une limite mensuelle à vos catégories de dépenses : vous serez alerté à l’approche
          du plafond.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {budgets?.map((b) => {
          const usage = b.usage;
          return (
            <li key={b.id} className="bg-card rounded-xl border p-4">
              <div className="mb-3 flex items-center gap-3">
                <CategoryIcon icon={b.category_detail.icon} color={b.category_detail.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.category_detail.name}</p>
                  {usage && usage.status !== "ok" && (
                    <p
                      className={cn(
                        "text-xs font-medium",
                        usage.status === "over" ? "text-expense" : "text-amber-600",
                      )}
                    >
                      {STATUS_LABEL[usage.status]}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Modifier"
                  onClick={() => {
                    setError(null);
                    setDraft({
                      id: b.id,
                      category: b.category,
                      amount: String(Number(b.amount)),
                      alert_threshold: String(b.alert_threshold),
                    });
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer"
                  onClick={() => remove(b)}
                >
                  <Trash2 />
                </Button>
              </div>
              {usage && (
                <>
                  <ProgressBar percent={usage.percent} tone={usage.status} />
                  <div className="text-muted-foreground mt-2 flex justify-between text-xs tabular-nums">
                    <span>
                      {formatMoney(usage.spent, currency)} sur {formatMoney(b.amount, currency)}
                    </span>
                    <span className={cn(Number(usage.remaining) < 0 && "text-expense font-medium")}>
                      {Number(usage.remaining) >= 0
                        ? `Reste ${formatMoney(usage.remaining, currency)}`
                        : `Dépassé de ${formatMoney(-Number(usage.remaining), currency)}`}
                    </span>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier le budget" : "Nouveau budget mensuel"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              id="budget-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Field label="Catégorie" htmlFor="b-cat">
                <NativeSelect
                  id="b-cat"
                  required
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  <option value="">Choisir…</option>
                  {expenseCategories.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      disabled={usedCategories.has(c.id) && c.id !== draft.category}
                    >
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Limite par mois" htmlFor="b-amount">
                <MoneyInput
                  id="b-amount"
                  required
                  currency={currency}
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </Field>
              <Field
                label="Alerte à partir de (%)"
                htmlFor="b-threshold"
                hint="Le budget est signalé lorsque cette part de la limite est dépensée."
              >
                <Input
                  id="b-threshold"
                  type="number"
                  min={1}
                  max={100}
                  value={draft.alert_threshold}
                  onChange={(e) => setDraft({ ...draft, alert_threshold: e.target.value })}
                  className="h-10"
                />
              </Field>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="budget-form" disabled={saving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
