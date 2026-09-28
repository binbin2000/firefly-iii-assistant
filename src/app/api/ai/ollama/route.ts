import { getBudgetOverview } from "@/lib/firefly";
import { analyzeEconomy, getOllamaStatus, OllamaIntegrationError } from "@/lib/ollama";
import type { AnalysisFocus } from "@/lib/ollama-types";

const focuses: AnalysisFocus[] = ["overview", "budget", "savings"];

export async function GET() {
  return Response.json(await getOllamaStatus());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      year?: unknown;
      monthKey?: unknown;
      focus?: unknown;
      question?: unknown;
      comparisonStrategy?: unknown;
      draftLimits?: unknown;
      availableBudgets?: unknown;
    };
    const year = typeof body.year === "number" ? body.year : Number.NaN;
    const focus = focuses.includes(body.focus as AnalysisFocus)
      ? (body.focus as AnalysisFocus)
      : "overview";

    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      return Response.json({ error: "A valid budget year is required." }, { status: 400 });
    }

    const overview = await getBudgetOverview(year);
    const requestedMonthKey = typeof body.monthKey === "string" ? body.monthKey : "";
    const monthKey = overview.months.some((month) => month.key === requestedMonthKey)
      ? requestedMonthKey
      : overview.activeMonthKey;
    if (body.draftLimits && typeof body.draftLimits === "object" && !Array.isArray(body.draftLimits)) {
      const draftLimits = body.draftLimits as Record<string, unknown>;
      overview.budgets.forEach((budget) => {
        const amount = draftLimits[budget.id];
        if (typeof amount === "number" && Number.isFinite(amount) && amount >= 0) {
          budget.cells[monthKey] = { ...budget.cells[monthKey], planned: amount };
        }
      });
    }

    return Response.json(
      await analyzeEconomy({
        overview,
        monthKey,
        focus,
        question: typeof body.question === "string" ? body.question : undefined,
        planning: {
          comparisonStrategy: typeof body.comparisonStrategy === "string" ? body.comparisonStrategy : undefined,
          availableBudgets:
            body.availableBudgets && typeof body.availableBudgets === "object" && !Array.isArray(body.availableBudgets)
              ? Object.fromEntries(Object.entries(body.availableBudgets).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])))
              : undefined,
        },
      }),
    );
  } catch (error) {
    const status = error instanceof OllamaIntegrationError ? error.status : 500;

    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to analyze the budget." },
      { status },
    );
  }
}
