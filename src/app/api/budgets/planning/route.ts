import { getPlanningContext } from "@/lib/budget-planning-data";

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("month") ?? undefined;
    return Response.json(await getPlanningContext(month));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Det gick inte att läsa planeringsunderlaget." },
      { status: 500 },
    );
  }
}
