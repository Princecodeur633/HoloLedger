"use client";

import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { CategoryManager } from "@/components/CategoryManager";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CURRENCIES } from "@/lib/format";
import type { User } from "@/lib/types";

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);

  /** A single select, so the currency is saved as soon as it changes. */
  async function saveCurrency(currency: string) {
    setSaving(true);
    try {
      const updated = await api<User>("/auth/me/", { method: "PATCH", body: { currency } });
      setUser(updated);
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
          <CardTitle>Devise</CardTitle>
          <CardDescription>
            S’applique aux nouvelles opérations et à l’affichage des totaux.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            id="currency"
            aria-label="Devise"
            value={user?.currency ?? "XAF"}
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
