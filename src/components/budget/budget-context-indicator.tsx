import type { BudgetMonth, BudgetRow } from "@/lib/budget-types";
import { formatCurrency } from "@/lib/budget-math";
import { cn } from "@/lib/utils";

export function BudgetContextIndicator({
  row,
  months,
  activeMonthKey,
}: {
  row: BudgetRow;
  months: BudgetMonth[];
  activeMonthKey: string;
}) {
  const activeIndex = months.findIndex((month) => month.key === activeMonthKey);
  const previousMonth = activeIndex > 0 ? months[activeIndex - 1] : undefined;
  const nextMonth = activeIndex < months.length - 1 ? months[activeIndex + 1] : undefined;
  const current = row.cells[activeMonthKey] ?? { planned: 0, actual: 0 };
  const previous = previousMonth ? row.cells[previousMonth.key] : undefined;
  const next = nextMonth ? row.cells[nextMonth.key] : undefined;
  const plannedDelta = previous ? current.planned - previous.planned : 0;
  const previousOver = previous ? previous.actual - previous.planned : 0;

  if (previousOver > 0) {
    return (
      <span className="text-sm font-medium text-rose-700">
        Över med {formatCurrency(previousOver, row.currencyCode)} förra månaden
      </span>
    );
  }

  if (previous && plannedDelta !== 0) {
    return (
      <span className={cn("text-sm font-medium", plannedDelta > 0 ? "text-slate-700" : "text-slate-500")}>
        {plannedDelta > 0 ? "+" : "-"}
        {formatCurrency(Math.abs(plannedDelta), row.currencyCode)} mot förra månaden
      </span>
    );
  }

  if (previous) {
    return <span className="text-sm text-slate-500">Samma som förra månaden</span>;
  }

  if (next) {
    return (
      <span className="text-sm text-slate-500">
        Nästa månad: {formatCurrency(next.planned, row.currencyCode)}
      </span>
    );
  }

  return <span className="text-sm text-slate-400">Ingen jämförelse ännu</span>;
}
