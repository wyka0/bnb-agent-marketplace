import type { Metadata } from "next";
import { CompareView } from "./compare-view";
import {
  getMarketplaceAgentBySlug,
  getMarketplaceAgents,
} from "@/lib/eight004scan/marketplace";
import { parseCompareIds } from "@/lib/eight004scan/compare";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Compare Agents",
  description: "Compare multiple ERC-8004 agents side-by-side.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.compare) ? params.compare[0] : params.compare;
  const selectedIds = parseCompareIds(raw);

  const [catalog, selectedResults] = await Promise.all([
    getMarketplaceAgents({ limit: 100, page: 1 }),
    Promise.all(selectedIds.map((slug) => getMarketplaceAgentBySlug(slug))),
  ]);
  const initialAgents = selectedResults.flatMap((result) => (result.ok ? [result.agent] : []));

  return <CompareView catalog={catalog} initialAgents={initialAgents} />;
}
