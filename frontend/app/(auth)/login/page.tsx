"use client";

import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  return (
    <AuthForm
      fields={[
        { name: "login", label: "Téléphone ou nom d’utilisateur", autoComplete: "username" },
        {
          name: "password",
          label: "Mot de passe",
          type: "password",
          autoComplete: "current-password",
          aside: (
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          ),
        },
      ]}
      submitLabel="Se connecter"
      onSubmit={(v) => login(v.login, v.password)}
      footer={{ text: "Pas encore de compte ?", href: "/register", link: "Créer un compte" }}
    />
  );
}
