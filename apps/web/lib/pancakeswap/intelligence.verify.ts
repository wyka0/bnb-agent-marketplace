/**
 * PANCAKESWAP OPTION B — adapter verification (offline, deterministic).
 *
 * Verifies the keyless READ-ONLY intelligence adapter
 * (`lib/pancakeswap/intelligence.ts`) with an INJECTED global fetch stub.
 * No live network traffic: every scenario is a labeled TEST FIXTURE.
 *
 * Coverage (task spec):
 *   1. successful normalization (unit: full measured data → exact model)
 *   2. missing fields (unit: absent price / absent token metadata → null;
 *      priceUSD 0 and invalid entries dropped by the price parser)
 *   3. empty pool (pipeline: empty pair registry → honest not-found)
 *   4. HTTP failure (pipeline: RPC HTTP 500 → honest server-error)
 *   5. timeout (pipeline: aborted RPC call → honest timeout)
 *   6. malformed (pipeline: garbage RPC hex + garbage price body → honest
 *      states, never a throw)
 *   7. unsupported network (pipeline: chainId ≠ 56 → honest error)
 *   8. read-only boundary (constant true + static source scan: no wallet,
 *      signing, approval, swap, transaction, or credential surface)
 *   9. full pipeline success (registry window → prices → reserves → TVL math
 *      → ranked, bounded output with exact sample scope)
 *  10. never-throws guarantee on edge paths
 *
 * Run (from apps/web):
 *   node --experimental-strip-types lib/pancakeswap/intelligence.verify.ts
 *
 * Exit: 1 on any failed assertion; 0 otherwise.
 */

import {
  PANCAKESWAP_V2_FACTORY,
  PANCAKESWAP_V2_FEE_TIER,
  PANCAKESWAP_SOURCE,
  PANCAKESWAP_READ_ONLY_BOUNDARY,
  getPancakeSwapPoolIntelligence,
  getPancakeSwapTokenPrices,
  normalizeIntelligencePair,
  __resetPancakeSwapCache,
  type PancakeSwapTokenPrice,
} from "./intelligence.ts";

function fail(message: string): never {
  console.error(`PANCAKESWAP INTELLIGENCE VERIFY FAILED: ${message}`);
  process.exit(1);
}

function expect(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

/* ------------------------------------------------------------------ *
 * ABI encode helpers (TEST FIXTURE encoding only)
 * ------------------------------------------------------------------ */

/**
 * Encode a uint256 word. Accepts a raw hex string OR a number/bigint — a bare
 * hex string is treated as a pre-computed value (never re-decoded).
 */
function word(value: bigint | number | string): string {
  const hex = typeof value === "string" ? value : BigInt(value).toString(16);
  return hex.length >= 64 ? hex.slice(-64) : hex.padStart(64, "0");
}

function encodeUint(value: bigint | number): string {
  return `0x${word(value)}`;
}

function encodeAddress(address: string): string {
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}

function encodeString(value: string): string {
  const data = Buffer.from(value, "utf8").toString("hex");
  const padded = data.padEnd(Math.ceil(data.length / 64) * 64, "0");
  return `0x${word(0x20)}${word(data.length / 2)}${padded}`;
}

function uint256Hex(value: bigint | number): string {
  return word(BigInt(value).toString(16));
}

/* ------------------------------------------------------------------ *
 * Global fetch stub (TEST FIXTURE transport only)
 * ------------------------------------------------------------------ */

type RpcRequest = { jsonrpc: string; id: number; method: string; params: unknown[] };

function fakeResponse(status: number, json: unknown): Response {
  const text = typeof json === "string" ? json : JSON.stringify(json);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    headers: new Headers(),
    url: "",
    redirected: false,
    type: "default",
    body: null,
    bodyUsed: false,
    clone: function clone(): Response {
      return fakeResponse(status, json);
    },
    arrayBuffer: async () => Buffer.from(text),
    blob: async () => new Blob([text]),
    json: async () => JSON.parse(text),
    text: async () => text,
    formData: async () => new FormData(),
  } as unknown as Response;
}

type RpcBehavior =
  { ok: true; result: string } | { status: number; error: true } | { reject: unknown };

type SimpleStub = {
  chainId?: string | null;
  calls?: Record<string, RpcBehavior>;
};

/**
 * Minimal stub: routes eth_chainId globally and eth_call by calldata
 * (enough for targeted failure-path tests).
 */
function installSimpleFetch(stub: SimpleStub): () => void {
  const original = globalThis.fetch;
  const calls: Record<string, RpcBehavior> = stub.calls ?? {};
  const proxy = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String((input as Request)?.url ?? "");
    if (url.includes("/api/cached/tokens/price/list/")) {
      return fakeResponse(200, {});
    }
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as RpcRequest) : null;
    if (!body) return fakeResponse(200, { jsonrpc: "2.0", id: 1, result: "0x" });
    if (body.method === "eth_chainId") {
      if (stub.chainId === null) return fakeResponse(500, { error: { message: "down" } });
      return fakeResponse(200, { jsonrpc: "2.0", id: body.id, result: stub.chainId ?? "0x38" });
    }
    const data = String((body.params as Array<{ to: string; data: string }>)[0]?.data ?? "");
    const behavior = calls[data];
    if (!behavior) return fakeResponse(200, { jsonrpc: "2.0", id: body.id, result: "0x" });
    if ("reject" in behavior) return Promise.reject(behavior.reject);
    if (!behavior.ok) return fakeResponse(behavior.status, { error: { message: "RPC error" } });
    return fakeResponse(200, { jsonrpc: "2.0", id: body.id, result: behavior.result });
  }) as typeof fetch;
  globalThis.fetch = proxy;
  return () => {
    globalThis.fetch = original;
  };
}

/**
 * Full happy-path stub: routes the complete registry→pairs→tokens→reserves→
 * symbols→prices flow for the 2-pair fixture registry. Optional `priceBody`
 * override for malformed-price scenarios.
 */
function installFullFetch(priceBody?: unknown): () => void {
  const original = globalThis.fetch;
  const proxy = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String((input as Request)?.url ?? "");
    if (url.includes("/api/cached/tokens/price/list/")) {
      if (priceBody !== undefined) return fakeResponse(200, priceBody);
      return fakeResponse(200, buildPriceBody());
    }
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as RpcRequest) : null;
    if (!body) return fakeResponse(200, { jsonrpc: "2.0", id: 1, result: "0x" });
    if (body.method === "eth_chainId") {
      return fakeResponse(200, { jsonrpc: "2.0", id: body.id, result: "0x38" });
    }
    if (body.method === "eth_call") {
      const { to, data } = (body.params as Array<{ to: string; data: string }>)[0]!;
      return fakeResponse(200, { jsonrpc: "2.0", id: body.id, result: resolveCall(to, data) });
    }
    return fakeResponse(200, { jsonrpc: "2.0", id: body.id, result: "0x" });
  }) as typeof fetch;
  globalThis.fetch = proxy;
  return () => {
    globalThis.fetch = original;
  };
}

/* ------------------------------------------------------------------ *
 * TEST FIXTURES — NOT LIVE PANCAKESWAP DATA
 * ------------------------------------------------------------------ */

const TOKEN_CAKE = "0x1111111111111111111111111111111111111111";
const TOKEN_WBNB = "0x2222222222222222222222222222222222222222";
const TOKEN_USDT = "0x3333333333333333333333333333333333333333";
const TOKEN_BUSD = "0x4444444444444444444444444444444444444444";
const TOKEN_UNLISTED = "0x9999999999999999999999999999999999999999";
const PAIR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // Cake/WBNB
const PAIR_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"; // USDT/BUSD

const DECIMALS_18 = encodeUint(18);

const SEL_ALL_PAIRS_LENGTH = "0x574f2ba3";
const SEL_ALL_PAIRS = "0x1e3dd18b";
const SEL_TOKEN0 = "0x0dfe1681";
const SEL_TOKEN1 = "0xd21220a7";
const SEL_GET_RESERVES = "0x0902f1ac";
const SEL_SYMBOL = "0x95d89b41";
const SEL_DECIMALS = "0x313ce567";

const PAIR_TOKENS: Record<string, { token0: string; token1: string }> = {
  [PAIR_A]: { token0: TOKEN_CAKE, token1: TOKEN_WBNB },
  [PAIR_B]: { token0: TOKEN_USDT, token1: TOKEN_BUSD },
};

const TOKEN_SYMBOLS: Record<string, string> = {
  [TOKEN_CAKE]: "Cake",
  [TOKEN_WBNB]: "WBNB",
  [TOKEN_USDT]: "USDT",
  [TOKEN_BUSD]: "BUSD",
};

const RESERVES: Record<string, { reserve0: bigint; reserve1: bigint }> = {
  // 5000 Cake / 3 WBNB — TVL = 5000×1.5308 + 3×602.51 = 9461.53
  [PAIR_A]: { reserve0: 5000n * 10n ** 18n, reserve1: 3n * 10n ** 18n },
  // 10000 USDT / 12000 BUSD — TVL = 10000×1.0002 + 12000×1.0002 = 22004.4
  [PAIR_B]: { reserve0: 10000n * 10n ** 18n, reserve1: 12000n * 10n ** 18n },
};

const PRICES: Record<string, PancakeSwapTokenPrice> = {
  [TOKEN_CAKE]: { priceUsd: 1.5308, tvlUsd: 400_000_000, timestamp: "2026-08-10T00:00:00.000Z" },
  [TOKEN_WBNB]: { priceUsd: 602.51, tvlUsd: 3_000_000_000, timestamp: "2026-08-10T00:01:00.000Z" },
  [TOKEN_USDT]: { priceUsd: 1.0002, tvlUsd: 5_000_000_000, timestamp: "2026-08-10T00:00:00.000Z" },
  [TOKEN_BUSD]: { priceUsd: 1.0002, tvlUsd: 6_000_000_000, timestamp: "2026-08-10T00:00:00.000Z" },
};

function buildPriceBody(): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [token, p] of Object.entries(PRICES)) {
    body[`56:${token}`] = {
      id: `56:${token}`,
      priceUSD: String(p.priceUsd),
      tvlUSD: String(p.tvlUsd),
      timestamp: p.timestamp,
      chainId: 56,
    };
  }
  return body;
}

function resolveCall(to: string, data: string): string {
  if (to.toLowerCase() === PANCAKESWAP_V2_FACTORY) {
    if (data.startsWith(SEL_ALL_PAIRS_LENGTH)) return encodeUint(2);
    if (data.startsWith(SEL_ALL_PAIRS)) {
      const index = BigInt(`0x${data.slice(SEL_ALL_PAIRS.length)}`);
      if (index === 0n) return encodeAddress(PAIR_A);
      if (index === 1n) return encodeAddress(PAIR_B);
      return encodeAddress("0x0000000000000000000000000000000000000000");
    }
  }
  const pair = Object.keys(PAIR_TOKENS).find((p) => p === to.toLowerCase());
  if (pair) {
    const { token0, token1 } = PAIR_TOKENS[pair]!;
    if (data.startsWith(SEL_TOKEN0)) return encodeAddress(token0);
    if (data.startsWith(SEL_TOKEN1)) return encodeAddress(token1);
    if (data.startsWith(SEL_GET_RESERVES)) {
      return `0x${uint256Hex(RESERVES[pair]!.reserve0)}${uint256Hex(RESERVES[pair]!.reserve1)}${uint256Hex(0)}`;
    }
  }
  const token = Object.keys(TOKEN_SYMBOLS).find((t) => t === to.toLowerCase());
  if (token) {
    if (data.startsWith(SEL_SYMBOL)) return encodeString(TOKEN_SYMBOLS[token]!);
    if (data.startsWith(SEL_DECIMALS)) return DECIMALS_18;
  }
  return "0x";
}

async function main(): Promise<void> {
  console.log(
    "PANCAKESWAP OPTION B — intelligence adapter verify (offline fixtures, no live data)"
  );

  /* -- 1. Successful normalization (unit) ---------------------------------- */
  {
    const pool = normalizeIntelligencePair({
      pair: { address: PAIR_A, token0: TOKEN_CAKE, token1: TOKEN_WBNB },
      reserves: RESERVES[PAIR_A]!,
      meta0: { symbol: "Cake", decimals: 18 },
      meta1: { symbol: "WBNB", decimals: 18 },
      price0: PRICES[TOKEN_CAKE],
      price1: PRICES[TOKEN_WBNB],
      retrievedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(pool !== null, "full measured pair must normalize to a pool");
    expect(pool!.symbol === "Cake/WBNB", `symbol must be Cake/WBNB, got ${pool!.symbol}`);
    expect(Math.abs(pool!.tvlUsd - 9461.53) < 1e-6, `TVL must be 9461.53, got ${pool!.tvlUsd}`);
    expect(pool!.reserve0 === 5000, `reserve0 must be 5000 Cake, got ${pool!.reserve0}`);
    expect(pool!.reserve1 === 3, `reserve1 must be 3 WBNB, got ${pool!.reserve1}`);
    expect(pool!.token0PriceUsd === 1.5308, "token0 USD price must pass through");
    expect(pool!.token1PriceUsd === 602.51, "token1 USD price must pass through");
    expect(pool!.volume24hUsd === null, "volume24hUsd must be null (never fabricated)");
    expect(
      pool!.feeTier === PANCAKESWAP_V2_FEE_TIER && pool!.feeTier === 0.0025,
      "fee tier must be the official V2 constant"
    );
    expect(pool!.apr === null && pool!.apy === null, "apr/apy must be null (never fabricated)");
    expect(pool!.chainId === 56, "chainId must be 56");
    expect(pool!.source === PANCAKESWAP_SOURCE, "source must be pancakeswap");
    expect(
      pool!.priceTimestamp === "2026-08-10T00:01:00.000Z",
      "priceTimestamp must be the LATER official timestamp"
    );
    console.log("ok   1 successful normalization (exact TVL/units/prices/honest nulls)");
  }

  /* -- 2. Missing fields (unit + price parser) ----------------------------- */
  {
    const base = {
      pair: { address: PAIR_A, token0: TOKEN_CAKE, token1: TOKEN_WBNB },
      reserves: RESERVES[PAIR_A]!,
      meta0: { symbol: "Cake", decimals: 18 },
      meta1: { symbol: "WBNB", decimals: 18 },
      price0: PRICES[TOKEN_CAKE],
      price1: PRICES[TOKEN_WBNB],
      retrievedAt: "2026-08-10T00:00:00.000Z",
    };
    expect(
      normalizeIntelligencePair({ ...base, price1: undefined }) === null,
      "missing token1 price must yield null (not a fabricated value)"
    );
    expect(
      normalizeIntelligencePair({ ...base, price0: undefined }) === null,
      "missing token0 price must yield null"
    );
    expect(
      normalizeIntelligencePair({ ...base, meta1: null }) === null,
      "missing token1 metadata must yield null"
    );
    expect(
      normalizeIntelligencePair({
        ...base,
        pair: { address: PAIR_A, token0: null, token1: TOKEN_WBNB },
      }) === null,
      "missing token0 address must yield null"
    );
    // Listed + unlisted token mix: the official source prices only the listed
    // token; the unlisted one is simply ABSENT (never a fabricated price).
    const restore = installFullFetch();
    const prices = await getPancakeSwapTokenPrices([TOKEN_CAKE, TOKEN_UNLISTED], {
      timeoutMs: 2_000,
    });
    restore();
    expect(
      prices.state === "ready",
      `listed token must yield a ready price set, got ${prices.state}`
    );
    expect(prices.prices[TOKEN_CAKE]!.priceUsd === 1.5308, "listed token price must pass through");
    expect(prices.prices[TOKEN_UNLISTED] === undefined, "unlisted token must be absent (never 0)");
    console.log("ok   2 missing fields → null / absent, never fabricated");
  }

  /* -- 3. Empty pool (pipeline) -------------------------------------------- */
  {
    __resetPancakeSwapCache();
    const restore = installSimpleFetch({
      chainId: "0x38",
      calls: { [SEL_ALL_PAIRS_LENGTH]: { ok: true, result: encodeUint(0) } },
    });
    const result = await getPancakeSwapPoolIntelligence({ limit: 5 });
    restore();
    expect(
      result.state === "not-found",
      `empty registry must be honest not-found, got ${result.state}`
    );
    expect(result.pools.length === 0, "empty registry must yield zero pools");
    expect(result.sample.registryLength === 0, "sample must record registry length 0");
    console.log("ok   3 empty pool → honest not-found + zero pools");
  }

  /* -- 4. HTTP failure (pipeline) ------------------------------------------ */
  {
    __resetPancakeSwapCache();
    const restore = installSimpleFetch({
      chainId: "0x38",
      calls: { [SEL_ALL_PAIRS_LENGTH]: { status: 500, error: true } },
    });
    const result = await getPancakeSwapPoolIntelligence({ limit: 5 });
    restore();
    expect(
      result.state === "server-error",
      `RPC HTTP 500 must map to server-error, got ${result.state}`
    );
    expect(result.pools.length === 0, "server-error must yield zero pools");
    console.log("ok   4 HTTP failure → honest server-error (never throws)");
  }

  /* -- 5. Timeout (pipeline) ----------------------------------------------- */
  {
    __resetPancakeSwapCache();
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const restore = installSimpleFetch({
      chainId: "0x38",
      calls: { [SEL_ALL_PAIRS_LENGTH]: { reject: abortError } },
    });
    const result = await getPancakeSwapPoolIntelligence({ limit: 5 });
    restore();
    expect(result.state === "timeout", `aborted call must map to timeout, got ${result.state}`);
    expect(result.pools.length === 0, "timeout must yield zero pools");
    console.log("ok   5 timeout → honest timeout (never throws)");
  }

  /* -- 6. Malformed (pipeline) --------------------------------------------- */
  {
    // Garbage hex from the RPC must decode defensively (never throw) → empty
    // registry → honest not-found.
    __resetPancakeSwapCache();
    const restore = installSimpleFetch({
      chainId: "0x38",
      calls: { [SEL_ALL_PAIRS_LENGTH]: { ok: true, result: "0xzzzz" } },
    });
    const malformedRpc = await getPancakeSwapPoolIntelligence({ limit: 5 });
    restore();
    expect(
      malformedRpc.state === "not-found",
      `malformed RPC hex must be honest not-found, got ${malformedRpc.state}`
    );

    // Garbage price-API body (invalid + zero prices) must drop every entry →
    // no valued pools → honest not-found. Never a fabricated value.
    __resetPancakeSwapCache();
    const restore2 = installFullFetch({
      [`56:${TOKEN_CAKE}`]: {
        id: `56:${TOKEN_CAKE}`,
        priceUSD: "not-a-price",
        tvlUSD: "x",
        timestamp: null,
        chainId: 56,
      },
      [`56:${TOKEN_WBNB}`]: {
        id: `56:${TOKEN_WBNB}`,
        priceUSD: "0",
        tvlUSD: "0",
        timestamp: null,
        chainId: 56,
      },
      "junk-key": { priceUSD: "1.0", tvlUSD: "1", timestamp: null },
    });
    const malformedPrices = await getPancakeSwapPoolIntelligence({ limit: 5 });
    restore2();
    expect(
      malformedPrices.state === "not-found",
      `malformed price body must be honest not-found, got ${malformedPrices.state}`
    );
    expect(malformedPrices.pools.length === 0, "malformed prices must yield zero pools");
    console.log("ok   6 malformed RPC + price body → honest states, never throws");
  }

  /* -- 7. Unsupported network (pipeline) ----------------------------------- */
  {
    __resetPancakeSwapCache();
    const restore = installSimpleFetch({ chainId: "0x2105" }); // Base — NOT chain 56
    const result = await getPancakeSwapPoolIntelligence({ limit: 5 });
    restore();
    expect(result.state === "error", `non-56 chainId must be honest error, got ${result.state}`);
    expect(
      result.reason === "error" && /unsupported network/.test(result.message ?? ""),
      "unsupported network must carry the explicit reason"
    );
    expect(result.pools.length === 0, "unsupported network must yield zero pools");
    console.log("ok   7 unsupported network → honest error, zero pools");
  }

  /* -- 8. Read-only boundary (structural) ---------------------------------- */
  {
    expect(PANCAKESWAP_READ_ONLY_BOUNDARY === true, "read-only boundary constant must be true");
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./intelligence.ts", import.meta.url), "utf8");
    // Scan EXECUTABLE code only — documentation comments may legitimately name
    // the forbidden surface to explain why it is absent.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const forbidden = [
      "sendTransaction",
      "sendRawTransaction",
      "eth_send",
      "signMessage",
      "signTypedData",
      "personal_sign",
      "approve(",
      "permit2",
      "addLiquidity",
      "removeLiquidity",
      "swapExact",
      "swapTokensForExact",
      "privateKey",
      "mnemonic",
      "PRIVATE_KEY",
      "MNEMONIC",
      "process.env",
    ];
    for (const token of forbidden) {
      expect(!code.includes(token), `source must not contain write/credential surface: "${token}"`);
    }
    // Only eth_call + eth_chainId may be sent over RPC (JSON-RPC methods only;
    // "POST" is just the HTTP transport verb).
    const jsonRpcMethods = [...code.matchAll(/method:\s*"(eth_[a-z]+)"/g)].map((m) => m[1]!);
    expect(jsonRpcMethods.length > 0, "RPC methods must be present in the source");
    expect(
      jsonRpcMethods.every((m) => m === "eth_call" || m === "eth_chainId"),
      `only eth_call/eth_chainId allowed, found: ${jsonRpcMethods.join(", ")}`
    );
    // No credential env var may be present in this harness process.
    for (const name of [
      "PANCAKESWAP_API_KEY",
      "PRIVATE_KEY",
      "WALLET_PRIVATE_KEY",
      "MNEMONIC",
      "SEED_PHRASE",
    ]) {
      expect(process.env[name] === undefined, `credential env var must not exist here: ${name}`);
    }
    console.log("ok   8 read-only boundary (no wallet/signing/approve/swap/tx/credential surface)");
  }

  /* -- 9. Full pipeline success (registry → prices → reserves → TVL) ------- */
  {
    __resetPancakeSwapCache();
    const restore = installFullFetch();
    const result = await getPancakeSwapPoolIntelligence({ limit: 1, window: 8 });
    restore();
    expect(result.state === "ready", `full pipeline must be ready, got ${result.state}`);
    if (result.state !== "ready") fail("full pipeline must be ready");
    expect(result.pools.length === 1, `limit must bound output to 1, got ${result.pools.length}`);
    const top = result.pools[0]!;
    expect(
      top.symbol === "USDT/BUSD",
      `highest-TVL pair must rank first (USDT/BUSD), got ${top.symbol}`
    );
    expect(Math.abs(top.tvlUsd - 22004.4) < 0.001, `TVL must be ~22004.4, got ${top.tvlUsd}`);
    expect(top.reserve0 === 10000 && top.reserve1 === 12000, "reserves must be in human units");
    expect(
      top.volume24hUsd === null && top.apr === null && top.apy === null,
      "honest nulls must survive the full pipeline"
    );
    expect(
      top.feeTier === 0.0025 && top.chainId === 56,
      "fee tier + chain id constants must survive"
    );
    expect(
      result.sample.registryLength === 2 &&
        result.sample.headCount === 2 &&
        result.sample.tailCount === 2,
      "sample scope must be recorded exactly"
    );
    expect(top.source === PANCAKESWAP_SOURCE, "source provenance must survive");
    console.log("ok   9 full pipeline: ranked bounded real output with exact sample scope");
  }

  /* -- 10. Never-throws guarantee (edge paths) ----------------------------- */
  {
    __resetPancakeSwapCache();
    const restore = installSimpleFetch({
      chainId: "0x38",
      calls: { [SEL_ALL_PAIRS_LENGTH]: { status: 500, error: true } },
    });
    const clamped = await getPancakeSwapPoolIntelligence({ limit: 0 });
    restore();
    expect(clamped.state === "server-error", "limit:0 must clamp + resolve honestly, never throw");

    __resetPancakeSwapCache();
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const restore2 = installSimpleFetch({
      chainId: "0x38",
      calls: { [SEL_ALL_PAIRS_LENGTH]: { reject: abortError } },
    });
    const tiny = await getPancakeSwapPoolIntelligence({ limit: 5, timeoutMs: 1 });
    restore2();
    expect(
      tiny.state === "timeout",
      `1ms timeout must resolve as honest timeout, got ${tiny.state}`
    );
    console.log("ok   10 never-throws guarantee on edge paths");
  }

  // No credential exposure — presence-only env check (belt + braces).
  {
    for (const name of [
      "PANCAKESWAP_API_KEY",
      "PRIVATE_KEY",
      "WALLET_PRIVATE_KEY",
      "MNEMONIC",
      "SEED_PHRASE",
      "NEXT_PUBLIC_PANCAKE",
    ]) {
      expect(
        process.env[name] === undefined,
        `credential env var must not exist in this harness: ${name}`
      );
    }
    console.log("ok   no credential exposure (presence-only env check)");
  }

  console.log(
    "PANCAKESWAP OPTION B STATUS: READY (keyless read-only intelligence adapter verified)"
  );
  process.exitCode = 0;
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
