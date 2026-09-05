/**
 * PANCAKESWAP P4 — READ-ONLY server-integration verification (web layer).
 *
 * Verifies the SERVER-ONLY loader (`apps/web/lib/pancakeswap/client.ts`) that a
 * server component uses to fetch read-only PancakeSwap pool data.
 *
 * OFFLINE FIXTURE TEST — NOT a live test. Safe by construction (matches the
 * TermiX web verify harness + Altana/PCS integration harnesses): NO credentials,
 * NO signing, NO wallet, NO transaction, and NO live network calls. Every HTTP
 * interaction is driven by an INJECTED fetch stub returning labeled
 *   TEST FIXTURE / NOT LIVE PANCAKESWAP DATA
 * bodies. The web loader reads the server-only env var `PANCAKESWAP_API_KEY`;
 * this harness sets it to a clearly-labeled fixture value (NOT a real key) to
 * exercise URL construction offline, and restores the previous value after.
 *
 * LIVE NODE REAL TESTING happens ONLY in the separate `live.verify.ts` harness
 * (one bounded request when a real key is configured).
 *
 * Run (Node >= 22, type-stripping):
 *   node --experimental-strip-types apps/web/lib/pancakeswap/server.verify.ts
 *
 * Exit: 1 on any failed assertion; 0 otherwise.
 */

import {
  PANCAKESWAP_BSC_CHAIN_ID,
  PANCAKESWAP_NODEREAL_BASE_URL,
  PANCAKESWAP_NODEREAL_FREE_PATH,
  buildPancakeSwapEndpoint,
  PANCAKESWAP_SOURCE,
  getPancakeSwapPools,
  isValidRawPair,
  normalizePair,
  normalizePairs,
  type PancakeSwapPoolsData,
  type PcsRawPair,
} from "./client.ts";

function fail(message: string): never {
  console.error(`PANCAKESWAP SERVER VERIFY FAILED: ${message}`);
  process.exit(1);
}

/** TEST FIXTURE — NOT A REAL KEY (clearly labeled; used only for URL construction). */
const FIXTURE_KEY = "PCS-TEST-FIXTURE-KEY-0000";
const FIXTURE_KEY_ENV = "PANCAKESWAP_API_KEY" as const;

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
  reserve0: "10",
  reserve1: "20",
  reserveUSD: "30000",
  reserveBNB: "5",
  token0Price: "2",
  token1Price: "0.5",
  volumeUSD: "123456",
  untrackedVolumeUSD: "123456",
  totalTransactions: "7",
};

/** A fetch stub producing a fixed body — injected via the lib's own dep. */
function makeFetch(
  handler: (callIndex: number) => {
    status?: number;
    body?: unknown;
    throwErr?: unknown;
    abort?: boolean;
  },
  urls: string[]
) {
  let callIndex = 0;
  return (async (input: string | URL | Request, init?: RequestInit) => {
    urls.push(String(input));
    // Shebang sanity: the keyed NodeReal endpoint; headers must NOT carry auth
    // (the key lives in the URL path only).
    if (init?.headers) {
      const h = new Headers(init.headers);
      if (h.has("authorization"))
        fail("client must not send an Authorization header (key stays in the URL path)");
    }
    const r = handler(callIndex++);
    if (r.throwErr) throw r.throwErr;
    if (r.abort) throw new DOMException("aborted", "AbortError");
    const status = r.status ?? 200;
    return { status, ok: status >= 200 && status < 300, json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
}

// The web lib builds its own client via `createApiClient` which uses global
// `fetch`. To keep the harness OFFLINE, we stub globalThis.fetch around a call.
async function run(
  options: Parameters<typeof getPancakeSwapPools>[0],
  stub: (callIndex: number) => {
    status?: number;
    body?: unknown;
    throwErr?: unknown;
    abort?: boolean;
  }
): Promise<{ data: PancakeSwapPoolsData; urls: string[] }> {
  const real: typeof fetch = globalThis.fetch;
  const urls: string[] = [];
  // @ts-expect-error - assign the offline stub for the duration of the call.
  globalThis.fetch = makeFetch(stub, urls);
  try {
    const data = await getPancakeSwapPools(options);
    return { data, urls };
  } finally {
    globalThis.fetch = real;
  }
}

async function main(): Promise<void> {
  console.log(
    "PANCAKESWAP P4 — server read-only integration verify (OFFLINE FIXTURES, no live data, no signing)"
  );

  const realKey = process.env[FIXTURE_KEY_ENV];
  // The harness needs the loader to read SOMETHING server-side; this is a
  // clearly-labeled fixture, NEVER a real key, and is restored afterwards.
  process.env[FIXTURE_KEY_ENV] = FIXTURE_KEY;
  try {
    // 1. config: chain 56 + NodeReal source layout + endpoint builder.
    if (PANCAKESWAP_BSC_CHAIN_ID !== 56) fail("chain id must be 56 (BSC mainnet)");
    if (PANCAKESWAP_NODEREAL_BASE_URL !== "https://open-platform.nodereal.io")
      fail("NodeReal base URL mismatch");
    if (
      buildPancakeSwapEndpoint(FIXTURE_KEY) !==
      `${PANCAKESWAP_NODEREAL_BASE_URL}/${FIXTURE_KEY}/${PANCAKESWAP_NODEREAL_FREE_PATH}/graphql/`
    ) {
      fail("free endpoint builder mismatch");
    }
    console.log("ok   1 valid mainnet config + NodeReal https endpoints");

    // 2. successful pool response + 9. source field + 10. chain ID + 11. retrievedAt.
    {
      const { data, urls } = await run({}, () => ({ body: { data: { pairs: [FIXTURE_PAIR] } } }));
      if (data.state !== "ready") fail("well-formed fixture must be ready");
      if (data.pools.length !== 1) fail("must normalize exactly one pool");
      const p = data.pools[0]!;
      if (p.symbol !== "WBNB/CAKE") fail("normalized symbol must be 'WBNB/CAKE'");
      if (data.source !== PANCAKESWAP_SOURCE) fail("response must carry source pancakeswap");
      if (data.chainId !== 56) fail("response must carry chainId 56");
      if (typeof data.retrievedAt !== "string") fail("response must stamp retrievedAt");
      if (
        urls.length !== 1 ||
        urls[0] !== `${PANCAKESWAP_NODEREAL_BASE_URL}/${FIXTURE_KEY}/pancakeswap-free/graphql/`
      ) {
        fail("loader must call the Free NodeReal endpoint with the key in the path");
      }
      if (JSON.stringify(data).includes(FIXTURE_KEY))
        fail("loader result must never contain the API key");
      console.log(
        "ok   2 + 9-11 successful parse + source/chain/retrievedAt + keyed-free-endpoint URL"
      );
    }

    // 2b. Missing key → unauthorized, zero network calls.
    {
      delete process.env[FIXTURE_KEY_ENV];
      const { data, urls } = await run({}, () => ({ body: { data: { pairs: [FIXTURE_PAIR] } } }));
      if (data.state !== "unauthorized") fail("missing key must map to unauthorized");
      if (urls.length !== 0) fail("missing-key path must not make a network call");
      if (data.message?.includes(FIXTURE_KEY)) fail("missing-key message must not contain any key");
      process.env[FIXTURE_KEY_ENV] = FIXTURE_KEY;
      console.log("ok   2b missing PANCAKESWAP_API_KEY → unauthorized, zero network calls");
    }

    // 2c. URL-form credential (full keyed NodeReal URL, no trailing slash) →
    //     used verbatim + normalized, keyed URL never leaks into the result.
    {
      const urlForm = `${PANCAKESWAP_NODEREAL_BASE_URL}/${FIXTURE_KEY}/${PANCAKESWAP_NODEREAL_FREE_PATH}/graphql`;
      process.env[FIXTURE_KEY_ENV] = urlForm;
      const { data, urls } = await run({}, () => ({ body: { data: { pairs: [FIXTURE_PAIR] } } }));
      if (data.state !== "ready") fail("URL-form credential must resolve ready");
      if (urls.length !== 1 || urls[0] !== `${urlForm}/`)
        fail("URL-form credential must be used verbatim (trailing slash normalized)");
      if (
        JSON.stringify(data).includes(FIXTURE_KEY) ||
        JSON.stringify(data).includes(PANCAKESWAP_NODEREAL_BASE_URL)
      ) {
        fail("URL-form result must never contain the keyed URL");
      }
      process.env[FIXTURE_KEY_ENV] = FIXTURE_KEY;
      console.log("ok   2c URL-form credential → verbatim keyed endpoint, URL never leaks");
    }

    // 12. volumeUSD preserved as CUMULATIVE + 13. APR stays null.
    {
      const { data } = await run({}, () => ({ body: { data: { pairs: [FIXTURE_PAIR] } } }));
      if (data.state !== "ready") fail("parse must succeed");
      const p = data.pools[0]!;
      if (p.volumeUsd !== 123456) fail("volumeUsd must equal cumulative volumeUSD");
      if (p.apr !== null || p.apy !== null) fail("apr/apy must be null (never fabricated)");
      if (p.tvlUsd !== 30000) fail("tvlUsd must equal reserveUSD");
      console.log("ok   12-13 cumulative volume + apr/apy null (never fabricated)");
    }

    // 3. multiple pools + 4. malformed integration result (invalid rows dropped).
    {
      const { data } = await run({}, () => ({
        body: {
          data: { pairs: [FIXTURE_PAIR, { id: "bad" } as unknown as PcsRawPair, FIXTURE_PAIR] },
        },
      }));
      if (data.state !== "ready" || data.pools.length !== 2)
        fail("invalid row must be dropped, valid ones kept");
      const sep = normalizePairs([{ id: "bad" }]);
      if (sep.length !== 0) fail("normalizePairs must drop invalid rows");
      if (normalizePair({ id: "bad" }) !== null)
        fail("normalizePair must return null for invalid rows");
      if (!isValidRawPair(FIXTURE_PAIR)) fail("a valid fixture must pass the shape guard");
      console.log("ok   3-4 multiple pools + malformed rows dropped");
    }

    // 4b. BETA fallback: source rejects orderBy → one retry on trackedReserveBNB
    //     + honest client-side re-rank.
    {
      const rows = [
        { ...FIXTURE_PAIR, id: "0xA", reserveUSD: "100" },
        { ...FIXTURE_PAIR, id: "0xB", reserveUSD: "900" },
        { ...FIXTURE_PAIR, id: "0xC", reserveUSD: "500" },
      ];
      const { data } = await run({ limit: 2, orderBy: "reserveUSD" }, (callIndex) => {
        if (callIndex === 0)
          return { body: { errors: [{ message: "orderBy 'reserveUSD' not supported (BETA)" }] } };
        return { body: { data: { pairs: rows } } };
      });
      if (data.state !== "ready") fail("BETA fallback must still resolve ready");
      if (data.pools.length !== 2) fail("BETA fallback must slice to the requested limit");
      if (data.pools[0]?.poolId !== "0xB" || data.pools[1]?.poolId !== "0xC")
        fail("BETA fallback must re-rank by the requested key");
      console.log("ok   4b BETA fallback — single retry + honest client-side ranking");
    }

    // 4c. GraphQL error echoing key/URL must be redacted.
    {
      const { data } = await run({}, () => ({
        body: {
          errors: [
            {
              message: `failed for ${PANCAKESWAP_NODEREAL_BASE_URL}/${FIXTURE_KEY}/pancakeswap-free/graphql`,
            },
          ],
        },
      }));
      if (data.state !== "server-error") fail("GraphQL error must map to server-error");
      const msg = data.message ?? "";
      if (msg.includes(FIXTURE_KEY) || msg.includes(PANCAKESWAP_NODEREAL_BASE_URL)) {
        fail("GraphQL error message must be redacted (no key, no NodeReal URL)");
      }
      console.log("ok   4c GraphQL error messages redacted (key + NodeReal URL never leak)");
    }

    // 5. empty pools → not-found + 6. network error + 7. timeout + 8. server error.
    {
      const empty = await run({}, () => ({ body: { data: { pairs: [] } } }));
      if (empty.data.state !== "not-found") fail("empty pairs must be not-found");
      const net = await run({}, () => ({ throwErr: new Error("simulated network failure") }));
      if (net.data.state !== "network-error") fail("network throw must map to network-error");
      const to = await run({}, () => ({ abort: true }));
      if (to.data.state !== "timeout") fail("abort must map to timeout");
      const se = await run({}, () => ({ status: 503 }));
      if (se.data.state !== "server-error") fail("503 must map to server-error");
      console.log("ok   5-8 not-found / network-error / timeout / server-error");
    }

    // GraphQL errors → server-error; 404 → not-found; 429 → rate-limited.
    {
      const gql = await run({}, () => ({ body: { errors: [{ message: "bad field" }] } }));
      if (gql.data.state !== "server-error") fail("GraphQL errors must map to server-error");
      const nf = await run({}, () => ({ status: 404 }));
      if (nf.data.state !== "not-found") fail("HTTP 404 must map to not-found");
      const rl = await run({}, () => ({ status: 429 }));
      if (rl.data.state !== "rate-limited") fail("HTTP 429 must map to rate-limited");
      console.log("ok   GraphQL errors / HTTP 404 / 429 map honestly");
    }

    // 14. no wallet/signing surface (exported API audit) + 15. no credential exposure.
    {
      const mod = await import("./client.ts");
      const bannedSubstr = [
        "writecontract",
        "sendtransaction",
        "signmessage",
        "signtypeddata",
        "permit2",
        "addliquidity",
        "removeliquidity",
        "approve",
        "transfer",
      ];
      for (const key of Object.keys(mod)) {
        const lower = key.toLowerCase();
        if (bannedSubstr.some((b) => lower.includes(b))) {
          fail(`client.ts must not export an execution-capable function: ${key}`);
        }
      }
      // Only read/is/normalize/list/build-style exports may exist.
      const allowed = /^(get|is|normalize|parse|build|resolve|PANCAKESWAP|PAIRS|map)/;
      for (const key of Object.keys(mod)) {
        if (typeof (mod as Record<string, unknown>)[key] === "function" && !allowed.test(key)) {
          fail(`client.ts exports a non-read function: ${key}`);
        }
      }
      console.log("ok   14 no wallet/signing surface (export audit)");
    }
  } finally {
    if (realKey === undefined) delete process.env[FIXTURE_KEY_ENV];
    else process.env[FIXTURE_KEY_ENV] = realKey;
  }

  // 15. no credential exposure — presence-only env check AFTER restoring the env.
  {
    const sd = [
      "PRIVATE_KEY",
      "WALLET_PRIVATE_KEY",
      "MNEMONIC",
      "SEED_PHRASE",
      "PANCAKE_PRIVATE",
      "NEXT_PUBLIC_PANCAKE",
    ];
    for (const name of sd) {
      if (process.env[name] !== undefined)
        fail(`a wallet/PANCAKE credential (${name}) must not be defined`);
    }
    if (process.env["NEXT_PUBLIC_PANCAKESWAP_API_KEY"] !== undefined) {
      fail("NEXT_PUBLIC_PANCAKESWAP_API_KEY must never be defined (key is server-only)");
    }
    console.log("ok   15 no credential exposure (presence-only env check, key restored)");
  }

  console.log("PANCAKESWAP SERVER VERIFY — OFFLINE FIXTURE TEST PASSED (P4 NodeReal migration)");
  process.exitCode = 0;
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
