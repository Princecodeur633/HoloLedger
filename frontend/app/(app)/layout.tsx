"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (!user) {
    return (
      <div
        role="status"
        aria-label="Chargement"
        className="flex min-h-dvh items-center justify-center"
      >
        <Logo className="size-20 animate-pulse" priority />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
