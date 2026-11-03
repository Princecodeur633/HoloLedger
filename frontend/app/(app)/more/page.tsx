"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { moreNav, PageHeader } from "@/components/AppShell";
import { ProfileCard } from "@/components/ProfileCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSpace } from "@/lib/space";

/** [section, items] in menu order (no Object.groupBy: older iPhones lack it). */
function groupBySection<T extends { section: string }>(items: T[]) {
  const groups: [string, T[]][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last[0] === item.section) last[1].push(item);
    else groups.push([item.section, [item]]);
  }
  return groups;
}

export default function MorePage() {
  const { current } = useSpace();
  return (
    <div>
      <PageHeader title="Plus" />
      <ProfileCard href="/profile" className="mb-4" />
      {/* The menu in a few titled blocks, easier to scan than one long list. */}
      {groupBySection(moreNav(current?.kind)).map(([section, items]) => (
        <section key={section} className="mb-4">
          <h2 className="text-muted-foreground mb-2 px-1 text-xs font-medium tracking-wide uppercase">
            {section}
          </h2>
          <ul className="bg-card divide-y rounded-xl border">
            {(items ?? []).map(({ href, label, description, icon: Icon }) => (
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
        </section>
      ))}
      <div className="mt-5">
        <p className="text-muted-foreground mb-2 text-sm">Apparence</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
