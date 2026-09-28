"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, LoaderCircle, PiggyBank, Sparkles, WandSparkles } from "lucide-react";
import { formatCurrency } from "@/lib/budget-math";
import { confirmBudgetOverwrite } from "@/lib/confirm-budget-action";
import type {
  AnalysisFocus,
  BudgetProposal,
  OllamaAnalysisResponse,
  OllamaStatus,
} from "@/lib/ollama-types";
import { cn } from "@/lib/utils";

const focusOptions: Array<{ value: AnalysisFocus; label: string }> = [
  { value: "overview", label: "Helhetsanalys" },
  { value: "budget", label: "Budgetförslag" },
  { value: "savings", label: "Spartips" },
];

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || "Analysen misslyckades.";
  } catch {
    return "Analysen misslyckades.";
  }
}

export function OllamaAssistant({
  year,
  monthKey,
  monthLabel,
  onApplyProposal,
}: {
  year: number;
  monthKey: string;
  monthLabel: string;
  onApplyProposal: (proposal: BudgetProposal) => void;
}) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [focus, setFocus] = useState<AnalysisFocus>("overview");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<OllamaAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [appliedProposalKeys, setAppliedProposalKeys] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    fetch("/api/ai/ollama")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readError(response));
        }

        return response.json() as Promise<OllamaStatus>;
      })
      .then((nextStatus) => {
        if (active) {
          setStatus(nextStatus);
        }
      })
      .catch((statusError: unknown) => {
        if (active) {
          setStatus({
            available: false,
            model: "Ollama",
            modelInstalled: false,
            installedModels: [],
            message: statusError instanceof Error ? statusError.message : "Det gick inte att kontrollera Ollama.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setAppliedProposalKeys([]);

    try {
      const response = await fetch("/api/ai/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, monthKey, focus, question }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const nextResult = (await response.json()) as OllamaAnalysisResponse;
      setResult(nextResult);
      setStatus((current) =>
        current
          ? { ...current, available: true, modelInstalled: true, model: nextResult.model, message: undefined }
          : current,
      );
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysen misslyckades.");
    } finally {
      setIsLoading(false);
    }
  };

  const applyProposal = (proposal: BudgetProposal, index: number) => {
    if (!proposal.budgetId) {
      return;
    }

    const approved = confirmBudgetOverwrite(
      `Använd Ollamas förslag för ${proposal.category}?`,
      `Ändra ${monthLabel} från ${formatCurrency(proposal.currentPlanned, proposal.currencyCode)} till ${formatCurrency(
        proposal.suggestedPlanned,
        proposal.currencyCode,
      )}.`,
    );

    if (!approved) {
      return;
    }

    onApplyProposal(proposal);
    setAppliedProposalKeys((current) => [...current, `${proposal.budgetId}-${index}`]);
  };

  const isReady = status?.available && status.modelInstalled;

  return (
    <section className="overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-violet-100 bg-violet-50/60 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-600 text-white shadow-sm">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-950">Lokal ekonomianalys</h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
                  status === null && "border-slate-200 bg-white text-slate-500",
                  status !== null && isReady && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  status !== null && !isReady && "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    status === null && "bg-slate-400",
                    status !== null && isReady && "bg-emerald-500",
                    status !== null && !isReady && "bg-amber-500",
                  )}
                />
                {status === null ? "Kontrollerar Ollama" : isReady ? status.model : "Konfiguration krävs"}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Analysera aggregerade budgetbelopp lokalt. Förslag förblir utkast tills du granskar och använder dem.
            </p>
            {status?.message && !isReady ? (
              <p className="mt-2 font-mono text-xs font-medium text-amber-800">{status.message}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1 rounded-md border border-violet-200 bg-white p-1">
          {focusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "h-8 rounded px-3 text-sm font-semibold transition",
                focus === option.value
                  ? "bg-violet-600 text-white"
                  : "text-slate-600 hover:bg-violet-50 hover:text-violet-800",
              )}
              onClick={() => setFocus(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="flex flex-col gap-2 md:flex-row">
          <label className="sr-only" htmlFor="ollama-question">
            Valfri fråga till den lokala modellen
          </label>
          <input
            id="ollama-question"
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            value={question}
            maxLength={500}
            placeholder={`Valfri fråga om ${monthLabel} ${year}…`}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isLoading) {
                void runAnalysis();
              }
            }}
          />
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void runAnalysis()}
            disabled={isLoading || status === null}
          >
            {isLoading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <WandSparkles className="size-4" aria-hidden="true" />
            )}
            {isLoading ? "Analyserar lokalt…" : "Analysera med Ollama"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {result ? (
          <div className="mt-5 space-y-5" aria-live="polite">
            <div>
              <p className="text-sm font-semibold text-slate-950">Sammanfattning</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{result.analysis.summary}</p>
              <p className="mt-1 text-xs text-slate-400">
                {result.model} · {new Date(result.generatedAt).toLocaleString()}
              </p>
            </div>

            {result.analysis.observations.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {result.analysis.observations.map((observation, index) => (
                  <article
                    key={`${observation.title}-${index}`}
                    className={cn(
                      "rounded-md border p-3",
                      observation.severity === "warning" && "border-amber-200 bg-amber-50/60",
                      observation.severity === "opportunity" && "border-emerald-200 bg-emerald-50/60",
                      observation.severity === "info" && "border-slate-200 bg-slate-50",
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-900">{observation.title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{observation.detail}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {result.analysis.budgetProposals.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Budgetförslag</h3>
                <p className="mt-1 text-xs text-slate-500">Beloppen gäller {monthLabel}. Granska varje förslag separat.</p>
                <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Budgetpost</th>
                        <th className="px-3 py-2 text-right">Nuvarande</th>
                        <th className="px-3 py-2 text-right">Förslag</th>
                        <th className="px-3 py-2">Motivering</th>
                        <th className="px-3 py-2 text-right">Åtgärd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.analysis.budgetProposals.map((proposal, index) => {
                        const proposalKey = `${proposal.budgetId}-${index}`;
                        const wasApplied = appliedProposalKeys.includes(proposalKey);

                        return (
                          <tr key={`${proposal.category}-${index}`} className="border-t border-slate-100 align-top">
                            <td className="px-3 py-3">
                              <p className="font-semibold text-slate-900">{proposal.category}</p>
                              <p className="mt-0.5 text-xs capitalize text-slate-500">
                                {proposal.kind === "new_category"
                                  ? "Förslag på ny budgetpost"
                                  : `${proposal.confidence === "high" ? "Hög" : proposal.confidence === "medium" ? "Medel" : "Låg"} säkerhet`}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-right font-medium text-slate-600">
                              {proposal.kind === "new_category"
                                ? "—"
                                : formatCurrency(proposal.currentPlanned, proposal.currencyCode)}
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-violet-700">
                              {formatCurrency(proposal.suggestedPlanned, proposal.currencyCode)}
                            </td>
                            <td className="max-w-xl px-3 py-3 leading-5 text-slate-600">{proposal.reason}</td>
                            <td className="px-3 py-3 text-right">
                              {proposal.budgetId ? (
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:text-emerald-700"
                                  onClick={() => applyProposal(proposal, index)}
                                  disabled={wasApplied}
                                >
                                  {wasApplied ? <Check className="size-3.5" aria-hidden="true" /> : null}
                                  {wasApplied ? "Använt" : "Granska och använd"}
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-slate-500">Skapa manuellt</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {result.analysis.savingsSuggestions.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Spartips</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {result.analysis.savingsSuggestions.map((suggestion, index) => (
                    <article key={`${suggestion.title}-${index}`} className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{suggestion.title}</p>
                          <p className="mt-0.5 text-xs font-medium capitalize text-emerald-700">
                            {suggestion.category} · {suggestion.effort === "high" ? "hög" : suggestion.effort === "medium" ? "medel" : "låg"} insats
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-700">
                          <PiggyBank className="size-4" aria-hidden="true" />
                          {formatCurrency(suggestion.monthlySaving, suggestion.currencyCode)}/mo
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-slate-600">{suggestion.description}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {result.analysis.caveats.length > 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Analysens begränsningar</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-500">
                  {result.analysis.caveats.map((caveat, index) => (
                    <li key={`${caveat}-${index}`}>{caveat}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
