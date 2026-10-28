"use client";

import {
  ChartPie,
  Ellipsis,
  FileUp,
  Goal,
  History,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Repeat,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/Logo";
import { OfflineBanner } from "@/components/OfflineSync";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

const MAIN_NAV = [
  { href: "/dashboard", label: "Accueil", icon: LayoutDashboard },
  { href: "/transactions", label: "Historique", icon: History },
  { href: "/reports", label: "Rapports", icon: ChartPie },
];

/** Secondary pages: in the sidebar on desktop, behind "Plus" on mobile. */
export const MORE_NAV = [
  { href: "/accounts", label: "Comptes", icon: Landmark, description: "Soldes et transferts" },
  { href: "/budgets", label: "Budgets", icon: PiggyBank, description: "Limites mensuelles" },
  { href: "/goals", label: "Objectifs", icon: Goal, description: "Épargne" },
  {
    href: "/recurring",
    label: "Récurrentes",
    icon: Repeat,
    description: "Loyer, salaire, abonnements",
  },
  { href: "/import", label: "Importer", icon: FileUp, description: "Relevé bancaire, SMS" },
  {
    href: "/settings",
    label: "Paramètres",
    icon: Settings,
    description: "Thème, devise, catégories",
  },
];

const NAV = [...MAIN_NAV, ...MORE_NAV];
const MOBILE_NAV = [...MAIN_NAV, { href: "/more", label: "Plus", icon: Ellipsis }];

function isActive(pathname: string, href: string) {
  if (href === "/transactions") return pathname === href;
  if (href === "/more")
    return (
      MORE_NAV.some((item) => pathname.startsWith(item.href)) ||
      pathname === href ||
      pathname === "/profile"
    );
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const onForm = pathname.startsWith("/transactions/");

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r p-4 md:flex print:hidden">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold">
          <Logo className="size-8" priority /> HoloLedger
        </Link>
        <Link
          href="/transactions/new"
          className="bg-primary text-primary-foreground hover:bg-primary/85 mb-4 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <Plus className="size-4" /> Ajouter une opération
        </Link>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(pathname, href)
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
        <div className="mt-auto flex flex-col gap-3 pt-4">
          {user && (
            <Link
              href="/profile"
              className={cn(
                "hover:bg-muted flex items-center gap-3 rounded-lg p-2 transition-colors",
                pathname === "/profile" && "bg-muted",
              )}
            >
              <UserAvatar name={user.username} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{user.username}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {user.phone ? formatPhone(user.phone) : user.email}
                </span>
              </span>
            </Link>
          )}
          <ThemeToggle compact />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">
          <OfflineBanner />
        </div>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-10 print:p-0">
          {children}
        </main>
      </div>

      {/* Mobile floating action button */}
      {!onForm && (
        <Link
          href="/transactions/new"
          aria-label="Ajouter une opération"
          className="bg-primary text-primary-foreground fixed right-4 bottom-20 z-30 flex size-14 items-center justify-center rounded-full shadow-lg md:hidden print:hidden"
        >
          <Plus className="size-6" />
        </Link>
      )}

      {/* Mobile bottom navigation */}
      <nav className="bg-background/95 fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px]",
              isActive(pathname, href) ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {action}
    </div>
  );
}
