"use client";

import { useMemo, useState } from "react";
import { Copy, Minus, Plus } from "lucide-react";
import type { BudgetMonth, BudgetRow } from "@/lib/budget-types";
import { confirmBudgetOverwrite } from "@/lib/confirm-budget-action";
import { formatCurrency, getRemaining, getUtilization } from "@/lib/budget-math";
import { cn } from "@/lib/utils";

const quickAdjustments = [-100, -50, 50, 100, 500];

export function BudgetRowDetails({
  row,
  months,
  activeMonthKey,
  onPlanChange,
  onQuickAdjust,
}: {
  row: BudgetRow;
  months: BudgetMonth[];
  activeMonthKey: string;
  onPlanChange: (budgetId: string, monthKey: string, value: number) => void;
  onQuickAdjust: (budgetId: string, monthKey: string, delta: number) => void;
}) {
  const [note, setNote] = useState("");
  const activeIndex = months.findIndex((month) => month.key === activeMonthKey);
  const previousMonth = activeIndex > 0 ? months[activeIndex - 1] : undefined;
  const nextMonth = activeIndex < months.length - 1 ? months[activeIndex + 1] : undefined;
  const cell = row.cells[activeMonthKey] ?? { planned: 0, actual: 0 };
  const previous = previousMonth ? row.cells[previousMonth.key] : undefined;
  const next = nextMonth ? row.cells[nextMonth.key] : undefined;
  const remaining = getRemaining(cell.planned, cell.actual);
  const utilization = getUtilization(cell.planned, cell.actual);

  const facts = useMemo(
    () => [
      { label: "Faktiskt utfall", value: formatCurrency(cell.actual, row.currencyCode) },
      { label: "Kvar", value: formatCurrency(remaining, row.currencyCode), alert: remaining < 0 },
      {
        label: "Föregående plan",
        value: previous ? formatCurrency(previous.planned, row.currencyCode) : "Ingen föregående månad",
      },
      {
        label: "Föregående utfall",
        value: previous ? formatCurrency(previous.actual, row.currencyCode) : "Ingen föregående månad",
      },
      {
        label: "Nästa plan",
        value: next ? formatCurrency(next.planned, row.currencyCode) : "Ingen nästa månad",
      },
      { label: "Använt", value: `${Math.round(utilization * 100)}%` },
    ],
    [cell.actual, next, previous, remaining, row.currencyCode, utilization],
  );

  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4 xl:grid-cols-[minmax(240px,0.8fr)_1fr]">
      <div>
        <label className="text-xs font-semibold uppercase text-slate-500" htmlFor={`planned-${row.id}`}>
          Planerat belopp
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id={`planned-${row.id}`}
            aria-label={`${row.name} planerat belopp`}
            className="h-11 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-base font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            inputMode="decimal"
            value={cell.planned}
            onChange={(event) => onPlanChange(row.id, activeMonthKey, Number(event.target.value) || 0)}
          />
          {previous ? (
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => {
                if (
                  confirmBudgetOverwrite(
                    "Kopiera föregående belopp till budgetposten?",
                    `${row.name} ersätts med föregående månads planerade belopp.`,
                  )
                ) {
                  onPlanChange(row.id, activeMonthKey, previous.planned);
                }
              }}
            >
              <Copy className="size-4" aria-hidden="true" />
              Kopiera
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {quickAdjustments.map((delta) => (
            <button
              key={delta}
              type="button"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => onQuickAdjust(row.id, activeMonthKey, delta)}
            >
              {delta < 0 ? <Minus className="size-3" aria-hidden="true" /> : <Plus className="size-3" aria-hidden="true" />}
              {Math.abs(delta)}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase text-slate-500" htmlFor={`note-${row.id}`}>
          Anteckning
        </label>
        <textarea
          id={`note-${row.id}`}
          className="mt-2 min-h-20 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          placeholder="Lägg till en anteckning för budgetposten"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-md border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">{fact.label}</p>
            <p className={cn("mt-1 text-sm font-semibold text-slate-900", fact.alert && "text-rose-700")}>
              {fact.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
