"use client";

import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { CategoryManager } from "@/components/CategoryManager";
import { ReminderToggle } from "@/components/ReminderToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useCurrency, useSpace } from "@/lib/space";
import { CURRENCIES } from "@/lib/format";

export default function SettingsPage() {
  const { current, reload } = useSpace();
  const currency = useCurrency();
  const [saving, setSaving] = useState(false);

  /** A single select, so the currency is saved as soon as it changes (for the current space). */
  async function saveCurrency(value: string) {
    if (!current) return;
    setSaving(true);
    try {
      await api(`/spaces/${current.id}/`, { method: "PATCH", body: { currency: value } });
      reload();
      toast.success("Devise mise à jour");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Paramètres" />

      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>
            « Système » suit le réglage de votre téléphone ou ordinateur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rappel quotidien</CardTitle>
        </CardHeader>
        <CardContent>
          <ReminderToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Devise {current && current.kind !== "personal" && `de « ${current.name} »`}
          </CardTitle>
          <CardDescription>
            Propre à chaque espace. S’applique aux nouvelles opérations et aux totaux.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            id="currency"
            aria-label="Devise"
            value={currency}
            disabled={saving}
            onChange={(e) => saveCurrency(e.target.value)}
            className="border-input dark:bg-input/30 h-9 w-full max-w-sm rounded-lg border bg-transparent px-2.5 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catégories</CardTitle>
          <CardDescription>Personnalisez vos catégories de revenus et de dépenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryManager />
        </CardContent>
      </Card>
    </div>
  );
}
