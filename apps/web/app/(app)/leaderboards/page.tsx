/**
 * Leaderboards route — Sprint 2G (server entry).
 *
 * Server component: reads normalized 8004scan data on the server (API key stays
 * server-only), then hands it to the frozen Sprint 2F client UI. Keyless-safe —
 * with no `8004SCAN_API_KEY` configured, `getLeaderboard()` returns the honest
 * "missing-key" state and the UI shows the existing pending/unavailable view.
 *
 * X.232 — the leaderboard discovery-network scope is URL-driven
 * (`?network=mainnet|testnet`, default "all" = both BNB chains merged) and
 * pagination is URL-driven (`?page=`, capped, one bounded read per chain).
 * This NEVER affects the ERC-8183 commercial-hire chain (HIRED_CHAIN_ID stays 97).
 *
 * `force-dynamic` + `revalidate = 0` ensure this NEVER fetches during `next
 * build` (no secrets or network needed for CI); data loads per request.
 */

import * as React from "react";
import type { Metadata } from "next";
import { getLeaderboard, parseLeaderboardNetworkScope } from "@/lib/eight004scan/leaderboard";
import { parseMarketplacePage } from "@/lib/eight004scan/marketplace";
import { LeaderboardsView } from "./leaderboards-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Ranked ERC-8004 agents by registry score, reputation, activity, and freshness.",
};

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNetwork = Array.isArray(params.network) ? params.network[0] : params.network;
  const scope = parseLeaderboardNetworkScope(rawNetwork);
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = parseMarketplacePage(rawPage);

  // Never throws; resolves to an honest state in every case (incl. no API key).
  const data = await getLeaderboard({ limit: 20, page, scope });

  return (
    <React.Suspense fallback={null}>
      <LeaderboardsView data={data} scope={scope} page={page} />
    </React.Suspense>
  );
}
