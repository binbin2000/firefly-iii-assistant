"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import type {
  BudgetPlanSaveResult,
  ComparisonStrategy,
  PlanningContext,
} from "@/lib/budget-types";
import { formatCurrency } from "@/lib/budget-math";
import { buildBudgetSuggestions, groupRowsByCurrency } from "@/lib/budget-planning";
import type { OllamaAnalysisResponse as AnalysisResponse } from "@/lib/ollama-types";
import { cn } from "@/lib/utils";

type Props = {
  context: PlanningContext;
  onContextChange: (context: PlanningContext) => void;
};

export function NextMonthPlanner({ context, onContextChange }: Props) {
  const [strategy, setStrategy] = useState<ComparisonStrategy>("smart");
  const [drafts, setDrafts] = useState<Record<string, number>>(() => Object.fromEntries(
    context.next.budgets.map((row) => [row.id, row.cells[context.next.month.key]?.planned ?? 0]),
  ));
  const currencies = useMemo(() => groupRowsByCurrency(context.next.budgets), [context.next.budgets]);
  const [availableDrafts, setAvailableDrafts] = useState<Record<string, number>>(() => Object.fromEntries(
    Object.keys(currencies).map((currency) => [
      currency,
      context.next.availableBudgets.find((item) => item.currencyCode === currency)?.amount ?? 0,
    ]),
  ));
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const suggestions = useMemo(
    () => buildBudgetSuggestions(context.next, context.previous, context.sameMonthLastYear, strategy),
    [context.next, context.previous, context.sameMonthLastYear, strategy],
  );
  const suggestionById = new Map(suggestions.map((suggestion) => [suggestion.budgetId, suggestion]));

  const save = async () => {
    const overAllocated = Object.entries(currencies).some(([currency, rows]) =>
      rows.reduce((sum, row) => sum + (drafts[row.id] ?? 0), 0) > (availableDrafts[currency] ?? 0),
    );
    if (overAllocated && !window.confirm("Budgeten överstiger budgetutrymmet. Vill du spara planen ändå?")) return;

    setSaving(true);
    setSaveStatus(null);
    try {
      const response = await fetch("/api/budgets/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: context.next.month.key,
          availableBudgets: Object.keys(currencies).map((currency) => {
            const existing = context.next.availableBudgets.find((item) => item.currencyCode === currency);
            return { id: existing?.id, amount: availableDrafts[currency] ?? 0, currencyCode: currency, start: context.next.month.start, end: context.next.month.end };
          }),
          limits: context.next.budgets
            .filter((row) => drafts[row.id] !== (row.cells[context.next.month.key]?.planned ?? 0))
            .map((row) => ({ budgetId: row.id, limitId: row.cells[context.next.month.key]?.limitId, amount: drafts[row.id], start: context.next.month.start, end: context.next.month.end })),
        }),
      });
      if (!response.ok) throw new Error("Det gick inte att spara planen.");
      const result = (await response.json()) as BudgetPlanSaveResult;
      const refreshed = context.source === "demo"
        ? {
            ...context,
            next: {
              ...context.next,
              budgets: context.next.budgets.map((row) => ({
                ...row,
                cells: {
                  ...row.cells,
                  [context.next.month.key]: {
                    ...row.cells[context.next.month.key],
                    planned: drafts[row.id] ?? 0,
                    actual: row.cells[context.next.month.key]?.actual ?? 0,
                  },
                },
              })),
              availableBudgets: Object.keys(currencies).map((currency) => {
                const existing = context.next.availableBudgets.find((item) => item.currencyCode === currency);
                return {
                  ...existing,
                  amount: availableDrafts[currency] ?? 0,
                  currencyCode: currency,
                  currencySymbol: existing?.currencySymbol ?? currency,
                  start: context.next.month.start,
                  end: context.next.month.end,
                };
              }),
            },
          }
        : await fetch("/api/budgets/planning").then((item) => item.json() as Promise<PlanningContext>);
      const failedBudgetIds = new Set(result.limits.filter((item) => !item.success).map((item) => item.budgetId));
      const failedCurrencies = new Set(result.availableBudgets.filter((item) => !item.success).map((item) => item.currencyCode));
      setDrafts(Object.fromEntries(refreshed.next.budgets.map((row) => [row.id, failedBudgetIds.has(row.id) ? drafts[row.id] : row.cells[refreshed.next.month.key]?.planned ?? 0])));
      setAvailableDrafts(Object.fromEntries(Object.keys(currencies).map((currency) => [currency, failedCurrencies.has(currency) ? availableDrafts[currency] : refreshed.next.availableBudgets.find((item) => item.currencyCode === currency)?.amount ?? 0])));
      onContextChange(refreshed);
      const failures = failedBudgetIds.size + failedCurrencies.size;
      setSaveStatus(failures ? `${failures} ändringar kunde inte sparas och ligger kvar som utkast.` : "Planen är sparad.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Det gick inte att spara planen.");
    } finally {
      setSaving(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await fetch("/api/ai/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: Number(context.next.month.key.slice(0, 4)), monthKey: context.next.month.key, focus: "budget", comparisonStrategy: strategy, draftLimits: drafts, availableBudgets: availableDrafts }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "AI-analysen misslyckades.");
      }
      setAnalysis(await response.json() as AnalysisResponse);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "AI-analysen misslyckades.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Planera {context.next.month.label}</h2>
            <p className="mt-1 text-sm text-slate-500">Ändringarna är utkast tills du sparar hela planen.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="text-sm font-medium text-slate-600">
              Jämförelse
              <select className="ml-2 h-10 rounded-md border border-slate-200 bg-white px-3 font-semibold text-slate-800" value={strategy} onChange={(event) => setStrategy(event.target.value as ComparisonStrategy)}>
                <option value="smart">Smart jämförelse</option>
                <option value="previous">Föregående månad</option>
                <option value="last-year">Samma månad förra året</option>
              </select>
            </label>
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50" onClick={() => void runAnalysis()} disabled={analyzing}>
              {analyzing ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Fördjupa med AI
            </button>
          </div>
        </div>
      </section>

      {Object.entries(currencies).map(([currency, rows]) => {
        const allocated = rows.reduce((sum, row) => sum + (drafts[row.id] ?? 0), 0);
        const available = availableDrafts[currency] ?? 0;
        const balance = available - allocated;
        return (
          <section key={currency} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 md:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700">Planerad inkomst / budgetutrymme
                <input aria-label={`Planerad inkomst ${currency}`} inputMode="decimal" className="mt-1 block h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-lg font-semibold" value={available} onChange={(event) => setAvailableDrafts((current) => ({ ...current, [currency]: Math.max(0, Number(event.target.value) || 0) }))} />
              </label>
              <div className="rounded-md border border-slate-200 bg-white p-3"><p className="text-sm text-slate-500">Fördelad budget</p><p className="mt-1 text-lg font-semibold">{formatCurrency(allocated, currency)}</p></div>
              <div className={cn("rounded-md border p-3", balance < 0 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50")}><p className="text-sm text-slate-500">Kvar att fördela</p><p className={cn("mt-1 text-lg font-semibold", balance < 0 ? "text-rose-700" : "text-emerald-700")}>{formatCurrency(balance, currency)}</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-white text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">Budgetpost</th><th className="px-4 py-3 text-right">Nuvarande plan</th><th className="px-4 py-3 text-right">Historiskt utfall</th><th className="px-4 py-3">Analys</th><th className="px-4 py-3 text-right">Utkast</th><th className="px-4 py-3 text-right">Åtgärd</th></tr></thead>
                <tbody>
                  {rows.map((row) => {
                    const suggestion = suggestionById.get(row.id)!;
                    const planned = row.cells[context.next.month.key]?.planned ?? 0;
                    return <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.name}</p><p className="text-xs text-slate-500">{row.group}</p></td>
                      <td className="px-4 py-3 text-right">{formatCurrency(planned, currency)}</td>
                      <td className="px-4 py-3 text-right"><p className="font-semibold">{formatCurrency(suggestion.referenceAmount, currency)}</p><p className="text-xs text-slate-500">{suggestion.reference === "last-year" ? "Förra året" : "Föregående månad"}</p></td>
                      <td className="max-w-sm px-4 py-3 text-slate-600">{suggestion.reason}</td>
                      <td className="px-4 py-3 text-right"><input aria-label={`${row.name} budgetutkast`} inputMode="decimal" className="h-10 w-32 rounded-md border border-slate-200 px-3 text-right font-semibold" value={drafts[row.id] ?? 0} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: Math.max(0, Number(event.target.value) || 0) }))} /></td>
                      <td className="px-4 py-3 text-right"><button type="button" className="h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold disabled:opacity-40" disabled={suggestion.suggestedAmount === null} onClick={() => setDrafts((current) => ({ ...current, [row.id]: suggestion.suggestedAmount ?? current[row.id] }))}>Använd förslag</button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {analysisError ? <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{analysisError}</div> : null}
      {analysis ? <section className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
        <h2 className="font-semibold text-violet-950">AI-fördjupning</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{analysis.analysis.summary}</p>
        {analysis.analysis.budgetProposals.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">
          {analysis.analysis.budgetProposals.map((proposal, index) => <article key={`${proposal.budgetId}-${index}`} className="rounded-md border border-violet-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-semibold text-slate-900">{proposal.category}</p><p className="mt-1 text-sm text-slate-600">{proposal.reason}</p></div>
              <span className="shrink-0 font-semibold text-violet-700">{formatCurrency(proposal.suggestedPlanned, proposal.currencyCode)}</span>
            </div>
            {proposal.budgetId ? <button type="button" className="mt-3 h-8 rounded-md border border-violet-200 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50" onClick={() => setDrafts((current) => ({ ...current, [proposal.budgetId!]: proposal.suggestedPlanned }))}>Använd AI-förslag</button> : null}
          </article>)}
        </div> : null}
      </section> : null}

      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2 text-sm text-slate-600">{saveStatus ? (saveStatus === "Planen är sparad." ? <Check className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-amber-600" />) : null}{saveStatus ?? "Granska utkastet innan du sparar."}</div>
        <div className="flex gap-2"><button type="button" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold" onClick={() => setDrafts((current) => ({ ...current, ...Object.fromEntries(suggestions.filter((item) => item.suggestedAmount !== null).map((item) => [item.budgetId, item.suggestedAmount!])) }))}><WandSparkles className="mr-2 inline size-4" />Använd alla förslag</button><button type="button" className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void save()} disabled={saving}>{saving ? "Sparar…" : "Spara plan"}</button></div>
      </div>
    </div>
  );
}
