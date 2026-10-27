"use client";

import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  return (
    <AuthForm
      fields={[
        { name: "username", label: "Nom d’utilisateur", autoComplete: "username" },
        { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
        { name: "password", label: "Mot de passe", type: "password", autoComplete: "new-password" },
      ]}
      submitLabel="Créer mon compte"
      onSubmit={(v) => register({ username: v.username, email: v.email, password: v.password })}
      footer={{ text: "Déjà inscrit ?", href: "/login", link: "Se connecter" }}
    />
  );
}
