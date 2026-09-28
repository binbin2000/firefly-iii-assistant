import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveAvailableBudget: vi.fn(),
  saveBudgetLimit: vi.fn(),
}));

vi.mock("@/lib/firefly", () => mocks);

import { PUT } from "../route";

const validBody = {
  monthKey: "2026-10",
  availableBudgets: [{ amount: 3_000, currencyCode: "SEK", start: "2026-10-01", end: "2026-10-31" }],
  limits: [{ budgetId: "food", amount: 900, start: "2026-10-01", end: "2026-10-31" }],
};

beforeEach(() => {
  mocks.saveAvailableBudget.mockReset().mockResolvedValue({});
  mocks.saveBudgetLimit.mockReset().mockResolvedValue({});
});

describe("PUT /api/budgets/plan", () => {
  it("returns a result for every successful write", async () => {
    const response = await PUT(new Request("http://localhost/api/budgets/plan", { method: "PUT", body: JSON.stringify(validBody) }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      availableBudgets: [{ currencyCode: "SEK", success: true }],
      limits: [{ budgetId: "food", success: true }],
    });
  });

  it("reports partial Firefly failures without hiding successful writes", async () => {
    mocks.saveBudgetLimit.mockRejectedValue(new Error("Firefly svarade 500"));
    const response = await PUT(new Request("http://localhost/api/budgets/plan", { method: "PUT", body: JSON.stringify(validBody) }));
    const body = await response.json();
    expect(body.availableBudgets[0].success).toBe(true);
    expect(body.limits[0]).toEqual({ budgetId: "food", success: false, error: "Firefly svarade 500" });
  });

  it("rejects periods outside the selected month", async () => {
    const response = await PUT(new Request("http://localhost/api/budgets/plan", {
      method: "PUT",
      body: JSON.stringify({ ...validBody, limits: [{ ...validBody.limits[0], start: "2026-09-01" }] }),
    }));
    const body = await response.json();
    expect(body.limits[0].success).toBe(false);
    expect(mocks.saveBudgetLimit).not.toHaveBeenCalled();
  });
});
