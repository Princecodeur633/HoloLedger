"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";

const EMPTY = { current: "", next: "", confirm: "" };

export function PasswordForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.next !== form.confirm) {
      setErrors({ next: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await api("/auth/password/", {
        method: "POST",
        body: { current_password: form.current, new_password: form.next },
      });
      setForm(EMPTY);
      toast.success("Mot de passe modifié");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({
          current: err.fieldError("current_password"),
          next: err.fieldError("new_password"),
          form:
            err.fieldError("current_password") || err.fieldError("new_password")
              ? undefined
              : err.message,
        });
      } else {
        setErrors({ form: OFFLINE_MESSAGE });
      }
    } finally {
      setSaving(false);
    }
  }

  const field = (id: keyof typeof EMPTY, label: string, autoComplete: string, error?: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`pw-${id}`}>{label}</Label>
      <Input
        id={`pw-${id}`}
        type="password"
        required
        autoComplete={autoComplete}
        value={form[id]}
        onChange={(e) => setForm({ ...form, [id]: e.target.value })}
        aria-invalid={!!error}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {field("current", "Mot de passe actuel", "current-password", errors.current)}
      {field("next", "Nouveau mot de passe", "new-password", errors.next)}
      {field("confirm", "Confirmer le nouveau mot de passe", "new-password")}
      {errors.form && <p className="text-destructive text-sm">{errors.form}</p>}
      <Button type="submit" className="self-start" disabled={saving}>
        {saving ? "Modification…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
