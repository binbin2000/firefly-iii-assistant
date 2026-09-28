import { describe, expect, it } from "vitest";
import type { BudgetOverview, BudgetRow } from "@/lib/budget-types";
import {
  cloneOverview,
  formatCurrency,
  getHealth,
  getRemaining,
  getUtilization,
  summarizeMonth,
} from "@/lib/budget-math";

const monthKey = "2026-09";

function budgetRow(
  id: string,
  name: string,
  planned: number,
  actual: number,
): BudgetRow {
  return {
    id,
    name,
    group: "Household",
    currencyCode: "USD",
    currencySymbol: "$",
    cells: { [monthKey]: { planned, actual, limitId: `limit-${id}` } },
  };
}

describe("budget calculations", () => {
  it("formats whole currency amounts and falls back for invalid currency codes", () => {
    expect(formatCurrency(1234.6, "USD")).toBe("1 235 US$");
    expect(formatCurrency(1234.6, "NOT_A_CURRENCY")).toBe("NOT_A_CURRENCY 1 235");
  });

  it("calculates the remaining amount", () => {
    expect(getRemaining(1_000, 650)).toBe(350);
    expect(getRemaining(500, 725)).toBe(-225);
  });

  it.each([
    { planned: 1_000, actual: 250, expected: 0.25 },
    { planned: 0, actual: 0, expected: 0 },
    { planned: 0, actual: 10, expected: 1 },
    { planned: -100, actual: 10, expected: 1 },
  ])(
    "returns $expected utilization for $actual spent against $planned",
    ({ planned, actual, expected }) => {
      expect(getUtilization(planned, actual)).toBe(expected);
    },
  );

  it.each([
    { planned: 1_000, actual: 799, expected: "good" },
    { planned: 1_000, actual: 800, expected: "warning" },
    { planned: 1_000, actual: 999, expected: "warning" },
    { planned: 1_000, actual: 1_000, expected: "danger" },
  ] as const)(
    "classifies $actual of $planned as $expected",
    ({ planned, actual, expected }) => {
      expect(getHealth(planned, actual)).toBe(expected);
    },
  );
});

describe("summarizeMonth", () => {
  it("totals a month and returns the three largest overspends", () => {
    const rows = [
      budgetRow("rent", "Rent", 1_000, 1_050),
      budgetRow("food", "Food", 400, 550),
      budgetRow("travel", "Travel", 200, 450),
      budgetRow("energy", "Energy", 100, 125),
      budgetRow("savings", "Savings", 500, 200),
    ];

    expect(summarizeMonth(rows, monthKey)).toEqual({
      totalBudget: 2_200,
      totalSpending: 2_375,
      remaining: -175,
      utilization: 2_375 / 2_200,
      overspends: [
        { id: "travel", name: "Travel", amount: 250 },
        { id: "food", name: "Food", amount: 150 },
        { id: "rent", name: "Rent", amount: 50 },
      ],
    });
  });

  it("treats missing month cells as zero", () => {
    const row = budgetRow("rent", "Rent", 1_000, 900);

    expect(summarizeMonth([row], "2027-01")).toEqual({
      totalBudget: 0,
      totalSpending: 0,
      remaining: 0,
      utilization: 0,
      overspends: [],
    });
  });
});

describe("cloneOverview", () => {
  it("creates independent month, budget, and cell objects", () => {
    const overview: BudgetOverview = {
      year: 2026,
      activeMonthKey: monthKey,
      months: [{ key: monthKey, label: "September", start: "2026-09-01", end: "2026-09-30" }],
      budgets: [budgetRow("food", "Food", 400, 250)],
      source: "demo",
    };

    const clone = cloneOverview(overview);
    clone.months[0].label = "Changed";
    clone.budgets[0].name = "Changed";
    clone.budgets[0].cells[monthKey].planned = 999;

    expect(overview.months[0].label).toBe("September");
    expect(overview.budgets[0].name).toBe("Food");
    expect(overview.budgets[0].cells[monthKey].planned).toBe(400);
  });
});
