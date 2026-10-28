"use client";

import { Pencil, Plus, SkipForward, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { CategoryIcon } from "@/components/CategoryBadge";
import { Field, MoneyInput, NativeSelect } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/lib/auth";
import { formatDate, today } from "@/lib/dates";
import { formatSigned, PAYMENT_METHODS, parseAmount } from "@/lib/format";
import type {
  Account,
  Category,
  Frequency,
  PaymentMethod,
  RecurringRule,
  TransactionType,
} from "@/lib/types";
import { FREQUENCIES, lastOccurrence, scheduleLabel, scheduleSummary } from "@/lib/recurrence";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type EndMode = "never" | "date" | "count";

const END_MODES: { value: EndMode; label: string }[] = [
  { value: "never", label: "Jamais" },
  { value: "date", label: "À une date" },
  { value: "count", label: "Après N fois" },
];

type Draft = {
  id?: string;
  type: TransactionType;
  amount: string;
  category: string;
  account: string;
  description: string;
  payment_method: PaymentMethod;
  frequency: Frequency;
  interval: string;
  start_date: string;
  end_mode: EndMode;
  end_date: string;
  count: string;
  auto_confirm: boolean;
  is_active: boolean;
};

/** End date sent to the API for the chosen "Se termine" option. */
function draftEndDate(d: Draft): string | null {
  if (d.end_mode === "date") return d.end_date || null;
  if (d.end_mode === "count" && Number(d.count) >= 1 && d.start_date)
    return lastOccurrence(d.start_date, d.frequency, Number(d.interval) || 1, Number(d.count));
  return null;
}

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : OFFLINE_MESSAGE;
}

function PendingItem({
  rule,
  currency,
  onDone,
}: {
  rule: RecurringRule;
  currency: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(Number(rule.amount)));
  const [busy, setBusy] = useState(false);

  async function act(action: "confirm" | "skip") {
    setBusy(true);
    try {
      await api(`/recurring/${rule.id}/${action}/`, {
        method: "POST",
        body: action === "confirm" ? { amount: parseAmount(amount) } : {},
      });
      toast.success(
        action === "confirm"
          ? "Opération enregistrée"
          : "Échéance annulée : rien n’a été enregistré",
      );
      onDone();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={rule.category_detail.icon} color={rule.category_detail.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{rule.description || rule.category_detail.name}</p>
          <p className="text-muted-foreground text-xs">
            Prévu le {rule.next_date && formatDate(rule.next_date)} · {rule.account_name}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Montant réel (modifiable s’il est différent) :
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <MoneyInput
            aria-label="Montant réel"
            currency={currency}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Button onClick={() => act("confirm")} disabled={busy}>
          Confirmer
        </Button>
        <Button
          variant="ghost"
          onClick={() => act("skip")}
          disabled={busy}
          title="Je n’ai pas fait cette opération ce jour-là"
        >
          Pas fait
        </Button>
      </div>
    </li>
  );
}

export default function RecurringPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? "XAF";
  const { data: rules, reload: reloadRules } = useApi<RecurringRule[]>("/recurring/");
  const { data: pending, reload: reloadPending } = useApi<{
    created_count: number;
    pending: RecurringRule[];
  }>("/recurring/pending/");
  const { data: categories } = useApi<Category[]>("/categories/");
  const { data: accounts } = useApi<Account[]>("/accounts/");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reload() {
    reloadRules();
    reloadPending();
  }

  const available = (categories ?? []).filter(
    (c) => draft && (c.type === draft.type || c.type === "both"),
  );
  const activeAccounts = (accounts ?? []).filter((a) => !a.is_archived);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    // end_mode / count are form-only: the API ignores unknown fields and gets end_date instead.
    const { id, ...body } = draft;
    try {
      await api(id ? `/recurring/${id}/` : "/recurring/", {
        method: id ? "PATCH" : "POST",
        body: {
          ...body,
          amount: parseAmount(body.amount),
          interval: Number(body.interval) || 1,
          end_date: draftEndDate(draft),
          ...(body.account ? {} : { account: undefined }),
        },
      });
      toast.success(id ? "Opération récurrente modifiée" : "Opération récurrente créée");
      setDraft(null);
      reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function skipNext(rule: RecurringRule) {
    if (!rule.next_date) return;
    const day = formatDate(rule.next_date);
    if (!window.confirm(`Annuler l’échéance du ${day} ? Rien ne sera enregistré ce jour-là.`))
      return;
    try {
      await api(`/recurring/${rule.id}/skip/`, { method: "POST" });
      toast.success(`Échéance du ${day} annulée`);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function remove(rule: RecurringRule) {
    if (
      !window.confirm("Supprimer cette opération récurrente ? Les opérations déjà créées restent.")
    )
      return;
    try {
      await api(`/recurring/${rule.id}/`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  function openNew() {
    setError(null);
    setDraft({
      type: "expense",
      amount: "",
      category: "",
      account: activeAccounts[0]?.id ?? "",
      description: "",
      payment_method: "cash",
      frequency: "monthly",
      interval: "1",
      start_date: today(),
      end_mode: "never",
      end_date: "",
      count: "",
      auto_confirm: false,
      is_active: true,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Récurrentes"
        action={
          <Button variant="outline" onClick={openNew}>
            <Plus /> Ajouter
          </Button>
        }
      />

      {pending && pending.pending.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle>À confirmer ({pending.pending.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Vérifiez le montant réel puis confirmez, ou ignorez cette échéance.
            </p>
            <ul className="divide-y">
              {pending.pending.map((rule) => (
                <PendingItem
                  key={rule.id + rule.next_date}
                  rule={rule}
                  currency={currency}
                  onDone={reload}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {rules === null && <ListSkeleton />}
      {rules?.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Enregistrez une fois vos opérations régulières (loyer, salaire, abonnements) : elles
          seront proposées à chaque échéance.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rules?.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "bg-card flex items-center gap-3 rounded-xl border p-3",
              !rule.is_active && "opacity-60",
            )}
          >
            <CategoryIcon icon={rule.category_detail.icon} color={rule.category_detail.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {rule.description || rule.category_detail.name}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {scheduleLabel(rule)}
                {" · "}
                {rule.next_date ? `prochaine le ${formatDate(rule.next_date)}` : "terminée"}
                {rule.auto_confirm && " · automatique"}
                {!rule.is_active && " · en pause"}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                rule.type === "income" && "text-income",
              )}
            >
              {formatSigned(rule.amount, rule.type, currency)}
            </span>
            {rule.next_date && rule.is_active && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Annuler la prochaine échéance"
                title="Annuler la prochaine échéance (pas faite)"
                onClick={() => skipNext(rule)}
              >
                <SkipForward />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Modifier"
              onClick={() => {
                setError(null);
                setDraft({
                  id: rule.id,
                  type: rule.type,
                  amount: String(Number(rule.amount)),
                  category: rule.category,
                  account: rule.account,
                  description: rule.description,
                  payment_method: rule.payment_method,
                  frequency: rule.frequency,
                  interval: String(rule.interval),
                  start_date: rule.start_date,
                  end_mode: rule.end_date ? "date" : "never",
                  end_date: rule.end_date ?? "",
                  count: "",
                  auto_confirm: rule.auto_confirm,
                  is_active: rule.is_active,
                });
              }}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Supprimer"
              onClick={() => remove(rule)}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Modifier l’opération récurrente" : "Nouvelle opération récurrente"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              id="recurring-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
                {(["expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraft({ ...draft, type: t, category: "" })}
                    className={cn(
                      "rounded-md py-1.5 text-sm",
                      draft.type === t
                        ? "bg-background font-medium shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    {t === "expense" ? "Dépense" : "Revenu"}
                  </button>
                ))}
              </div>
              <Field label="Description" htmlFor="r-desc">
                <Input
                  id="r-desc"
                  maxLength={255}
                  placeholder={draft.type === "expense" ? "Ex : Loyer" : "Ex : Salaire"}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="h-10"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Montant" htmlFor="r-amount">
                  <MoneyInput
                    id="r-amount"
                    required
                    currency={currency}
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  />
                </Field>
                <Field label="Catégorie" htmlFor="r-cat">
                  <NativeSelect
                    id="r-cat"
                    required
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  >
                    <option value="">Choisir…</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Compte" htmlFor="r-account">
                  <NativeSelect
                    id="r-account"
                    value={draft.account}
                    onChange={(e) => setDraft({ ...draft, account: e.target.value })}
                  >
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Paiement" htmlFor="r-pm">
                  <NativeSelect
                    id="r-pm"
                    value={draft.payment_method}
                    onChange={(e) =>
                      setDraft({ ...draft, payment_method: e.target.value as PaymentMethod })
                    }
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Répéter tous les" htmlFor="r-interval">
                <div className="flex gap-2">
                  <Input
                    id="r-interval"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={52}
                    value={draft.interval}
                    onChange={(e) => setDraft({ ...draft, interval: e.target.value })}
                    className="h-10 w-20"
                  />
                  <NativeSelect
                    aria-label="Unité"
                    value={draft.frequency}
                    onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Frequency })}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {Number(draft.interval) > 1 ? f.many : f.one}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </Field>
              <Field label="Première échéance" htmlFor="r-start">
                <Input
                  id="r-start"
                  type="date"
                  required
                  value={draft.start_date}
                  onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                  className="h-10"
                />
              </Field>
              <Field label="Se termine">
                <div className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
                  {END_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setDraft({ ...draft, end_mode: m.value })}
                      className={cn(
                        "rounded-md py-1.5 text-sm",
                        draft.end_mode === m.value
                          ? "bg-background font-medium shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {draft.end_mode === "date" && (
                  <Input
                    aria-label="Date de fin"
                    type="date"
                    required
                    min={draft.start_date}
                    value={draft.end_date}
                    onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                    className="h-10"
                  />
                )}
                {draft.end_mode === "count" && (
                  <div className="flex items-center gap-2 text-sm">
                    <Input
                      aria-label="Nombre de fois"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1000}
                      required
                      placeholder="Ex : 30"
                      value={draft.count}
                      onChange={(e) => setDraft({ ...draft, count: e.target.value })}
                      className="h-10 w-24"
                    />
                    fois
                  </div>
                )}
              </Field>
              <p className="bg-muted rounded-lg px-3 py-2 text-sm">
                {scheduleSummary(
                  draft.frequency,
                  Number(draft.interval) || 1,
                  draft.start_date,
                  draftEndDate(draft),
                )}
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 size-4"
                  checked={draft.auto_confirm}
                  onChange={(e) => setDraft({ ...draft, auto_confirm: e.target.checked })}
                />
                <span>
                  Créer automatiquement à l’échéance
                  <span className="text-muted-foreground block text-xs">
                    Sinon, l’opération vous est proposée « à confirmer » (utile si le montant
                    varie).
                  </span>
                </span>
              </label>
              {draft.id && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={draft.is_active}
                    onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  />
                  Active
                </label>
              )}
              {error && <p className="text-destructive text-sm">{error}</p>}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="recurring-form" disabled={saving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pending && pending.created_count > 0 && (
        <p className="text-muted-foreground text-xs">
          {pending.created_count} opération(s) automatique(s) viennent d’être créées.
        </p>
      )}
    </div>
  );
}
