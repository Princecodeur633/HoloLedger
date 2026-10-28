"use client";

import { CircleCheck, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { CATEGORY_COLORS, CategoryIcon } from "@/components/CategoryBadge";
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
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, parseISODate, today } from "@/lib/dates";
import { formatMoney, parseAmount } from "@/lib/format";
import type { Goal, GoalContribution } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type GoalDraft = {
  id?: string;
  name: string;
  target_amount: string;
  deadline: string;
  color: string;
};
type Movement = { goal: Goal; direction: 1 | -1; amount: string; note: string };

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : OFFLINE_MESSAGE;
}

/** Monthly effort needed to reach the goal on time, or null without deadline. */
function monthlyEffort(goal: Goal): number | null {
  if (!goal.deadline || goal.reached) return null;
  const now = parseISODate(today());
  const end = parseISODate(goal.deadline);
  const months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth();
  return Number(goal.remaining) / Math.max(months, 1);
}

function History({
  goal,
  currency,
  onChange,
}: {
  goal: Goal;
  currency: string;
  onChange: () => void;
}) {
  const { data, reload } = useApi<GoalContribution[]>(`/goals/${goal.id}/contributions/`);

  async function remove(c: GoalContribution) {
    try {
      await api(`/goal-contributions/${c.id}/`, { method: "DELETE" });
      reload();
      onChange();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  if (!data) return <Skeleton className="h-3 w-32" />;
  if (data.length === 0) return <p className="text-muted-foreground text-xs">Aucun versement.</p>;
  return (
    <ul className="divide-y text-sm">
      {data.map((c) => (
        <li key={c.id} className="flex items-center gap-2 py-1.5">
          <span className="text-muted-foreground w-24 shrink-0 text-xs">{formatDate(c.date)}</span>
          <span className="flex-1 truncate text-xs">{c.note}</span>
          <span
            className={cn("tabular-nums", Number(c.amount) < 0 ? "text-expense" : "text-income")}
          >
            {Number(c.amount) > 0 ? "+" : ""}
            {formatMoney(c.amount, currency)}
          </span>
          <Button variant="ghost" size="icon-xs" aria-label="Supprimer" onClick={() => remove(c)}>
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default function GoalsPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? "XAF";
  const { data: goals, reload } = useApi<Goal[]>("/goals/");
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [movement, setMovement] = useState<Movement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveGoal() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const { id, ...body } = draft;
    try {
      await api(id ? `/goals/${id}/` : "/goals/", {
        method: id ? "PATCH" : "POST",
        body: {
          ...body,
          target_amount: parseAmount(body.target_amount),
          deadline: body.deadline || null,
        },
      });
      toast.success(id ? "Objectif modifié" : "Objectif créé");
      setDraft(null);
      reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveMovement() {
    if (!movement) return;
    setSaving(true);
    setError(null);
    const amount = Number(parseAmount(movement.amount)) * movement.direction;
    try {
      const res = await api<{ goal: Goal }>(`/goals/${movement.goal.id}/contributions/`, {
        method: "POST",
        body: { amount: String(amount), note: movement.note },
      });
      toast.success(res.goal.reached ? "Objectif atteint, bravo !" : "Versement enregistré");
      setMovement(null);
      reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(goal: Goal) {
    if (!window.confirm(`Supprimer l’objectif « ${goal.name} » et son historique ?`)) return;
    try {
      await api(`/goals/${goal.id}/`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Objectifs"
        action={
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              setDraft({ name: "", target_amount: "", deadline: "", color: CATEGORY_COLORS[7] });
            }}
          >
            <Plus /> Objectif
          </Button>
        }
      />

      {goals === null && <ListSkeleton rows={2} />}
      {goals?.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Créez un objectif d’épargne (moto, fonds d’urgence, rentrée scolaire…) et suivez vos
          versements jusqu’à l’atteindre.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {goals?.map((goal) => {
          const effort = monthlyEffort(goal);
          return (
            <li
              key={goal.id}
              className="bg-card relative isolate overflow-hidden rounded-xl border p-4"
            >
              {/* Same decorative style as the balance card, tinted with the goal color. */}
              <PiggyBank
                className="pointer-events-none absolute -right-4 -bottom-6 -z-10 size-28 -rotate-6 opacity-[0.12]"
                style={{ color: goal.color }}
                strokeWidth={1.25}
                aria-hidden
              />
              <div className="mb-3 flex items-center gap-3">
                <CategoryIcon icon={goal.icon} color={goal.color} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {goal.name}
                    {goal.reached && <CircleCheck className="text-income size-4" />}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {goal.deadline ? `Échéance : ${formatDate(goal.deadline)}` : "Sans échéance"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Modifier"
                  onClick={() => {
                    setError(null);
                    setDraft({
                      id: goal.id,
                      name: goal.name,
                      target_amount: String(Number(goal.target_amount)),
                      deadline: goal.deadline ?? "",
                      color: goal.color,
                    });
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer"
                  onClick={() => remove(goal)}
                >
                  <Trash2 />
                </Button>
              </div>

              <ProgressBar percent={goal.percent} color={goal.color} />
              <div className="mt-2 flex justify-between text-xs tabular-nums">
                <span>
                  <span className="font-semibold">{formatMoney(goal.saved_amount, currency)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {formatMoney(goal.target_amount, currency)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {goal.percent.toLocaleString("fr-FR")} %
                </span>
              </div>
              {effort !== null && (
                <p className="text-muted-foreground mt-1 text-xs">
                  À mettre de côté : environ {formatMoney(Math.ceil(effort), currency)} par mois.
                </p>
              )}

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setMovement({ goal, direction: 1, amount: "", note: "" });
                  }}
                >
                  <Plus /> Verser
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Number(goal.saved_amount) <= 0}
                  onClick={() => {
                    setError(null);
                    setMovement({ goal, direction: -1, amount: "", note: "" });
                  }}
                >
                  Retirer
                </Button>
              </div>

              <details className="mt-3">
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  Historique
                </summary>
                <div className="mt-2">
                  <History goal={goal} currency={currency} onChange={reload} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier l’objectif" : "Nouvel objectif"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              id="goal-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveGoal();
              }}
            >
              <Field label="Nom" htmlFor="g-name">
                <Input
                  id="g-name"
                  required
                  maxLength={80}
                  placeholder="Ex : Moto"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="h-10"
                />
              </Field>
              <Field label="Montant visé" htmlFor="g-target">
                <MoneyInput
                  id="g-target"
                  required
                  currency={currency}
                  value={draft.target_amount}
                  onChange={(e) => setDraft({ ...draft, target_amount: e.target.value })}
                />
              </Field>
              <Field label="Échéance (facultatif)" htmlFor="g-deadline">
                <Input
                  id="g-deadline"
                  type="date"
                  min={today()}
                  value={draft.deadline}
                  onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
                  className="h-10"
                />
              </Field>
              <Field label="Couleur">
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      onClick={() => setDraft({ ...draft, color })}
                      className={cn(
                        "ring-offset-background size-7 rounded-full ring-offset-2",
                        draft.color === color && "ring-foreground ring-2",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </Field>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="goal-form" disabled={saving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={movement !== null} onOpenChange={(open) => !open && setMovement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movement?.direction === 1 ? "Verser vers" : "Retirer de"} « {movement?.goal.name} »
            </DialogTitle>
          </DialogHeader>
          {movement && (
            <form
              id="movement-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveMovement();
              }}
            >
              <Field label="Montant" htmlFor="m-amount">
                <MoneyInput
                  id="m-amount"
                  required
                  autoFocus
                  currency={currency}
                  value={movement.amount}
                  onChange={(e) => setMovement({ ...movement, amount: e.target.value })}
                />
              </Field>
              <Field label="Note (facultatif)" htmlFor="m-note">
                <Input
                  id="m-note"
                  maxLength={255}
                  value={movement.note}
                  onChange={(e) => setMovement({ ...movement, note: e.target.value })}
                  className="h-10"
                />
              </Field>
              <p className="text-muted-foreground text-xs">
                Astuce : si l’argent épargné quitte un compte, enregistrez aussi un transfert vers
                un compte « Épargne » pour garder vos soldes justes.
              </p>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovement(null)}>
              Annuler
            </Button>
            <Button type="submit" form="movement-form" disabled={saving}>
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
