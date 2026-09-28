"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import type { BudgetMonth, BudgetRow } from "@/lib/budget-types";
import { formatCurrency, getHealth, getRemaining, getUtilization } from "@/lib/budget-math";
import { cn } from "@/lib/utils";
import { BudgetContextIndicator } from "./budget-context-indicator";
import { BudgetRowDetails } from "./budget-row-details";
import { BudgetStatusBadge } from "./budget-status-badge";

type SortKey = "category" | "planned" | "actual" | "remaining" | "used" | "status" | "context";
type SortDirection = "asc" | "desc";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

const healthRank = { danger: 0, warning: 1, good: 2 };

const sortableColumns: Array<{
  key: SortKey;
  label: string;
  className?: string;
}> = [
  { key: "category", label: "Budgetpost" },
  { key: "planned", label: "Planerat", className: "justify-end text-right" },
  { key: "actual", label: "Utfall", className: "justify-end text-right" },
  { key: "remaining", label: "Kvar", className: "justify-end text-right" },
  { key: "used", label: "Använt" },
  { key: "status", label: "Status" },
  { key: "context", label: "Jämförelse" },
];

function getContextLabel(row: BudgetRow, months: BudgetMonth[], activeMonthKey: string) {
  const activeIndex = months.findIndex((month) => month.key === activeMonthKey);
  const previousMonth = activeIndex > 0 ? months[activeIndex - 1] : undefined;
  const nextMonth = activeIndex < months.length - 1 ? months[activeIndex + 1] : undefined;
  const current = row.cells[activeMonthKey] ?? { planned: 0, actual: 0 };
  const previous = previousMonth ? row.cells[previousMonth.key] : undefined;
  const next = nextMonth ? row.cells[nextMonth.key] : undefined;
  const plannedDelta = previous ? current.planned - previous.planned : 0;
  const previousOver = previous ? previous.actual - previous.planned : 0;

  if (previousOver > 0) {
    return `over ${previousOver}`;
  }

  if (previous && plannedDelta !== 0) {
    return `delta ${plannedDelta}`;
  }

  if (previous) {
    return "same";
  }

  if (next) {
    return `next ${next.planned}`;
  }

  return "none";
}

function compareStrings(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getSortValue(row: BudgetRow, months: BudgetMonth[], activeMonthKey: string, key: SortKey) {
  const cell = row.cells[activeMonthKey] ?? { planned: 0, actual: 0 };

  switch (key) {
    case "category":
      return `${row.name} ${row.group}`;
    case "planned":
      return cell.planned;
    case "actual":
      return cell.actual;
    case "remaining":
      return getRemaining(cell.planned, cell.actual);
    case "used":
      return getUtilization(cell.planned, cell.actual);
    case "status":
      return healthRank[getHealth(cell.planned, cell.actual)];
    case "context":
      return getContextLabel(row, months, activeMonthKey);
  }
}

function compareRows(a: BudgetRow, b: BudgetRow, months: BudgetMonth[], activeMonthKey: string, sort: SortState) {
  const aValue = getSortValue(a, months, activeMonthKey, sort.key);
  const bValue = getSortValue(b, months, activeMonthKey, sort.key);
  const direction = sort.direction === "asc" ? 1 : -1;
  const primary =
    typeof aValue === "number" && typeof bValue === "number"
      ? aValue - bValue
      : compareStrings(String(aValue), String(bValue));

  if (primary !== 0) {
    return primary * direction;
  }

  return compareStrings(a.name, b.name);
}

function SortableHeader({
  column,
  sort,
  onSortChange,
}: {
  column: (typeof sortableColumns)[number];
  sort: SortState;
  onSortChange: (key: SortKey) => void;
}) {
  const isActive = sort.key === column.key;
  const Icon = isActive && sort.direction === "asc" ? ChevronUp : ChevronDown;

  return (
    <th
      className="border-b border-slate-200 px-4 py-3"
      aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={cn(
          "inline-flex w-full items-center gap-1.5 rounded-sm text-xs font-semibold uppercase text-slate-500 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-100",
          column.className,
          isActive && "text-slate-950",
        )}
        onClick={() => onSortChange(column.key)}
        aria-label={`Sortera efter ${column.label} ${isActive && sort.direction === "asc" ? "fallande" : "stigande"}`}
      >
        <span>{column.label}</span>
        <Icon className={cn("size-3.5", !isActive && "opacity-40")} aria-hidden="true" />
      </button>
    </th>
  );
}

export function MonthlyFollowUpTable({
  rows,
  months,
  activeMonthKey,
  focusedBudgetId,
  onPlanChange,
  onQuickAdjust,
}: {
  rows: BudgetRow[];
  months: BudgetMonth[];
  activeMonthKey: string;
  focusedBudgetId?: string | null;
  onPlanChange: (budgetId: string, monthKey: string, value: number) => void;
  onQuickAdjust: (budgetId: string, monthKey: string, delta: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(focusedBudgetId ?? null);
  const [sort, setSort] = useState<SortState>({ key: "status", direction: "asc" });
  const activeMonth = months.find((month) => month.key === activeMonthKey) ?? months[0];
  const sortedRows = useMemo(() => [...rows].sort((a, b) => compareRows(a, b, months, activeMonthKey, sort)), [
    activeMonthKey,
    months,
    rows,
    sort,
  ]);

  const changeSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-3 py-3 sm:px-4">
        <h2 className="text-base font-semibold text-slate-950">Uppföljning för {activeMonth.label}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Granska återstående belopp, nyttjandegrad och poster som behöver uppmärksamhet.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-xs font-semibold uppercase text-slate-500">
              {sortableColumns.map((column) => (
                <SortableHeader key={column.key} column={column} sort={sort} onSortChange={changeSort} />
              ))}
              <th className="border-b border-slate-200 px-4 py-3 text-right">Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const cell = row.cells[activeMonthKey] ?? { planned: 0, actual: 0 };
              const remaining = getRemaining(cell.planned, cell.actual);
              const utilization = getUtilization(cell.planned, cell.actual);
              const health = getHealth(cell.planned, cell.actual);
              const isExpanded = expandedId === row.id;

              return (
                <Fragment key={row.id}>
                  <tr
                    className={cn(
                      "group cursor-pointer align-top hover:bg-slate-50",
                      isExpanded && "bg-slate-50",
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                  >
                    <td className="border-b border-slate-100 px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
                          {isExpanded ? (
                            <ChevronDown className="size-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="size-4" aria-hidden="true" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{row.name}</p>
                          <p className="truncate text-xs font-medium text-slate-500">{row.group}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(cell.planned, row.currencyCode)}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-medium text-slate-700">
                      {formatCurrency(cell.actual, row.currencyCode)}
                    </td>
                    <td
                      className={cn(
                        "border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold",
                        remaining < 0 ? "text-rose-700" : "text-emerald-700",
                      )}
                    >
                      {formatCurrency(remaining, row.currencyCode)}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              health === "good" && "bg-emerald-500",
                              health === "warning" && "bg-amber-400",
                              health === "danger" && "bg-rose-500",
                            )}
                            style={{ width: `${Math.min(100, Math.round(utilization * 100))}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm font-semibold text-slate-600">
                          {Math.round(utilization * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <BudgetStatusBadge health={health} />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <BudgetContextIndicator row={row} months={months} activeMonthKey={activeMonthKey} />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-right">
                      <button
                        type="button"
                        className="h-8 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {isExpanded ? "Stäng" : "Granska"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr key={`${row.id}-details`}>
                      <td colSpan={8} className="border-b border-slate-100 bg-slate-50 px-4 py-4">
                        <BudgetRowDetails
                          row={row}
                          months={months}
                          activeMonthKey={activeMonthKey}
                          onPlanChange={onPlanChange}
                          onQuickAdjust={onQuickAdjust}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
