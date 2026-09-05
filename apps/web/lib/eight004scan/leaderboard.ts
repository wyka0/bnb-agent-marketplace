/**
 * Server-side Leaderboard data loader.
 *
 * Bridges the 8004scan client → normalized model → an honest, discriminated
 * `LeaderboardData` the (client) UI switches on. Keyless-safe:
 *
 *   - No `8004SCAN_API_KEY`  → state "missing-key"  → UI shows the existing
 *     "Waiting for ERC-8004 Registry" / unavailable state (NO crash, NO fetch).
 *   - Key present            → one request to `GET /agents`; errors map to
 *     unauthorized / rate-limited / offline; empty → "empty"; rows → "ready".
 *
 * IMPORTANT: this must never run during `next build`. The route opts out of
 * static prerendering (`force-dynamic`) so this only executes per-request. This
 * module is only imported by the server component, never by client code.
 */

import { has8004ScanApiKey, listAgents } from "./client";
import { normalizeAgents } from "./normalize";
import type { LeaderboardData, LeaderboardDataState } from "./leaderboard-types";
import {
  MARKETPLACE_MAX_PAGE,
  parseMarketplaceNetworkScope,
  type MarketplaceNetworkScope,
} from "./marketplace";

const EMPTY: Omit<LeaderboardData, "state"> = {
  agents: [],
  pagination: null,
  lastIndexed: null,
};

/**
 * X.232 — leaderboard discovery-network scope. Mirrors the marketplace model:
 * "mainnet" = BNB Smart Chain mainnet ONLY (chain 56); "testnet" = chain 97
 * ONLY; "all" = both BNB chains merged (one bounded read each). Discovery-only
 * — never touches the commercial-hire chain (HIRED_CHAIN_ID stays 97).
 */
export type LeaderboardNetworkScope = MarketplaceNetworkScope;

/** Parse a raw network value into a valid leaderboard scope (invalid → "all"). Pure. */
export { parseMarketplaceNetworkScope as parseLeaderboardNetworkScope };

export interface GetLeaderboardOptions {
  limit?: number;
  page?: number;
  search?: string;
  /** X.232 — discovery-network scope (default "all" = BNB 56 + 97 merged). */
  scope?: LeaderboardNetworkScope;
}

/**
 * Fetch + normalize the leaderboard. Always resolves (never throws) so the page
 * can render an honest state in every case.
 */
export async function getLeaderboard(
  options: GetLeaderboardOptions = {}
): Promise<LeaderboardData> {
  // 1) Keyless-safe short-circuit: no key → unavailable, no network call.
  if (!has8004ScanApiKey()) {
    return { state: "missing-key", ...EMPTY };
  }

  const page = Math.min(options.page ?? 1, MARKETPLACE_MAX_PAGE);
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const scope = options.scope ?? "all";
  const readMainnet = scope === "all" || scope === "mainnet";
  const readTestnet = scope === "all" || scope === "testnet";

  // 2) Real requests (request-time only). One bounded read per BNB chain;
  //    a single failing read degrades honestly (never partial-fabricated rows).
  const [mainnet, bscTestnet] = await Promise.all([
    readMainnet
      ? listAgents({
          page,
          limit,
          search: options.search,
          // X.232 — "Mainnet" means BNB Smart Chain mainnet ONLY (chain 56).
          chainId: 56,
          isTestnet: false,
          sortBy: "total_score",
          sortOrder: "desc",
        })
      : Promise.resolve({ ok: false, reason: "not-found" as const, status: 404 }),
    readTestnet
      ? listAgents({
          page,
          limit,
          search: options.search,
          chainId: 97,
          isTestnet: true,
          sortBy: "total_score",
          sortOrder: "desc",
        })
      : Promise.resolve({ ok: false, reason: "not-found" as const, status: 404 }),
  ]);

  const okResults = [mainnet, bscTestnet].filter((r) => r.ok) as Array<{
    ok: true;
    data: import("./types").Scan8004Agent[];
    meta: import("./types").Scan8004Meta;
  }>;
  if (okResults.length === 0) {
    const failed = !mainnet.ok ? mainnet : bscTestnet;
    if (failed.ok) {
      return { state: "error", ...EMPTY };
    }
    const state: LeaderboardDataState =
      failed.status === 401 || failed.status === 403
        ? "unauthorized"
        : failed.status === 429
          ? "rate-limited"
          : failed.status === 400 || failed.status === 404
            ? "error"
            : "offline";
    return { state, ...EMPTY };
  }

  // Merge the two BNB-chain reads; rankings stay network-mixing only in the
  // "all" scope (both BNB chains — never non-BNB chains).
  const agents = normalizeAgents(okResults.flatMap((r) => r.data));
  const pagination = {
    page,
    limit,
    total: okResults.reduce((sum, r) => sum + (r.meta.pagination?.total ?? 0), 0),
    hasMore: okResults.some((r) => r.meta.pagination?.hasMore === true),
  };
  if (agents.length === 0) {
    return { state: "empty", ...EMPTY, pagination };
  }

  return {
    state: "ready",
    agents,
    pagination,
    lastIndexed: okResults.map((r) => r.meta.timestamp ?? null).find((t) => t !== null) ?? null,
  };
}

export type { LeaderboardAgent, LeaderboardData } from "./leaderboard-types";
