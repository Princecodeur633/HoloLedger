import type { Decimal } from "./types";

export type GroupStatus = "paid" | "pending" | "due" | "late" | "upcoming";

/** Same colors everywhere: green paid, orange to validate, red late, grey not due yet. */
export const STATUS: Record<GroupStatus, { label: string; dot: string; chip: string }> = {
  paid: { label: "Payé", dot: "bg-income", chip: "bg-income/10 text-income" },
  pending: {
    label: "À valider",
    dot: "bg-warning",
    chip: "bg-warning/15 text-warning",
  },
  due: { label: "À payer", dot: "bg-foreground/40", chip: "bg-muted text-foreground" },
  late: { label: "En retard", dot: "bg-expense", chip: "bg-expense/10 text-expense" },
  upcoming: {
    label: "À venir",
    dot: "bg-muted-foreground/20",
    chip: "bg-muted text-muted-foreground",
  },
};

export interface GroupRules {
  contribution_amount: Decimal;
  frequency: "weekly" | "biweekly" | "monthly";
  start_date: string;
  payment_delay_days: number;
  late_penalty: Decimal;
  goal_name: string;
  goal_amount: Decimal | null;
}

export const FREQUENCIES: { value: GroupRules["frequency"]; label: string }[] = [
  { value: "weekly", label: "Chaque semaine" },
  { value: "biweekly", label: "Toutes les 2 semaines" },
  { value: "monthly", label: "Chaque mois" },
];

export interface GroupMemberRow {
  id: string;
  name: string;
  phone: string;
  user: string | null;
  role: "owner" | "manager" | "member" | null;
  position: number;
  amount: Decimal;
  expected_amount: Decimal | null;
  paid: Decimal;
  pending: Decimal;
  owed_to_date: Decimal;
  arrears: Decimal;
  advance: Decimal;
  late_count: number;
  penalty: Decimal;
  statuses: GroupStatus[];
}

export interface GroupPeriod {
  index: number;
  date: string;
  deadline: string;
  collected: Decimal;
  expected: Decimal;
  beneficiary?: { id: string; name: string } | null;
  payout?: {
    id: string;
    amount: Decimal;
    date: string;
    member: string;
    member_user: string | null;
    recorded_in_personal: boolean;
  } | null;
}

export interface GroupBoard {
  kind: "tontine" | "family";
  rules: GroupRules;
  members: GroupMemberRow[];
  periods: GroupPeriod[];
  current_period: GroupPeriod | null;
  totals: {
    validated: Decimal;
    pending: Decimal;
    spent: Decimal;
    paid_out: Decimal;
    cash: Decimal;
    arrears: Decimal;
    penalties: Decimal;
    late_members: number;
  };
  me: { member: string | null; is_manager: boolean };
  pending_count: number;
}

export interface Contribution {
  id: string;
  member: string;
  member_name: string;
  amount: Decimal;
  date: string;
  reference: string;
  note: string;
  status: "pending" | "validated" | "refused";
  declared_by_name: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  refusal_reason: string;
  created_at: string;
}

export interface GroupExpense {
  id: string;
  amount: Decimal;
  purpose: string;
  note: string;
  date: string;
  created_by_name: string | null;
}

export const isGroupKind = (kind: string | undefined) => kind === "tontine" || kind === "family";

/** Ready-to-send WhatsApp summary of the current session / month, for the group chat. */
export function shareText(
  board: GroupBoard,
  spaceName: string,
  money: (v: string | number) => string,
  date: (iso: string) => string,
) {
  const period = board.current_period;
  const at = period ? board.periods.findIndex((p) => p.index === period.index) : -1;
  const names = (status: GroupStatus) =>
    board.members.filter((m) => at >= 0 && m.statuses[at] === status).map((m) => m.name);
  const lines = [`*${spaceName}*`];
  if (period) {
    if (board.kind === "tontine") {
      lines.push(`Séance ${period.index} · ${date(period.date)}`);
      if (period.beneficiary) lines.push(`🍽️ C’est ${period.beneficiary.name} qui mange`);
    } else {
      lines.push(`Cotisations du ${date(period.date)}`);
    }
    lines.push(`💰 ${money(period.collected)} sur ${money(period.expected)}`, "");
  }
  const groups: [string, string[]][] = [
    ["✅ Payé", names("paid")],
    ["⏳ À valider", names("pending")],
    ["🔴 En retard", names("late")],
    ["⚪ À payer", names("due")],
  ];
  for (const [label, list] of groups) if (list.length) lines.push(`${label} : ${list.join(", ")}`);
  if (period) lines.push("", `Date limite : ${date(period.deadline)}`);
  if (board.kind === "family") lines.push(`En caisse : ${money(board.totals.cash)}`);
  lines.push("", "Suivi sur HoloLedger");
  return lines.join("\n");
}

/** The rules in one plain sentence: "10 000 FCFA chaque mois · à payer sous 3 jours · …". */
export function rulesSummary(rules: GroupRules, money: (v: string | number) => string) {
  const parts = [
    `${money(rules.contribution_amount)} ${FREQUENCIES.find((f) => f.value === rules.frequency)?.label.toLowerCase() ?? ""}`,
    `à payer sous ${rules.payment_delay_days} jour${rules.payment_delay_days > 1 ? "s" : ""}`,
  ];
  if (Number(rules.late_penalty) > 0) parts.push(`pénalité de retard ${money(rules.late_penalty)}`);
  if (rules.goal_amount && Number(rules.goal_amount) > 0)
    parts.push(`${rules.goal_name || "objectif"} : ${money(rules.goal_amount)}`);
  return parts.join(" · ");
}
