import type { BudgetPlanSaveInput, BudgetPlanSaveResult } from "@/lib/budget-types";
import { saveAvailableBudget, saveBudgetLimit } from "@/lib/firefly";

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validPeriod(start: unknown, end: unknown, monthKey: string) {
  return typeof start === "string" && typeof end === "string" && start.startsWith(`${monthKey}-`) && end.startsWith(`${monthKey}-`);
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as BudgetPlanSaveInput;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.monthKey ?? "")) {
      return Response.json({ error: "En giltig månad krävs." }, { status: 400 });
    }
    if (!Array.isArray(body.availableBudgets) || !Array.isArray(body.limits)) {
      return Response.json({ error: "Planen har ett ogiltigt format." }, { status: 400 });
    }

    const availableBudgets: BudgetPlanSaveResult["availableBudgets"] = await Promise.all(
      body.availableBudgets.map(async (entry) => {
        try {
          if (!/^[A-Z]{3}$/.test(entry.currencyCode ?? "") || !validAmount(entry.amount) || !validPeriod(entry.start, entry.end, body.monthKey)) {
            throw new Error("Ogiltigt budgetutrymme.");
          }
          await saveAvailableBudget(entry);
          return { currencyCode: entry.currencyCode, success: true };
        } catch (error) {
          return {
            currencyCode: entry.currencyCode,
            success: false,
            error: error instanceof Error ? error.message : "Okänt fel",
          };
        }
      }),
    );
    const limits: BudgetPlanSaveResult["limits"] = await Promise.all(
      body.limits.map(async (entry) => {
        try {
          if (!entry.budgetId || !validAmount(entry.amount) || !validPeriod(entry.start, entry.end, body.monthKey)) {
            throw new Error("Ogiltigt budgetbelopp.");
          }
          await saveBudgetLimit(entry);
          return { budgetId: entry.budgetId, success: true };
        } catch (error) {
          return {
            budgetId: entry.budgetId,
            success: false,
            error: error instanceof Error ? error.message : "Okänt fel",
          };
        }
      }),
    );

    return Response.json({ availableBudgets, limits } satisfies BudgetPlanSaveResult);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Det gick inte att spara planen." },
      { status: 500 },
    );
  }
}
