/**
 * BSC category discovery — server-only, bounded, evidence-keeping.
 *
 * Main Track P8: the marketplace never surfaces category-eligible BNB Chain
 * agents (P7 audit: 0/0/0/0 category matches on the surfaced page). This
 * module replaces "newest-first only" with a BOUNDED, category-aware read:
 *
 *   For each of the four required categories, ONE documented 8004scan query
 *   is issued with the officially supported server-side filters
 *   (`chainId=56`, `isTestnet=false`, `search=<category keyword>`), then the
 *   deterministic phrase classifier (./classifier.ts) decides which fetched
 *   records genuinely match the category. Category is NEVER claimed to be an
 *   8004scan field — every match carries the real metadata excerpt that
 *   justified it (source: "8004scan metadata").
 *
 * Boundedness (honesty rules, P8):
 *   - At most 4 requests per page load (one per category keyword), single
 *     page each (limit ≤ 100). NEVER loops over the 404,853-agent registry.
 *   - No fabrication: `matched` ∈ `retrieved` ∈ keyword `hits` (the API's own
 *     chain-56 search total). All three are reported so counts are auditable.
 *   - A failed keyword query degrades ONLY its own bucket (partial
 *     availability); the other categories still render.
 *   - Key handling is identical to the marketplace loader: the server-only
 *     `8004SCAN_API_KEY` guard with an honest "missing-key" state.
 *
 * Pure vs network (testable like marketplace.ts):
 *   - `assembleBscDiscovery` — PURE shaping from labeled results; the verify
 *     harness tests it with TEST FIXTURE records (no network, no env).
 *   - `getBscCategoryDiscovery` — the bounded network path (page.tsx).
 */

import { has8004ScanApiKey, listAgents, type Scan8004Result } from "../client.ts";
import { normalizeAgent } from "../normalize.ts";
import {
  classifyAgent,
  includeInBscDiscovery,
  DISCOVERY_CATEGORIES,
  type DiscoveryCategoryKey,
  type DiscoveryMatchEvidence,
} from "./classifier.ts";
import type { LeaderboardAgent } from "../leaderboard-types";
import type { Scan8004Agent } from "../types";

/** Discovery is BNB Chain (chainId 56) ONLY — never mixed with other chains. */
export const BSC_DISCOVERY_CHAIN_ID = 56;

/** Honest per-bucket availability (same state space as the marketplace). */
export type BscDiscoveryBucketState =
  | "ready"
  | "empty"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "server-error"
  | "network-error"
  | "error";

/** One matched record + the exact real-metadata evidence that matched it. */
export interface DiscoveredAgent {
  agent: LeaderboardAgent;
  match: DiscoveryMatchEvidence;
}

/** One category bucket: the API's totals + what we actually present. */
export interface BscDiscoveryBucket {
  key: DiscoveryCategoryKey;
  label: string;
  searchKeyword: string;
  state: BscDiscoveryBucketState;
  /** API's own `search=<keyword>&chainId=56` total (meta.pagination.total). */
  hits: number | null;
  /** Unique records actually fetched for the keyword (deduped). */
  retrieved: number;
  /** Records classified into THIS category by the documented phrase table. */
  matched: number;
  /** The matched records, deterministic, server order. */
  discovered: DiscoveredAgent[];
}

export type BscDiscoveryState =
  | "missing-key"
  | "ready"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "server-error"
  | "network-error"
  | "error";

export interface BscDiscoveryData {
  state: BscDiscoveryState;
  buckets: BscDiscoveryBucket[];
  lastIndexed: string | null;
  /** Wall-clock of this fetch (honest: data is a snapshot, not "live forever"). */
  fetchedAt: string | null;
  source: "8004scan";
}

/* ------------------------------------------------------------------ *
 * Pure assembly — deterministic shaping of labeled keyword results.
 * ------------------------------------------------------------------ */

export interface BscDiscoveryBucketInput {
  key: DiscoveryCategoryKey;
  result: Scan8004Result<Scan8004Agent>;
}

function bucketFromFailure(reason: string): BscDiscoveryBucketState {
  switch (reason) {
    case "unauthorized":
      return "unauthorized";
    case "forbidden":
      return "forbidden";
    case "rate-limited":
      return "rate-limited";
    default:
      return "error";
  }
}

/** Deterministic severity order when EVERY bucket failed (worst wins). */
const FAILURE_PRIORITY: readonly BscDiscoveryState[] = [
  "rate-limited",
  "unauthorized",
  "forbidden",
  "server-error",
  "network-error",
  "error",
];

/** Build one bucket from a labeled keyword result (pure, deterministic). */
function assembleBucket(input: BscDiscoveryBucketInput): BscDiscoveryBucket {
  const def = DISCOVERY_CATEGORIES.find((c) => c.key === input.key);
  const base = {
    key: input.key,
    label: def?.label ?? input.key,
    searchKeyword: def?.searchKeyword ?? "",
  };

  if (!input.result.ok) {
    return {
      ...base,
      state: bucketFromFailure(input.result.reason),
      hits: null,
      retrieved: 0,
      matched: 0,
      discovered: [],
    };
  }

  // Dedup by registry identity FIRST (a record repeated in one page counts once).
  const unique = new Map<string, LeaderboardAgent>();
  for (const raw of input.result.data) {
    const agent = normalizeAgent(raw);
    if (!includeInBscDiscovery(agent.chainId, agent.isTestnet)) continue;
    if (!unique.has(agent.slug)) unique.set(agent.slug, agent);
  }

  const discovered: DiscoveredAgent[] = [];
  for (const agent of unique.values()) {
    // Deterministic local classification; keep ONLY matches for this bucket.
    const match = classifyAgent(agent).categories.find((m) => m.category === input.key);
    if (match) discovered.push({ agent, match });
  }

  return {
    ...base,
    state: discovered.length > 0 ? "ready" : "empty",
    hits: input.result.ok ? (input.result.meta.pagination?.total ?? null) : null,
    retrieved: unique.size,
    matched: discovered.length,
    discovered,
  };
}

/**
 * Shape labeled keyword results into `BscDiscoveryData`. Pure — never
 * throws, never fabricates rows, fully testable with labeled fixtures.
 * Buckets follow DISCOVERY_CATEGORIES order; unknown keys are ignored.
 */
export function assembleBscDiscovery(inputs: BscDiscoveryBucketInput[]): BscDiscoveryData {
  const buckets = DISCOVERY_CATEGORIES.map(({ key }) => inputs.find((i) => i.key === key))
    .filter((i): i is BscDiscoveryBucketInput => i !== undefined)
    .map(assembleBucket);

  const anyUsable = buckets.some((b) => b.state === "ready" || b.state === "empty");
  const state: BscDiscoveryState = anyUsable
    ? "ready"
    : (FAILURE_PRIORITY.find((p) => buckets.some((b) => b.state === p)) ?? "error");

  const lastIndexed =
    inputs
      .map((i) => (i.result.ok ? (i.result.meta.timestamp ?? null) : null))
      .find((t) => t !== null) ?? null;

  return { state, buckets, lastIndexed, fetchedAt: null, source: "8004scan" };
}

/* ------------------------------------------------------------------ *
 * Bounded network path — at most 4 single-page requests, no loops.
 * ------------------------------------------------------------------ */

export interface GetBscCategoryDiscoveryOptions {
  /** Bounded page size per category keyword (1..100). Single page each. */
  maxPerCategory?: number;
  page?: number;
}

/**
 * One bounded discovery pass: one `GET /agents` per category keyword with
 * `chainId=56` + `isTestnet=false` (officially supported server-side filters,
 * live-verified in P7), then pure assembly. Keyless-safe: without
 * `8004SCAN_API_KEY` the honest "missing-key" state is returned — nothing is
 * simulated. Never loops; the full registry is never fetched.
 */
export async function getBscCategoryDiscovery(
  options: GetBscCategoryDiscoveryOptions = {}
): Promise<BscDiscoveryData> {
  if (!has8004ScanApiKey()) {
    return {
      state: "missing-key",
      buckets: [],
      lastIndexed: null,
      fetchedAt: null,
      source: "8004scan",
    };
  }

  const limit = Math.min(Math.max(options.maxPerCategory ?? 100, 1), 100);
  const page = options.page ?? 1;

  const inputs = await Promise.all(
    DISCOVERY_CATEGORIES.map(async ({ key, searchKeyword }) => ({
      key,
      result: await listAgents({
        page,
        limit,
        chainId: BSC_DISCOVERY_CHAIN_ID,
        isTestnet: false,
        search: searchKeyword,
      }),
    }))
  );

  return { ...assembleBscDiscovery(inputs), fetchedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ *
 * X.53 — single-category loader for the four Main Track category pages.
 * ------------------------------------------------------------------ */

/** One category's bucket plus the snapshot metadata the page must attribute. */
export interface BscCategoryPageData {
  state: BscDiscoveryState;
  bucket: BscDiscoveryBucket | null;
  lastIndexed: string | null;
  fetchedAt: string | null;
  source: "8004scan";
}

/**
 * X.53: ONE bounded `GET /agents` request for a SINGLE category keyword.
 *
 * The four Main Track category pages each render exactly one category, so
 * issuing all four keyword queries per page would be wasteful. This reuses
 * the same officially supported server-side filters (`chainId=56`,
 * `isTestnet=false`, `search=<keyword>`) and the SAME deterministic phrase
 * classifier as the marketplace, so a category page and the marketplace can
 * never disagree about what qualifies.
 *
 * Honesty rules are inherited unchanged: keyless-safe `missing-key` state,
 * `matched ∈ retrieved ∈ hits`, evidence retained per match, and no
 * fabricated rows or metrics.
 */
export async function getBscCategoryPage(
  key: DiscoveryCategoryKey,
  options: GetBscCategoryDiscoveryOptions = {}
): Promise<BscCategoryPageData> {
  const definition = DISCOVERY_CATEGORIES.find((candidate) => candidate.key === key);
  if (!definition) {
    return { state: "error", bucket: null, lastIndexed: null, fetchedAt: null, source: "8004scan" };
  }
  if (!has8004ScanApiKey()) {
    return { state: "missing-key", bucket: null, lastIndexed: null, fetchedAt: null, source: "8004scan" };
  }

  const limit = Math.min(Math.max(options.maxPerCategory ?? 100, 1), 100);
  const page = options.page ?? 1;
  const result = await listAgents({
    page,
    limit,
    chainId: BSC_DISCOVERY_CHAIN_ID,
    isTestnet: false,
    search: definition.searchKeyword,
  });

  const assembled = assembleBscDiscovery([{ key, result }]);
  const bucket = assembled.buckets[0] ?? null;
  return {
    state: assembled.state,
    bucket,
    lastIndexed: assembled.lastIndexed,
    fetchedAt: new Date().toISOString(),
    source: "8004scan",
  };
}
