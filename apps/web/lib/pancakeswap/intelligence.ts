/**
 * PancakeSwap — KEYLESS READ-ONLY market-intelligence adapter (Option B).
 *
 * WHY THIS EXISTS: the legacy NodeReal loader (`./client.ts`) requires the
 * server-only env var `PANCAKESWAP_API_KEY`. This adapter replaces that data
 * path for the Agent Details UI with an API-key-FREE read-only pipeline:
 *
 *   1. PancakeSwap V2 pair registry on BSC mainnet (chain 56), read via the
 *      OFFICIAL PUBLIC BNB Chain JSON-RPC endpoints (bsc-dataseed*.bnbchain.org
 *      / binance.org) — `eth_call` only, no key, no wallet, no signing.
 *   2. Official PancakeSwap token-price API (`explorer.pancakeswap.com`,
 *      the public keyless endpoint used by PancakeSwap's own AI plugins —
 *      `github.com/pancakeswap/pancakeswap-ai`) for real USD prices.
 *
 * NETWORK: BSC mainnet ONLY (chain 56). The registry and the price API are
 * mainnet-only; testnet data is never substituted and never implied.
 *
 * SAMPLE SCOPE (honest by design): the pair registry contains millions of
 * entries and cannot be enumerated wholesale. This adapter reads a BOUNDED
 * window — the first `windowSize` registered pairs (the blue-chip head) and
 * the last `windowSize` (the newest tail) — then ranks whatever survived the
 * price filter by COMPUTED TVL (USD). The `sample` field on every result
 * states exactly what was read. This is real data from a labeled sample, NOT
 * a "top pools" claim.
 *
 * READ-ONLY BOUNDARY (enforced): no wallet, no private key, no signing, no
 * approve, no swap, no add/removeLiquidity, no transaction submission, no
 * execution endpoints. Every network operation is an HTTP GET (price API) or
 * a JSON-RPC `eth_call` (read). There is no `eth_sendRawTransaction`, no
 * private-key material, and no env credential of any kind in this module.
 * Missing values are `null` (or the honest unavailable state) — never 0.
 *
 * This module is server-only (never bundled to the browser), makes no network
 * calls at import time, and never throws — every path resolves to a
 * discriminated honest state.
 */

import "server-only";
import { createApiClient, ApiClientError } from "@bnb-marketplace/data-api";

/* ------------------------------------------------------------------ *
 * Constants (official, public, keyless)
 * ------------------------------------------------------------------ */

/** BSC mainnet — the ONLY network this adapter reads. */
export const PANCAKESWAP_BSC_CHAIN_ID = 56 as const;

/** Official PancakeSwap V2 pair factory on BSC mainnet (documented address). */
export const PANCAKESWAP_V2_FACTORY = "0xca143ce32fe78f1f7019d7d551a6402fc5350c73" as const;

/** Official PUBLIC BNB Chain JSON-RPC endpoints (no key). */
export const PANCAKESWAP_PUBLIC_RPCS = [
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed2.bnbchain.org",
  "https://bsc-dataseed3.bnbchain.org",
] as const;

/** Official PancakeSwap price API (public, keyless; used by pancakeswap-ai). */
export const PANCAKESWAP_PRICE_API_BASE = "https://explorer.pancakeswap.com" as const;
export const PANCAKESWAP_PRICE_API_PATH = "/api/cached/tokens/price/list/" as const;

/** Official V2 fee tier (25 bps) — a protocol constant, not fabricated data. */
export const PANCAKESWAP_V2_FEE_TIER = 0.0025 as const;

/** Provenance label shared with the keyed loader's UI contract. */
export const PANCAKESWAP_SOURCE = "pancakeswap" as const;

/* -- Function selectors (ERC-20 / PancakePair / factory reads) -- */

const SEL_ALL_PAIRS_LENGTH = "0x574f2ba3" as const; // allPairsLength()
const SEL_ALL_PAIRS = "0x1e3dd18b" as const; // allPairs(uint256)
const SEL_TOKEN0 = "0x0dfe1681" as const; // token0()
const SEL_TOKEN1 = "0xd21220a7" as const; // token1()
const SEL_GET_RESERVES = "0x0902f1ac" as const; // getReserves()
const SEL_SYMBOL = "0x95d89b41" as const; // symbol()
const SEL_DECIMALS = "0x313ce567" as const; // decimals()

/** Bounded concurrency for JSON-RPC batches (public-node politeness). */
const RPC_CONCURRENCY = 8 as const;
/** Bounded registry window per side (head + tail). */
const DEFAULT_WINDOW = 8 as const;
const MAX_WINDOW = 16 as const;
/** In-memory TTL cache (ms) for repeated reads — protects public endpoints. */
const CACHE_TTL_MS = 60_000 as const;

/* ------------------------------------------------------------------ *
 * Honest state model (same contract as the keyed loader's UI states)
 * ------------------------------------------------------------------ */

export type PancakeSwapIntelligenceState =
  | "ready"
  | "not-found"
  | "bad-request"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "server-error"
  | "network-error"
  | "timeout"
  | "error";

/**
 * One normalized PancakeSwap V2 pair. Every field is either real measured
 * data or an explicit honest `null` — never a fabricated 0.
 */
export interface PancakeSwapIntelligencePool {
  /** The pair contract address (lowercased). */
  poolId: string;
  chainId: typeof PANCAKESWAP_BSC_CHAIN_ID;
  token0Address: string;
  token0Symbol: string;
  token1Address: string;
  token1Symbol: string;
  /** "SYMBOL0/SYMBOL1" display label built from the on-chain symbols. */
  symbol: string;
  /** Computed TVL (USD) = reserve0 × price0 + reserve1 × price1. */
  tvlUsd: number;
  /** Real current token quantities held by the pool (human units). */
  reserve0: number;
  reserve1: number;
  /** Official PancakeSwap price API USD prices (real, per token). */
  token0PriceUsd: number;
  token1PriceUsd: number;
  /** 24h volume is NOT available on-chain → always null (never fabricated). */
  volume24hUsd: null;
  /** Official V2 fee tier constant. */
  feeTier: number;
  /** APR/APY not available from on-chain data → always null. */
  apr: null;
  apy: null;
  /** Latest official price-API timestamp seen for either token (ISO). */
  priceTimestamp: string | null;
  source: typeof PANCAKESWAP_SOURCE;
  retrievedAt: string;
}

/** What the adapter actually read — honest sample labeling. */
export interface PancakeSwapSample {
  /** Registry length at read time (`allPairsLength`). */
  registryLength: number | null;
  /** Pair indices sampled: head [0, headCount) and tail [len-tailCount, len). */
  headCount: number;
  tailCount: number;
}

export type PancakeSwapIntelligenceData =
  | {
      state: "ready";
      pools: PancakeSwapIntelligencePool[];
      sample: PancakeSwapSample;
      source: typeof PANCAKESWAP_SOURCE;
      chainId: typeof PANCAKESWAP_BSC_CHAIN_ID;
      retrievedAt: string;
    }
  | {
      state: Exclude<PancakeSwapIntelligenceState, "ready">;
      pools: [];
      sample: PancakeSwapSample;
      source: typeof PANCAKESWAP_SOURCE;
      chainId: typeof PANCAKESWAP_BSC_CHAIN_ID;
      retrievedAt: string;
      reason: Exclude<PancakeSwapIntelligenceState, "ready">;
      message?: string;
    };

/* ------------------------------------------------------------------ *
 * Tiny ABI helpers (hex encode/decode — no library required)
 * ------------------------------------------------------------------ */

function pad32(value: string): string {
  return value.length >= 64 ? value.slice(-64) : value.padStart(64, "0");
}

/** Encode a uint256 argument into 32 bytes of hex (without 0x). */
function encodeUint256(value: bigint): string {
  return pad32(value.toString(16));
}

/**
 * Decode the last 32 bytes of a result as a bigint. NEVER throws — malformed
 * hex yields 0n (which downstream treats as an honest missing/unset value).
 */
function decodeUint256(resultHex: string): bigint {
  const body = resultHex.startsWith("0x") ? resultHex.slice(2) : resultHex;
  const last = body.slice(-64);
  if (!/^[0-9a-fA-F]{0,64}$/.test(last)) return 0n;
  return BigInt(`0x${last || "0"}`);
}

/** Decode a Solidity address (last 20 bytes), lowercased. */
function decodeAddress(resultHex: string): string {
  const body = resultHex.startsWith("0x") ? resultHex.slice(2) : resultHex;
  return `0x${body.slice(-40).toLowerCase()}`;
}

/** Decode a Solidity `string` (offset/length/data), truncated defensively. */
function decodeAbiString(resultHex: string): string | null {
  const body = resultHex.startsWith("0x") ? resultHex.slice(2) : resultHex;
  if (body.length < 128) return null;
  const offset = Number(decodeUint256(body.slice(0, 64)));
  if (!Number.isSafeInteger(offset)) return null;
  const start = offset * 2;
  if (start + 64 > body.length) return null;
  const length = Number(decodeUint256(body.slice(start, start + 64)));
  if (!Number.isSafeInteger(length) || length < 0 || length > 256) return null;
  const dataStart = start + 64;
  if (dataStart + length * 2 > body.length) return null;
  let out = "";
  for (let i = 0; i < length; i++) {
    const c = body.slice(dataStart + i * 2, dataStart + i * 2 + 2);
    const n = Number.parseInt(c, 16);
    if (Number.isNaN(n)) return null;
    out += String.fromCharCode(n);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * In-memory TTL cache (module-level; server-only by import guard)
 * ------------------------------------------------------------------ */

const cache = new Map<string, { expires: number; value: unknown }>();

function memo<T>(key: string, ttlMs: number, produce: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
  return produce().then((value) => {
    cache.set(key, { expires: Date.now() + ttlMs, value });
    if (cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of cache) if (v.expires < now) cache.delete(k);
    }
    return value;
  });
}

/* ------------------------------------------------------------------ *
 * JSON-RPC transport (eth_call only — read-only by construction)
 * ------------------------------------------------------------------ */

type RpcFailure =
  | { kind: "http"; status: number }
  | { kind: "timeout" }
  | { kind: "network" }
  | { kind: "revert" }
  | { kind: "malformed" };

type RpcResult = { ok: true; result: string } | { ok: false; failure: RpcFailure };

function isTimeoutLike(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (typeof error === "object" && error !== null) {
    const e = error as { name?: unknown; code?: unknown; status?: unknown };
    if (e.name === "AbortError") return true;
    if (e.code === "UPSTREAM_ERROR" && e.status === undefined) return true;
  }
  return false;
}

/** ONE bounded JSON-RPC `eth_call`/`eth_getCode` POST. Never throws. */
async function rpcCall(
  rpc: string,
  to: string,
  data: string,
  timeoutMs: number
): Promise<RpcResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to, data }, "latest"],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, failure: { kind: "http", status: response.status } };
    const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
    if (typeof body.result !== "string") {
      if (body.error) return { ok: false, failure: { kind: "revert" } };
      return { ok: false, failure: { kind: "malformed" } };
    }
    return { ok: true, result: body.result };
  } catch (error) {
    if (isTimeoutLike(error)) return { ok: false, failure: { kind: "timeout" } };
    return { ok: false, failure: { kind: "network" } };
  } finally {
    clearTimeout(timer);
  }
}

/** `eth_chainId` — the ONLY RPC method besides eth_call this adapter sends. */
async function rpcChainId(rpc: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { result?: unknown };
    return typeof body.result === "string" ? body.result : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const RPC_SELECT_KEY = "rpc:selected";

/**
 * Pick the first official public RPC whose chainId is 56. Cached for CACHE_TTL_MS.
 * Returns the rpc URL, or one of the honest failure markers:
 *   "unsupported-network" (a responding endpoint is NOT chain 56),
 *   "network-error" (none reachable).
 */
async function selectRpc(
  timeoutMs: number
): Promise<string | "unsupported-network" | "network-error"> {
  const selected = memo(
    RPC_SELECT_KEY,
    CACHE_TTL_MS,
    async (): Promise<string | "unsupported-network" | "network-error"> => {
      let anyResponded = false;
      for (const rpc of PANCAKESWAP_PUBLIC_RPCS) {
        const chainId = await rpcChainId(rpc, Math.min(timeoutMs, 5_000));
        if (chainId === null) continue;
        anyResponded = true;
        if (chainId === "0x38") return rpc;
        return "unsupported-network";
      }
      return anyResponded ? "unsupported-network" : "network-error";
    }
  );
  return selected;
}

/* ------------------------------------------------------------------ *
 * Official price API (public, keyless)
 * ------------------------------------------------------------------ */

export interface PancakeSwapTokenPrice {
  priceUsd: number;
  tvlUsd: number | null;
  timestamp: string | null;
}

export type PancakeSwapPricesData =
  | { state: "ready"; prices: Record<string, PancakeSwapTokenPrice> }
  | {
      state: Exclude<PancakeSwapIntelligenceState, "ready">;
      prices: Record<string, PancakeSwapTokenPrice>;
      reason: Exclude<PancakeSwapIntelligenceState, "ready">;
      message?: string;
    };

function mapHttpStatusToState(status: number): Exclude<PancakeSwapIntelligenceState, "ready"> {
  if (status === 400) return "bad-request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server-error";
  return "error";
}

interface PriceApiEntry {
  id?: unknown;
  priceUSD?: unknown;
  tvlUSD?: unknown;
  timestamp?: unknown;
  chainId?: unknown;
}

/** Parse the official price-API body; invalid/missing entries are dropped. */
function parsePriceApiBody(body: unknown): Record<string, PancakeSwapTokenPrice> {
  const out: Record<string, PancakeSwapTokenPrice> = {};
  if (typeof body !== "object" || body === null) return out;
  for (const [key, raw] of Object.entries(body as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as PriceApiEntry;
    const price = typeof entry.priceUSD === "string" ? Number(entry.priceUSD) : NaN;
    if (!Number.isFinite(price) || price <= 0) continue; // priceUSD 0 = unlisted
    // The official body keys addresses with the chainId prefix ("56:0x…");
    // normalize to the bare lowercase address for pipeline lookups.
    const bare = key.toLowerCase().split(":").pop() ?? "";
    if (!/^0x[0-9a-f]{40}$/.test(bare)) continue;
    const tvl = typeof entry.tvlUSD === "string" ? Number(entry.tvlUSD) : NaN;
    out[bare] = {
      priceUsd: price,
      tvlUsd: Number.isFinite(tvl) ? tvl : null,
      timestamp: typeof entry.timestamp === "string" ? entry.timestamp : null,
    };
  }
  return out;
}

/**
 * READ-ONLY: official PancakeSwap USD prices for a set of token addresses
 * (chain 56). ONE bounded GET; always resolves (never throws). Returns only
 * tokens the official source actually prices — missing tokens are simply
 * absent from the map (callers must treat absence as "no price", never 0).
 */
export async function getPancakeSwapTokenPrices(
  addresses: readonly string[],
  options: { timeoutMs?: number } = {}
): Promise<PancakeSwapPricesData> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const uniq = [
    ...new Set(addresses.map((a) => a.trim().toLowerCase()).filter((a) => a.length === 42)),
  ];
  if (uniq.length === 0) {
    return {
      state: "not-found",
      prices: {},
      reason: "not-found",
      message: "No pool data available",
    };
  }
  const ids = uniq.map((a) => `${PANCAKESWAP_BSC_CHAIN_ID}:${a}`).join(",");
  const client = createApiClient({ baseUrl: PANCAKESWAP_PRICE_API_BASE, timeoutMs });
  try {
    const body = await memo(`price:${ids}`, CACHE_TTL_MS, () =>
      client.get<unknown>(`${PANCAKESWAP_PRICE_API_PATH}${ids}`, {
        forceLiterally: true,
        cache: "no-store",
      })
    );
    const prices = parsePriceApiBody(body);
    if (Object.keys(prices).length === 0) {
      return {
        state: "not-found",
        prices: {},
        reason: "not-found",
        message: "No pool data available",
      };
    }
    return { state: "ready", prices };
  } catch (error) {
    const status = (error as ApiClientError)?.status;
    if (isTimeoutLike(error)) {
      return { state: "timeout", prices: {}, reason: "timeout", message: "request timed out" };
    }
    if (typeof status === "number") {
      const reason = mapHttpStatusToState(status);
      return { state: reason, prices: {}, reason, message: "upstream request failed" };
    }
    return {
      state: "network-error",
      prices: {},
      reason: "network-error",
      message: "network failure",
    };
  }
}

/* ------------------------------------------------------------------ *
 * On-chain registry + pool reads
 * ------------------------------------------------------------------ */

interface RawPair {
  address: string;
  token0: string | null;
  token1: string | null;
}

interface PairReserves {
  reserve0: bigint;
  reserve1: bigint;
}

interface TokenMeta {
  symbol: string;
  decimals: number;
}

async function readFactory(
  rpc: string,
  timeoutMs: number
): Promise<
  | { ok: true; length: bigint }
  | { ok: false; failure: RpcFailure }
  | { ok: false; reason: "unsupported-network" }
> {
  const chainId = await rpcChainId(rpc, Math.min(timeoutMs, 5_000));
  if (chainId !== "0x38") return { ok: false, reason: "unsupported-network" };
  const r = await rpcCall(rpc, PANCAKESWAP_V2_FACTORY, SEL_ALL_PAIRS_LENGTH, timeoutMs);
  if (!r.ok) return { ok: false, failure: r.failure };
  return { ok: true, length: decodeUint256(r.result) };
}

async function readPairAddress(
  rpc: string,
  index: bigint,
  timeoutMs: number
): Promise<string | null> {
  const r = await rpcCall(
    rpc,
    PANCAKESWAP_V2_FACTORY,
    `${SEL_ALL_PAIRS}${encodeUint256(index)}`,
    timeoutMs
  );
  if (!r.ok) return null;
  const address = decodeAddress(r.result);
  return address === "0x0000000000000000000000000000000000000000" ? null : address;
}

async function readPairTokens(
  rpc: string,
  pair: string,
  timeoutMs: number
): Promise<{ token0: string | null; token1: string | null }> {
  const [r0, r1] = await Promise.all([
    rpcCall(rpc, pair, SEL_TOKEN0, timeoutMs),
    rpcCall(rpc, pair, SEL_TOKEN1, timeoutMs),
  ]);
  return {
    token0: r0.ok ? decodeAddress(r0.result) : null,
    token1: r1.ok ? decodeAddress(r1.result) : null,
  };
}

async function readPairReserves(
  rpc: string,
  pair: string,
  timeoutMs: number
): Promise<PairReserves | null> {
  const r = await rpcCall(rpc, pair, SEL_GET_RESERVES, timeoutMs);
  if (!r.ok) return null;
  const body = r.result.startsWith("0x") ? r.result.slice(2) : r.result;
  if (body.length < 192) return null;
  return {
    reserve0: decodeUint256(body.slice(0, 64)),
    reserve1: decodeUint256(body.slice(64, 128)),
  };
}

async function readTokenMeta(
  rpc: string,
  token: string,
  timeoutMs: number
): Promise<TokenMeta | null> {
  const [symbol, decimals] = await Promise.all([
    rpcCall(rpc, token, SEL_SYMBOL, timeoutMs),
    rpcCall(rpc, token, SEL_DECIMALS, timeoutMs),
  ]);
  if (!symbol.ok || !decimals.ok) return null;
  const sym = decodeAbiString(symbol.result);
  const dec = Number(decodeUint256(decimals.result));
  if (
    sym === null ||
    sym.length === 0 ||
    sym.length > 32 ||
    !Number.isInteger(dec) ||
    dec < 0 ||
    dec > 64
  ) {
    return null;
  }
  return { symbol: sym, decimals: dec };
}

/** Small bounded worker pool for JSON-RPC batches. */
async function runPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ------------------------------------------------------------------ *
 * Normalization
 * ------------------------------------------------------------------ */

function toHumanUnits(raw: bigint, decimals: number): number {
  const value = Number(raw) / 10 ** decimals;
  return Number.isFinite(value) ? value : 0;
}

/** Normalize one measured pair into the UI model; null when any required field is missing. */
export function normalizeIntelligencePair(input: {
  pair: RawPair;
  reserves: PairReserves;
  meta0: TokenMeta | null;
  meta1: TokenMeta | null;
  price0: PancakeSwapTokenPrice | undefined;
  price1: PancakeSwapTokenPrice | undefined;
  retrievedAt: string;
}): PancakeSwapIntelligencePool | null {
  const { pair, reserves, meta0, meta1, price0, price1, retrievedAt } = input;
  if (pair.token0 === null || pair.token1 === null || !meta0 || !meta1) return null;
  if (price0 === undefined || price1 === undefined) return null; // no price → not a valued pool
  const reserve0 = toHumanUnits(reserves.reserve0, meta0.decimals);
  const reserve1 = toHumanUnits(reserves.reserve1, meta1.decimals);
  const tvlUsd = reserve0 * price0.priceUsd + reserve1 * price1.priceUsd;
  if (!Number.isFinite(tvlUsd) || tvlUsd <= 0) return null;
  const ts0 = price0.timestamp;
  const ts1 = price1.timestamp;
  const priceTimestamp = ts0 && ts1 ? (ts0 > ts1 ? ts0 : ts1) : (ts0 ?? ts1);
  return {
    poolId: pair.address,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    token0Address: pair.token0,
    token0Symbol: meta0.symbol,
    token1Address: pair.token1,
    token1Symbol: meta1.symbol,
    symbol: `${meta0.symbol}/${meta1.symbol}`,
    tvlUsd,
    reserve0,
    reserve1,
    token0PriceUsd: price0.priceUsd,
    token1PriceUsd: price1.priceUsd,
    volume24hUsd: null, // not available on-chain — never fabricated
    feeTier: PANCAKESWAP_V2_FEE_TIER,
    apr: null, // not available on-chain — never fabricated
    apy: null,
    priceTimestamp,
    source: PANCAKESWAP_SOURCE,
    retrievedAt,
  };
}

/* ------------------------------------------------------------------ *
 * Pool intelligence loader (the UI-facing entry point)
 * ------------------------------------------------------------------ */

export interface GetPancakeSwapPoolIntelligenceOptions {
  /** Display cap (default 5, max 8). */
  limit?: number;
  /** Registry window per side (default 8, max 16). */
  window?: number;
  /** Per-request timeout budget (default 12s). */
  timeoutMs?: number;
}

const EMPTY_SAMPLE: PancakeSwapSample = { registryLength: null, headCount: 0, tailCount: 0 };

function failureResult(
  reason: Exclude<PancakeSwapIntelligenceState, "ready">,
  sample: PancakeSwapSample,
  message?: string
): PancakeSwapIntelligenceData {
  return {
    state: reason,
    pools: [],
    sample,
    source: PANCAKESWAP_SOURCE,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    retrievedAt: new Date().toISOString(),
    reason,
    message,
  };
}

function mapRpcFailure(failure: RpcFailure): Exclude<PancakeSwapIntelligenceState, "ready"> {
  switch (failure.kind) {
    case "http":
      return mapHttpStatusToState(failure.status);
    case "timeout":
      return "timeout";
    case "revert":
    case "malformed":
      return "server-error";
    case "network":
      return "network-error";
  }
}

/**
 * TEST-ONLY SEAM: clears the in-memory TTL cache. Used exclusively by the
 * offline verify harness so each scenario starts from a clean slate; never
 * called from application code.
 */
export function __resetPancakeSwapCache(): void {
  cache.clear();
}

/**
 * READ-ONLY: fetch + normalize a bounded sample of real PancakeSwap V2 pools
 * (BSC mainnet) — official public RPC + official price API, NO API KEY.
 *
 * ALWAYS resolves (never throws); every failure is an honest state. Empty
 * result after filtering → `not-found` ("No pool data available"). The ready
 * payload carries `sample` describing exactly which registry window was read.
 */
export async function getPancakeSwapPoolIntelligence(
  options: GetPancakeSwapPoolIntelligenceOptions = {}
): Promise<PancakeSwapIntelligenceData> {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 8);
  const window = Math.min(Math.max(options.window ?? DEFAULT_WINDOW, 1), MAX_WINDOW);
  const timeoutMs = options.timeoutMs ?? 12_000;
  const retrievedAt = new Date().toISOString();

  // 1. Pick a chain-56 public RPC (chainId sanity — never silently mixes networks).
  const rpc = await selectRpc(timeoutMs);
  if (rpc === "unsupported-network") {
    return failureResult("error", EMPTY_SAMPLE, "unsupported network (expected chain 56)");
  }
  if (rpc === "network-error") {
    return failureResult("network-error", EMPTY_SAMPLE, "network failure");
  }

  // 2. Registry length + bounded head/tail window indices.
  const factory = await readFactory(rpc, timeoutMs);
  if (!factory.ok) {
    if ("reason" in factory)
      return failureResult("error", EMPTY_SAMPLE, "unsupported network (expected chain 56)");
    return failureResult(mapRpcFailure(factory.failure), EMPTY_SAMPLE);
  }
  const length = factory.length;
  const lenNum = Number(length);
  const sample: PancakeSwapSample = {
    registryLength: lenNum,
    headCount: Math.min(window, lenNum),
    tailCount: Math.min(window, lenNum),
  };
  const indices: bigint[] = [];
  const head = Math.min(window, lenNum);
  for (let i = 0; i < head; i++) indices.push(BigInt(i));
  const tailStart = lenNum > window ? BigInt(lenNum - window) : 0n;
  for (let i = tailStart; i < length; i++) {
    if (!indices.includes(i)) indices.push(i);
  }

  // 3. allPairs(i) → pair addresses (failures per-index are dropped).
  const addresses = (
    await runPool(indices, RPC_CONCURRENCY, (i) => readPairAddress(rpc, i, timeoutMs))
  ).filter((a): a is string => a !== null);
  if (addresses.length === 0) return failureResult("not-found", sample, "No pool data available");

  // 4. token0/token1 per pair (bounded parallel reads).
  const tokenReads = await runPool(addresses, RPC_CONCURRENCY, (address) =>
    readPairTokens(rpc, address, timeoutMs)
  );
  const rawPairs: RawPair[] = addresses.map((address, i) => ({
    address,
    token0: tokenReads[i]!.token0,
    token1: tokenReads[i]!.token1,
  }));
  const pairsWithTokens = rawPairs.filter((p) => p.token0 !== null && p.token1 !== null);
  if (pairsWithTokens.length === 0)
    return failureResult("not-found", sample, "No pool data available");

  // 5. Official USD prices for every distinct token (one bounded GET).
  const tokens = [...new Set(pairsWithTokens.flatMap((p) => [p.token0!, p.token1!]))];
  const priceResult = await getPancakeSwapTokenPrices(tokens, { timeoutMs });
  if (priceResult.state !== "ready") {
    return failureResult(priceResult.state, sample, priceResult.message);
  }

  // 6. Keep only pairs whose BOTH tokens carry a real official price.
  const valued = pairsWithTokens.filter(
    (p) =>
      priceResult.prices[p.token0!.toLowerCase()] && priceResult.prices[p.token1!.toLowerCase()]
  );
  if (valued.length === 0) return failureResult("not-found", sample, "No pool data available");

  // 7. reserves + token metadata for the survivors (reads only).
  const reserves = await runPool(valued, RPC_CONCURRENCY, (p) =>
    readPairReserves(rpc, p.address, timeoutMs)
  );
  const metaTokens = [...new Set(valued.flatMap((p) => [p.token0!, p.token1!]))];
  const metaList = await runPool(metaTokens, RPC_CONCURRENCY, (t) =>
    readTokenMeta(rpc, t, timeoutMs)
  );
  const meta = new Map<string, TokenMeta | null>();
  metaTokens.forEach((t, i) => meta.set(t, metaList[i]!));

  // 8. Normalize + rank by computed TVL (USD) + display cap.
  const pools: PancakeSwapIntelligencePool[] = [];
  valued.forEach((pair, i) => {
    const reservesEntry = reserves[i];
    if (!reservesEntry) return;
    const meta0 = meta.get(pair.token0!);
    const meta1 = meta.get(pair.token1!);
    if (!meta0 || !meta1) return;
    const normalized = normalizeIntelligencePair({
      pair,
      reserves: reservesEntry,
      meta0,
      meta1,
      price0: priceResult.prices[pair.token0!.toLowerCase()],
      price1: priceResult.prices[pair.token1!.toLowerCase()],
      retrievedAt,
    });
    if (normalized !== null) pools.push(normalized);
  });
  if (pools.length === 0) return failureResult("not-found", sample, "No pool data available");
  pools.sort((a, b) => b.tvlUsd - a.tvlUsd);
  return {
    state: "ready",
    pools: pools.slice(0, limit),
    sample,
    source: PANCAKESWAP_SOURCE,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    retrievedAt,
  };
}

/**
 * READ-ONLY liquidity snapshot — the same pipeline as pool intelligence,
 * expressed as the narrow liquidity-view interface. A liquidity snapshot
 * here IS the pool set (pool, reserves, TVL, prices, fee tier); there is no
 * separate snapshot source. Kept as a distinct named entry point so callers
 * can express intent; returns the identical honest discriminated result.
 */
export function getPancakeSwapLiquiditySnapshot(
  options: GetPancakeSwapPoolIntelligenceOptions = {}
): Promise<PancakeSwapIntelligenceData> {
  return getPancakeSwapPoolIntelligence(options);
}

/* ------------------------------------------------------------------ *
 * Read-only boundary (documented + enforced by the verify harness)
 * ------------------------------------------------------------------ */

/**
 * THE READ-ONLY BOUNDARY:
 *  - No wallet, no private key, no mnemonic, no signing, no approval.
 *  - No swap, addLiquidity, removeLiquidity, permit2, router, or tx builder.
 *  - No transaction submission, no execution endpoints, no nonce management.
 *  - No credentials of any kind are read from the environment in this module.
 *  - Network surface: HTTP GET (price API) + JSON-RPC eth_call / eth_chainId.
 * The only reason this module exists is read-only market intelligence.
 */
export const PANCAKESWAP_READ_ONLY_BOUNDARY = true as const;
