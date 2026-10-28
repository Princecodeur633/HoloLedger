export type TransactionType = "income" | "expense";
export type CategoryType = TransactionType | "both";
export type Period = "day" | "week" | "month" | "quarter" | "semester" | "year";
export type PaymentMethod = "cash" | "mobile_money" | "card" | "transfer" | "other";

export interface User {
  id: string;
  username: string;
  /** E.164, e.g. +242061234567 (null only for accounts created in the admin). */
  phone: string | null;
  email: string | null;
  whatsapp_verified: boolean;
  currency: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  is_default: boolean;
  created_at: string;
}

/** Decimal values are serialized as strings by Django REST Framework. */
export type Decimal = string;

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: Decimal;
  currency: string;
  date: string;
  description: string;
  category: string;
  category_detail: Category;
  account: string;
  account_name: string;
  recurring_rule: string | null;
  source: string;
  payment_method: PaymentMethod;
  note: string;
  created_at: string;
  updated_at: string;
}

export type TransactionInput = Pick<
  Transaction,
  "type" | "amount" | "date" | "description" | "category" | "source" | "payment_method" | "note"
> & {
  /** Empty or missing: the server uses the default account. */
  account?: string;
};

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Totals {
  income: Decimal;
  expense: Decimal;
  net: Decimal;
  count: number;
}

export interface CategoryShare {
  category: Pick<Category, "id" | "name" | "color" | "icon">;
  total: Decimal;
  count: number;
  percent: number;
}

export interface Summary {
  currency: string;
  balance: Decimal;
  total_income: Decimal;
  total_expense: Decimal;
  accounts: Pick<Account, "id" | "name" | "type" | "color" | "icon" | "balance">[];
  month: Totals & { start: string; end: string };
  top_expense_categories: CategoryShare[];
  budget_alerts: BudgetAlert[];
  pending_recurring_count: number;
  recent_transactions: Transaction[];
}

export interface SeriesPoint {
  start: string;
  income: Decimal;
  expense: Decimal;
  net: Decimal;
}

export interface PeriodStats extends Totals {
  period: Period;
  start: string;
  end: string;
  currency: string;
  bucket: "day" | "week" | "month";
  series: SeriesPoint[];
}

export interface CategoryStats {
  period: Period;
  start: string;
  end: string;
  type: TransactionType;
  categories: CategoryShare[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type AccountType = "cash" | "mobile_money" | "bank" | "savings" | "other";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initial_balance: Decimal;
  balance: Decimal;
  color: string;
  icon: string;
  is_archived: boolean;
  created_at: string;
}

export interface Transfer {
  id: string;
  from_account: string;
  from_account_name: string;
  to_account: string;
  to_account_name: string;
  amount: Decimal;
  fee: Decimal;
  fee_transaction: string | null;
  date: string;
  note: string;
  created_at: string;
}

export type BudgetStatus = "ok" | "warning" | "over";

export interface BudgetUsage {
  month_start: string;
  month_end: string;
  spent: Decimal;
  remaining: Decimal;
  percent: number;
  status: BudgetStatus;
}

export interface Budget {
  id: string;
  category: string;
  category_detail: Category;
  amount: Decimal;
  alert_threshold: number;
  usage: BudgetUsage | null;
}

export interface BudgetAlert extends BudgetUsage {
  budget: string;
  category: Pick<Category, "id" | "name" | "color" | "icon">;
  amount: Decimal;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: Decimal;
  saved_amount: Decimal;
  remaining: Decimal;
  percent: number;
  reached: boolean;
  deadline: string | null;
  color: string;
  icon: string;
  created_at: string;
}

export interface GoalContribution {
  id: string;
  amount: Decimal;
  date: string;
  note: string;
  created_at: string;
}

export type Frequency = "weekly" | "monthly" | "yearly";

export interface RecurringRule {
  id: string;
  type: TransactionType;
  amount: Decimal;
  category: string;
  category_detail: Category;
  account: string;
  account_name: string;
  description: string;
  payment_method: PaymentMethod;
  frequency: Frequency;
  interval: number;
  start_date: string;
  end_date: string | null;
  next_date: string | null;
  auto_confirm: boolean;
  is_active: boolean;
}

export interface Insights {
  period: Period;
  start: string;
  end: string;
  currency: string;
  current: Totals;
  previous: Totals & { start: string; end: string };
  change: { income: number | null; expense: number | null };
  savings_rate: number | null;
  days_elapsed: number;
  days_total: number;
  average_daily_expense: Decimal | null;
  projection: { expense: Decimal; net: Decimal } | null;
  top_expenses: Transaction[];
  by_payment_method: { payment_method: PaymentMethod; total: Decimal }[];
  by_account: (Totals & { account: string; name: string; color: string })[];
  balance_history: { start: string; balance: Decimal }[];
  balance_history_bucket: "day" | "week" | "month";
}

export type ImportRole = "date" | "description" | "amount" | "debit" | "credit";
export type ImportMapping = Partial<Record<ImportRole, number>>;

export interface ImportPreview {
  headers: string[];
  rows: string[][];
  mapping: ImportMapping;
}

export interface ImportRow {
  index: number;
  error: string | null;
  duplicate: boolean;
  skip: boolean;
  date?: string;
  description?: string;
  type?: TransactionType;
  amount?: Decimal;
  category?: string | null;
}

export interface SmsParse {
  kind: TransactionType | "withdrawal" | null;
  amount: Decimal;
  fee: Decimal | null;
  balance: Decimal | null;
  date: string | null;
  counterparty: string | null;
  reference: string | null;
  operator: "mtn" | "orange" | null;
  suggested_account: string | null;
  suggested_category: string | null;
}
