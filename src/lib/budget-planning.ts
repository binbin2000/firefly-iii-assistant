import type {
  BudgetPeriodSnapshot,
  BudgetRow,
  BudgetSuggestion,
  ComparisonStrategy,
} from "./budget-types";

export function monthKeyAtOffset(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getCalendarMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function hasRelevantHistory(row: BudgetRow | undefined, monthKey: string) {
  const cell = row?.cells[monthKey];
  return Boolean(cell && (cell.actual > 0 || cell.planned > 0));
}

export function buildBudgetSuggestions(
  next: BudgetPeriodSnapshot,
  previous: BudgetPeriodSnapshot,
  sameMonthLastYear: BudgetPeriodSnapshot,
  strategy: ComparisonStrategy,
): BudgetSuggestion[] {
  return next.budgets.map((row) => {
    const previousRow = previous.budgets.find((candidate) => candidate.id === row.id);
    const lastYearRow = sameMonthLastYear.budgets.find((candidate) => candidate.id === row.id);
    const useLastYear =
      strategy === "last-year" ||
      (strategy === "smart" && hasRelevantHistory(lastYearRow, sameMonthLastYear.month.key));
    const reference = useLastYear ? "last-year" : "previous";
    const referenceRow = useLastYear ? lastYearRow : previousRow;
    const referenceMonth = useLastYear ? sameMonthLastYear.month : previous.month;
    const referenceAmount = referenceRow?.cells[referenceMonth.key]?.actual ?? 0;
    const planned = row.cells[next.month.key]?.planned ?? 0;

    if (referenceAmount <= 0) {
      return {
        budgetId: row.id,
        reference,
        referenceAmount: 0,
        suggestedAmount: null,
        deviation: null,
        reason: "Historiskt utfall saknas eller är noll.",
      };
    }

    const deviation = Math.abs(planned - referenceAmount) / referenceAmount;
    return {
      budgetId: row.id,
      reference,
      referenceAmount,
      suggestedAmount: deviation >= 0.1 ? Math.round(referenceAmount * 100) / 100 : null,
      deviation,
      reason:
        deviation >= 0.1
          ? `Planen avviker ${Math.round(deviation * 100)} % från historiskt utfall.`
          : "Planen ligger nära historiskt utfall.",
    };
  });
}

export function groupRowsByCurrency(rows: BudgetRow[]) {
  return rows.reduce<Record<string, BudgetRow[]>>((groups, row) => {
    (groups[row.currencyCode] ??= []).push(row);
    return groups;
  }, {});
}
