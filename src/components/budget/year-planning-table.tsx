"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronsRight, Copy, Sigma } from "lucide-react";
import type { BudgetMonth, BudgetOverview, BudgetRow } from "@/lib/budget-types";
import { confirmBudgetOverwrite } from "@/lib/confirm-budget-action";
import { formatCurrency, getRemaining, summarizeMonth } from "@/lib/budget-math";
import { cn } from "@/lib/utils";

type SelectedCell = {
  budgetId: string;
  monthKey: string;
} | null;

export function YearPlanningTable({
  rows,
  months,
  year,
  activeMonthKey,
  onActiveMonthChange,
  onPlanChange,
  onCopyPreviousMonth,
  onCopyMonthToRestOfYear,
  onCopySameMonthLastYear,
  onDistributeAnnualAmount,
}: {
  rows: BudgetRow[];
  months: BudgetMonth[];
  year: number;
  activeMonthKey: string;
  onActiveMonthChange: (monthKey: string) => void;
  onPlanChange: (budgetId: string, monthKey: string, value: number) => void;
  onCopyPreviousMonth: (monthKey: string) => void;
  onCopyMonthToRestOfYear: (monthKey: string) => void;
  onCopySameMonthLastYear: (budgetId: string, monthKey: string) => void;
  onDistributeAnnualAmount: (budgetId: string, amount: number) => void;
}) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [annualAmount, setAnnualAmount] = useState("");
  const [previousYearLookup, setPreviousYearLookup] = useState<{
    rows: BudgetRow[] | null;
    year: number;
  }>({ rows: null, year: year - 1 });
  const activeMonth = months.find((month) => month.key === activeMonthKey) ?? months[0];
  const activeMonthIndex = Math.max(
    0,
    months.findIndex((month) => month.key === activeMonthKey),
  );
  const activeQuarterIndex = Math.floor(activeMonthIndex / 3);
  const quarterStartIndex = activeQuarterIndex * 3;
  const visibleMonths = months.slice(quarterStartIndex, quarterStartIndex + 3);
  const quarters = Array.from({ length: Math.ceil(months.length / 3) }, (_, index) => {
    const quarterMonths = months.slice(index * 3, index * 3 + 3);

    return {
      index,
      label: `Q${index + 1}`,
      monthKeys: quarterMonths.map((month) => month.key),
      range: quarterMonths.map((month) => month.label).join(" - "),
    };
  });
  const monthSummaries = useMemo(
    () =>
      Object.fromEntries(
        months.map((month) => [
          month.key,
          {
            ...summarizeMonth(rows, month.key),
            currency: rows.find((row) => row.cells[month.key])?.currencyCode ?? rows[0]?.currencyCode ?? "USD",
          },
        ]),
      ),
    [months, rows],
  );
  const [availableByMonth, setAvailableByMonth] = useState<Record<string, number>>({});
  const selectedRow = rows.find((row) => row.id === selectedCell?.budgetId);
  const selectedMonth = months.find((month) => month.key === selectedCell?.monthKey);
  const selectedBudgetCell = selectedRow && selectedCell ? selectedRow.cells[selectedCell.monthKey] : undefined;
  const activeMonthSummary = activeMonth ? monthSummaries[activeMonth.key] : undefined;

  useEffect(() => {
    let isCurrent = true;

    fetch(`/api/budgets/overview?year=${year - 1}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Det gick inte att läsa föregående år");
        }

        return response.json() as Promise<BudgetOverview>;
      })
      .then((previousOverview) => {
        if (isCurrent) {
          setPreviousYearLookup({ rows: previousOverview.budgets, year: year - 1 });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setPreviousYearLookup({ rows: [], year: year - 1 });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [year]);

  const getAnnualPlanned = (row: BudgetRow) =>
    months.reduce((total, month) => total + (row.cells[month.key]?.planned ?? 0), 0);

  const getAnnualActual = (row: BudgetRow) =>
    months.reduce((total, month) => total + (row.cells[month.key]?.actual ?? 0), 0);

  const getPreviousAmount = (row: BudgetRow, monthIndex: number) => {
    if (monthIndex <= 0) {
      return undefined;
    }

    const previous = months[monthIndex - 1];
    return row.cells[previous.key]?.planned ?? 0;
  };

  const getLastYearAmount = (row: BudgetRow, monthKey: string) => {
    if (previousYearLookup.year !== year - 1 || !previousYearLookup.rows) {
      return undefined;
    }

    const previousMonthKey = `${year - 1}-${monthKey.slice(5)}`;
    return previousYearLookup.rows.find((budget) => budget.id === row.id)?.cells[previousMonthKey]?.planned ?? null;
  };

  const renderCopyValue = (value: number | null | undefined, currencyCode: string, isLoading = false) => {
    if (typeof value === "number") {
      return formatCurrency(value, currencyCode);
    }

    return isLoading ? "Laddar" : "Ej angivet";
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-3 sm:px-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">Årsplanering</h2>
          <p className="mt-1 text-sm text-slate-500">
            Arbeta ett kvartal i taget med årstotaler som stöd.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 xl:h-9"
            onClick={() => {
              if (
                confirmBudgetOverwrite(
                  "Kopiera föregående månad till vald månad?",
                  "Alla budgetposter i den valda månaden ersätts med föregående månads planerade belopp.",
                )
              ) {
                onCopyPreviousMonth(activeMonthKey);
              }
            }}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Kopiera föregående månad
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 xl:h-9"
            onClick={() => {
              if (
                confirmBudgetOverwrite(
                  "Kopiera vald månad till resten av året?",
                  "Framtida månader ersätts med den valda månadens planerade belopp.",
                )
              ) {
                onCopyMonthToRestOfYear(activeMonthKey);
              }
            }}
          >
            <ChevronsRight className="size-4" aria-hidden="true" />
            Kopiera till resten av året
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-slate-200 px-3 py-3 sm:px-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-1">
          <div className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain">
            {quarters.map((quarter) => {
              const isActive = quarter.index === activeQuarterIndex;
              const targetMonthKey = quarter.monthKeys.includes(activeMonthKey)
                ? activeMonthKey
                : quarter.monthKeys[0];

              return (
                <button
                  key={quarter.label}
                  type="button"
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center justify-center rounded-md px-3 text-sm font-semibold transition",
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-white hover:text-slate-900",
                  )}
                  onClick={() => targetMonthKey && onActiveMonthChange(targetMonthKey)}
                >
                  {quarter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-md border border-slate-200 bg-white p-1">
          {visibleMonths.map((month) => (
            <button
              key={month.key}
              type="button"
              className={cn(
                "h-9 rounded-md px-2 text-sm font-semibold transition",
                month.key === activeMonthKey
                  ? "bg-sky-50 text-sky-800"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
              onClick={() => onActiveMonthChange(month.key)}
            >
              {month.label}
            </button>
          ))}
        </div>
      </div>

      {selectedRow && selectedCell && selectedMonth ? (
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Vald budgetpost</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-950">{selectedRow.name}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="selected-planned">
                {selectedMonth.label} planerat
              </label>
              <input
                id="selected-planned"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                inputMode="decimal"
                value={selectedBudgetCell?.planned ?? 0}
                onChange={(event) =>
                  onPlanChange(selectedRow.id, selectedCell.monthKey, Number(event.target.value) || 0)
                }
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="annual-amount">
                Årsbelopp
              </label>
              <input
                id="annual-amount"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                inputMode="decimal"
                placeholder="Fördela över månaderna"
                value={annualAmount}
                onChange={(event) => setAnnualAmount(event.target.value)}
              />
            </div>
          </div>
          <div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-100"
              onClick={() => {
                if (
                  confirmBudgetOverwrite(
                    "Fördela årsbeloppet över budgetposten?",
                    `Alla månader för ${selectedRow.name} ersätts med en lika stor andel av årsbeloppet.`,
                  )
                ) {
                  onDistributeAnnualAmount(selectedRow.id, Number(annualAmount) || 0);
                }
              }}
            >
              <Sigma className="size-4" aria-hidden="true" />
              Fördela
            </button>
          </div>
        </div>
      ) : null}

      {activeMonth && activeMonthSummary ? (
        <div className="grid gap-3 p-3 sm:p-4 md:hidden">
          <div
            className={cn(
              "rounded-md border p-3",
              (availableByMonth[activeMonth.key] ?? activeMonthSummary.totalBudget) - activeMonthSummary.totalBudget < 0
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-slate-50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{activeMonth.label}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Budgeterat {formatCurrency(activeMonthSummary.totalBudget, activeMonthSummary.currency)}
                </p>
              </div>
              <div className="min-w-28">
                <label className="sr-only" htmlFor={`mobile-available-${activeMonth.key}`}>
                  {activeMonth.label} budgetutrymme
                </label>
                <input
                  id={`mobile-available-${activeMonth.key}`}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-right text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  inputMode="decimal"
                  value={availableByMonth[activeMonth.key] ?? activeMonthSummary.totalBudget}
                  onChange={(event) =>
                    setAvailableByMonth((current) => ({
                      ...current,
                      [activeMonth.key]: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {rows.map((row) => {
            const cell = row.cells[activeMonth.key] ?? { planned: 0, actual: 0 };
            const remaining = getRemaining(cell.planned, cell.actual);
            const previousAmount = getPreviousAmount(row, activeMonthIndex);
            const lastYearAmount = getLastYearAmount(row, activeMonth.key);

            return (
              <article key={row.id} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{row.name}</p>
                    <p className="truncate text-xs font-medium text-slate-500">{row.group}</p>
                  </div>
                  <p className="shrink-0 text-right text-xs font-semibold text-slate-500">
                    År {formatCurrency(getAnnualPlanned(row), row.currencyCode)}
                  </p>
                </div>
                <label className="mt-3 block text-xs font-semibold uppercase text-slate-500" htmlFor={`plan-${row.id}`}>
                  {activeMonth.label} planerat
                </label>
                <input
                  id={`plan-${row.id}`}
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  inputMode="decimal"
                  value={cell.planned}
                  onChange={(event) => onPlanChange(row.id, activeMonth.key, Number(event.target.value) || 0)}
                />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-medium">
                  <p className="rounded-md bg-slate-50 px-2 py-2 text-slate-600">
                    Utfall{" "}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(cell.actual, row.currencyCode)}
                    </span>
                  </p>
                  <p
                    className={cn(
                      "rounded-md px-2 py-2",
                      remaining < 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    Kvar <span className="font-semibold">{formatCurrency(remaining, row.currencyCode)}</span>
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    disabled={activeMonthIndex <= 0}
                    onClick={() => {
                      if (
                        !confirmBudgetOverwrite(
                          "Kopiera föregående belopp?",
                          `${row.name} för ${activeMonth.label} ersätts med föregående månads planerade belopp.`,
                        )
                      ) {
                        return;
                      }

                      onPlanChange(row.id, activeMonth.key, previousAmount ?? 0);
                    }}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    Föregående {renderCopyValue(previousAmount, row.currencyCode)}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    disabled={lastYearAmount === null}
                    onClick={() => {
                      if (
                        confirmBudgetOverwrite(
                          "Kopiera förra årets belopp?",
                          `${row.name} för ${activeMonth.label} ersätts med samma månads planerade belopp från förra året.`,
                        )
                      ) {
                        onCopySameMonthLastYear(row.id, activeMonth.key);
                      }
                    }}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    Förra året {renderCopyValue(lastYearAmount, row.currencyCode, lastYearAmount === undefined)}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-64 border-b border-r border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                Budget
              </th>
              {visibleMonths.map((month) => {
                const summary = monthSummaries[month.key];
                const available = availableByMonth[month.key] ?? summary.totalBudget;
                const remainingAvailable = available - summary.totalBudget;
                const isOverAvailable = remainingAvailable < 0;

                return (
                  <th
                    key={month.key}
                    className={cn(
                      "sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-600",
                      month.key === activeMonthKey && "bg-sky-50 text-sky-800",
                      isOverAvailable && "bg-rose-50 text-rose-800",
                    )}
                  >
                    <div className="grid gap-2">
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-sm text-left text-sm font-semibold outline-none transition hover:text-slate-950 focus:ring-2 focus:ring-sky-100",
                          month.key === activeMonthKey ? "text-sky-800" : "text-slate-600",
                          isOverAvailable && "text-rose-800 hover:text-rose-950",
                        )}
                        onClick={() => onActiveMonthChange(month.key)}
                      >
                        {month.label}
                      </button>
                      <div className="grid gap-1">
                        <p className="text-xs font-medium text-slate-500">
                          Budgeterat{" "}
                          <span className="font-semibold text-slate-800">
                            {formatCurrency(summary.totalBudget, summary.currency)}
                          </span>
                        </p>
                        <label className="sr-only" htmlFor={`available-${month.key}`}>
                          {month.label} budgetutrymme
                        </label>
                        <input
                          id={`available-${month.key}`}
                          className={cn(
                            "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
                            isOverAvailable && "border-rose-300 bg-rose-50 text-rose-900 focus:border-rose-400 focus:ring-rose-100",
                          )}
                          inputMode="decimal"
                          aria-invalid={isOverAvailable}
                          value={available}
                          onChange={(event) =>
                            setAvailableByMonth((current) => ({
                              ...current,
                              [month.key]: Math.max(0, Number(event.target.value) || 0),
                            }))
                          }
                        />
                        <p
                          className={cn(
                            "flex min-h-4 items-center gap-1 text-xs font-medium",
                            isOverAvailable ? "text-rose-700" : "text-emerald-700",
                          )}
                        >
                          {isOverAvailable ? <AlertTriangle className="size-3 shrink-0" aria-hidden="true" /> : null}
                          {isOverAvailable
                            ? `${formatCurrency(Math.abs(remainingAvailable), summary.currency)} över`
                            : `${formatCurrency(remainingAvailable, summary.currency)} kvar`}
                        </p>
                      </div>
                    </div>
                  </th>
                );
              })}
              <th className="sticky top-0 z-20 w-44 border-b border-l border-slate-200 bg-white px-4 py-3 text-right text-sm font-semibold text-slate-600">
                Årstotal
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="group">
                <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-3 group-hover:bg-slate-50">
                  <p className="truncate text-sm font-semibold text-slate-950">{row.name}</p>
                  <p className="truncate text-xs font-medium text-slate-500">{row.group}</p>
                </td>
                {visibleMonths.map((month) => {
                  const cell = row.cells[month.key] ?? { planned: 0, actual: 0 };
                  const remaining = getRemaining(cell.planned, cell.actual);
                  const isSelected = selectedCell?.budgetId === row.id && selectedCell.monthKey === month.key;
                  const monthIndex = months.findIndex((item) => item.key === month.key);
                  const previousAmount = getPreviousAmount(row, monthIndex);
                  const lastYearAmount = getLastYearAmount(row, month.key);

                  return (
                    <td
                      key={month.key}
                      className={cn(
                        "border-b border-slate-100 p-2 align-top",
                        month.key === activeMonthKey && "bg-sky-50/50",
                      )}
                    >
                      <div
                        className={cn(
                          "min-h-20 w-full rounded-md border border-transparent p-2 text-left transition hover:border-slate-200 hover:bg-slate-50",
                          isSelected && "border-sky-300 bg-white ring-2 ring-sky-100",
                        )}
                      >
                        <button
                          type="button"
                          className="block w-full rounded-sm text-left outline-none focus:ring-2 focus:ring-sky-100"
                          onClick={() => setSelectedCell({ budgetId: row.id, monthKey: month.key })}
                        >
                          <span className="block text-sm font-semibold text-slate-950">
                            {formatCurrency(cell.planned, row.currencyCode)}
                          </span>
                          <span className="mt-2 block text-xs text-slate-500">
                            Utfall {formatCurrency(cell.actual, row.currencyCode)}
                          </span>
                          <span
                            className={cn("mt-1 block text-xs", remaining < 0 ? "text-rose-700" : "text-slate-500")}
                          >
                            Kvar {formatCurrency(remaining, row.currencyCode)}
                          </span>
                        </button>

                        {isSelected ? (
                          <div className="mt-3 grid gap-1">
                            <button
                              type="button"
                              className="inline-flex min-h-8 w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={monthIndex <= 0}
                              onClick={() => {
                                if (
                                  !confirmBudgetOverwrite(
                                    "Kopiera föregående belopp?",
                                    `${row.name} för ${month.label} ersätts med föregående månads planerade belopp.`,
                                  )
                                ) {
                                  return;
                                }

                                onPlanChange(row.id, month.key, previousAmount ?? 0);
                              }}
                            >
                              <Copy className="size-3.5 shrink-0" aria-hidden="true" />
                              <span className="min-w-0 truncate">
                              Föregående {renderCopyValue(previousAmount, row.currencyCode)}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="inline-flex min-h-8 w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={lastYearAmount === null}
                              onClick={() => {
                                if (
                                  confirmBudgetOverwrite(
                                    "Kopiera förra årets belopp?",
                                    `${row.name} för ${month.label} ersätts med samma månads planerade belopp från förra året.`,
                                  )
                                ) {
                                  onCopySameMonthLastYear(row.id, month.key);
                                }
                              }}
                            >
                              <Copy className="size-3.5 shrink-0" aria-hidden="true" />
                              <span className="min-w-0 truncate">
                                Förra året {renderCopyValue(lastYearAmount, row.currencyCode, lastYearAmount === undefined)}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="inline-flex min-h-8 w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                if (
                                  !confirmBudgetOverwrite(
                                    "Kopiera beloppet till resten av året?",
                                    `Framtida månader för ${row.name} ersätts med ${month.label}s planerade belopp.`,
                                  )
                                ) {
                                  return;
                                }

                                months
                                  .slice(monthIndex + 1)
                                  .forEach((futureMonth) => onPlanChange(row.id, futureMonth.key, cell.planned));
                              }}
                            >
                              <ChevronsRight className="size-3.5 shrink-0" aria-hidden="true" />
                              <span className="min-w-0 truncate">
                                Resten av året {formatCurrency(cell.planned, row.currencyCode)}
                              </span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
                <td className="border-b border-l border-slate-100 px-4 py-3 text-right align-top">
                  <p className="text-sm font-semibold text-slate-950">
                    {formatCurrency(getAnnualPlanned(row), row.currencyCode)}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Utfall {formatCurrency(getAnnualActual(row), row.currencyCode)}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-xs font-medium",
                      getRemaining(getAnnualPlanned(row), getAnnualActual(row)) < 0
                        ? "text-rose-700"
                        : "text-slate-500",
                    )}
                  >
                    Kvar {formatCurrency(getRemaining(getAnnualPlanned(row), getAnnualActual(row)), row.currencyCode)}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
