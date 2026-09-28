import { AlertTriangle, ArrowRight, Gauge, Landmark, PiggyBank, WalletCards } from "lucide-react";
import type { BudgetPeriodSnapshot } from "@/lib/budget-types";
import { formatCurrency, getHealth, getRemaining, getUtilization } from "@/lib/budget-math";
import { groupRowsByCurrency } from "@/lib/budget-planning";
import { cn } from "@/lib/utils";
import { BudgetStatusBadge } from "./budget-status-badge";

export function CurrentMonthOverview({
  snapshot,
  onOpenDetails,
}: {
  snapshot: BudgetPeriodSnapshot;
  onOpenDetails: (budgetId: string) => void;
}) {
  const groups = groupRowsByCurrency(snapshot.budgets);

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([currency, rows]) => {
        const allocated = rows.reduce((sum, row) => sum + (row.cells[snapshot.month.key]?.planned ?? 0), 0);
        const actual = rows.reduce((sum, row) => sum + (row.cells[snapshot.month.key]?.actual ?? 0), 0);
        const available = snapshot.availableBudgets.find((item) => item.currencyCode === currency)?.amount;
        const utilization = getUtilization(allocated, actual);
        const cards = [
          { label: "Budgetutrymme", value: available === undefined ? "Ej angivet" : formatCurrency(available, currency), icon: Landmark },
          { label: "Fördelad budget", value: formatCurrency(allocated, currency), icon: WalletCards },
          { label: "Faktiskt utfall", value: formatCurrency(actual, currency), icon: Gauge },
          { label: "Kvar i budget", value: formatCurrency(allocated - actual, currency), icon: PiggyBank },
          { label: "Nyttjandegrad", value: `${Math.round(utilization * 100)} %`, icon: AlertTriangle },
        ];
        const sorted = [...rows].sort((a, b) => {
          const aCell = a.cells[snapshot.month.key] ?? { planned: 0, actual: 0 };
          const bCell = b.cells[snapshot.month.key] ?? { planned: 0, actual: 0 };
          const rank = { danger: 0, warning: 1, good: 2 };
          return rank[getHealth(aCell.planned, aCell.actual)] - rank[getHealth(bCell.planned, bCell.actual)];
        });

        return (
          <section key={currency} className="space-y-3" aria-label={`${currency} budgetöversikt`}>
            {Object.keys(groups).length > 1 ? <h2 className="text-lg font-semibold">{currency}</h2> : null}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {cards.map((card) => (
                <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-slate-500">
                    <p className="text-sm font-medium">{card.label}</p>
                    <card.icon className="size-4" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-xl font-semibold text-slate-950">{card.value}</p>
                </article>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold text-slate-950">Budgetposter i {snapshot.month.label}</h2>
                <p className="mt-1 text-sm text-slate-500">Poster som behöver uppmärksamhet visas först.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {sorted.map((row) => {
                  const cell = row.cells[snapshot.month.key] ?? { planned: 0, actual: 0 };
                  const health = getHealth(cell.planned, cell.actual);
                  const utilization = getUtilization(cell.planned, cell.actual);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className="grid w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:grid-cols-[minmax(180px,1fr)_repeat(3,minmax(110px,.45fr))_150px_32px] sm:items-center"
                      onClick={() => onOpenDetails(row.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">{row.name}</span>
                        <span className="text-xs text-slate-500">{row.group}</span>
                      </span>
                      <span className="text-sm"><span className="text-slate-500">Planerat </span>{formatCurrency(cell.planned, currency)}</span>
                      <span className="text-sm"><span className="text-slate-500">Utfall </span>{formatCurrency(cell.actual, currency)}</span>
                      <span className={cn("text-sm font-semibold", getRemaining(cell.planned, cell.actual) < 0 ? "text-rose-700" : "text-emerald-700")}>
                        {formatCurrency(getRemaining(cell.planned, cell.actual), currency)} kvar
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span className={cn("block h-full", health === "good" && "bg-emerald-500", health === "warning" && "bg-amber-400", health === "danger" && "bg-rose-500")} style={{ width: `${Math.min(100, utilization * 100)}%` }} />
                        </span>
                        <BudgetStatusBadge health={health} />
                      </span>
                      <ArrowRight className="size-4 text-slate-400" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
