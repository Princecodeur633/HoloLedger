"use client";

import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  return (
    <AuthForm
      fields={[
        { name: "login", label: "Nom d’utilisateur ou e-mail", autoComplete: "username" },
        {
          name: "password",
          label: "Mot de passe",
          type: "password",
          autoComplete: "current-password",
        },
      ]}
      submitLabel="Se connecter"
      onSubmit={(v) => login(v.login, v.password)}
      footer={{ text: "Pas encore de compte ?", href: "/register", link: "Créer un compte" }}
    />
  );
}
