"use client";

import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/UserAvatar";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import type { Contribution, GroupBoard, GroupMemberRow } from "@/lib/group";
import { formatPhone } from "@/lib/phone";
import { MASK, useHidden } from "@/lib/privacy";
import { useCurrency } from "@/lib/space";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

import { StatusChip } from "./StatusChip";

const CONTRIBUTION = {
  pending: "text-warning",
  validated: "text-income",
  refused: "text-expense line-through",
};

/**
 * One member's full record: totals, every period's status and every payment, plus the
 * manager's actions — so nobody has to cross-check several screens.
 */
export function MemberSheet({
  member,
  board,
  onClose,
  onEdit,
  onToggleManager,
  onRemove,
}: {
  member: GroupMemberRow | null;
  board: GroupBoard;
  onClose: () => void;
  onEdit: (m: GroupMemberRow) => void;
  onToggleManager: (m: GroupMemberRow) => void;
  onRemove: (m: GroupMemberRow) => void;
}) {
  const currency = useCurrency();
  const hidden = useHidden();
  const money = (v: string | number) => (hidden ? MASK : formatMoney(v, currency));
  const { data: payments } = useApi<Contribution[]>(
    member ? "/group/contributions/" : null,
    member ? { member: member.id } : undefined,
  );
  const manager = board.me.is_manager;
  const tontine = board.kind === "tontine";

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {member && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <UserAvatar name={member.name} />
                <span className="min-w-0">
                  <span className="block truncate">{member.name}</span>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {member.role === "owner"
                      ? "Créateur · gestionnaire"
                      : member.role === "manager"
                        ? "Gestionnaire"
                        : member.user
                          ? "Membre avec l’app"
                          : "Membre carnet (sans l’app)"}
                    {member.phone && ` · ${formatPhone(member.phone)}`}
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground text-xs">Versé (validé)</p>
                <p className="font-semibold tabular-nums">{money(member.paid)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground text-xs">
                  {Number(member.advance) > 0 ? "D’avance" : "Reste dû"}
                </p>
                <p
                  className={cn(
                    "font-semibold tabular-nums",
                    member.late_count > 0 && "text-expense",
                    Number(member.advance) > 0 && "text-income",
                  )}
                >
                  {money(Number(member.advance) > 0 ? member.advance : member.arrears)}
                </p>
              </div>
              {Number(member.pending) > 0 && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">À valider</p>
                  <p className="text-warning font-semibold tabular-nums">{money(member.pending)}</p>
                </div>
              )}
              {Number(member.penalty) > 0 && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Pénalités</p>
                  <p className="text-expense font-semibold tabular-nums">{money(member.penalty)}</p>
                </div>
              )}
            </div>

            {/* Period by period */}
            <section>
              <p className="mb-2 text-sm font-semibold">{tontine ? "Séances" : "Périodes"}</p>
              <ul className="divide-y rounded-lg border text-sm">
                {board.periods.map((period, i) => (
                  <li key={period.index} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-muted-foreground w-20 shrink-0 text-xs">
                      {formatDate(period.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {tontine && period.beneficiary
                        ? period.beneficiary.id === member.id
                          ? "Son tour de manger"
                          : `Mange : ${period.beneficiary.name}`
                        : ""}
                    </span>
                    <StatusChip status={member.statuses[i]} />
                  </li>
                ))}
              </ul>
            </section>

            {/* Payments */}
            <section>
              <p className="mb-2 text-sm font-semibold">Versements</p>
              {payments && payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun versement.</p>
              ) : (
                <ul className="divide-y rounded-lg border text-sm">
                  {(payments ?? []).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block">{formatDate(p.date)}</span>
                        <span className="text-muted-foreground block text-xs">
                          {p.status === "pending"
                            ? "À valider"
                            : p.status === "refused"
                              ? `Refusé${p.refusal_reason ? ` : ${p.refusal_reason}` : ""}`
                              : `Validé${p.reviewed_by_name ? ` par ${p.reviewed_by_name}` : ""}`}
                          {p.reference && ` · réf. ${p.reference}`}
                        </span>
                      </span>
                      <span className={cn("font-semibold tabular-nums", CONTRIBUTION[p.status])}>
                        {money(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {manager && (
              <div className="flex flex-col gap-2 border-t pt-3">
                <Link
                  href={`/group/pay?member=${member.id}`}
                  className={buttonVariants({ className: "h-10" })}
                >
                  <Plus /> Enregistrer un versement pour {member.name}
                </Link>
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(member)}>
                    <Pencil /> Modifier
                  </Button>
                  {member.user && member.role !== "owner" && (
                    <Button variant="ghost" size="sm" onClick={() => onToggleManager(member)}>
                      <ShieldCheck />
                      {member.role === "manager" ? "Retirer gestionnaire" : "Nommer gestionnaire"}
                    </Button>
                  )}
                  {!member.user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-expense ml-auto"
                      onClick={() => onRemove(member)}
                    >
                      <Trash2 /> Retirer
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
