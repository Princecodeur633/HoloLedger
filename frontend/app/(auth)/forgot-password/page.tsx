"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PhoneInput } from "@/components/PhoneInput";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { DEFAULT_COUNTRY, phoneBody, type PhoneValue } from "@/lib/phone";
import { useWhatsAppEnabled } from "@/lib/whatsapp";

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : OFFLINE_MESSAGE;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const enabled = useWhatsAppEnabled();
  const [phone, setPhone] = useState<PhoneValue>({ country: DEFAULT_COUNTRY, number: "" });
  const [link, setLink] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<{ phone?: string; code?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await api<{ url: string }>("/auth/password/reset/start/", {
        method: "POST",
        body: phoneBody(phone),
      });
      setLink(res.url);
    } catch (err) {
      setErrors({
        phone: err instanceof ApiError ? (err.fieldError("phone") ?? err.message) : errorText(err),
      });
    } finally {
      setBusy(false);
    }
  }

  async function reset(event: React.FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setErrors({ password: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await api("/auth/password/reset/", {
        method: "POST",
        body: { ...phoneBody(phone), code: form.code.trim(), new_password: form.password },
      });
      toast.success("Mot de passe modifié. Connectez-vous avec le nouveau.");
      router.replace("/login");
    } catch (err) {
      if (err instanceof ApiError && (err.fieldError("code") || err.fieldError("new_password"))) {
        setErrors({ code: err.fieldError("code"), password: err.fieldError("new_password") });
      } else {
        setErrors({ code: errorText(err) });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Mot de passe oublié</h2>
          <p className="text-muted-foreground text-sm">
            Recevez un code sur WhatsApp pour choisir un nouveau mot de passe.
          </p>
        </div>

        {!enabled ? (
          <p className="bg-muted rounded-lg p-3 text-sm">
            La récupération par WhatsApp n’est pas encore disponible. Contactez l’administrateur
            pour réinitialiser votre mot de passe.
          </p>
        ) : !link ? (
          <form onSubmit={start} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Votre numéro de téléphone</Label>
              <PhoneInput
                id="phone"
                required
                value={phone}
                onChange={setPhone}
                invalid={!!errors.phone}
              />
              {errors.phone && <p className="text-destructive text-sm">{errors.phone}</p>}
            </div>
            <Button type="submit" size="lg" className="h-10" disabled={busy}>
              {busy ? "Veuillez patienter…" : "Continuer"}
            </Button>
          </form>
        ) : (
          <>
            <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
              <li>Ouvrez WhatsApp avec le bouton ci-dessous.</li>
              <li>Envoyez le message déjà écrit, sans le modifier.</li>
              <li>Vous recevez un code à 6 chiffres : tapez-le ici.</li>
            </ol>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({
                size: "lg",
                className: "h-10 bg-[#25D366] text-white hover:bg-[#1ebe5b]",
              })}
            >
              <MessageCircle /> Ouvrir WhatsApp
            </a>

            <form onSubmit={reset} className="flex flex-col gap-4 border-t pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Code reçu</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, "") })}
                  aria-invalid={!!errors.code}
                  className="h-10 tracking-[0.3em]"
                />
                {errors.code && <p className="text-destructive text-sm">{errors.code}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  aria-invalid={!!errors.password}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  className="h-10"
                />
                {errors.password && <p className="text-destructive text-sm">{errors.password}</p>}
              </div>
              <Button type="submit" size="lg" className="h-10" disabled={busy}>
                {busy ? "Veuillez patienter…" : "Changer mon mot de passe"}
              </Button>
            </form>
          </>
        )}

        <p className="text-muted-foreground text-center text-sm">
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
