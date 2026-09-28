import type { AvailableBudget, BudgetOverview, BudgetRow } from "./budget-types";
import { getDemoAvailableBudgets, getDemoBudgetOverview } from "./demo-budget-data";
import { getDemoTransactionsOverview } from "./demo-transactions-data";
import type { TransactionSplit, TransactionsOverview } from "./transaction-types";

type FireflyList<T> = {
  data: T[];
  meta?: {
    pagination?: {
      current_page: number;
      total_pages: number;
    };
  };
};

type FireflyBudget = {
  id: string;
  attributes: {
    active: boolean;
    name: string;
    order?: number;
    auto_budget_currency_code?: string;
  };
};

type FireflyBudgetLimit = {
  id: string;
  attributes: {
    amount: string;
    start: string;
    end: string;
    currency_code?: string;
    currency_symbol?: string;
    spent?: Array<{
      sum: string;
      currency_code?: string;
      currency_symbol?: string;
    }>;
  };
};

type FireflyAvailableBudget = {
  id: string;
  attributes: {
    amount: string;
    start: string;
    end: string;
    currency_code: string;
    currency_symbol?: string;
  };
};

function getCurrencySymbol(currencyCode: string) {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);

    return parts.find((part) => part.type === "currency")?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

function getBudgetCurrency(budget: FireflyBudget, limits: FireflyBudgetLimit[]) {
  const limitWithCurrency = limits.find((limit) => limit.attributes.currency_code);
  const spentWithCurrency = limits
    .flatMap((limit) => limit.attributes.spent ?? [])
    .find((spent) => spent.currency_code);
  const currencyCode =
    limitWithCurrency?.attributes.currency_code ??
    spentWithCurrency?.currency_code ??
    budget.attributes.auto_budget_currency_code ??
    "USD";
  const currencySymbol =
    limitWithCurrency?.attributes.currency_symbol ??
    spentWithCurrency?.currency_symbol ??
    getCurrencySymbol(currencyCode);

  return { currencyCode, currencySymbol };
}

type FireflyTransactionSplit = {
  transaction_journal_id: string;
  description: string;
  amount: string;
  currency_code?: string;
  date: string;
  category_id?: string | null;
  category_name?: string | null;
  tags?: string[] | null;
  source_name?: string | null;
  destination_name?: string | null;
};

type FireflyTransactionGroup = {
  id: string;
  attributes: {
    transactions: FireflyTransactionSplit[];
  };
};

type FireflyCategory = {
  id: string;
  attributes: {
    name: string;
  };
};

type FireflyTag = {
  attributes: {
    tag: string;
  };
};

function getConfig() {
  const baseUrl = process.env.FIREFLY_BASE_URL?.replace(/\/$/, "");
  const token = process.env.FIREFLY_ACCESS_TOKEN;

  if (!baseUrl || !token) {
    return null;
  }

  return { baseUrl, token };
}

async function fireflyFetch<T>(path: string): Promise<T> {
  const config = getConfig();

  if (!config) {
    throw new Error("Firefly configuration is missing");
  }

  const response = await fetch(`${config.baseUrl}/api${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text();
    let detail = responseText;

    try {
      const body = JSON.parse(responseText) as { message?: unknown };
      detail = typeof body.message === "string" ? body.message : responseText;
    } catch {
      // Firefly and reverse proxies may return plain text or HTML here.
    }

    const summary = detail.replace(/\s+/g, " ").trim().slice(0, 300);
    const status = `${response.status} ${response.statusText}`.trim();
    throw new Error(
      `Firefly request failed: GET /api${path} -> ${status}${summary ? `: ${summary}` : ""}`,
    );
  }

  return response.json() as Promise<T>;
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const firstSeparator = path.includes("?") ? "&" : "?";
  let page = 1;
  let totalPages = 1;
  const results: T[] = [];

  do {
    const response = await fireflyFetch<FireflyList<T>>(`${path}${firstSeparator}page=${page}`);
    results.push(...response.data);
    totalPages = response.meta?.pagination?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return results;
}

function monthEnd(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}

function makeMonths(year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, index, 1));
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;

    return {
      key,
      label: date.toLocaleString("sv-SE", { month: "short" }),
      start: `${key}-01`,
      end: monthEnd(year, index),
    };
  });
}

export async function getAvailableBudgets(start: string, end: string): Promise<AvailableBudget[]> {
  if (!getConfig()) {
    const [year, month] = start.split("-").map(Number);
    return getDemoAvailableBudgets(year, month - 1);
  }

  const entries = await fetchAll<FireflyAvailableBudget>(
    `/v1/available-budgets?start=${start}&end=${end}&limit=200`,
  );
  return entries
    .filter((entry) => entry.attributes.start.slice(0, 10) <= end && entry.attributes.end.slice(0, 10) >= start)
    .map((entry) => ({
      id: entry.id,
      amount: Number.parseFloat(entry.attributes.amount) || 0,
      currencyCode: entry.attributes.currency_code,
      currencySymbol: entry.attributes.currency_symbol ?? getCurrencySymbol(entry.attributes.currency_code),
      start: entry.attributes.start.slice(0, 10),
      end: entry.attributes.end.slice(0, 10),
    }));
}

export async function saveAvailableBudget(input: {
  id?: string;
  amount: number;
  currencyCode: string;
  start: string;
  end: string;
}) {
  const config = getConfig();
  if (!config) {
    return { source: "demo" as const };
  }

  const path = input.id
    ? `/api/v1/available-budgets/${input.id}`
    : "/api/v1/available-budgets";
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: input.id ? "PUT" : "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.max(0, input.amount).toFixed(2),
      currency_code: input.currencyCode,
      start: input.start,
      end: input.end,
    }),
  });

  if (!response.ok) {
    throw new Error(`Det gick inte att spara budgetutrymmet: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function getBudgetOverview(year = new Date().getFullYear()): Promise<BudgetOverview> {
  if (!getConfig()) {
    return getDemoBudgetOverview(year);
  }

  const months = makeMonths(year);
  const activeMonthKey = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const budgets = await fetchAll<FireflyBudget>("/v1/budgets?limit=200");
  const activeBudgets = budgets
    .filter((budget) => budget.attributes.active)
    .sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0));

  const rows: BudgetRow[] = await Promise.all(
    activeBudgets.map(async (budget) => {
      const limits = await fetchAll<FireflyBudgetLimit>(
        `/v1/budgets/${budget.id}/limits?start=${year}-01-01&end=${year}-12-31&limit=200`,
      );
      const currency = getBudgetCurrency(budget, limits);

      return {
        id: budget.id,
        name: budget.attributes.name,
        group: "Budget",
        currencyCode: currency.currencyCode,
        currencySymbol: currency.currencySymbol,
        cells: Object.fromEntries(
          months.map((month) => {
            const limit = limits.find((item) => item.attributes.start <= month.end && item.attributes.end >= month.start);
            const spent = limit?.attributes.spent?.[0]?.sum ?? "0";
            const actual = Math.abs(Number.parseFloat(spent) || 0);

            return [
              month.key,
              {
                planned: Number.parseFloat(limit?.attributes.amount ?? "0") || 0,
                actual,
                limitId: limit?.id,
              },
            ];
          }),
        ),
      };
    }),
  );

  return {
    year,
    activeMonthKey,
    months,
    budgets: rows,
    source: "firefly",
  };
}

export async function saveBudgetLimit(input: {
  budgetId: string;
  limitId?: string;
  amount: number;
  start: string;
  end: string;
}) {
  const config = getConfig();

  if (!config) {
    return { source: "demo" as const };
  }

  const path = input.limitId
    ? `/api/v1/budgets/${input.budgetId}/limits/${input.limitId}`
    : `/api/v1/budgets/${input.budgetId}/limits`;
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: input.limitId ? "PUT" : "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount.toFixed(2),
      start: input.start,
      end: input.end,
    }),
  });

  if (!response.ok) {
    throw new Error(`Unable to save budget limit: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function needsReview(split: FireflyTransactionSplit) {
  return !split.category_id || !split.tags || split.tags.length === 0;
}

function toTransactionSplit(group: FireflyTransactionGroup, split: FireflyTransactionSplit): TransactionSplit {
  return {
    transactionId: group.id,
    splitId: split.transaction_journal_id,
    description: split.description,
    amount: Math.abs(Number.parseFloat(split.amount) || 0),
    currencyCode: split.currency_code ?? "USD",
    date: split.date.slice(0, 10),
    sourceName: split.source_name ?? "Unknown",
    destinationName: split.destination_name ?? "Unknown",
    category: null,
    tags: [],
  };
}

async function fetchTransactionsNeedingReview(limit: number) {
  const transactions: TransactionSplit[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && transactions.length < limit) {
    const response = await fireflyFetch<FireflyList<FireflyTransactionGroup>>(
      `/v1/transactions?limit=200&page=${page}`,
    );

    for (const group of response.data) {
      for (const split of group.attributes.transactions) {
        if (needsReview(split)) {
          transactions.push(toTransactionSplit(group, split));
        }

        if (transactions.length === limit) {
          return transactions;
        }
      }
    }

    totalPages = response.meta?.pagination?.total_pages ?? 1;
    page += 1;
  }

  return transactions;
}

export async function getTransactionsNeedingReview(limit = 100): Promise<TransactionsOverview> {
  if (!getConfig()) {
    return getDemoTransactionsOverview();
  }

  const [transactions, categories, tags] = await Promise.all([
    fetchTransactionsNeedingReview(Math.max(0, limit)),
    fetchAll<FireflyCategory>("/v1/categories?limit=200"),
    fetchAll<FireflyTag>("/v1/tags?limit=200"),
  ]);

  return {
    transactions,
    categories: categories.map((category) => ({ id: category.id, name: category.attributes.name })),
    knownTags: tags.map((tag) => tag.attributes.tag).filter(Boolean),
    source: "firefly",
  };
}

export async function applyTransactionTags(input: {
  transactionId: string;
  splitId: string;
  categoryName?: string;
  tags: string[];
}) {
  const config = getConfig();

  if (!config) {
    return { source: "demo" as const };
  }

  const group = await fireflyFetch<{ data: FireflyTransactionGroup }>(
    `/v1/transactions/${input.transactionId}`,
  ).then((body) => body.data);
  const split = group.attributes.transactions.find(
    (item) => item.transaction_journal_id === input.splitId,
  );

  if (!split) {
    throw new Error("Transaction split not found");
  }

  const response = await fetch(`${config.baseUrl}/api/v1/transactions/${input.transactionId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transactions: [
        {
          transaction_journal_id: input.splitId,
          category_name: input.categoryName ?? split.category_name ?? undefined,
          tags: input.tags,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Unable to save transaction: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
