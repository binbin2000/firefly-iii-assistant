import { NextResponse } from "next/server";
import { getBudgetOverview } from "@/lib/firefly";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();

  try {
    return NextResponse.json(await getBudgetOverview(year));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Det gick inte att läsa budgetöversikten" },
      { status: 500 },
    );
  }
}
