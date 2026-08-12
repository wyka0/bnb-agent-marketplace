/**
 * Leaderboards route — Sprint 2G (server entry).
 *
 * Server component: reads normalized 8004scan data on the server (API key stays
 * server-only), then hands it to the frozen Sprint 2F client UI. Keyless-safe —
 * with no `8004SCAN_API_KEY` configured, `getLeaderboard()` returns the honest
 * "missing-key" state and the UI shows the existing pending/unavailable view.
 *
 * `force-dynamic` + `revalidate = 0` ensure this NEVER fetches during
 * `next build` (no secrets or network needed for CI); data loads per request.
 */

import * as React from "react";
import type { Metadata } from "next";
import { getLeaderboard } from "@/lib/eight004scan/leaderboard";
import { LeaderboardsView } from "./leaderboards-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Ranked ERC-8004 agents by registry score, reputation, activity, and freshness.",
};

export default async function LeaderboardsPage() {
  // Never throws; resolves to an honest state in every case (incl. no API key).
  const data = await getLeaderboard({ limit: 20 });

  return (
    <React.Suspense fallback={null}>
      <LeaderboardsView data={data} />
    </React.Suspense>
  );
}
