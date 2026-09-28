import { BudgetWorkspace } from "@/components/budget/budget-workspace";
import { getBudgetOverview } from "@/lib/firefly";
import { getPlanningContext } from "@/lib/budget-planning-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const overview = await getBudgetOverview();
  const planningContext = await getPlanningContext(undefined, overview);

  return <BudgetWorkspace initialOverview={overview} initialPlanningContext={planningContext} />;
}
