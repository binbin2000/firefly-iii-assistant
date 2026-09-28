import type { BudgetHealth, BudgetOverview, BudgetRow, BudgetSummary } from "./budget-types";

export function formatCurrency(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value)}`;
  }
}

export function getRemaining(planned: number, actual: number) {
  return planned - actual;
}

export function getUtilization(planned: number, actual: number) {
  if (planned <= 0) {
    return actual > 0 ? 1 : 0;
  }

  return actual / planned;
}

export function getHealth(planned: number, actual: number): BudgetHealth {
  const utilization = getUtilization(planned, actual);

  if (utilization >= 1) {
    return "danger";
  }

  if (utilization >= 0.8) {
    return "warning";
  }

  return "good";
}

export function summarizeMonth(rows: BudgetRow[], monthKey: string): BudgetSummary {
  const totalBudget = rows.reduce((sum, row) => sum + (row.cells[monthKey]?.planned ?? 0), 0);
  const totalSpending = rows.reduce((sum, row) => sum + (row.cells[monthKey]?.actual ?? 0), 0);
  const overspends = rows
    .map((row) => {
      const cell = row.cells[monthKey];
      return {
        id: row.id,
        name: row.name,
        amount: cell ? Math.max(0, cell.actual - cell.planned) : 0,
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return {
    totalBudget,
    totalSpending,
    remaining: totalBudget - totalSpending,
    utilization: getUtilization(totalBudget, totalSpending),
    overspends,
  };
}

export function cloneOverview(overview: BudgetOverview): BudgetOverview {
  return {
    ...overview,
    months: overview.months.map((month) => ({ ...month })),
    budgets: overview.budgets.map((budget) => ({
      ...budget,
      cells: Object.fromEntries(
        Object.entries(budget.cells).map(([key, value]) => [key, { ...value }]),
      ),
    })),
  };
}
