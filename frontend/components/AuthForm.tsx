"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";

export interface AuthField {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
}

export function AuthForm({
  fields,
  submitLabel,
  onSubmit,
  footer,
}: {
  fields: AuthField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  footer: { text: string; href: string; link: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [offline, setOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOffline(false);
    try {
      await onSubmit(values);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) setError(err);
      else setOffline(true);
    } finally {
      setSubmitting(false);
    }
  }

  const globalError = offline
    ? "Impossible de contacter le serveur."
    : error && !fields.some((f) => error.fieldError(f.name))
      ? error.message
      : null;

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.name} className="flex flex-col gap-2">
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input
                id={f.name}
                type={f.type ?? "text"}
                autoComplete={f.autoComplete}
                required
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                aria-invalid={!!error?.fieldError(f.name)}
                className="h-10"
              />
              {error?.fieldError(f.name) && (
                <p className="text-destructive text-sm">{error.fieldError(f.name)}</p>
              )}
            </div>
          ))}
          {globalError && <p className="text-destructive text-sm">{globalError}</p>}
          <Button type="submit" size="lg" className="h-10" disabled={submitting}>
            {submitting ? "Veuillez patienter…" : submitLabel}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            {footer.text}{" "}
            <Link
              href={footer.href}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              {footer.link}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
