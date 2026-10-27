"use client";

import Link from "next/link";
import { useState } from "react";

import { Textarea } from "@/components/form";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, ApiError, buildQuery } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { SmsParse, TransactionInput } from "@/lib/types";

const KIND_LABELS = {
  income: "Revenu",
  expense: "Dépense",
  withdrawal: "Retrait (transfert vers vos espèces)",
};

/** Paste a Mobile Money SMS; hands back pre-filled transaction values. */
export function SmsParser({
  onParsed,
  onCancel,
}: {
  onParsed: (values: Partial<TransactionInput>) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SmsParse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function analyze() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api<SmsParse>("/imports/sms/", { method: "POST", body: { text } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analyse impossible hors ligne.");
    } finally {
      setBusy(false);
    }
  }

  function use(parsed: SmsParse) {
    if (parsed.kind !== "income" && parsed.kind !== "expense") return;
    const parts = [
      parsed.reference && `Réf. ${parsed.reference}`,
      parsed.fee && Number(parsed.fee) > 0 && `Frais ${formatMoney(parsed.fee)}`,
    ];
    onParsed({
      type: parsed.kind,
      amount: String(Number(parsed.amount)),
      ...(parsed.date ? { date: parsed.date } : {}),
      description: parsed.counterparty ?? "",
      category: parsed.suggested_category ?? "",
      ...(parsed.suggested_account ? { account: parsed.suggested_account } : {}),
      payment_method: "mobile_money",
      note: parts.filter(Boolean).join(" · "),
    });
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-3">
      <label htmlFor="sms" className="text-sm font-medium">
        Collez le SMS de confirmation
      </label>
      <Textarea
        id="sms"
        rows={4}
        placeholder="Ex : Vous avez payé 5 000 FCFA à BOUTIQUE MARIE le 2026-10-26…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}

      {result && (
        <div className="bg-background rounded-lg border p-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{result.kind ? KIND_LABELS[result.kind] : "Non reconnu"}</dd>
            <dt className="text-muted-foreground">Montant</dt>
            <dd className="font-medium">{formatMoney(result.amount)}</dd>
            {result.fee && Number(result.fee) > 0 && (
              <>
                <dt className="text-muted-foreground">Frais</dt>
                <dd>{formatMoney(result.fee)}</dd>
              </>
            )}
            {result.counterparty && (
              <>
                <dt className="text-muted-foreground">Tiers</dt>
                <dd>{result.counterparty}</dd>
              </>
            )}
            {result.date && (
              <>
                <dt className="text-muted-foreground">Date</dt>
                <dd>{result.date}</dd>
              </>
            )}
          </dl>
          {result.kind === "withdrawal" ? (
            <Link
              href={`/accounts${buildQuery({
                transfer: "1",
                from: result.suggested_account,
                amount: String(Number(result.amount)),
                fee: result.fee ? String(Number(result.fee)) : undefined,
                date: result.date,
              })}`}
              className={buttonVariants({ className: "mt-3 w-full" })}
            >
              Enregistrer comme transfert
            </Link>
          ) : result.kind ? (
            <Button className="mt-3 w-full" onClick={() => use(result)}>
              Utiliser ces informations
            </Button>
          ) : (
            <p className="text-muted-foreground mt-2">
              Type non reconnu : choisissez Dépense ou Revenu dans le formulaire.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={analyze} disabled={busy || !text.trim()}>
          {busy ? "Analyse…" : "Analyser"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </div>
  );
}
