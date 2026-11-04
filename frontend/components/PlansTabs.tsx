"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/budgets", label: "Budgets" },
  { href: "/goals", label: "Objectifs" },
];

/** Budgets and goals answer the same question ("what I plan"): one entry, two tabs. */
export function PlansTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Budgets et objectifs"
      className="bg-muted -mt-2 grid grid-cols-2 gap-1 rounded-lg p-1"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname.startsWith(tab.href) ? "page" : undefined}
          className={cn(
            "rounded-md py-1.5 text-center text-sm",
            pathname.startsWith(tab.href)
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
