import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTransactionsNeedingReview } from "@/lib/firefly";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function transactionGroup(id: string, options?: { categoryId?: string | null; tags?: string[] | null }) {
  return {
    id,
    attributes: {
      transactions: [
        {
          transaction_journal_id: `${id}-split`,
          description: `Transaction ${id}`,
          amount: "12.34",
          currency_code: "SEK",
          date: "2026-09-28T12:00:00+02:00",
          category_id: options?.categoryId ?? null,
          category_name: null,
          tags: options?.tags ?? [],
          source_name: "Checking",
          destination_name: "Shop",
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.stubEnv("FIREFLY_BASE_URL", "https://firefly.example");
  vi.stubEnv("FIREFLY_ACCESS_TOKEN", "token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getTransactionsNeedingReview", () => {
  it("stops paging through transaction history once the requested queue is full", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/transactions?")) {
        return jsonResponse({
          data: [transactionGroup("1"), transactionGroup("2")],
          meta: { pagination: { current_page: 1, total_pages: 50 } },
        });
      }

      return jsonResponse({ data: [], meta: { pagination: { current_page: 1, total_pages: 1 } } });
    });

    const overview = await getTransactionsNeedingReview(2);

    expect(overview.transactions).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/transactions?"))).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://firefly.example/api/v1/transactions?limit=200&page=1",
      expect.anything(),
    );
  });

  it("includes the failing endpoint and Firefly message in errors", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/transactions?")) {
        return jsonResponse(
          { message: "Database timed out" },
          { status: 500, statusText: "Internal Server Error" },
        );
      }

      return jsonResponse({ data: [], meta: { pagination: { current_page: 1, total_pages: 1 } } });
    });

    await expect(getTransactionsNeedingReview()).rejects.toThrow(
      "Firefly request failed: GET /api/v1/transactions?limit=200&page=1 -> 500 Internal Server Error: Database timed out",
    );
  });
});
