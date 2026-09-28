import type { BudgetMonth, BudgetOverview, BudgetPeriodSnapshot, PlanningContext } from "./budget-types";
import { getCalendarMonthKey, monthKeyAtOffset } from "./budget-planning";
import { getAvailableBudgets, getBudgetOverview } from "./firefly";

function monthFromKey(key: string): BudgetMonth {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return {
    key,
    label: date.toLocaleString("sv-SE", { month: "long" }),
    start: `${key}-01`,
    end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

function emptyOverview(year: number, source: PlanningContext["source"]): BudgetOverview {
  return { year, activeMonthKey: `${year}-01`, months: [], budgets: [], source };
}

export async function getPlanningContext(
  baseMonthKey = getCalendarMonthKey(),
  initialOverview?: BudgetOverview,
): Promise<PlanningContext> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(baseMonthKey)) {
    throw new Error("Ogiltig månad.");
  }

  const keys = {
    current: baseMonthKey,
    next: monthKeyAtOffset(baseMonthKey, 1),
    previous: monthKeyAtOffset(baseMonthKey, -1),
    sameMonthLastYear: monthKeyAtOffset(baseMonthKey, -11),
  };
  const overviewPromises = new Map<number, Promise<BudgetOverview>>();
  if (initialOverview) {
    overviewPromises.set(initialOverview.year, Promise.resolve(initialOverview));
  }
  const overviewFor = (key: string) => {
    const year = Number(key.slice(0, 4));
    if (!overviewPromises.has(year)) {
      overviewPromises.set(year, getBudgetOverview(year));
    }
    return overviewPromises.get(year)!;
  };

  const [currentOverview, nextOverview] = await Promise.all([
    overviewFor(keys.current),
    overviewFor(keys.next),
  ]);
  const source = currentOverview.source;
  const [previousOverview, lastYearOverview] = await Promise.all([
    overviewFor(keys.previous).catch(() => emptyOverview(Number(keys.previous.slice(0, 4)), source)),
    overviewFor(keys.sameMonthLastYear).catch(() => emptyOverview(Number(keys.sameMonthLastYear.slice(0, 4)), source)),
  ]);

  async function snapshot(key: string, overview: BudgetOverview): Promise<BudgetPeriodSnapshot> {
    const month = overview.months.find((candidate) => candidate.key === key) ?? monthFromKey(key);
    const availableBudgets = await getAvailableBudgets(month.start, month.end).catch(() => []);
    return { month, budgets: overview.budgets, availableBudgets };
  }

  const [current, next, previous, sameMonthLastYear] = await Promise.all([
    snapshot(keys.current, currentOverview),
    snapshot(keys.next, nextOverview),
    snapshot(keys.previous, previousOverview),
    snapshot(keys.sameMonthLastYear, lastYearOverview),
  ]);

  return { source, current, next, previous, sameMonthLastYear };
}
