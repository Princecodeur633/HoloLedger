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
import { ListSkeleton } from "@/components/ui/skeleton";
import { download } from "@/lib/api";
import { today } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import type {
  Account,
  Category,
  Paginated,
  Period,
  Transaction,
  TransactionType,
} from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const TYPES: { value: TransactionType | ""; label: string }[] = [
  { value: "", label: "Toutes" },
  { value: "expense", label: "Dépenses" },
  { value: "income", label: "Revenus" },
];

type When = "all" | "month" | "custom";

const WHEN: { value: When; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Autre période" },
];

const chip = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1 text-sm transition-colors",
    active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground",
  );

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [type, setType] = useState<TransactionType | "">("");
  const [when, setWhen] = useState<When>("all");
  const [category, setCategory] = useState("");
  const [range, setRange] = useState<{ period: Period; date: string }>({
    period: "month",
    date: today(),
  });
  const [account, setAccount] = useState("");
  const [page, setPage] = useState(1);
  const pending = useOutbox();
  const { data: accounts } = useApi<Account[]>("/accounts/");
  const { data: categories } = useApi<Category[]>("/categories/");

  const filters = {
    search: deferredSearch,
    type,
    account,
    category,
    ...(when === "month" ? { period: "month", date: today() } : {}),
    ...(when === "custom" ? range : {}),
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
          placeholder="Rechercher une opération, un montant…"
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
              setCategory("");
              resetPage();
            }}
            className={chip(type === t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="-mt-1 flex flex-wrap items-center gap-2">
        {WHEN.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => {
              setWhen(w.value);
              resetPage();
            }}
            className={chip(when === w.value)}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-2", (accounts?.length ?? 0) > 1 && "grid-cols-2")}>
        <NativeSelect
          aria-label="Catégorie"
          className="h-9"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            resetPage();
          }}
        >
          <option value="">Toutes les catégories</option>
          {(categories ?? [])
            .filter((c) => !type || c.type === type || c.type === "both")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </NativeSelect>
        {(accounts?.length ?? 0) > 1 && (
          <NativeSelect
            aria-label="Compte"
            className="h-9"
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
      </div>

      {when === "custom" && (
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
        {data ? <TransactionList transactions={data.results} /> : !error && <ListSkeleton />}
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
