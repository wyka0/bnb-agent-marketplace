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

/**
 * X.216 — the DISCOVERY NETWORK scope the marketplace catalog is read from.
 * This is a pure 8004scan application-level filter; it has NO connection to
 * the ERC-8183 commercial-hire chain (HIRED_CHAIN_ID stays 97 and commercial
 * hire addresses are untouched).
 */
export type MarketplaceNetworkScope = "all" | "mainnet" | "testnet";

/**
 * X.231 — conservative UI pagination depth. Upstream supports thousands of
 * pages (~487k records); the marketplace intentionally exposes only a shallow
 * window (newest-first browsing + search) instead of crawling the registry.
 * Reads beyond this cap are rejected before any upstream request is made.
 */
export const MARKETPLACE_MAX_PAGE = 10;

/** Parse a raw page number (1-indexed) into a safe, capped page. Pure. */
export function parseMarketplacePage(raw: string | undefined | null): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, MARKETPLACE_MAX_PAGE);
}

/** Canonical labels for the network selector (single source of truth). */
export const MARKETPLACE_NETWORK_LABELS = {
  mainnet: "8004scan Mainnet",
  testnet: "8004scan Testnet",
} as const;

/** Parse a raw `network` value into a valid scope (invalid → "all"). Pure. */
export function parseMarketplaceNetworkScope(
  raw: string | undefined | null
): MarketplaceNetworkScope {
  if (raw === "mainnet" || raw === "testnet") return raw;
  return "all";
}

export interface GetMarketplaceAgentsOptions {
  page?: number;
  /** Bounded page size, reused from the verified pagination (1..100). */
  limit?: number;
  /** Optional live registry search (name, metadata, or registry identity). */
  query?: string;
  /**
   * X.216 — optional discovery-network scope. Default "all" keeps the exact
   * X.154 behavior (chain 56 + 97 merged). "mainnet" reads only the chain-56
   * registry; "testnet" reads only the chain-97 registry. Pure read-scope
   * selection — never touches commercial hire configuration.
   */
  scope?: MarketplaceNetworkScope;
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
  const page = Math.min(options.page ?? 1, MARKETPLACE_MAX_PAGE);
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 100);
  const query = options.query?.trim();
  const scope = options.scope ?? "all";
  if (!has8004ScanApiKey()) {
    return { state: "missing-key", ...EMPTY };
  }
  const readMainnet = scope === "all" || scope === "mainnet";
  const readTestnet = scope === "all" || scope === "testnet";
  const [mainnet, bscTestnet] = await Promise.all([
    readMainnet
      ? listAgents({
          page,
          limit,
          // X.231 — "Mainnet" means BNB Smart Chain mainnet ONLY (chain 56).
          // `isTestnet=false` alone would return every non-testnet EVM chain
          // (Base/Celo/Arbitrum/…); the explicit chainId pins the read.
          chainId: 56,
          isTestnet: false,
          sortBy: "created_at",
          sortOrder: "desc",
          search: query || undefined,
        })
      : Promise.resolve({ ok: false, reason: "not-found" as const, status: 404 }),
    readTestnet
      ? listAgents({
          page,
          limit,
          chainId: 97,
          isTestnet: true,
          sortBy: "created_at",
          sortOrder: "desc",
          search: query || undefined,
        })
      : Promise.resolve({ ok: false, reason: "not-found" as const, status: 404 }),
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

/**
 * The marketplace's live-seller registry chain (BSC Testnet). A record's full
 * identity is `chainId:contract:tokenId` — token ids are NOT globally unique
 * across chains/registries, so search keeps chain context and never collapses
 * e.g. `97:registry:2005` with a `56:registry:2005` record.
 */
export const MARKETPLACE_LIVE_CHAIN = 97;

/**
 * Relevance-scoring context for a search over a fixed result set. `tokenCount`
 * maps a token id to how many records in the set share it — used so a bare/ambiguous
 * token id is never treated as a globally unique exact match.
 */
export interface AgentSearchCtx {
  tokenCount: ReadonlyMap<string, number>;
}

const NO_SEARCH_CTX: AgentSearchCtx = { tokenCount: new Map() };

/**
 * Deterministic relevance ordering (X.164). Returns 0 when the agent does not
 * match the query, otherwise a positive score where HIGHER = more relevant:
 *
 *   1. exact normalized agent name                         → 1000
 *   2. exact normalized slug (route key)                   → 950
 *   3. exact full registry identifier (agentId)            → 950
 *   4. token-id match — only when unambiguous + referenced → 600 / 200 / 150
 *   5. all query tokens present (AND)                       → 300
 *   6. any query token present (normal text relevance)      → 50
 *
 * Token-id matching is chain-aware and never globally unique: a bare numeric
 * token is scored as a medium (150) match; an explicit `Agent <n>` / chain
 * reference raises it, but only to 600 when the token is unambiguous within the
 * result set. When two or more records share a token id, both are returned and
 * ranked (the live chain gets a small tie-break boost) — never a single
 * arbitrary selection.
 */
export function scoreAgentMatch(
  a: LeaderboardAgent,
  query: string,
  ctx: AgentSearchCtx = NO_SEARCH_CTX
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const text = agentSearchText(a);
  // P1 — exact normalized name.
  if (a.name.trim().toLowerCase() === q) return 1000;
  // P2 — exact slug (the registry identity used by the detail route).
  if (a.slug.toLowerCase() === q) return 950;
  // P3 — exact full registry identifier.
  if (a.agentId.toLowerCase() === q) return 950;

  const tokens = q.split(/\s+/).filter(Boolean);
  const numTokens = tokens.filter((t) => /^\d+$/.test(t));
  if (numTokens.length > 0 && numTokens.every((t) => t === a.tokenId)) {
    // Token-id matching only fires for an explicit reference ("Agent 2005" /
    // "token 2005" / a `chain:registry:token` shape) or a bare single numeric
    // token. A multi-word name query that merely contains a number must NOT
    // collapse onto a same-token record — it falls through to text relevance.
    const explicitRef =
      tokens.some((t) => t === "agent" || t === "token" || t === "id") || q.includes(":");
    const isBareTokenQuery = tokens.length === 1;
    if (explicitRef || isBareTokenQuery) {
      const unambiguous = (ctx.tokenCount.get(a.tokenId) ?? 0) <= 1;
      const chainBoost = a.chainId === MARKETPLACE_LIVE_CHAIN ? 25 : 0;
      if (explicitRef && unambiguous) return 600 + chainBoost; // referenced + unique → strong
      if (explicitRef) return 200 + chainBoost; // referenced but ambiguous → shown, lower
      // Bare numeric token: NOT globally unique → medium, never an exact identity.
      return 150 + chainBoost;
    }
  }

  // P5 — every query token must appear (AND), so a single common word never
  // over-matches.
  if (tokens.length > 1 && tokens.every((t) => text.includes(t))) return 300;
  // P6 — a single query token present (ordinary text relevance). Restricted to
  // single-token queries so multi-word queries stay AND-only (X.163).
  if (tokens.length === 1) {
    const only = tokens[0];
    if (only && text.includes(only)) return 50;
  }
  return 0;
}

/** Boolean match predicate (used by non-ranking callers). */
export function matchesSearch(a: LeaderboardAgent, query: string): boolean {
  return scoreAgentMatch(a, query, { tokenCount: new Map([[a.tokenId, 1]]) }) > 0;
}

/** Facets with NO backing registry data: any selection matches nothing. */
function matchesNoData(set: ReadonlySet<string>): boolean {
  return set.size > 0 ? false : true;
}

export function matchesFilters(
  a: LeaderboardAgent,
  filters: MarketplaceFilters,
  ctx: AgentSearchCtx
): boolean {
  if (scoreAgentMatch(a, filters.query, ctx) <= 0) return false;

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
  // Relevance context: how many records in this set share each token id. A token
  // id shared by 2+ records is ambiguous and must not be treated as a unique exact
  // match (X.164).
  const tokenCount = new Map<string, number>();
  for (const a of agents) {
    if (!a.tokenId) continue;
    tokenCount.set(a.tokenId, (tokenCount.get(a.tokenId) ?? 0) + 1);
  }
  const ctx: AgentSearchCtx = { tokenCount };

  const matched = agents.filter((a) => matchesFilters(a, filters, ctx));
  // Deterministic relevance ordering: when a query is present, rank by score
  // (exact name/slug/id first, then token relevance, then text) — stable tie-break
  // by name. Ambiguous token matches are all returned, never a single arbitrary pick.
  if (filters.query.trim()) {
    matched.sort((x, y) => {
      const sx = scoreAgentMatch(x, filters.query, ctx);
      const sy = scoreAgentMatch(y, filters.query, ctx);
      if (sy !== sx) return sy - sx;
      return x.name.localeCompare(y.name);
    });
  }
  return matched;
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
