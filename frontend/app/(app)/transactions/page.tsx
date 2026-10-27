"use client";

import { CloudOff, FileDown, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { NativeSelect } from "@/components/form";
import { PeriodSelector } from "@/components/PeriodSelector";
import { TransactionList } from "@/components/TransactionList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { download } from "@/lib/api";
import { today } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import type { Account, Paginated, Period, Transaction, TransactionType } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const TYPES: { value: TransactionType | ""; label: string }[] = [
  { value: "", label: "Toutes" },
  { value: "expense", label: "Dépenses" },
  { value: "income", label: "Revenus" },
];

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [type, setType] = useState<TransactionType | "">("");
  const [allTime, setAllTime] = useState(true);
  const [range, setRange] = useState<{ period: Period; date: string }>({
    period: "month",
    date: today(),
  });
  const [account, setAccount] = useState("");
  const [page, setPage] = useState(1);
  const pending = useOutbox();
  const { data: accounts } = useApi<Account[]>("/accounts/");

  const filters = {
    search: deferredSearch,
    type,
    account,
    ...(allTime ? {} : range),
  };
  const { data, loading, error } = useApi<Paginated<Transaction>>("/transactions/", {
    ...filters,
    page,
  });

  async function exportCsv() {
    try {
      await download("/transactions/export/", filters, "operations.csv");
    } catch {
      toast.error("Export impossible.");
    }
  }

  const resetPage = () => setPage(1);

  const pageTotal = (data?.results ?? []).reduce(
    (acc, tx) => acc + (tx.type === "income" ? 1 : -1) * Number(tx.amount),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Historique"
        action={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.count}>
            <FileDown /> Exporter CSV
          </Button>
        }
      />

      {pending.length > 0 && (
        <div className="rounded-xl border border-dashed p-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium">
            <CloudOff className="size-4" /> En attente d’envoi
          </p>
          <ul className="text-muted-foreground text-xs">
            {pending.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Rechercher (description, catégorie, montant)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          className="h-10 pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setType(t.value);
              resetPage();
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              type === t.value
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
        {(accounts?.length ?? 0) > 1 && (
          <NativeSelect
            aria-label="Compte"
            className="h-8 w-auto"
            value={account}
            onChange={(e) => {
              setAccount(e.target.value);
              resetPage();
            }}
          >
            <option value="">Tous les comptes</option>
            {accounts!.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <label className="text-muted-foreground ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!allTime}
            onChange={(e) => {
              setAllTime(!e.target.checked);
              resetPage();
            }}
            className="accent-primary size-4"
          />
          Filtrer par période
        </label>
      </div>

      {!allTime && (
        <PeriodSelector
          period={range.period}
          date={range.date}
          onChange={(v) => {
            setRange(v);
            resetPage();
          }}
        />
      )}

      {error && <p className="text-destructive text-sm">{error.message}</p>}

      {data && (
        <p className="text-muted-foreground text-sm">
          {data.count} opération{data.count > 1 ? "s" : ""}
          {data.results.length > 0 && (
            <>
              {" "}
              · net affiché :{" "}
              <span className={cn("font-medium", pageTotal >= 0 ? "text-income" : "text-expense")}>
                {pageTotal > 0 ? "+" : ""}
                {formatMoney(pageTotal, data.results[0].currency)}
              </span>
            </>
          )}
        </p>
      )}

      <div className={cn(loading && "opacity-60 transition-opacity")}>
        {data ? (
          <TransactionList transactions={data.results} />
        ) : (
          !error && <p className="text-muted-foreground text-sm">Chargement…</p>
        )}
      </div>

      {data && (data.next || data.previous) && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" disabled={!data.previous} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </Button>
          <span className="text-muted-foreground text-sm">Page {page}</span>
          <Button variant="outline" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}
