import type { AvailableBudget, BudgetOverview, BudgetRow } from "./budget-types";

function monthEnd(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}

function makeMonths(year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, index, 1));
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;

    return {
      key,
      label: date.toLocaleString("sv-SE", { month: "short" }),
      start: `${key}-01`,
      end: monthEnd(year, index),
    };
  });
}

const seeds = [
  { id: "1", name: "Matvaror", group: "Vardag", planned: 680, actuals: [642, 701, 614, 688, 733, 512, 695, 720, 654, 711, 689, 748] },
  { id: "2", name: "Restaurang", group: "Livsstil", planned: 260, actuals: [238, 211, 284, 301, 339, 228, 245, 276, 219, 288, 254, 310] },
  { id: "3", name: "Transport", group: "Everyday", planned: 180, actuals: [164, 171, 153, 211, 188, 97, 0, 0, 0, 0, 0, 0] },
  { id: "4", name: "Boende", group: "Fast", planned: 1450, actuals: [1450, 1450, 1450, 1450, 1450, 1450, 1450, 1450, 1450, 1450, 1450, 1450] },
  { id: "5", name: "Utilities", group: "Fixed", planned: 310, actuals: [298, 334, 307, 286, 329, 168, 0, 0, 0, 0, 0, 0] },
  { id: "6", name: "Health", group: "Care", planned: 220, actuals: [67, 191, 242, 84, 160, 41, 0, 0, 0, 0, 0, 0] },
  { id: "7", name: "Travel", group: "Goals", planned: 400, actuals: [0, 120, 0, 560, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "8", name: "Subscriptions", group: "Fixed", planned: 95, actuals: [91, 91, 97, 97, 97, 97, 0, 0, 0, 0, 0, 0] },
];

export function getDemoBudgetOverview(year = new Date().getFullYear()): BudgetOverview {
  const months = makeMonths(year);
  const activeMonthKey = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const budgets: BudgetRow[] = seeds.map((seed) => ({
    id: seed.id,
    name: seed.name,
    group: seed.group,
    currencyCode: "USD",
    currencySymbol: "$",
    cells: Object.fromEntries(
      months.map((month, index) => [
        month.key,
        {
          planned: seed.planned + (index === 11 && seed.name === "Travel" ? 250 : 0),
          actual: seed.actuals[index] ?? 0,
          limitId: `demo-${seed.id}-${month.key}`,
        },
      ]),
    ),
  }));

  return {
    year,
    activeMonthKey,
    months,
    budgets,
    source: "demo",
  };
}

export function getDemoAvailableBudgets(year: number, monthIndex: number): AvailableBudget[] {
  const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return [{
    id: `demo-available-${key}`,
    amount: 4200,
    currencyCode: "USD",
    currencySymbol: "$",
    start: `${key}-01`,
    end: monthEnd(year, monthIndex),
  }];
}
