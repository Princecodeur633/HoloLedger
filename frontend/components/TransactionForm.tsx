"use client";

import { useState } from "react";

import { CategoryIcon } from "@/components/CategoryBadge";
import { currencySymbol, NativeSelect, selectClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { today } from "@/lib/dates";
import { PAYMENT_METHODS, parseAmount } from "@/lib/format";
import type { Account, Category, TransactionInput, TransactionType } from "@/lib/types";
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

export function TransactionForm({
  initial,
  currency,
  submitLabel = "Enregistrer",
  onSubmit,
}: {
  initial?: Partial<TransactionInput>;
  currency: string;
  submitLabel?: string;
  onSubmit: (data: TransactionInput) => Promise<void>;
}) {
  const [form, setForm] = useState<TransactionInput>(() => ({
    ...EMPTY,
    date: today(),
    ...initial,
  }));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const { data: categories } = useApi<Category[]>("/categories/");
  const { data: accounts } = useApi<Account[]>("/accounts/");
  const activeAccounts = (accounts ?? []).filter((a) => !a.is_archived || a.id === form.account);

  const available = (categories ?? []).filter((c) => c.type === form.type || c.type === "both");

  function update<K extends keyof TransactionInput>(key: K, value: TransactionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
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
        setErrors({ form: "Impossible de contacter le serveur." });
      }
    } finally {
      setSubmitting(false);
    }
  }

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

      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Montant</Label>
        <div className="relative">
          <Input
            id="amount"
            inputMode="decimal"
            autoFocus
            placeholder="0"
            value={form.amount}
            onChange={(e) => update("amount", e.target.value)}
            aria-invalid={!!errors.amount}
            className="h-14 pr-16 text-2xl font-semibold tabular-nums md:text-2xl"
          />
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
            {currencySymbol(currency)}
          </span>
        </div>
        {errors.amount && <p className="text-destructive text-sm">{errors.amount}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Catégorie</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {available.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => update("category", c.id)}
              aria-pressed={form.category === c.id}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition-colors",
                form.category === c.id
                  ? "border-primary bg-primary/5 ring-primary ring-1"
                  : "hover:bg-muted",
              )}
            >
              <CategoryIcon icon={c.icon} color={c.color} />
              <span className="line-clamp-2 text-center leading-tight">{c.name}</span>
            </button>
          ))}
          {categories === null && (
            <p className="text-muted-foreground col-span-3 text-sm">Chargement…</p>
          )}
        </div>
        {errors.category && <p className="text-destructive text-sm">{errors.category}</p>}
      </fieldset>

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
          <Label htmlFor="payment_method">Moyen de paiement</Label>
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
                {a.name}
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

      <details className="group rounded-lg border px-3 py-2" open={!!(form.source || form.note)}>
        <summary className="text-muted-foreground cursor-pointer text-sm">Plus de détails</summary>
        <div className="mt-3 flex flex-col gap-3 pb-1">
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
