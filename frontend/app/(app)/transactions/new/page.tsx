"use client";

import { ChevronLeft, FileSpreadsheet, MessageSquareText, PenLine } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { SmsParser } from "@/components/SmsParser";
import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { StatementImport } from "@/components/StatementImport";
import { TransactionForm } from "@/components/TransactionForm";
import { Button } from "@/components/ui/button";
import { api, NetworkError } from "@/lib/api";
import { useCurrency } from "@/lib/space";
import { formatMoney } from "@/lib/format";
import { enqueue } from "@/lib/outbox";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionInput } from "@/lib/types";

type Mode = "manual" | "sms" | "statement";

const MODES: { value: Mode; label: string; icon: typeof PenLine }[] = [
  { value: "manual", label: "Saisir", icon: PenLine },
  { value: "sms", label: "SMS", icon: MessageSquareText },
  { value: "statement", label: "Relevé", icon: FileSpreadsheet },
];

function NewTransaction() {
  const router = useRouter();

  const currency = useCurrency();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    params.get("tab") === "releve" ? "statement" : params.get("tab") === "sms" ? "sms" : "manual",
  );
  // Changing the key remounts the form with the values read from an SMS.
  const [prefill, setPrefill] = useState<{ key: number; values?: Partial<TransactionInput> }>({
    key: 0,
  });

  async function save(data: TransactionInput) {
    try {
      const tx = await api<Transaction>("/transactions/", { method: "POST", body: data });
      navigator.vibrate?.(20);
      toast.success(tx.type === "income" ? "Revenu enregistré" : "Dépense enregistrée");
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err;
      const label = `${data.type === "income" ? "Revenu" : "Dépense"} de ${formatMoney(data.amount, currency)}`;
      enqueue("/transactions/", data, label);
      toast.info("Hors ligne : l’opération sera envoyée dès le retour de la connexion.");
    }
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Nouvelle opération"
        action={
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft /> Retour
          </Button>
        }
      />

      {/* Where this operation goes: visible, and changeable in one tap. */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Dans</span>
        <SpaceSwitcher />
      </div>

      {/* Three ways to add: type it, paste a Mobile Money SMS, or import a statement. */}
      <div role="tablist" className="bg-muted mb-5 grid grid-cols-3 gap-1 rounded-lg p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm",
              mode === m.value ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            <m.icon className="size-4" /> {m.label}
          </button>
        ))}
      </div>

      {mode === "sms" && (
        <SmsParser
          onParsed={(values) => {
            setPrefill((p) => ({ key: p.key + 1, values }));
            setMode("manual");
          }}
          onCancel={() => setMode("manual")}
        />
      )}
      {mode === "statement" && <StatementImport />}
      {mode === "manual" && (
        <TransactionForm
          key={prefill.key}
          initial={prefill.values}
          currency={currency}
          quick
          onSubmit={save}
        />
      )}
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense>
      <NewTransaction />
    </Suspense>
  );
}
