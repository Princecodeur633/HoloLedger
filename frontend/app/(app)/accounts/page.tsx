"use client";

import { ArrowLeftRight, Archive, Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { BalanceCard } from "@/components/BalanceCard";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "@/components/CategoryBadge";
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
import { ACCOUNT_TYPES, accountTypeIcon, formatMoney, parseAmount } from "@/lib/format";
import type { Account, AccountType, Paginated, Transfer } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type AccountDraft = {
  id?: string;
  name: string;
  type: AccountType;
  initial_balance: string;
  color: string;
};

type TransferDraft = {
  from_account: string;
  to_account: string;
  amount: string;
  fee: string;
  date: string;
  note: string;
};

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : OFFLINE_MESSAGE;
}

function AccountsContent() {
  const { user } = useAuth();
  const currency = user?.currency ?? "XAF";
  const params = useSearchParams();
  const { data: accounts, reload: reloadAccounts } = useApi<Account[]>("/accounts/");
  const { data: transfers, reload: reloadTransfers } = useApi<Paginated<Transfer>>("/transfers/");

  const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
  const [transferDraft, setTransferDraft] = useState<TransferDraft | null>(() =>
    params.get("transfer")
      ? {
          from_account: params.get("from") ?? "",
          to_account: "",
          amount: params.get("amount") ?? "",
          fee: params.get("fee") ?? "",
          date: params.get("date") ?? today(),
          note: "Retrait Mobile Money",
        }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = (accounts ?? []).filter((a) => !a.is_archived);
  const archived = (accounts ?? []).filter((a) => a.is_archived);
  const total = active.reduce((sum, a) => sum + Number(a.balance), 0);

  function reload() {
    reloadAccounts();
    reloadTransfers();
  }

  async function saveAccount() {
    if (!accountDraft) return;
    setSaving(true);
    setError(null);
    const { id, ...body } = accountDraft;
    const icon = accountTypeIcon(body.type);
    try {
      await api(id ? `/accounts/${id}/` : "/accounts/", {
        method: id ? "PATCH" : "POST",
        body: { ...body, icon, initial_balance: parseAmount(body.initial_balance) || "0" },
      });
      toast.success(id ? "Compte modifié" : "Compte créé");
      setAccountDraft(null);
      reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveTransfer() {
    if (!transferDraft) return;
    setSaving(true);
    setError(null);
    try {
      await api("/transfers/", {
        method: "POST",
        body: {
          ...transferDraft,
          amount: parseAmount(transferDraft.amount),
          fee: parseAmount(transferDraft.fee) || "0",
        },
      });
      toast.success("Transfert enregistré");
      setTransferDraft(null);
      reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function setArchived(account: Account, is_archived: boolean) {
    try {
      await api(`/accounts/${account.id}/`, { method: "PATCH", body: { is_archived } });
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function removeAccount(account: Account) {
    if (!window.confirm(`Supprimer le compte « ${account.name} » ?`)) return;
    try {
      await api(`/accounts/${account.id}/`, { method: "DELETE" });
      toast.success("Compte supprimé");
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function removeTransfer(transfer: Transfer) {
    if (!window.confirm("Supprimer ce transfert (et ses frais éventuels) ?")) return;
    try {
      await api(`/transfers/${transfer.id}/`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  function openTransfer() {
    setError(null);
    setTransferDraft({
      from_account: active[0]?.id ?? "",
      to_account: active[1]?.id ?? "",
      amount: "",
      fee: "",
      date: today(),
      note: "",
    });
  }

  const accountRow = (account: Account, extra?: React.ReactNode) => {
    const Watermark = CATEGORY_ICONS[accountTypeIcon(account.type)];
    return (
      <li
        key={account.id}
        className="relative isolate flex items-center gap-3 overflow-hidden rounded-xl border p-3"
      >
        {/* Same decorative style as the balance card, tinted with the account color. */}
        <Watermark
          className="pointer-events-none absolute -right-3 -bottom-5 -z-10 size-20 -rotate-6 opacity-[0.12]"
          style={{ color: account.color }}
          strokeWidth={1.25}
          aria-hidden
        />
        <CategoryIcon icon={accountTypeIcon(account.type)} color={account.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account.name}</p>
          <p className="text-muted-foreground text-xs">
            {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label}
          </p>
        </div>
        <span
          className={cn(
            "font-semibold tabular-nums",
            Number(account.balance) < 0 && "text-expense",
          )}
        >
          {formatMoney(account.balance, currency)}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Modifier ${account.name}`}
          onClick={() => {
            setError(null);
            setAccountDraft({
              id: account.id,
              name: account.name,
              type: account.type,
              initial_balance: String(Number(account.initial_balance)),
              color: account.color,
            });
          }}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={account.is_archived ? "Réactiver" : "Archiver"}
          title={account.is_archived ? "Réactiver" : "Archiver"}
          onClick={() => setArchived(account, !account.is_archived)}
        >
          <Archive />
        </Button>
        {extra}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Comptes"
        action={
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              setAccountDraft({
                name: "",
                type: "mobile_money",
                initial_balance: "",
                color: CATEGORY_COLORS[4],
              });
            }}
          >
            <Plus /> Compte
          </Button>
        }
      />

      <BalanceCard balance={String(total)} currency={currency} label="Total de vos comptes" />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Vos comptes</CardTitle>
          {active.length > 1 && (
            <Button size="sm" onClick={openTransfer}>
              <ArrowLeftRight /> Transférer
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {accounts === null ? (
            <ListSkeleton />
          ) : (
            <ul className="flex flex-col gap-2">{active.map((a) => accountRow(a))}</ul>
          )}
          {active.length === 1 && (
            <p className="text-muted-foreground mt-3 text-sm">
              Ajoutez vos comptes Mobile Money ou bancaires pour suivre chaque solde et enregistrer
              les transferts entre eux.
            </p>
          )}
          {archived.length > 0 && (
            <details className="mt-3">
              <summary className="text-muted-foreground cursor-pointer text-sm">
                Comptes archivés ({archived.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-2 opacity-70">
                {archived.map((a) =>
                  accountRow(
                    a,
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Supprimer ${a.name}`}
                      onClick={() => removeAccount(a)}
                    >
                      <Trash2 />
                    </Button>,
                  ),
                )}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transferts récents</CardTitle>
        </CardHeader>
        <CardContent>
          {transfers && transfers.results.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Un transfert déplace de l’argent entre vos comptes (ex. retrait Mobile Money →
              espèces) sans compter comme dépense ni revenu.
            </p>
          )}
          <ul className="divide-y">
            {transfers?.results.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <ArrowLeftRight className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {t.from_account_name} → {t.to_account_name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(t.date)}
                    {Number(t.fee) > 0 && ` · frais ${formatMoney(t.fee, currency)}`}
                    {t.note && ` · ${t.note}`}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">
                  {formatMoney(t.amount, currency)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer le transfert"
                  onClick={() => removeTransfer(t)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={accountDraft !== null} onOpenChange={(open) => !open && setAccountDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{accountDraft?.id ? "Modifier le compte" : "Nouveau compte"}</DialogTitle>
          </DialogHeader>
          {accountDraft && (
            <form
              id="account-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveAccount();
              }}
            >
              <Field label="Nom" htmlFor="acc-name">
                <Input
                  id="acc-name"
                  required
                  maxLength={60}
                  placeholder="Ex : MTN MoMo"
                  value={accountDraft.name}
                  onChange={(e) => setAccountDraft({ ...accountDraft, name: e.target.value })}
                  className="h-10"
                />
              </Field>
              <Field label="Type" htmlFor="acc-type">
                <NativeSelect
                  id="acc-type"
                  value={accountDraft.type}
                  onChange={(e) =>
                    setAccountDraft({ ...accountDraft, type: e.target.value as AccountType })
                  }
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                label="Solde de départ"
                htmlFor="acc-initial"
                hint="L’argent présent sur ce compte avant votre première opération."
              >
                <MoneyInput
                  id="acc-initial"
                  currency={currency}
                  value={accountDraft.initial_balance}
                  onChange={(e) =>
                    setAccountDraft({ ...accountDraft, initial_balance: e.target.value })
                  }
                />
              </Field>
              <Field label="Couleur">
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      onClick={() => setAccountDraft({ ...accountDraft, color })}
                      className={cn(
                        "ring-offset-background size-7 rounded-full ring-offset-2",
                        accountDraft.color === color && "ring-foreground ring-2",
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
            <Button variant="outline" onClick={() => setAccountDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="account-form" disabled={saving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferDraft !== null}
        onOpenChange={(open) => !open && setTransferDraft(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfert entre comptes</DialogTitle>
          </DialogHeader>
          {transferDraft && (
            <form
              id="transfer-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveTransfer();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="De" htmlFor="tr-from">
                  <NativeSelect
                    id="tr-from"
                    required
                    value={transferDraft.from_account}
                    onChange={(e) =>
                      setTransferDraft({ ...transferDraft, from_account: e.target.value })
                    }
                  >
                    <option value="">Choisir…</option>
                    {active.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Vers" htmlFor="tr-to">
                  <NativeSelect
                    id="tr-to"
                    required
                    value={transferDraft.to_account}
                    onChange={(e) =>
                      setTransferDraft({ ...transferDraft, to_account: e.target.value })
                    }
                  >
                    <option value="">Choisir…</option>
                    {active.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Montant" htmlFor="tr-amount">
                  <MoneyInput
                    id="tr-amount"
                    required
                    currency={currency}
                    value={transferDraft.amount}
                    onChange={(e) => setTransferDraft({ ...transferDraft, amount: e.target.value })}
                  />
                </Field>
                <Field label="Frais (facultatif)" htmlFor="tr-fee">
                  <MoneyInput
                    id="tr-fee"
                    currency={currency}
                    value={transferDraft.fee}
                    onChange={(e) => setTransferDraft({ ...transferDraft, fee: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Date" htmlFor="tr-date">
                <Input
                  id="tr-date"
                  type="date"
                  max={today()}
                  value={transferDraft.date}
                  onChange={(e) => setTransferDraft({ ...transferDraft, date: e.target.value })}
                  className="h-10"
                />
              </Field>
              <Field label="Note" htmlFor="tr-note">
                <Input
                  id="tr-note"
                  maxLength={255}
                  value={transferDraft.note}
                  onChange={(e) => setTransferDraft({ ...transferDraft, note: e.target.value })}
                  className="h-10"
                />
              </Field>
              <p className="text-muted-foreground text-xs">
                Les frais sont enregistrés comme une dépense « Frais » sur le compte de départ.
              </p>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="transfer-form" disabled={saving}>
              Transférer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsContent />
    </Suspense>
  );
}
