"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

import { CategoryIcon } from "@/components/CategoryBadge";
import { currencySymbol, NativeSelect, selectClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { formatDate, today } from "@/lib/dates";
import { formatMoney, PAYMENT_METHODS, paymentMethodLabel, parseAmount } from "@/lib/format";
import type {
  Account,
  Category,
  Paginated,
  Transaction,
  TransactionInput,
  TransactionType,
} from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const EMPTY: TransactionInput = {
  type: "expense",
  amount: "",
  date: "",
  description: "",
  category: "",
  account: "",
  source: "",
  payment_method: "cash",
  note: "",
};

const QUICK_CATEGORIES = 6;

/**
 * Add / edit an operation. In `quick` mode (new operation) only the amount and the category
 * are in view; the user's history suggests the usual categories, amount and account.
 */
export function TransactionForm({
  initial,
  currency,
  submitLabel = "Enregistrer",
  quick = false,
  onSubmit,
}: {
  initial?: Partial<TransactionInput>;
  currency: string;
  submitLabel?: string;
  quick?: boolean;
  onSubmit: (data: TransactionInput) => Promise<void>;
}) {
  const [form, setForm] = useState<TransactionInput>(() => ({
    ...EMPTY,
    date: today(),
    ...initial,
  }));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [allCategories, setAllCategories] = useState(!quick);
  const [suggested, setSuggested] = useState(false);
  const [touched, setTouched] = useState<Set<keyof TransactionInput>>(new Set());
  const { data: categories } = useApi<Category[]>("/categories/");
  const { data: accounts } = useApi<Account[]>("/accounts/");
  // Last 50 operations: enough to know the usual categories and amounts.
  const { data: history } = useApi<Paginated<Transaction>>(quick ? "/transactions/" : null);
  const activeAccounts = (accounts ?? []).filter((a) => !a.is_archived || a.id === form.account);
  const recent = history?.results ?? [];

  const available = (categories ?? []).filter((c) => c.type === form.type || c.type === "both");
  const usage = new Map<string, number>();
  for (const tx of recent)
    if (tx.type === form.type) usage.set(tx.category, (usage.get(tx.category) ?? 0) + 1);
  const ranked = [...available].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
  let shown = allCategories ? available : ranked.slice(0, QUICK_CATEGORIES);
  const selected = available.find((c) => c.id === form.category);
  if (selected && !shown.includes(selected))
    shown = [...shown.slice(0, QUICK_CATEGORIES - 1), selected];

  function update<K extends keyof TransactionInput>(key: K, value: TransactionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setTouched((t) => new Set(t).add(key));
    if (key === "amount") setSuggested(false);
  }

  function pickCategory(id: string) {
    setErrors((e) => ({ ...e, category: undefined }));
    const last = quick
      ? recent.find((tx) => tx.category === id && tx.type === form.type)
      : undefined;
    setForm((f) => {
      const next = { ...f, category: id };
      if (!last) return next;
      // Suggest what was used last time for this category, without overriding user input.
      if (!f.amount || suggested) next.amount = String(Number(last.amount));
      if (!touched.has("account")) next.account = last.account;
      if (!touched.has("payment_method")) next.payment_method = last.payment_method;
      return next;
    });
    if (last && (!form.amount || suggested)) setSuggested(true);
  }

  function setType(type: TransactionType) {
    setForm((f) => {
      const current = categories?.find((c) => c.id === f.category);
      const keep = current && (current.type === type || current.type === "both");
      return { ...f, type, category: keep ? f.category : "" };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseAmount(form.amount);
    const local: Record<string, string> = {};
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0)
      local.amount = "Saisissez un montant positif.";
    if (!form.category) local.category = "Choisissez une catégorie.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }

    setSubmitting(true);
    try {
      const { account, ...rest } = form;
      await onSubmit({ ...rest, amount, ...(account ? { account } : {}) });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = Object.fromEntries(
          Object.keys(EMPTY).map((k) => [k, err.fieldError(k)]),
        );
        const hasFieldError = Object.values(fieldErrors).some(Boolean);
        setErrors({ ...fieldErrors, form: hasFieldError ? undefined : err.message });
      } else {
        setErrors({ form: OFFLINE_MESSAGE });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const accountName =
    activeAccounts.find((a) => a.id === form.account)?.name ?? activeAccounts[0]?.name;
  const detailsSummary = [
    form.date === today() ? "Aujourd’hui" : formatDate(form.date),
    paymentMethodLabel(form.payment_method),
    activeAccounts.length > 1 ? accountName : null,
    form.description || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div
        className="bg-muted grid grid-cols-2 gap-2 rounded-xl p-1"
        role="radiogroup"
        aria-label="Type"
      >
        {(
          [
            ["expense", "− Dépense", "bg-expense text-white"],
            ["income", "+ Revenu", "bg-income text-white"],
          ] as const
        ).map(([value, label, active]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={form.type === value}
            onClick={() => setType(value)}
            className={cn(
              "rounded-lg py-2.5 text-sm font-medium transition-colors",
              form.type === value ? active : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1">
        <Label htmlFor="amount" className="sr-only">
          Montant
        </Label>
        <div className="flex items-baseline justify-center gap-2">
          <Input
            id="amount"
            inputMode="decimal"
            autoFocus
            placeholder="0"
            value={form.amount}
            onChange={(e) => update("amount", e.target.value)}
            aria-invalid={!!errors.amount}
            style={{ width: `${Math.max(form.amount.length, 1) + 0.5}ch` }}
            className="h-auto max-w-[75vw] min-w-[3ch] border-0 bg-transparent p-0 text-center text-5xl font-extrabold tracking-tight tabular-nums shadow-none focus-visible:ring-0 md:text-5xl dark:bg-transparent"
          />
          <span className="text-muted-foreground text-xl font-semibold">
            {currencySymbol(currency)}
          </span>
        </div>
        <div className="bg-border h-px w-40" />
        {suggested && (
          <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            <Sparkles className="size-3" /> Montant habituel proposé, modifiable
          </p>
        )}
        {errors.amount && <p className="text-destructive text-sm">{errors.amount}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Catégorie</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickCategory(c.id)}
              aria-pressed={form.category === c.id}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition-colors",
                form.category === c.id
                  ? "border-primary bg-primary/10 ring-primary ring-1"
                  : "hover:bg-muted",
              )}
            >
              <CategoryIcon icon={c.icon} color={c.color} />
              <span className="line-clamp-2 text-center leading-tight">{c.name}</span>
            </button>
          ))}
          {categories === null &&
            Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
        {available.length > QUICK_CATEGORIES && (
          <button
            type="button"
            onClick={() => setAllCategories((v) => !v)}
            className="text-primary self-center text-sm font-medium"
          >
            {allCategories ? "Moins de catégories" : `Toutes les catégories (${available.length})`}
          </button>
        )}
        {errors.category && <p className="text-destructive text-sm">{errors.category}</p>}
      </fieldset>

      <details
        className="group rounded-xl border"
        open={!quick || !!(form.source || form.note || errors.account || errors.date)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm">
          <span className="font-medium">Plus de détails</span>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-xs">
            {detailsSummary}
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-3 border-t px-3 pt-3 pb-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                max={today()}
                onChange={(e) => update("date", e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment_method">Paiement</Label>
              <select
                id="payment_method"
                className={selectClass}
                value={form.payment_method}
                onChange={(e) =>
                  update("payment_method", e.target.value as TransactionInput["payment_method"])
                }
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeAccounts.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="account">Compte</Label>
              <NativeSelect
                id="account"
                value={form.account || activeAccounts[0].id}
                onChange={(e) => update("account", e.target.value)}
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {formatMoney(a.balance, currency)}
                  </option>
                ))}
              </NativeSelect>
              {errors.account && <p className="text-destructive text-sm">{errors.account}</p>}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder={form.type === "expense" ? "Ex : Marché" : "Ex : Salaire d’octobre"}
              value={form.description}
              maxLength={255}
              onChange={(e) => update("description", e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="source">{form.type === "income" ? "Provenance" : "Destination"}</Label>
            <Input
              id="source"
              value={form.source}
              maxLength={255}
              onChange={(e) => update("source", e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Note</Label>
            <textarea
              id="note"
              rows={3}
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
              className={cn(selectClass, "h-auto py-2")}
            />
          </div>
        </div>
      </details>

      {errors.form && <p className="text-destructive text-sm">{errors.form}</p>}

      <Button type="submit" size="lg" className="h-12 text-base" disabled={submitting}>
        {submitting ? "Enregistrement…" : submitLabel}
      </Button>
    </form>
  );
}
