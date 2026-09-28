import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextMonthPlanner } from "@/components/budget/next-month-planner";
import type { BudgetPeriodSnapshot, PlanningContext } from "@/lib/budget-types";

function snapshot(monthKey: string, planned: number, actual: number, available = 50): BudgetPeriodSnapshot {
  return {
    month: { key: monthKey, label: monthKey, start: `${monthKey}-01`, end: `${monthKey}-28` },
    budgets: [{
      id: "food",
      name: "Mat",
      group: "Vardag",
      currencyCode: "SEK",
      currencySymbol: "kr",
      cells: { [monthKey]: { planned, actual, limitId: `limit-${monthKey}` } },
    }],
    availableBudgets: [{ id: `available-${monthKey}`, amount: available, currencyCode: "SEK", currencySymbol: "kr", start: `${monthKey}-01`, end: `${monthKey}-28` }],
  };
}

const context: PlanningContext = {
  source: "demo",
  current: snapshot("2026-09", 100, 80),
  next: snapshot("2026-10", 100, 0),
  previous: snapshot("2026-09", 100, 200),
  sameMonthLastYear: { ...snapshot("2025-10", 0, 0), budgets: [] },
};

afterEach(() => vi.restoreAllMocks());

describe("NextMonthPlanner", () => {
  it("applies a rule suggestion to the local draft", () => {
    render(<NextMonthPlanner context={context} onContextChange={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Använd förslag" }));
    expect(screen.getByRole("textbox", { name: "Mat budgetutkast" })).toHaveValue("200");
  });

  it("requires confirmation before saving an over-allocated plan", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<NextMonthPlanner context={context} onContextChange={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Spara plan" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
