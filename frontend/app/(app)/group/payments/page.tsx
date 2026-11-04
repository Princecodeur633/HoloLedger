"use client";

import { Check, Plus, Receipt, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { api, ApiError, OFFLINE_MESSAGE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import type { Contribution, GroupBoard } from "@/lib/group";
import { MASK, useHidden } from "@/lib/privacy";
import { useCurrency } from "@/lib/space";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const LABEL = {
  pending: { text: "À valider", cls: "bg-warning/15 text-warning" },
  validated: { text: "Validé", cls: "bg-income/10 text-income" },
  refused: { text: "Refusé", cls: "bg-expense/10 text-expense" },
};

export default function GroupPaymentsPage() {
  const currency = useCurrency();
  const hidden = useHidden();
  const money = (v: string) => (hidden ? MASK : formatMoney(v, currency));
  const { data: board } = useApi<GroupBoard>("/group/");
  const { data: items, reload } = useApi<Contribution[]>("/group/contributions/");
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const manager = board?.me.is_manager ?? false;
  const { user } = useAuth();

  const visible = (which: "pending" | "all") =>
    (items ?? []).filter((c) => which === "all" || c.status === "pending");

  async function act(c: Contribution, action: "validate" | "refuse" | "delete") {
    let body: { reason: string } | undefined;
    if (action === "refuse") {
      const reason = window.prompt(
        `Pourquoi refuser le versement de ${c.member_name} ?`,
        "Pas reçu",
      );
      if (reason === null) return;
      body = { reason };
    }
    if (action === "delete" && !window.confirm("Supprimer ce versement ?")) return;
    try {
      await api(
        action === "delete"
          ? `/group/contributions/${c.id}/`
          : `/group/contributions/${c.id}/${action}/`,
        { method: action === "delete" ? "DELETE" : "POST", body },
      );
      toast.success(
        action === "validate"
          ? "Versement validé"
          : action === "refuse"
            ? "Versement refusé"
            : "Supprimé",
      );
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : OFFLINE_MESSAGE);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Versements"
        action={
          <Link href="/group/pay" className={buttonVariants({ variant: "outline" })}>
            <Plus /> {manager ? "Enregistrer" : "J’ai versé"}
          </Link>
        }
      />

      <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1 lg:hidden">
        {(
          [
            [
              "pending",
              `À valider (${(items ?? []).filter((c) => c.status === "pending").length})`,
            ],
            ["all", "Tous"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "rounded-md py-1.5 text-sm",
              tab === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="lg:hidden">
          {items === null ? (
            <ListSkeleton />
          ) : visible(tab).length === 0 ? (
            <EmptyState
              icon={Receipt}
              message={
                tab === "pending"
                  ? "Aucun versement en attente de validation."
                  : "Aucun versement pour l’instant."
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {visible(tab).map((c) => (
                <li key={c.id} className="bg-card rounded-xl border p-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.member_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(c.date)}
                        {c.reference && ` · réf. ${c.reference}`}
                        {c.declared_by_name && ` · déclaré par ${c.declared_by_name}`}
                      </p>
                      {c.note && <p className="text-muted-foreground mt-1 text-xs">{c.note}</p>}
                      {c.status === "refused" && c.refusal_reason && (
                        <p className="text-expense mt-1 text-xs">Motif : {c.refusal_reason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{money(c.amount)}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          LABEL[c.status].cls,
                        )}
                      >
                        {LABEL[c.status].text}
                      </span>
                    </div>
                  </div>
                  {(manager ||
                    (c.status === "pending" && c.declared_by_name === user?.username)) && (
                    <div className="mt-2 flex gap-2">
                      {manager && c.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => act(c, "validate")}>
                            <Check /> Valider
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => act(c, "refuse")}>
                            <X /> Refuser
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="ml-auto"
                        aria-label="Supprimer"
                        onClick={() => act(c, "delete")}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <section className="hidden lg:flex lg:flex-col lg:gap-2">
          <h2 className="text-sm font-semibold">À valider</h2>
          {items === null ? (
            <ListSkeleton />
          ) : visible("pending").length === 0 ? (
            <EmptyState
              icon={Receipt}
              message={
                true
                  ? "Aucun versement en attente de validation."
                  : "Aucun versement pour l’instant."
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {visible("pending").map((c) => (
                <li key={c.id} className="bg-card rounded-xl border p-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.member_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(c.date)}
                        {c.reference && ` · réf. ${c.reference}`}
                        {c.declared_by_name && ` · déclaré par ${c.declared_by_name}`}
                      </p>
                      {c.note && <p className="text-muted-foreground mt-1 text-xs">{c.note}</p>}
                      {c.status === "refused" && c.refusal_reason && (
                        <p className="text-expense mt-1 text-xs">Motif : {c.refusal_reason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{money(c.amount)}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          LABEL[c.status].cls,
                        )}
                      >
                        {LABEL[c.status].text}
                      </span>
                    </div>
                  </div>
                  {(manager ||
                    (c.status === "pending" && c.declared_by_name === user?.username)) && (
                    <div className="mt-2 flex gap-2">
                      {manager && c.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => act(c, "validate")}>
                            <Check /> Valider
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => act(c, "refuse")}>
                            <X /> Refuser
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="ml-auto"
                        aria-label="Supprimer"
                        onClick={() => act(c, "delete")}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="hidden lg:flex lg:flex-col lg:gap-2">
          <h2 className="text-sm font-semibold">Tous les versements</h2>
          {items === null ? (
            <ListSkeleton />
          ) : visible("all").length === 0 ? (
            <EmptyState
              icon={Receipt}
              message={
                false
                  ? "Aucun versement en attente de validation."
                  : "Aucun versement pour l’instant."
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {visible("all").map((c) => (
                <li key={c.id} className="bg-card rounded-xl border p-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.member_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(c.date)}
                        {c.reference && ` · réf. ${c.reference}`}
                        {c.declared_by_name && ` · déclaré par ${c.declared_by_name}`}
                      </p>
                      {c.note && <p className="text-muted-foreground mt-1 text-xs">{c.note}</p>}
                      {c.status === "refused" && c.refusal_reason && (
                        <p className="text-expense mt-1 text-xs">Motif : {c.refusal_reason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{money(c.amount)}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          LABEL[c.status].cls,
                        )}
                      >
                        {LABEL[c.status].text}
                      </span>
                    </div>
                  </div>
                  {(manager ||
                    (c.status === "pending" && c.declared_by_name === user?.username)) && (
                    <div className="mt-2 flex gap-2">
                      {manager && c.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => act(c, "validate")}>
                            <Check /> Valider
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => act(c, "refuse")}>
                            <X /> Refuser
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="ml-auto"
                        aria-label="Supprimer"
                        onClick={() => act(c, "delete")}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
