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
import {
  getMarketplaceAgents,
  parseMarketplaceNetworkScope,
  parseMarketplacePage,
} from "@/lib/eight004scan/marketplace";
import { getBscCategoryDiscovery } from "@/lib/eight004scan/discovery/service";
import { MarketplaceView } from "./marketplace-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQuery?.trim() ?? "";
  // X.216 — the discovery-network scope is URL-driven (?network=mainnet|testnet).
  // Default "all" keeps the exact X.154 merged catalog; an explicit scope selects
  // the 8004scan registry the catalog is read from. This NEVER affects the
  // ERC-8183 commercial-hire chain (HIRED_CHAIN_ID stays 97).
  const rawNetwork = Array.isArray(params.network) ? params.network[0] : params.network;
  const scope = parseMarketplaceNetworkScope(rawNetwork);
  // X.231 — shallow, truthful pagination: ?page= (1-indexed, capped) drives
  // the upstream page parameter. Bounded reads per page; no registry crawl.
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = parseMarketplacePage(rawPage);

  // Two bounded reads, run in parallel; discovery degrades per-category.
  const [data, discovery] = await Promise.all([
    getMarketplaceAgents({ limit: 24, page, query, scope }),
    getBscCategoryDiscovery({ maxPerCategory: 100 }),
  ]);
  return (
    <React.Suspense fallback={null}>
      <MarketplaceView data={data} discovery={discovery} scope={scope} page={page} />
    </React.Suspense>
  );
}
