import { NextResponse } from "next/server";
import { saveBudgetLimit } from "@/lib/firefly";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      budgetId: string;
      limitId?: string;
      amount: number;
      start: string;
      end: string;
    };

    return NextResponse.json(await saveBudgetLimit(body));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Det gick inte att spara budgetgränsen" },
      { status: 500 },
    );
  }
}
