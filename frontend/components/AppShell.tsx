"use client";

import {
  BookOpen,
  ChartPie,
  Ellipsis,
  FileUp,
  Goal,
  HandCoins,
  Receipt,
  Settings2,
  Users,
  Layers,
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
import { Fragment } from "react";

import { Logo } from "@/components/Logo";
import { OfflineBanner } from "@/components/OfflineSync";
import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { isGroupKind } from "@/lib/group";
import { useSpace } from "@/lib/space";
import type { SpaceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAIN_NAV = [
  { href: "/dashboard", label: "Accueil", icon: LayoutDashboard },
  { href: "/transactions", label: "Historique", icon: History },
  { href: "/reports", label: "Rapports", icon: ChartPie },
];

/** Tontine / family: members and payments instead of accounts and operations. */
const GROUP_NAV = [
  { href: "/dashboard", label: "Accueil", icon: LayoutDashboard },
  { href: "/group/payments", label: "Versements", icon: History },
  { href: "/group/members", label: "Membres", icon: Users },
];

const COMMON_MORE = ["/spaces", "/guide", "/settings"];

export function mainNav(kind: SpaceKind | undefined) {
  return isGroupKind(kind) ? GROUP_NAV : MAIN_NAV;
}

/** Secondary pages: in the sidebar on desktop, behind "Plus" on mobile. */
export const MORE_NAV = [
  { href: "/accounts", label: "Comptes", icon: Landmark, description: "Soldes et transferts" },
  { href: "/budgets", label: "Budgets", icon: PiggyBank, description: "Limites mensuelles" },
  { href: "/goals", label: "Objectifs", icon: Goal, description: "Épargne" },
  {
    href: "/debts",
    label: "Dettes et prêts",
    icon: HandCoins,
    description: "Qui me doit, à qui je dois",
  },
  {
    href: "/recurring",
    label: "Récurrentes",
    icon: Repeat,
    description: "Loyer, salaire, abonnements",
  },
  { href: "/import", label: "Importer", icon: FileUp, description: "Relevé bancaire, SMS" },
  { href: "/spaces", label: "Mes espaces", icon: Layers, description: "Perso, couple, business" },
  { href: "/guide", label: "Guide", icon: BookOpen, description: "Comment utiliser l’app" },
  {
    href: "/settings",
    label: "Paramètres",
    icon: Settings,
    description: "Thème, devise, catégories",
  },
];

/** Menu of the current space: no debts in a couple, "clients et fournisseurs" in a business. */
export function moreNav(kind: SpaceKind | undefined) {
  if (isGroupKind(kind)) {
    return [
      {
        href: "/group/rules",
        label: "Règles",
        icon: Settings2,
        description: "Montant, rythme, délai, pénalité",
      },
      ...(kind === "family"
        ? [
            {
              href: "/group/expenses",
              label: "Dépenses",
              icon: Receipt,
              description: "À quoi l’argent a servi",
            },
          ]
        : []),
      ...MORE_NAV.filter((item) => COMMON_MORE.includes(item.href)),
    ];
  }
  return MORE_NAV.filter((item) => !(kind === "couple" && item.href === "/debts")).map((item) =>
    item.href === "/debts" && kind === "business"
      ? { ...item, label: "Clients et fournisseurs", description: "Qui me doit, à qui je dois" }
      : item,
  );
}

const MORE_TAB = { href: "/more", label: "Plus", icon: Ellipsis };

function isActive(pathname: string, href: string, kind: SpaceKind | undefined) {
  if (href === "/transactions") return pathname === href;
  if (href === "/more")
    return (
      moreNav(kind).some((item) => pathname.startsWith(item.href)) ||
      pathname === href ||
      pathname === "/profile"
    );
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { current } = useSpace();
  const kind = current?.kind;
  const nav = [...mainNav(kind), ...moreNav(kind)];
  const mobileNav = [...mainNav(kind), MORE_TAB];
  // The "+" records a payment in a group, an operation elsewhere.
  const addHref = isGroupKind(kind) ? "/group/pay" : "/transactions/new";
  const addLabel = isGroupKind(kind) ? "Verser une cotisation" : "Ajouter une opération";

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r p-4 md:flex print:hidden">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold">
          <Logo className="size-8" priority /> HoloLedger
        </Link>
        <SpaceSwitcher className="mb-4 w-full justify-start" />
        <Link
          href={addHref}
          className="bg-primary text-primary-foreground hover:bg-primary/85 mb-4 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <Plus className="size-4" /> {addLabel}
        </Link>
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(pathname, href, kind)
                ? "bg-primary/10 text-primary font-medium"
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
        {/* Mobile top bar: which space you are in, always in sight. */}
        <div className="bg-background/95 sticky top-0 z-20 flex items-center gap-2 border-b px-4 py-2 backdrop-blur md:hidden print:hidden">
          <Logo className="size-7" />
          <SpaceSwitcher className="min-w-0" />
        </div>
        {/* Switching space remounts the pages, so every screen reloads its data. */}
        <main
          key={current?.id ?? "personal"}
          className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-10 print:p-0"
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation, with the main action ("+") in the middle. */}
      <nav className="bg-background/95 fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
        {mobileNav.map(({ href, label, icon: Icon }, index) => (
          <Fragment key={href}>
            {index === 2 && (
              <div className="flex items-start justify-center">
                <Link
                  href={addHref}
                  aria-label={addLabel}
                  aria-current={pathname === addHref ? "page" : undefined}
                  className="bg-primary text-primary-foreground ring-background -mt-5 flex size-14 items-center justify-center rounded-full shadow-lg ring-4 transition-transform active:scale-95"
                >
                  <Plus className="size-6" />
                </Link>
              </div>
            )}
            <Link
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[11px]",
                isActive(pathname, href, kind)
                  ? "text-primary font-medium"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          </Fragment>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {action}
    </div>
  );
}
