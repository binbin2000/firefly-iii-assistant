import type { BudgetHealth } from "@/lib/budget-types";
import { cn } from "@/lib/utils";

const labels: Record<BudgetHealth, string> = {
  good: "I fas",
  warning: "Bevaka",
  danger: "Över",
};

export function BudgetStatusBadge({ health }: { health: BudgetHealth }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
        health === "good" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        health === "warning" && "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
        health === "danger" && "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
      )}
    >
      {labels[health]}
    </span>
  );
}
