export type BudgetHealth = "good" | "warning" | "danger";

export type BudgetMonth = {
  key: string;
  label: string;
  start: string;
  end: string;
};

export type BudgetCell = {
  planned: number;
  actual: number;
  limitId?: string;
};

export type BudgetRow = {
  id: string;
  name: string;
  group: string;
  currencyCode: string;
  currencySymbol: string;
  cells: Record<string, BudgetCell>;
};

export type BudgetOverview = {
  year: number;
  activeMonthKey: string;
  months: BudgetMonth[];
  budgets: BudgetRow[];
  source: "firefly" | "demo";
};

export type AvailableBudget = {
  id?: string;
  amount: number;
  currencyCode: string;
  currencySymbol: string;
  start: string;
  end: string;
};

export type BudgetPeriodSnapshot = {
  month: BudgetMonth;
  budgets: BudgetRow[];
  availableBudgets: AvailableBudget[];
};

export type PlanningContext = {
  source: "firefly" | "demo";
  current: BudgetPeriodSnapshot;
  next: BudgetPeriodSnapshot;
  previous: BudgetPeriodSnapshot;
  sameMonthLastYear: BudgetPeriodSnapshot;
};

export type ComparisonStrategy = "smart" | "previous" | "last-year";

export type BudgetSuggestion = {
  budgetId: string;
  reference: "previous" | "last-year";
  referenceAmount: number;
  suggestedAmount: number | null;
  deviation: number | null;
  reason: string;
};

export type BudgetPlanSaveInput = {
  monthKey: string;
  availableBudgets: Array<Pick<AvailableBudget, "id" | "amount" | "currencyCode" | "start" | "end">>;
  limits: Array<{
    budgetId: string;
    limitId?: string;
    amount: number;
    start: string;
    end: string;
  }>;
};

export type BudgetPlanSaveResult = {
  availableBudgets: Array<{ currencyCode: string; success: boolean; error?: string }>;
  limits: Array<{ budgetId: string; success: boolean; error?: string }>;
};

export type BudgetSummary = {
  totalBudget: number;
  totalSpending: number;
  remaining: number;
  utilization: number;
  overspends: Array<{
    id: string;
    name: string;
    amount: number;
  }>;
};
