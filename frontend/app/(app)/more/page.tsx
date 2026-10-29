"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { MORE_NAV, PageHeader } from "@/components/AppShell";
import { ProfileCard } from "@/components/ProfileCard";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function MorePage() {
  return (
    <div>
      <PageHeader title="Plus" />
      <ProfileCard href="/profile" className="mb-4" />
      <ul className="bg-card divide-y rounded-xl border">
        {MORE_NAV.map(({ href, label, description, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="hover:bg-muted flex items-center gap-3 px-4 py-3">
              <span className="bg-muted flex size-9 items-center justify-center rounded-full">
                <Icon className="size-4" />
              </span>
              <span className="flex-1">
                <span className="block font-medium">{label}</span>
                <span className="text-muted-foreground block text-xs">{description}</span>
              </span>
              <ChevronRight className="text-muted-foreground size-4" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <p className="text-muted-foreground mb-2 text-sm">Apparence</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
