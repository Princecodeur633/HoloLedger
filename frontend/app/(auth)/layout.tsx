"use client";

import { Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/*
        Pale bank in the background, echoing the balance card. On phones it sits behind the form
        (the bottom corner is off-screen there); on large screens it fills the bottom-right corner.
      */}
      <Landmark
        className="text-foreground pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[24rem] -translate-x-1/2 -translate-y-1/3 -rotate-6 opacity-[0.07] md:top-auto md:-right-24 md:-bottom-24 md:left-auto md:size-[36rem] md:translate-x-0 md:translate-y-0 md:opacity-[0.05]"
        strokeWidth={1}
        aria-hidden
      />
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo className="size-28" priority />
        <h1 className="text-3xl font-semibold tracking-tight">HoloLedger</h1>
        <p className="text-muted-foreground text-sm">Suivez votre argent, simplement.</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <Link
        href="/guide"
        className="text-muted-foreground hover:text-foreground mt-6 text-sm underline-offset-4 hover:underline"
      >
        Comment ça marche ? Voir le guide
      </Link>
    </div>
  );
}
