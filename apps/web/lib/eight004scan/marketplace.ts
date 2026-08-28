/**
 * Marketplace — server-only catalog loader over the VERIFIED 8004scan path.
 *
 * REUSE, NOT DUPLICATION: this module calls the exact same verified surface as
 * the Leaderboards route (`has8004ScanApiKey` + `listAgents` + `normalizeAgents`
 * from `./client.ts` / `./normalize.ts`). It adds NO second HTTP client, NO
 * second auth path, and NO new response parsing — it only shapes the existing
 * discriminated result into the Marketplace's honest states and adds pure
 * client-side filtering/sorting helpers over the normalized records.
 *
 *  8004scan API  →  client.listAgents (verified)  →  normalizeAgents (verified)
 *        ↓
 *  toMarketplaceData / pickAgentBySlug (this file — pure shaping)
 *        ↓
 *  Marketplace page & Agent Details route (server components)
 *
 * Honest states (the UI switches on these, never fake rows):
 *   missing-key · ready · empty · unauthorized · forbidden · rate-limited
 *   server-error · network-error · error
 *
 * No network calls at import time; bounded requests only (single page, no
 * fetch loops). The 8004scan API key is read ONLY server-side in `client.ts`.
 */

import { has8004ScanApiKey, listAgents, type Scan8004Result } from "./client.ts";
import { normalizeAgents } from "./normalize.ts";
import type { LeaderboardAgent } from "./leaderboard-types";
import type { Scan8004Agent, Scan8004Pagination } from "./types";

/* ------------------------------------------------------------------ *
 * Marketplace discriminated states (superset of the honest-UI contract).
 * ------------------------------------------------------------------ */

export type MarketplaceDataState =
  | "missing-key"
  | "ready"
  | "empty"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "server-error"
  | "network-error"
  | "error";

export interface MarketplaceData {
  state: MarketplaceDataState;
  agents: LeaderboardAgent[];
  pagination: Scan8004Pagination | null;
  lastIndexed: string | null;
  source: "8004scan";
}

const EMPTY: Omit<MarketplaceData, "state"> = {
  agents: [],
  pagination: null,
  lastIndexed: null,
  source: "8004scan",
};

/** Map the verified client's HTTP status onto the honest state space. */
export function mapStatusToState(
  status: number | undefined
): Exclude<MarketplaceDataState, "ready" | "empty" | "missing-key"> {
  if (typeof status !== "number") return "network-error";
  if (status >= 500) return "server-error";
  if (status === 429) return "rate-limited";
  if (status === 403) return "forbidden";
  if (status === 401) return "unauthorized";
  return "error";
}

/**
 * Shape a verified `listAgents` result into `MarketplaceData`. Pure — never
 * throws, never fabricates rows, and is fully testable with labeled fixtures.
 */
export function toMarketplaceData(result: Scan8004Result<Scan8004Agent>): MarketplaceData {
  if (result.ok) {
    const agents = normalizeAgents(result.data);
    if (agents.length === 0) {
      return { state: "empty", ...EMPTY, pagination: result.meta.pagination ?? null };
    }
    return {
      state: "ready",
      agents,
      pagination: result.meta.pagination ?? null,
      lastIndexed: result.meta.timestamp ?? null,
      source: "8004scan",
    };
  }
  return { state: mapStatusToState(result.status), ...EMPTY };
}

/* ------------------------------------------------------------------ *
 * Marketplace list loader — ONE bounded request (page 1, newest first).
 * ------------------------------------------------------------------ */

export interface GetMarketplaceAgentsOptions {
  page?: number;
  /** Bounded page size, reused from the verified pagination (1..100). */
  limit?: number;
  /** Optional live registry search (name, metadata, or registry identity). */
  query?: string;
}

/**
 * Fetch the first page of live agents for the Marketplace. Single bounded
 * read per BNB chain (56 mainnet + 97 testnet, merged) — never a loop over
 * the registry. Newest-first (real `created_at`). X.154: BSC testnet agents
 * are surfaced so the marketplace supports the hackathon's chain-97 seller.
 */
export async function getMarketplaceAgents(
  options: GetMarketplaceAgentsOptions = {}
): Promise<MarketplaceData> {
  const page = options.page ?? 1;
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 100);
  const query = options.query?.trim();
  if (!has8004ScanApiKey()) {
    return { state: "missing-key", ...EMPTY };
  }
  const [mainnet, bscTestnet] = await Promise.all([
    listAgents({
      page,
      limit,
      isTestnet: false,
      sortBy: "created_at",
      sortOrder: "desc",
      search: query || undefined,
    }),
    listAgents({
      page,
      limit,
      chainId: 97,
      isTestnet: true,
      sortBy: "created_at",
      sortOrder: "desc",
      search: query || undefined,
    }),
  ]);
  // Merge the two BNB-chain reads into one result; a single failing read
  // degrades the whole state honestly (never partial-fabricated rows).
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
    return { state: mapStatusToState(failed.status), ...EMPTY };
  }
  const merged: Scan8004Result<Scan8004Agent> = {
    ok: true,
    data: okResults.flatMap((r) => r.data),
    meta: {
      timestamp:
        okResults.map((r) => r.meta.timestamp ?? null).find((t) => t !== null) ?? undefined,
      pagination: {
        page,
        limit,
        total: okResults.reduce((sum, r) => sum + (r.meta.pagination?.total ?? 0), 0),
        hasMore: okResults.some((r) => r.meta.pagination?.hasMore === true),
      },
    },
  };
  return toMarketplaceData(merged);
}

/* ------------------------------------------------------------------ *
 * Single-agent lookup — deterministic identity mapping by `agent_id`.
 *
 * The detail route key IS the registry identity: `slug === agent.agent_id`
 * (composite `chainId:contract:tokenId`, set by the verified normalize.ts).
 * One bounded read: the API's `search` param was live-verified to surface an
 * agent by its agent_id, then an EXACT key-equality filter guarantees we never
 * guess or fuzzy-match a record.
 * ------------------------------------------------------------------ */

export type AgentLookupState =
  | "missing-key"
  | "not-found"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "server-error"
  | "network-error"
  | "error";

export type AgentLookupResult =
  { ok: true; agent: LeaderboardAgent } | { ok: false; reason: AgentLookupState };

/**
 * Exact key-equality match on the normalized registry identity (slug).
 * X.154: addresses are case-insensitive on-chain, so the match is
 * case-insensitive — a checksummed detail slug (`97:0x8004A818…:1906`) must
 * resolve the API's lowercase `agent_id` (`97:0x8004a818…:1906`). The
 * chain:contract:token identity is unchanged; only casing is tolerated.
 */
export function pickAgentBySlug(
  agents: LeaderboardAgent[],
  slug: string
): LeaderboardAgent | undefined {
  const lower = slug.toLowerCase();
  return agents.find((a) => a.slug.toLowerCase() === lower);
}

export async function getMarketplaceAgentBySlug(slug: string): Promise<AgentLookupResult> {
  if (!has8004ScanApiKey()) {
    return { ok: false, reason: "missing-key" };
  }
  // X.154: the slug IS the registry identity (e.g. `97:0x8004…:1906`), so the
  // exact search must NOT filter by `isTestnet` — a BSC testnet agent must
  // resolve. The exact key-equality match below is the safety guard.
  const result = await listAgents({
    search: slug,
    page: 1,
    limit: 20,
  });
  if (!result.ok) {
    return { ok: false, reason: mapStatusToState(result.status) };
  }
  const agent = pickAgentBySlug(normalizeAgents(result.data), slug);
  return agent ? { ok: true, agent } : { ok: false, reason: "not-found" };
}

/* ------------------------------------------------------------------ *
 * Pure search + filter + sort helpers over NORMALIZED records.
 * Operate ONLY on fields the registry actually provides (name, description,
 * protocols, slug, verification, createdAt, averageScore). Category is NOT
 * classified by 8004scan → category filters deterministically match nothing,
 * and risk/activity/status/registry/builder facets have no backing data → any
 * selection matches nothing (honest zero results, never a fabricated match).
 * ------------------------------------------------------------------ */

export interface MarketplaceFilters {
  query: string;
  categories: ReadonlySet<string>;
  verifications: ReadonlySet<string>;
  protocols: ReadonlySet<string>;
  risks: ReadonlySet<string>;
  activities: ReadonlySet<string>;
  statuses: ReadonlySet<string>;
  registryStates: ReadonlySet<string>;
  verifiedBuildersOnly: boolean;
}

/** Display label → canonical category key ("Grid Trading" → "grid-trading"). */
export function categoryKeyFromLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Lowercased search surface for an agent (name, description, protocols, id). */
export function agentSearchText(a: LeaderboardAgent): string {
  return [a.name, a.description, a.slug, ...a.protocols]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" ")
    .toLowerCase();
}

export function matchesSearch(a: LeaderboardAgent, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return agentSearchText(a).includes(q);
}

/** Facets with NO backing registry data: any selection matches nothing. */
function matchesNoData(set: ReadonlySet<string>): boolean {
  return set.size > 0 ? false : true;
}

export function matchesFilters(a: LeaderboardAgent, filters: MarketplaceFilters): boolean {
  if (!matchesSearch(a, filters.query)) return false;

  // Category: the verified model carries no registered category (null) — a
  // category selection deterministically returns zero matches (never a guess).
  if (filters.categories.size > 0) {
    const keys = [...filters.categories].map(categoryKeyFromLabel);
    if (!keys.includes(a.category ?? "\u0000")) return false;
  }

  // Verification: real `verified` / `unverified` states; "Pending"/"Deprecated"
  // are platform states the registry does not expose → no matches.
  if (filters.verifications.size > 0) {
    const v = a.verification;
    const hit = [...filters.verifications].some((label) =>
      label === "Verified" ? v === "verified" : label === "Unverified" ? v === "unverified" : false
    );
    if (!hit) return false;
  }

  // Protocols: real `supported_protocols` (e.g. "A2A", "MCP").
  if (filters.protocols.size > 0) {
    const ps = a.protocols.map((p) => p.toLowerCase());
    const hit = [...filters.protocols].some((label) => ps.includes(label.toLowerCase()));
    if (!hit) return false;
  }

  // Risk / Activity / Status / Registry / Builder facets: no registry data.
  if (!matchesNoData(filters.risks)) return false;
  if (!matchesNoData(filters.activities)) return false;
  if (!matchesNoData(filters.statuses)) return false;
  if (!matchesNoData(filters.registryStates)) return false;
  if (filters.verifiedBuildersOnly) return false; // no builder verification data

  return true;
}

export function applyMarketplaceFilters(
  agents: LeaderboardAgent[],
  filters: MarketplaceFilters
): LeaderboardAgent[] {
  return agents.filter((a) => matchesFilters(a, filters));
}

export type MarketplaceSortKey =
  "default" | "featured" | "verified" | "reputation" | "trending" | "newest" | "alphabetical";

/**
 * Honest sorts. Only real fields are used:
 *   newest       → created_at desc
 *   alphabetical → name asc
 *   verified     → verified records first, server order afterwards
 *   reputation   → average_score desc (unknowns last)
 *   default/featured/trending → no editorial data → keep the API's order.
 * Never invents a score and never reorders unpredictably: stable sorts only.
 */
export function sortMarketplaceAgents(
  agents: LeaderboardAgent[],
  sort: MarketplaceSortKey
): LeaderboardAgent[] {
  const copy = [...agents];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => {
        const at = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bt - at;
      });
    case "alphabetical":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "verified":
      return copy.sort(
        (a, b) => Number(b.verification === "verified") - Number(a.verification === "verified")
      );
    case "reputation":
      return copy.sort((a, b) => {
        const av = a.averageScore ?? Number.NEGATIVE_INFINITY;
        const bv = b.averageScore ?? Number.NEGATIVE_INFINITY;
        return bv - av;
      });
    case "default":
    case "featured":
    case "trending":
    default:
      return copy; // server order; unchanged (no editorial/trend data exists)
  }
}
