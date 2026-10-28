"use client";

import { ChevronLeft, MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { SmsParser } from "@/components/SmsParser";
import { TransactionForm } from "@/components/TransactionForm";
import { Button } from "@/components/ui/button";
import { api, NetworkError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { enqueue } from "@/lib/outbox";
import type { Transaction, TransactionInput } from "@/lib/types";

export default function NewTransactionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const currency = user?.currency ?? "XAF";
  const [showSms, setShowSms] = useState(false);
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

      {showSms ? (
        <div className="mb-5">
          <SmsParser
            onParsed={(values) => {
              setPrefill((p) => ({ key: p.key + 1, values }));
              setShowSms(false);
            }}
            onCancel={() => setShowSms(false)}
          />
        </div>
      ) : (
        <Button variant="outline" className="mb-5 w-full" onClick={() => setShowSms(true)}>
          <MessageSquareText /> Remplir depuis un SMS Mobile Money
        </Button>
      )}

      <TransactionForm
        key={prefill.key}
        initial={prefill.values}
        currency={currency}
        quick
        onSubmit={save}
      />
    </div>
  );
}
