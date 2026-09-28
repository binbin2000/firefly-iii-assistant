import { AlertTriangle, Gauge, Landmark, PiggyBank, WalletCards } from "lucide-react";
import type { BudgetRow } from "@/lib/budget-types";
import { formatCurrency, getHealth, summarizeMonth } from "@/lib/budget-math";
import { cn } from "@/lib/utils";

export function BudgetSummaryCards({
  budgets,
  monthKey,
  currency,
}: {
  budgets: BudgetRow[];
  monthKey: string;
  currency: string;
}) {
  const summary = summarizeMonth(budgets, monthKey);
  const attentionCount = budgets.filter((budget) => {
    const cell = budget.cells[monthKey] ?? { planned: 0, actual: 0 };
    return getHealth(cell.planned, cell.actual) !== "good";
  }).length;
  const cards = [
    {
      label: "Månadsbudget",
      value: formatCurrency(summary.totalBudget, currency),
      icon: Landmark,
      tone: "neutral",
    },
    {
      label: "Utfall",
      value: formatCurrency(summary.totalSpending, currency),
      icon: WalletCards,
      tone: "neutral",
    },
    {
      label: "Kvar",
      value: formatCurrency(summary.remaining, currency),
      icon: PiggyBank,
      tone: summary.remaining < 0 ? "danger" : "good",
    },
    {
      label: "Nyttjandegrad",
      value: `${Math.round(summary.utilization * 100)}%`,
      icon: Gauge,
      tone: summary.utilization >= 1 ? "danger" : summary.utilization >= 0.8 ? "warning" : "good",
    },
    {
      label: "Behöver granskas",
      value: `${attentionCount}`,
      icon: AlertTriangle,
      tone: attentionCount > 0 ? "warning" : "neutral",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_1.25fr]">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <span
              className={cn(
                "grid size-8 place-items-center rounded-md",
                card.tone === "neutral" && "bg-slate-100 text-slate-700",
                card.tone === "good" && "bg-emerald-50 text-emerald-700",
                card.tone === "warning" && "bg-amber-50 text-amber-700",
                card.tone === "danger" && "bg-rose-50 text-rose-700",
              )}
            >
              <card.icon className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-xl font-semibold tracking-normal text-slate-950 sm:text-2xl">{card.value}</p>
        </div>
      ))}

      <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-rose-600" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600">Största överskridanden</p>
        </div>
        <div className="mt-3 space-y-2">
          {summary.overspends.length === 0 ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              Inga poster över budget
            </p>
          ) : (
            summary.overspends.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-700">{item.name}</span>
                <span className="font-semibold text-rose-700">{formatCurrency(item.amount, currency)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export const SummaryCards = BudgetSummaryCards;
