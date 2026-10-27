import type { AccountType, PaymentMethod, TransactionType } from "./types";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: string | number, currency = "XAF"): string {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(Number(value));
}

export function formatSigned(value: string | number, type: TransactionType, currency?: string) {
  return `${type === "income" ? "+" : "−"}${formatMoney(value, currency)}`;
}

/** Compact amounts for chart axes: 1,2 M / 450 k. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

/** Accepts "15 000", "15000,50" or "15.000" as typed on a phone keyboard. */
export function parseAmount(input: string): string {
  return input.replace(/[\s  ]/g, "").replace(",", ".");
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Carte" },
  { value: "transfer", label: "Virement" },
  { value: "other", label: "Autre" },
];

export function paymentMethodLabel(value: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

export const CURRENCIES = [
  { value: "XAF", label: "Franc CFA (BEAC) — FCFA" },
  { value: "XOF", label: "Franc CFA (BCEAO) — F CFA" },
  { value: "EUR", label: "Euro — €" },
  { value: "USD", label: "Dollar US — $" },
];

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: "cash", label: "Espèces", icon: "wallet" },
  { value: "mobile_money", label: "Mobile Money", icon: "smartphone" },
  { value: "bank", label: "Banque", icon: "landmark" },
  { value: "savings", label: "Épargne", icon: "piggy-bank" },
  { value: "other", label: "Autre", icon: "coins" },
];

export function accountTypeIcon(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.icon ?? "wallet";
}
