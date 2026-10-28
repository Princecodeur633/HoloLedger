"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { Field, NativeSelect } from "@/components/form";
import { SmsParser } from "@/components/SmsParser";
import { TransactionForm } from "@/components/TransactionForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatSigned } from "@/lib/format";
import type {
  Account,
  Category,
  ImportMapping,
  ImportPreview,
  ImportRole,
  ImportRow,
  TransactionInput,
} from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const ROLES: { role: ImportRole; label: string }[] = [
  { role: "date", label: "Date" },
  { role: "description", label: "Libellé" },
  { role: "amount", label: "Montant (± signé)" },
  { role: "debit", label: "Débit (sorties)" },
  { role: "credit", label: "Crédit (entrées)" },
];

type Override = { skip?: boolean; category?: string };

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : OFFLINE_MESSAGE;
}

function StatementImport() {
  const { user } = useAuth();
  const router = useRouter();
  const currency = user?.currency ?? "XAF";
  const { data: accounts } = useApi<Account[]>("/accounts/");
  const { data: categories } = useApi<Category[]>("/categories/");

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [account, setAccount] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAccounts = (accounts ?? []).filter((a) => !a.is_archived);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setRows(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await api<ImportPreview>("/imports/preview/", { method: "POST", body });
      setPreview(res);
      setMapping(res.mapping);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function commitBody(dryRun: boolean) {
    return {
      mapping,
      rows: preview!.rows,
      overrides,
      dry_run: dryRun,
      ...(account ? { account } : {}),
    };
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ rows: ImportRow[] }>("/imports/commit/", {
        method: "POST",
        body: commitBody(true),
      });
      setRows(res.rows);
      setOverrides({});
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ created: number; skipped: number }>("/imports/commit/", {
        method: "POST",
        body: commitBody(false),
      });
      toast.success(`${res.created} opération(s) importée(s), ${res.skipped} ignorée(s).`);
      router.push("/transactions");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function setRole(role: ImportRole, value: string) {
    const next = { ...mapping };
    if (value === "") delete next[role];
    else next[role] = Number(value);
    // A signed amount column and debit/credit columns are mutually exclusive.
    if (role === "amount" && value !== "") {
      delete next.debit;
      delete next.credit;
    }
    if ((role === "debit" || role === "credit") && value !== "") delete next.amount;
    setMapping(next);
    setRows(null);
  }

  const isSkipped = (row: ImportRow) => overrides[row.index]?.skip ?? row.skip;
  const selected = rows?.filter((r) => !isSkipped(r)).length ?? 0;

  if (!preview) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
          <FileSpreadsheet className="text-muted-foreground size-10" />
          <div>
            <p className="font-medium">Importez le relevé exporté par votre banque</p>
            <p className="text-muted-foreground text-sm">
              Fichier CSV ou Excel (.xlsx), 5 Mo maximum. Les relevés PDF ne sont pas pris en
              charge.
            </p>
          </div>
          <label className="bg-primary text-primary-foreground hover:bg-primary/85 inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium">
            <Upload className="size-4" />
            {busy ? "Lecture…" : "Choisir un fichier"}
            <input
              type="file"
              accept=".csv,.txt,.xlsx"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = "";
              }}
            />
          </label>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>1. Colonnes du fichier</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
            Changer de fichier
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {preview.rows.length} lignes lues. Vérifiez à quelle colonne correspond chaque
            information. Utilisez soit « Montant », soit « Débit » et « Crédit ».
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ROLES.map(({ role, label }) => (
              <Field key={role} label={label} htmlFor={`map-${role}`}>
                <NativeSelect
                  id={`map-${role}`}
                  value={mapping[role] ?? ""}
                  onChange={(e) => setRole(role, e.target.value)}
                >
                  <option value="">—</option>
                  {preview.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ))}
            <Field label="Compte" htmlFor="imp-account">
              <NativeSelect
                id="imp-account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">Compte par défaut</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-t">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1.5 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            className="self-start"
            onClick={analyze}
            disabled={busy || mapping.date === undefined}
          >
            {busy && !rows ? "Analyse…" : "2. Analyser les lignes"}
          </Button>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>

      {rows && (
        <Card>
          <CardHeader>
            <CardTitle>3. Vérifier et importer</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Les doublons (déjà présents) et les lignes illisibles sont décochés. Ajustez les
              catégories proposées si besoin.
            </p>
            <ul className="divide-y">
              {rows.map((row) => {
                const skipped = isSkipped(row);
                const category = overrides[row.index]?.category ?? row.category ?? "";
                return (
                  <li
                    key={row.index}
                    className={cn(
                      "flex flex-wrap items-center gap-2 py-2 text-sm",
                      skipped && "opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      aria-label="Importer cette ligne"
                      className="accent-primary size-4"
                      checked={!skipped}
                      disabled={!!row.error}
                      onChange={(e) =>
                        setOverrides((o) => ({
                          ...o,
                          [row.index]: { ...o[row.index], skip: !e.target.checked },
                        }))
                      }
                    />
                    {row.error ? (
                      <span className="text-destructive flex-1 text-xs">
                        Ligne {row.index + 1} : {row.error}
                      </span>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{row.description || "(sans libellé)"}</p>
                          <p className="text-muted-foreground text-xs">
                            {row.date && formatDate(row.date)}
                            {row.duplicate && " · déjà enregistrée ?"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            row.type === "income" && "text-income",
                          )}
                        >
                          {formatSigned(row.amount!, row.type!, currency)}
                        </span>
                        <NativeSelect
                          aria-label="Catégorie"
                          className="h-8 w-full sm:w-44"
                          value={category}
                          onChange={(e) =>
                            setOverrides((o) => ({
                              ...o,
                              [row.index]: { ...o[row.index], category: e.target.value },
                            }))
                          }
                        >
                          {(categories ?? [])
                            .filter((c) => c.type === row.type || c.type === "both")
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </NativeSelect>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <Button onClick={commit} disabled={busy || selected === 0}>
              {busy ? "Import…" : `Importer ${selected} opération${selected > 1 ? "s" : ""}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SmsImport() {
  const { user } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState<{ key: number; data: Partial<TransactionInput> } | null>(
    null,
  );

  if (values) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vérifiez puis enregistrez</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm
            key={values.key}
            initial={values.data}
            currency={user?.currency ?? "XAF"}
            onSubmit={async (data) => {
              await api("/transactions/", { method: "POST", body: data });
              toast.success("Opération enregistrée");
              router.push("/dashboard");
            }}
          />
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setValues(null)}>
            Analyser un autre SMS
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Copiez le SMS de confirmation reçu de MTN MoMo ou Orange Money : le montant, le tiers, la
        date et les frais sont lus automatiquement.
      </p>
      <SmsParser onParsed={(data) => setValues({ key: Date.now(), data })} />
    </div>
  );
}

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Importer" />
      <Tabs defaultValue="statement">
        <TabsList className="w-full">
          <TabsTrigger value="statement">Relevé bancaire</TabsTrigger>
          <TabsTrigger value="sms">SMS Mobile Money</TabsTrigger>
        </TabsList>
        <TabsContent value="statement" className="mt-3">
          <StatementImport />
        </TabsContent>
        <TabsContent value="sms" className="mt-3">
          <SmsImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
