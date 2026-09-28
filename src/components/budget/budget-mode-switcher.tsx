import { BarChart3, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

export type BudgetMode = "follow-up" | "planning";

export function BudgetModeSwitcher({
  mode,
  onModeChange,
}: {
  mode: BudgetMode;
  onModeChange: (mode: BudgetMode) => void;
}) {
  const options = [
    { value: "follow-up" as const, label: "Uppföljning", icon: BarChart3 },
    { value: "planning" as const, label: "Årsplanering", icon: CalendarRange },
  ];

  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1 shadow-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition",
            mode === option.value
              ? "bg-slate-950 text-white"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
          )}
          onClick={() => onModeChange(option.value)}
        >
          <option.icon className="size-4" aria-hidden="true" />
          {option.label}
        </button>
      ))}
    </div>
  );
}
