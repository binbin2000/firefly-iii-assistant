import { describe, expect, it } from "vitest";
import type { BudgetPeriodSnapshot, BudgetRow } from "@/lib/budget-types";
import { buildBudgetSuggestions, groupRowsByCurrency, monthKeyAtOffset } from "@/lib/budget-planning";

function row(id: string, monthKey: string, planned: number, actual: number, currencyCode = "SEK"): BudgetRow {
  return { id, name: id, group: "Test", currencyCode, currencySymbol: "kr", cells: { [monthKey]: { planned, actual } } };
}

function snapshot(monthKey: string, rows: BudgetRow[]): BudgetPeriodSnapshot {
  return { month: { key: monthKey, label: monthKey, start: `${monthKey}-01`, end: `${monthKey}-28` }, budgets: rows, availableBudgets: [] };
}

describe("budget planning", () => {
  it("handles year boundaries", () => {
    expect(monthKeyAtOffset("2026-12", 1)).toBe("2027-01");
    expect(monthKeyAtOffset("2026-01", -1)).toBe("2025-12");
  });

  it("uses last year for smart comparison and suggests changes at ten percent", () => {
    const suggestions = buildBudgetSuggestions(
      snapshot("2026-10", [row("food", "2026-10", 800, 0)]),
      snapshot("2026-09", [row("food", "2026-09", 700, 720)]),
      snapshot("2025-10", [row("food", "2025-10", 750, 1_000)]),
      "smart",
    );
    expect(suggestions[0]).toMatchObject({ reference: "last-year", referenceAmount: 1_000, suggestedAmount: 1_000 });
  });

  it("falls back to previous month and does not propose zero history", () => {
    const suggestions = buildBudgetSuggestions(
      snapshot("2026-10", [row("food", "2026-10", 800, 0)]),
      snapshot("2026-09", [row("food", "2026-09", 700, 0)]),
      snapshot("2025-10", []),
      "smart",
    );
    expect(suggestions[0]).toMatchObject({ reference: "previous", suggestedAmount: null, deviation: null });
  });

  it("keeps currencies in separate groups", () => {
    const groups = groupRowsByCurrency([row("sek", "2026-10", 1, 0), row("usd", "2026-10", 1, 0, "USD")]);
    expect(Object.keys(groups).sort()).toEqual(["SEK", "USD"]);
  });
});
