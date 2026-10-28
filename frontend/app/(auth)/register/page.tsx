"use client";

import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/lib/auth";
import { DEFAULT_COUNTRY } from "@/lib/phone";

export default function RegisterPage() {
  const { register } = useAuth();
  return (
    <AuthForm
      fields={[
        { name: "username", label: "Nom d’utilisateur", autoComplete: "username" },
        { name: "phone", label: "Téléphone", type: "phone" },
        { name: "email", label: "E-mail", type: "email", autoComplete: "email", optional: true },
        { name: "password", label: "Mot de passe", type: "password", autoComplete: "new-password" },
      ]}
      submitLabel="Créer mon compte"
      onSubmit={(v) =>
        register({
          username: v.username,
          phone: v.phone,
          phone_country: v.phone_country ?? DEFAULT_COUNTRY,
          email: v.email || undefined,
          password: v.password,
        })
      }
      footer={{ text: "Déjà inscrit ?", href: "/login", link: "Se connecter" }}
    />
  );
}
