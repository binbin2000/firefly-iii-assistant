import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveAvailableBudget } from "@/lib/firefly";

beforeEach(() => {
  vi.stubEnv("FIREFLY_BASE_URL", "https://firefly.example");
  vi.stubEnv("FIREFLY_ACCESS_TOKEN", "token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("saveAvailableBudget", () => {
  it.each([
    { id: undefined, method: "POST", url: "https://firefly.example/api/v1/available-budgets" },
    { id: "42", method: "PUT", url: "https://firefly.example/api/v1/available-budgets/42" },
  ])("uses $method when id is $id", async ({ id, method, url }) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await saveAvailableBudget({ id, amount: 3_000, currencyCode: "SEK", start: "2026-10-01", end: "2026-10-31" });
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method }));
  });
});
