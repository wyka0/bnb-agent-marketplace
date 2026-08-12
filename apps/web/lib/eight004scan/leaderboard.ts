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

const EMPTY: Omit<LeaderboardData, "state"> = {
  agents: [],
  pagination: null,
  lastIndexed: null,
};

export interface GetLeaderboardOptions {
  limit?: number;
  page?: number;
  search?: string;
  chainId?: number;
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

  // 2) Real request (request-time only).
  const result = await listAgents({
    page: options.page ?? 1,
    limit: Math.min(Math.max(options.limit ?? 20, 1), 100),
    search: options.search,
    chainId: options.chainId,
    sortBy: "total_score", // documented sort field
    sortOrder: "desc",
    isTestnet: false,
  });

  if (!result.ok) {
    const state: LeaderboardDataState =
      result.reason === "unauthorized"
        ? "unauthorized"
        : result.reason === "rate-limited"
          ? "rate-limited"
          : result.reason === "bad-request" || result.reason === "not-found"
            ? "error"
            : "offline";
    return { state, ...EMPTY };
  }

  const agents = normalizeAgents(result.data);
  if (agents.length === 0) {
    return { state: "empty", ...EMPTY, pagination: result.meta.pagination ?? null };
  }

  return {
    state: "ready",
    agents,
    pagination: result.meta.pagination ?? null,
    lastIndexed: result.meta.timestamp ?? null,
  };
}

export type { LeaderboardAgent, LeaderboardData } from "./leaderboard-types";
