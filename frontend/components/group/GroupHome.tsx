"use client";

import { ChevronRight, Hourglass, Share2, TriangleAlert, Utensils } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { ProgressBar } from "@/components/ProgressBar";
import { Button, buttonVariants } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { type GroupBoard, type GroupExpense, rulesSummary, shareText } from "@/lib/group";
import { MASK, useHidden } from "@/lib/privacy";
import { useCurrency, useSpace } from "@/lib/space";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

import { StatusChip } from "./StatusChip";

export function GroupHome() {
  const { current } = useSpace();
  const currency = useCurrency();
  const hidden = useHidden();
  const money = (v: string | number) => (hidden ? MASK : formatMoney(v, currency));
  const { data: board, error, reload } = useApi<GroupBoard>("/group/");
  const family = current?.kind === "family";
  const { data: expenses } = useApi<GroupExpense[]>(family ? "/group/expenses/" : null);

  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (!board) return <DashboardSkeleton />;

  const period = board.current_period;
  const at = period ? board.periods.findIndex((p) => p.index === period.index) : -1;
  const me = board.members.find((m) => m.id === board.me.member);
  const manager = board.me.is_manager;
  const goal = Number(board.rules.goal_amount ?? 0);

  async function handOver() {
    if (!period?.beneficiary) return;
    const ok = window.confirm(
      `Confirmer que la cagnotte (${formatMoney(period.collected, currency)}) a été remise à ${period.beneficiary.name} ?`,
    );
    if (!ok) return;
    try {
      await api("/group/payouts/", { method: "POST", body: { session: period.index } });
      toast.success("Cagnotte remise : séance close");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    }
  }

  async function recordMine(payoutId: string) {
    try {
      await api(`/group/payouts/${payoutId}/`, { method: "POST" });
      toast.success("Ajouté comme revenu dans votre espace personnel");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    }
  }

  const myPayout = board.periods.find(
    (p) =>
      p.payout &&
      p.payout.member_user &&
      me &&
      p.beneficiary?.id === me.id &&
      !p.payout.recorded_in_personal,
  )?.payout;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-5 duration-300">
      <PageHeader title={current?.name ?? "Groupe"} />
      <Link
        href="/group/rules"
        className="text-muted-foreground hover:text-foreground -mt-3 flex items-center gap-1 text-xs"
      >
        {rulesSummary(board.rules, money)}
        <ChevronRight className="size-3" />
      </Link>

      {/*
        Phones: one column in reading order. Large screens: what to know on the left, the
        people and the history on the right.
      */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-5">
          {family ? (
            <>
              {/* The fund */}
              <div className="bg-foreground text-background dark:bg-card dark:text-card-foreground dark:ring-foreground/10 rounded-2xl p-6 shadow-sm dark:ring-1">
                <p className="text-sm opacity-70">
                  {family ? "En caisse" : "Collecté, pas encore remis"}
                </p>
                <p className="mt-2 text-[clamp(2.25rem,11vw,3.25rem)] leading-none font-extrabold tabular-nums">
                  {money(board.totals.cash)}
                </p>
                <p className="mt-3 text-xs opacity-70">
                  {money(board.totals.validated)} validés
                  {Number(board.totals.pending) > 0 &&
                    ` · ${money(board.totals.pending)} à valider`}
                  {family &&
                    Number(board.totals.spent) > 0 &&
                    ` · ${money(board.totals.spent)} dépensés`}
                </p>
              </div>
              {/* My situation */}
              {me && (
                <section className="bg-card flex flex-col gap-3 rounded-xl border p-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={me.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Ma situation</p>
                      <p className="text-muted-foreground text-xs">
                        {money(me.paid)} versés
                        {Number(me.arrears) > 0 && (
                          <span className={cn("font-medium", me.late_count > 0 && "text-expense")}>
                            {" "}
                            · {money(me.arrears)} {me.late_count > 0 ? "en retard" : "à payer"}
                          </span>
                        )}
                        {Number(me.advance) > 0 && (
                          <span className="text-income font-medium">
                            {" "}
                            · {money(me.advance)} d’avance
                          </span>
                        )}
                        {Number(me.penalty) > 0 && ` · pénalités ${money(me.penalty)}`}
                      </p>
                    </div>
                    {at >= 0 && <StatusChip status={me.statuses[at]} />}
                  </div>
                  {(Number(me.arrears) > 0 ||
                    (at >= 0 && ["due", "late"].includes(me.statuses[at]))) && (
                    <Link href="/group/pay" className={buttonVariants({ className: "h-10" })}>
                      J’ai versé
                    </Link>
                  )}
                </section>
              )}
              {myPayout && (
                <div className="bg-income/5 border-income/30 flex flex-col gap-2 rounded-xl border p-3 text-sm">
                  <p>
                    Vous avez reçu la cagnotte de{" "}
                    <span className="font-semibold">{money(myPayout.amount)}</span>.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => recordMine(myPayout.id)}
                  >
                    L’ajouter à mon espace personnel
                  </Button>
                </div>
              )}
              {/* Current session / period */}
              {period && (
                <section className="bg-card rounded-xl border p-4">
                  {family ? (
                    <p className="font-semibold">Cotisations du {formatDate(period.date)}</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-xs">
                        Séance {period.index} sur {board.periods.length} · {formatDate(period.date)}
                      </p>
                      <p className="mt-1 flex items-center gap-2 font-semibold">
                        <Utensils className="size-4" />
                        {period.beneficiary ? `C’est ${period.beneficiary.name} qui mange` : "—"}
                      </p>
                    </>
                  )}
                  <div className="mt-3 mb-1 flex justify-between text-sm tabular-nums">
                    <span>{money(period.collected)} collectés</span>
                    <span className="text-muted-foreground">sur {money(period.expected)}</span>
                  </div>
                  <ProgressBar
                    percent={
                      Number(period.expected)
                        ? (Number(period.collected) / Number(period.expected)) * 100
                        : 0
                    }
                  />
                  <p className="text-muted-foreground mt-2 text-xs">
                    À payer au plus tard le {formatDate(period.deadline)}
                  </p>
                  {!family &&
                    manager &&
                    period.beneficiary &&
                    !period.payout &&
                    Number(period.collected) > 0 && (
                      <Button size="sm" className="mt-3" onClick={handOver}>
                        Cagnotte remise à {period.beneficiary.name}
                      </Button>
                    )}
                </section>
              )}
              {board.totals.late_members > 0 && (
                <div className="border-expense/30 bg-expense/5 flex items-start gap-3 rounded-xl border p-3 text-sm">
                  <TriangleAlert className="text-expense mt-0.5 size-4 shrink-0" />
                  <p>
                    <span className="text-expense font-semibold">
                      {board.totals.late_members} membre{board.totals.late_members > 1 ? "s" : ""}{" "}
                      en retard
                    </span>{" "}
                    · {money(board.totals.arrears)} non payés
                    {Number(board.totals.penalties) > 0 &&
                      ` · ${money(board.totals.penalties)} de pénalités`}
                  </p>
                </div>
              )}
              {manager && board.pending_count > 0 && (
                <Link
                  href="/group/payments"
                  className="border-warning/40 bg-warning/10 flex items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <Hourglass className="text-warning size-4 shrink-0" />
                  <span className="flex-1">
                    {board.pending_count} versement{board.pending_count > 1 ? "s" : ""} à valider
                  </span>
                  <ChevronRight className="size-4" />
                </Link>
              )}
              {goal > 0 && family && (
                <section className="bg-card rounded-xl border p-4">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-semibold">{board.rules.goal_name || "Objectif"}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {money(board.totals.validated)} / {money(goal)}
                    </span>
                  </div>
                  <ProgressBar percent={(Number(board.totals.validated) / goal) * 100} />
                </section>
              )}
            </>
          ) : (
            <>
              {/* Current session / period */}
              {period && (
                <section className="bg-card rounded-xl border p-4">
                  {family ? (
                    <p className="font-semibold">Cotisations du {formatDate(period.date)}</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-xs">
                        Séance {period.index} sur {board.periods.length} · {formatDate(period.date)}
                      </p>
                      <p className="mt-1 flex items-center gap-2 font-semibold">
                        <Utensils className="size-4" />
                        {period.beneficiary ? `C’est ${period.beneficiary.name} qui mange` : "—"}
                      </p>
                    </>
                  )}
                  <div className="mt-3 mb-1 flex justify-between text-sm tabular-nums">
                    <span>{money(period.collected)} collectés</span>
                    <span className="text-muted-foreground">sur {money(period.expected)}</span>
                  </div>
                  <ProgressBar
                    percent={
                      Number(period.expected)
                        ? (Number(period.collected) / Number(period.expected)) * 100
                        : 0
                    }
                  />
                  <p className="text-muted-foreground mt-2 text-xs">
                    À payer au plus tard le {formatDate(period.deadline)}
                  </p>
                  {!family &&
                    manager &&
                    period.beneficiary &&
                    !period.payout &&
                    Number(period.collected) > 0 && (
                      <Button size="sm" className="mt-3" onClick={handOver}>
                        Cagnotte remise à {period.beneficiary.name}
                      </Button>
                    )}
                </section>
              )}
              {/* My situation */}
              {me && (
                <section className="bg-card flex flex-col gap-3 rounded-xl border p-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={me.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Ma situation</p>
                      <p className="text-muted-foreground text-xs">
                        {money(me.paid)} versés
                        {Number(me.arrears) > 0 && (
                          <span className={cn("font-medium", me.late_count > 0 && "text-expense")}>
                            {" "}
                            · {money(me.arrears)} {me.late_count > 0 ? "en retard" : "à payer"}
                          </span>
                        )}
                        {Number(me.advance) > 0 && (
                          <span className="text-income font-medium">
                            {" "}
                            · {money(me.advance)} d’avance
                          </span>
                        )}
                        {Number(me.penalty) > 0 && ` · pénalités ${money(me.penalty)}`}
                      </p>
                    </div>
                    {at >= 0 && <StatusChip status={me.statuses[at]} />}
                  </div>
                  {(Number(me.arrears) > 0 ||
                    (at >= 0 && ["due", "late"].includes(me.statuses[at]))) && (
                    <Link href="/group/pay" className={buttonVariants({ className: "h-10" })}>
                      J’ai versé
                    </Link>
                  )}
                </section>
              )}
              {myPayout && (
                <div className="bg-income/5 border-income/30 flex flex-col gap-2 rounded-xl border p-3 text-sm">
                  <p>
                    Vous avez reçu la cagnotte de{" "}
                    <span className="font-semibold">{money(myPayout.amount)}</span>.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => recordMine(myPayout.id)}
                  >
                    L’ajouter à mon espace personnel
                  </Button>
                </div>
              )}
              {manager && board.pending_count > 0 && (
                <Link
                  href="/group/payments"
                  className="border-warning/40 bg-warning/10 flex items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <Hourglass className="text-warning size-4 shrink-0" />
                  <span className="flex-1">
                    {board.pending_count} versement{board.pending_count > 1 ? "s" : ""} à valider
                  </span>
                  <ChevronRight className="size-4" />
                </Link>
              )}
              {board.totals.late_members > 0 && (
                <div className="border-expense/30 bg-expense/5 flex items-start gap-3 rounded-xl border p-3 text-sm">
                  <TriangleAlert className="text-expense mt-0.5 size-4 shrink-0" />
                  <p>
                    <span className="text-expense font-semibold">
                      {board.totals.late_members} membre{board.totals.late_members > 1 ? "s" : ""}{" "}
                      en retard
                    </span>{" "}
                    · {money(board.totals.arrears)} non payés
                    {Number(board.totals.penalties) > 0 &&
                      ` · ${money(board.totals.penalties)} de pénalités`}
                  </p>
                </div>
              )}
              {/* The fund */}
              <div className="bg-foreground text-background dark:bg-card dark:text-card-foreground dark:ring-foreground/10 rounded-2xl p-6 shadow-sm dark:ring-1">
                <p className="text-sm opacity-70">
                  {family ? "En caisse" : "Collecté, pas encore remis"}
                </p>
                <p className="mt-2 text-[clamp(2.25rem,11vw,3.25rem)] leading-none font-extrabold tabular-nums">
                  {money(board.totals.cash)}
                </p>
                <p className="mt-3 text-xs opacity-70">
                  {money(board.totals.validated)} validés
                  {Number(board.totals.pending) > 0 &&
                    ` · ${money(board.totals.pending)} à valider`}
                  {family &&
                    Number(board.totals.spent) > 0 &&
                    ` · ${money(board.totals.spent)} dépensés`}
                </p>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-5">
          {/* Members at a glance */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-muted-foreground text-sm font-medium">
                Membres ({board.members.length})
              </h2>
              <Link href="/group/members" className="text-sm font-medium">
                Tout voir
              </Link>
            </div>
            <ul className="bg-card divide-y rounded-xl border">
              {board.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <UserAvatar name={m.name} className="size-8 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-medium",
                        m.late_count > 0 && "text-expense",
                      )}
                    >
                      {m.name}
                      {!m.user && (
                        <span className="text-muted-foreground font-normal"> · carnet</span>
                      )}
                    </span>
                    {Number(m.arrears) > 0 && (
                      <span
                        className={cn(
                          "block text-xs",
                          m.late_count > 0 ? "text-expense" : "text-muted-foreground",
                        )}
                      >
                        {money(m.arrears)} {m.late_count > 0 ? "en retard" : "à payer"}
                      </span>
                    )}
                  </span>
                  {at >= 0 && <StatusChip status={m.statuses[at]} />}
                </li>
              ))}
            </ul>
          </section>

          {/* Tontine sessions / family spending */}
          {!family && (
            <section>
              <h2 className="text-muted-foreground mb-2 text-sm font-medium">Ordre de passage</h2>
              <ol className="bg-card divide-y rounded-xl border">
                {board.periods.map((p) => (
                  <li key={p.index} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        p.payout ? "bg-income/15 text-income" : "bg-muted",
                        period?.index === p.index && !p.payout && "bg-foreground text-background",
                      )}
                    >
                      {p.index}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {p.beneficiary?.name}
                      <span className="text-muted-foreground"> · {formatDate(p.date)}</span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {p.payout
                        ? `✓ ${money(p.payout.amount)}`
                        : period?.index === p.index
                          ? "en cours"
                          : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {family && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-muted-foreground text-sm font-medium">
                  À quoi l’argent a servi
                </h2>
                <Link href="/group/expenses" className="text-sm font-medium">
                  Tout voir
                </Link>
              </div>
              {expenses && expenses.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucune dépense pour l’instant.</p>
              ) : (
                <ul className="bg-card divide-y rounded-xl border">
                  {(expenses ?? []).slice(0, 3).map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.purpose}</span>
                        <span className="text-muted-foreground block text-xs">
                          {formatDate(e.date)}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">−{money(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              shareText(board, current?.name ?? "", (v) => formatMoney(v, currency), formatDate),
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", className: "h-11" })}
          >
            <Share2 /> Partager le point sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
