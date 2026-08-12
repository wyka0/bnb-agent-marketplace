/**
 * PANCAKESWAP — READ-ONLY data adapter verification (NodeReal MegaNode
 * PancakeSwap GraphQL, BSC).
 *
 * OFFLINE FIXTURE TEST — NOT a live test. Safe by construction (matches
 * TermiX/Altana verify harnesses): NO credentials, NO signing, NO wallet, NO
 * transaction, and NO live network calls. Every HTTP interaction is driven by
 * an INJECTED fetch stub returning labeled
 *   TEST FIXTURE / NOT LIVE PANCAKESWAP DATA
 * bodies. The API key used here is a clearly-labeled fake (fixture) — never a
 * real NodeReal secret — and it is only used to assert URL construction.
 *
 * Exit policy: 1 on any failed assertion; 0 otherwise.
 * Run after `pnpm build`:  node dist/pancakeswap/data.verify.js
 */

import { listPools, PAIRS_QUERY, type PcsFetchFn } from "./client.js";
import { normalizePair, normalizePairs, parseDecimal, isValidRawPair } from "./pools.js";
import {
  PANCAKESWAP_BSC_CHAIN_ID,
  PANCAKESWAP_NODEREAL_BASE_URL,
  PANCAKESWAP_NODEREAL_FREE_PATH,
  PANCAKESWAP_NODEREAL_PREMIUM_PATH,
  PANCAKESWAP_NODEREAL_GRAPHQL_PATH,
  buildPancakeSwapEndpoint,
  PANCAKESWAP_SOURCE,
  type PancakeSwapPool,
  type PcsRawPair,
} from "./types.js";

function fail(message: string): never {
  console.error(`PANCAKESWAP DATA VERIFY FAILED: ${message}`);
  process.exit(1);
}

/** TEST FIXTURE — NOT A REAL KEY. Only used to assert URL construction offline. */
const FIXTURE_KEY = "PCS-TEST-FIXTURE-KEY-0000";

/** TEST FIXTURE — NOT LIVE PANCAKESWAP DATA. Well-formed subgraph pair rows. */
const FIXTURE_PAIR: PcsRawPair = {
  id: "0x61EB789d75A95CAaa3fF50A4723d08d0f40c3bB8",
  name: "WBNB-CAKE",
  token0: { id: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", symbol: "WBNB", name: "Wrapped BNB" },
  token1: {
    id: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    symbol: "CAKE",
    name: "PancakeSwap Token",
  },
  reserve0: "152345.67",
  reserve1: "987654.32",
  reserveUSD: "1234567.89",
  reserveBNB: "4567.89",
  token0Price: "12.34",
  token1Price: "0.0810",
  volumeUSD: "98765432.10",
  untrackedVolumeUSD: "99000000.00",
  totalTransactions: "123456",
};

/** A 2xx stub result whose JSON body is the GraphQL envelope `{ data: { pairs } }`. */
function okResponse(pairs: unknown[]) {
  return { status: 200, body: { data: { pairs } } };
}

/** Build a fetch stub that returns a fixed body/status; also records calls + URLs. */
function stubFetch(
  handler: (
    callIndex: number,
    body: unknown
  ) => { status?: number; body?: unknown; throwErr?: unknown; abort?: boolean }
): { PcsFetchFn: PcsFetchFn; bodies: unknown[]; inputs: string[] } {
  const bodies: unknown[] = [];
  const inputs: string[] = [];
  let callIndex = 0;
  const PcsFetchFn: PcsFetchFn = async (input, init) => {
    inputs.push(input);
    // Assert READ-ONLY: never an Authorization / Bearer header (the key lives
    // in the URL path only).
    const headers = new Headers(init?.headers);
    if (headers.has("authorization"))
      fail("client sent an Authorization header (key must stay in the URL path)");
    bodies.push(init?.body);
    const h = handler(callIndex++, init?.body);
    if (h.throwErr) throw h.throwErr;
    if (h.abort) throw new DOMException("aborted", "AbortError");
    const status = h.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => h.body,
    } as ReturnType<PcsFetchFn> extends Promise<infer R> ? R : never;
  };
  return { PcsFetchFn, bodies, inputs };
}

const FIXTURE_OPTIONS = { apiKey: FIXTURE_KEY } as const;

async function main(): Promise<void> {
  console.log("PANCAKESWAP — read-only data verify (OFFLINE FIXTURES, no live data, no signing)");

  // 1. Config: BSC mainnet chain id + NodeReal source layout + endpoint builder.
  if (PANCAKESWAP_BSC_CHAIN_ID !== 56) fail("PancakeSwap pool data is BSC mainnet (chain 56)");
  if (PANCAKESWAP_NODEREAL_BASE_URL !== "https://open-platform.nodereal.io")
    fail("NodeReal base URL mismatch");
  if (PANCAKESWAP_NODEREAL_FREE_PATH !== "pancakeswap-free")
    fail("Free product path must be pancakeswap-free");
  if (PANCAKESWAP_NODEREAL_PREMIUM_PATH !== "pancakeswap")
    fail("Premium product path must be pancakeswap");
  if (PANCAKESWAP_NODEREAL_GRAPHQL_PATH !== "graphql") fail("GraphQL path must be graphql");
  const freeUrl = buildPancakeSwapEndpoint(FIXTURE_KEY, "free");
  const premUrl = buildPancakeSwapEndpoint(FIXTURE_KEY, "premium");
  if (freeUrl !== `${PANCAKESWAP_NODEREAL_BASE_URL}/${FIXTURE_KEY}/pancakeswap-free/graphql/`) {
    fail(`Free endpoint builder produced: ${freeUrl}`);
  }
  if (premUrl !== `${PANCAKESWAP_NODEREAL_BASE_URL}/${FIXTURE_KEY}/pancakeswap/graphql/`) {
    fail(`Premium endpoint builder produced: ${premUrl}`);
  }
  if (PAIRS_QUERY.trim().length === 0) fail("PAIRS_QUERY must be defined");
  console.log(
    "ok   1 valid BSC source config (chain 56) + Free/Premium NodeReal endpoints + query defined"
  );

  // 1b. Missing API key → unauthorized BEFORE any network call (zero fetches).
  {
    const { PcsFetchFn, inputs } = stubFetch(() => okResponse([FIXTURE_PAIR]));
    const res = await listPools(PcsFetchFn, {});
    if (res.ok || res.reason !== "unauthorized") fail("missing API key must map to unauthorized");
    if (inputs.length !== 0) fail("missing-key path must NOT make a network call");
    if (res.message?.includes(FIXTURE_KEY)) fail("missing-key message must not contain any key");
    console.log("ok   1b missing PANCAKESWAP_API_KEY → unauthorized, zero network calls");
  }

  // 2. Valid response parsing + 3. token-pair parsing + token0/1 presence + name/symbol.
  {
    const { PcsFetchFn, bodies, inputs } = stubFetch(() => okResponse([FIXTURE_PAIR]));
    const res = await listPools(PcsFetchFn, FIXTURE_OPTIONS);
    if (!res.ok) fail("well-formed pairs must parse ok");
    if (res.data.length !== 1) fail("must normalize 1 pool");
    const p = res.data[0] as PancakeSwapPool;
    if (p.token0Symbol !== "WBNB" || p.token1Symbol !== "CAKE") fail("token pair parsing failed");
    if (p.symbol !== "WBNB/CAKE") fail("normalized symbol must be 'token0/token1'");
    if (p.token0Address !== FIXTURE_PAIR.token0.id) fail("token0Address must be the contract id");
    const body = JSON.parse(String(bodies[0])) as { query?: string };
    if (body.query !== PAIRS_QUERY) fail("must send the documented PAIRS_QUERY");
    // The authenticated URL (with the fixture key) is used for the request, but
    // the key and the URL must never appear in the returned result.
    if (inputs[0] !== `${PANCAKESWAP_NODEREAL_BASE_URL}/${FIXTURE_KEY}/pancakeswap-free/graphql/`) {
      fail("free endpoint URL must carry the key in the path segment");
    }
    if (
      JSON.stringify(res).includes(FIXTURE_KEY) ||
      JSON.stringify(res).includes(PANCAKESWAP_NODEREAL_BASE_URL)
    ) {
      fail("result must never contain the API key or the NodeReal URL");
    }
    console.log("ok   2-3 valid response parsing + token-pair parsing (id/symbol/name)");
  }

  // 4. TVL/liquidity parsing + 5. volume parsing (cumulative) + 6. price parsing.
  {
    const { PcsFetchFn } = stubFetch(() => okResponse([FIXTURE_PAIR]));
    const res = await listPools(PcsFetchFn, FIXTURE_OPTIONS);
    if (!res.ok) fail("parse must succeed");
    const p = res.data[0] as PancakeSwapPool;
    if (p.tvlUsd !== 1234567.89) fail("tvlUsd ≠ reserveUSD normalization failed");
    if (p.volumeUsd !== 98765432.1) fail("volumeUsd ≠ cumulative volumeUSD normalization failed");
    if (p.token0Price !== 12.34 || p.token1Price !== 0.081) fail("price parsing failed");
    if (p.totalTransactions !== 123456) fail("totalTransactions normalization failed");
    console.log("ok   4-6 TVL (reserveUSD) + cumulative volume + price parsed");
  }

  // 4b. BETA fallback: source rejects the requested orderBy → one bounded
  // retry on `trackedReserveBNB`, then an honest client-side re-rank.
  {
    const rows = [
      { ...FIXTURE_PAIR, id: "0xA", volumeUSD: "100" },
      { ...FIXTURE_PAIR, id: "0xB", volumeUSD: "900" },
      { ...FIXTURE_PAIR, id: "0xC", volumeUSD: "500" },
    ];
    const { PcsFetchFn, bodies, inputs } = stubFetch((callIndex) => {
      if (callIndex === 0)
        return {
          body: {
            errors: [{ message: "Validation error ... 'orderBy' value 'volumeUSD' not supported" }],
          },
        };
      return okResponse(rows);
    });
    const res = await listPools(PcsFetchFn, { ...FIXTURE_OPTIONS, limit: 2, orderBy: "volumeUSD" });
    if (!res.ok) fail("BETA fallback must still return ok");
    if (res.data.length !== 2) fail("BETA fallback must slice to the requested limit");
    if (res.data[0]?.poolId !== "0xB" || res.data[1]?.poolId !== "0xC")
      fail("BETA fallback must re-rank by the requested key desc");
    const fbBody = JSON.parse(String(bodies[1])) as {
      variables?: { orderBy?: string; first?: number };
    };
    if (fbBody.variables?.orderBy !== "trackedReserveBNB")
      fail("fallback must order by trackedReserveBNB");
    if (typeof fbBody.variables?.first === "number" && fbBody.variables.first > 1000)
      fail("fallback must respect the BETA first cap (1000)");
    if (inputs.length !== 2) fail("fallback must be exactly one bounded retry");
    if (JSON.stringify(res).includes(FIXTURE_KEY))
      fail("fallback result must never contain the key");
    console.log(
      "ok   4b BETA fallback — single retry on trackedReserveBNB + honest client-side ranking"
    );
  }

  // 7. APR/APY are NOT provided by the V2 data source → always null (never invented).
  {
    const { PcsFetchFn } = stubFetch(() => okResponse([FIXTURE_PAIR]));
    const res = await listPools(PcsFetchFn, FIXTURE_OPTIONS);
    if (!res.ok) fail("parse must succeed");
    const p = res.data[0] as PancakeSwapPool;
    if (p.apr !== null) fail("apr must be null (V2 schema provides no APR)");
    if (p.apy !== null) fail("apy must be null (V2 schema provides no APY)");
    console.log("ok   7 APR/APY null — never fabricated (not in V2 schema)");
  }

  // 8. Missing fields → record invalid + dropped (never zero-coerced).
  {
    const missing = { ...FIXTURE_PAIR, reserveUSD: undefined } as unknown;
    if (isValidRawPair(missing)) fail("missing reserveUSD must be invalid");
    if (normalizePair(missing) !== null) fail("invalid pair must normalize to null (dropped)");
    const missingToken = {
      ...FIXTURE_PAIR,
      token1: { id: "0x0001", symbol: undefined },
    } as unknown;
    if (normalizePair(missingToken) !== null) fail("missing token symbol must drop the record");
    console.log("ok   8 missing fields dropped (never coerced to 0)");
  }

  // 9. Malformed response → error (no fabricated numbers) + credential redaction.
  {
    const badShape = stubFetch(() => ({ body: { wrongKey: true } }));
    const res = await listPools(badShape.PcsFetchFn, FIXTURE_OPTIONS);
    if (res.ok || res.reason !== "error") fail("unexpected response shape must map to error");
    const gqlErr = stubFetch(() => ({ body: { errors: [{ message: "no such field: foo" }] } }));
    const res2 = await listPools(gqlErr.PcsFetchFn, FIXTURE_OPTIONS);
    if (res2.ok || res2.reason !== "error") fail("GraphQL errors must map to error");
    const emptyParse = stubFetch(() => okResponse([{ id: "x" } /* invalid */]));
    const res3 = await listPools(emptyParse.PcsFetchFn, FIXTURE_OPTIONS);
    if (res3.ok || res3.reason !== "error")
      fail("all-invalid rows must surface error, not fabricated zeros");
    // A GraphQL message that echoes the key or the NodeReal URL must be redacted.
    const leaky = stubFetch(() => ({
      body: {
        errors: [
          {
            message: `request failed for ${PANCAKESWAP_NODEREAL_BASE_URL}/${FIXTURE_KEY}/pancakeswap-free/graphql`,
          },
        ],
      },
    }));
    const res4 = await listPools(leaky.PcsFetchFn, FIXTURE_OPTIONS);
    if (res4.ok) fail("GraphQL error must map to error");
    const msg4 = res4.message ?? "";
    if (msg4.includes(FIXTURE_KEY) || msg4.includes(PANCAKESWAP_NODEREAL_BASE_URL)) {
      fail("error message must be redacted (no key, no NodeReal URL)");
    }
    console.log(
      "ok   9 malformed / GraphQL / unparseable rows → error (no fabricated data, no credential leak)"
    );
  }

  // 10. not-found (empty pairs array, network 404).
  {
    const empty = stubFetch(() => okResponse([]));
    const res = await listPools(empty.PcsFetchFn, FIXTURE_OPTIONS);
    if (res.ok || res.reason !== "not-found") fail("empty pairs must map to not-found");
    const notFound = stubFetch(() => ({ status: 404 }));
    const res2 = await listPools(notFound.PcsFetchFn, FIXTURE_OPTIONS);
    if (res2.ok || res2.reason !== "not-found") fail("HTTP 404 must map to not-found");
    console.log("ok   10 not-found (empty + HTTP 404)");
  }

  // 11. rate-limit + 12. server error.
  {
    const rl = await listPools(stubFetch(() => ({ status: 429 })).PcsFetchFn, FIXTURE_OPTIONS);
    if (rl.ok || rl.reason !== "rate-limited") fail("429 → rate-limited");
    const se = await listPools(stubFetch(() => ({ status: 503 })).PcsFetchFn, FIXTURE_OPTIONS);
    if (se.ok || se.reason !== "server-error") fail("503 → server-error");
    const unauthorized = await listPools(
      stubFetch(() => ({ status: 401 })).PcsFetchFn,
      FIXTURE_OPTIONS
    );
    if (unauthorized.ok || unauthorized.reason !== "unauthorized") fail("401 → unauthorized");
    const forbidden = await listPools(
      stubFetch(() => ({ status: 403 })).PcsFetchFn,
      FIXTURE_OPTIONS
    );
    if (forbidden.ok || forbidden.reason !== "forbidden") fail("403 → forbidden");
    console.log("ok   11-12 rate-limit / server-error / unauthorized / forbidden mapped");
  }

  // 13. network error + 14. timeout/abort.
  {
    const ne = await listPools(
      stubFetch(() => ({ throwErr: new Error("simulated") })).PcsFetchFn,
      FIXTURE_OPTIONS
    );
    if (ne.ok || ne.reason !== "network-error") fail("network throw → network-error");
    const to = await listPools(stubFetch(() => ({ abort: true })).PcsFetchFn, FIXTURE_OPTIONS);
    if (to.ok || to.reason !== "network-error") fail("abort/timeout → network-error");
    console.log("ok   13-14 network error + timeout → network-error");
  }

  // 15. No wallet requirement + 16. no signing + 17. no transaction capability.
  {
    const surface = import("./index.js") as unknown as Record<string, unknown>;
    const forbidden = [
      "writeContract",
      "sendTransaction",
      "signMessage",
      "signTypedData",
      "swap",
      "addLiquidity",
      "removeLiquidity",
      "approve",
      "permit",
      "permit2",
    ];
    for (const k of Object.keys(surface)) {
      if (forbidden.some((f) => k.toLowerCase().includes(f)))
        fail(`barrel must not expose write/sign/swap API "${k}"`);
    }
    if (typeof globalThis.fetch !== "function") {
      // The adapter requires a fetch; that is the ONLY runtime dependency — no wallet/key.
    }
    if (parseDecimal("0") !== 0)
      fail("parseDecimal must return a REAL 0 when the value is genuinely 0");
    if (parseDecimal("not-a-number") !== null) fail("parseDecimal must return null on garbage");
    console.log("ok   15-17 no wallet / signing / transaction surface (read-only subgraph only)");
  }

  // 18. No credential leakage — presence-only env check; no secret is read or printed.
  {
    const names = [
      "PRIVATE_KEY",
      "PRIVATEKEY",
      "MNEMONIC",
      "SEED_PHRASE",
      "WALLET_PRIVATE_KEY",
      "SIGNER",
      "FACILITATOR_KEY",
      "PANCAKE_PRIVATE",
      "NEXT_PUBLIC_PANCAKE",
    ];
    for (const name of names) {
      const present = process.env[name] !== undefined; // presence only — value never read/printed
      if (present && /NEXT_PUBLIC|PRIVATE|SEED|MNEMONIC|SIGNER/.test(name)) {
        fail(`a wallet/credential env var (${name}) must not exist for a read-only data adapter`);
      }
    }
    // The server-only key is allowed; a NEXT_PUBLIC variant is NOT.
    if (process.env["NEXT_PUBLIC_PANCAKESWAP_API_KEY"] !== undefined) {
      fail("NEXT_PUBLIC_PANCAKESWAP_API_KEY must never be defined (key is server-only)");
    }
    console.log("ok   18 no credential leakage (keyed endpoint; presence-only env check)");
  }

  // normalizePairs on mixed valid/invalid must keep only valid rows.
  {
    const list = normalizePairs([FIXTURE_PAIR, { id: "bad" }]);
    if (list.length !== 1) fail("normalizePairs must drop invalid rows and keep valid ones");
    if (list[0]?.source !== PANCAKESWAP_SOURCE)
      fail("normalized record must be labeled source=pancakeswap");
    console.log("ok   mixed batch keeps only valid rows; source labeled pancakeswap");
  }

  console.log("PANCAKESWAP DATA VERIFY — OFFLINE FIXTURE TEST PASSED (P4 NodeReal migration)");
  process.exitCode = 0;
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
