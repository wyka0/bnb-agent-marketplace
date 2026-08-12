/**
 * Marketplace page — Main Track P1 (server entry) + P8 BSC category discovery.
 *
 * Loads TWO bounded live surfaces from the verified 8004scan path:
 *   1. the first page of newest agents (existing marketplace list), and
 *   2. BSC category discovery — at most 4 single-page keyword requests
 *      (`chainId=56`, bounded in `lib/eight004scan/discovery/service.ts`).
 *
 * Both are keyless-safe and failure-safe: every non-ready state renders an
 * honest message — never fake cards.
 *
 * `force-dynamic` + `revalidate = 0`: NEVER fetches during `next build`
 * (no secrets or network needed for CI); data loads per request.
 */

import * as React from "react";
import { getMarketplaceAgents } from "@/lib/eight004scan/marketplace";
import { getBscCategoryDiscovery } from "@/lib/eight004scan/discovery/service";
import { MarketplaceView } from "./marketplace-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MarketplacePage() {
  // Two bounded reads, run in parallel; discovery degrades per-category.
  const [data, discovery] = await Promise.all([
    getMarketplaceAgents({ limit: 24, page: 1 }),
    getBscCategoryDiscovery({ maxPerCategory: 100 }),
  ]);
  return (
    <React.Suspense fallback={null}>
      <MarketplaceView data={data} discovery={discovery} />
    </React.Suspense>
  );
}
