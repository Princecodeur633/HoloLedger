"use client";

import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { Field, MoneyInput, NativeSelect } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { formatMoney, parseAmount } from "@/lib/format";
import { FREQUENCIES, type GroupBoard, type GroupRules, rulesSummary } from "@/lib/group";
import { useCurrency, useSpace } from "@/lib/space";
import { useApi } from "@/lib/use-api";

function RulesForm({ rules, editable }: { rules: GroupRules; editable: boolean }) {
  const currency = useCurrency();
  const tontine = useSpace().current?.kind === "tontine";
  const [form, setForm] = useState({
    contribution_amount: String(Number(rules.contribution_amount)),
    frequency: rules.frequency,
    start_date: rules.start_date,
    payment_delay_days: String(rules.payment_delay_days),
    late_penalty: Number(rules.late_penalty) ? String(Number(rules.late_penalty)) : "",
    goal_name: rules.goal_name,
    goal_amount: rules.goal_amount ? String(Number(rules.goal_amount)) : "",
  });
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/group/rules/", {
        method: "PATCH",
        body: {
          ...form,
          contribution_amount: parseAmount(form.contribution_amount) || "0",
          payment_delay_days: Number(form.payment_delay_days) || 0,
          late_penalty: parseAmount(form.late_penalty) || "0",
          goal_amount: form.goal_amount ? parseAmount(form.goal_amount) : null,
        },
      });
      toast.success("Règles enregistrées");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <fieldset disabled={!editable} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={tontine ? "Cotisation par séance" : "Cotisation par membre"}
            htmlFor="r-amount"
          >
            <MoneyInput
              id="r-amount"
              currency={currency}
              value={form.contribution_amount}
              onChange={(e) => setForm({ ...form, contribution_amount: e.target.value })}
            />
          </Field>
          <Field label="Rythme" htmlFor="r-freq">
            <NativeSelect
              id="r-freq"
              value={form.frequency}
              onChange={(e) =>
                setForm({ ...form, frequency: e.target.value as GroupRules["frequency"] })
              }
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tontine ? "Première séance" : "Début des cotisations"} htmlFor="r-start">
            <Input
              id="r-start"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="h-10"
            />
          </Field>
          <Field label="Délai de paiement (jours)" htmlFor="r-delay">
            <Input
              id="r-delay"
              type="number"
              min={0}
              max={60}
              value={form.payment_delay_days}
              onChange={(e) => setForm({ ...form, payment_delay_days: e.target.value })}
              className="h-10"
            />
          </Field>
        </div>
        <Field
          label="Pénalité de retard (facultatif)"
          htmlFor="r-penalty"
          hint="Ajoutée pour chaque période payée après le délai."
        >
          <MoneyInput
            id="r-penalty"
            currency={currency}
            value={form.late_penalty}
            onChange={(e) => setForm({ ...form, late_penalty: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={tontine ? "Objectif (facultatif)" : "Projet familial (facultatif)"}
            htmlFor="r-goal-name"
          >
            <Input
              id="r-goal-name"
              maxLength={80}
              placeholder={tontine ? "Ex : Total par membre" : "Ex : Maison familiale"}
              value={form.goal_name}
              onChange={(e) => setForm({ ...form, goal_name: e.target.value })}
              className="h-10"
            />
          </Field>
          <Field label="Montant visé" htmlFor="r-goal">
            <MoneyInput
              id="r-goal"
              currency={currency}
              value={form.goal_amount}
              onChange={(e) => setForm({ ...form, goal_amount: e.target.value })}
            />
          </Field>
        </div>
      </fieldset>
      {editable ? (
        <Button type="submit" className="self-start" disabled={saving}>
          Enregistrer les règles
        </Button>
      ) : (
        <p className="text-muted-foreground text-sm">
          Seul un gestionnaire peut modifier les règles.
        </p>
      )}
    </form>
  );
}

export default function GroupRulesPage() {
  const currency = useCurrency();
  const { data: board } = useApi<GroupBoard>("/group/");
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Règles du groupe" />
      {!board ? (
        <ListSkeleton />
      ) : board.me.is_manager ? (
        <RulesForm rules={board.rules} editable />
      ) : (
        // Members read the rules as a sentence rather than a greyed-out form.
        <div className="bg-card flex flex-col gap-2 rounded-xl border p-4">
          <p className="font-semibold">Les règles du groupe</p>
          <p className="text-muted-foreground text-sm">
            {rulesSummary(board.rules, (v) => formatMoney(v, currency))}
          </p>
          <p className="text-muted-foreground text-xs">
            Depuis le {formatDate(board.rules.start_date)}. Seul un gestionnaire peut les modifier.
          </p>
        </div>
      )}
    </div>
  );
}
