"use client";

import { Landmark } from "lucide-react";
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
      {/* Very pale bank in the background, echoing the balance card. */}
      <Landmark
        className="text-foreground pointer-events-none absolute -right-24 -bottom-24 -z-10 size-[26rem] -rotate-6 opacity-[0.04] md:size-[36rem]"
        strokeWidth={1}
        aria-hidden
      />
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo className="size-28" priority />
        <h1 className="text-3xl font-semibold tracking-tight">HoloLedger</h1>
        <p className="text-muted-foreground text-sm">Suivez votre argent, simplement.</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
