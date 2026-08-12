/**
 * TERMIX AACP — READ-ONLY reputation adapter verification.
 *
 * Safe by construction (matches the Altana verify harnesses): NO credentials,
 * NO signing, NO wallet, NO session, NO transaction, and NO live network calls.
 * Every HTTP interaction is driven by an INJECTED fetch stub returning labeled
 *   TEST FIXTURE / NOT LIVE TERMIX DATA
 * bodies. Nothing here contacts the real TermiX backend.
 *
 * Exit policy:
 *   - 1  any assertion fails (the integration gate).
 *   - 0  otherwise.
 *
 * Run after `pnpm build`:  node dist/termix/reputation.verify.js
 */

import {
  TERMIX_AACP_CHAIN_ID,
  TERMIX_AACP_DEFAULT_BASE_URL,
  TERMIX_AGENT_NFT_ADDRESS,
  TERMIX_REPUTATION_SOURCE,
  createTermixClient,
  decodeAnomalyFlags,
  getTermixReputationByAgentId,
  getTermixReputationForAgent,
  isRawReputation,
  isValidAgentId,
  mapErc8004ToTermixAgentId,
  normalizeReputation,
  termixBaseUrl,
  type FetchFn,
} from "./index.js";
import type { Erc8004AgentIdentity, TermiXRawReputation } from "./types.js";

function fail(message: string): never {
  console.error(`TERMIX REPUTATION VERIFY FAILED: ${message}`);
  process.exit(1);
}

/** TEST FIXTURE — NOT LIVE TERMIX DATA. A well-formed AACP reputation record. */
const FIXTURE_RAW: TermiXRawReputation = {
  agentId: "7",
  score: 85,
  totalJobs: 20,
  completedJobs: 17,
  onTimeJobs: 16,
  approvedJobs: 15,
  disputeWins: 2,
  anomalyFlags: 0,
};

/** Build a fetch stub that returns a fixed status + JSON body (offline). */
function stubFetch(
  status: number,
  body: unknown,
  opts: { throwNetwork?: boolean; abort?: boolean } = {}
): {
  fetchFn: FetchFn;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchFn: FetchFn = async (input, init) => {
    calls.push(input);
    // Assert the client is READ-ONLY: only GET, and never an Authorization header.
    if ((init?.method ?? "GET") !== "GET") fail("client issued a non-GET request");
    if (init?.headers) {
      for (const key of Object.keys(init.headers)) {
        if (/^authorization$/i.test(key))
          fail("client sent an Authorization header (must be public GET)");
      }
    }
    if (opts.throwNetwork) throw new Error("simulated network failure");
    if (opts.abort) {
      const e = new Error("aborted");
      (e as { name: string }).name = "AbortError";
      throw e;
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
  return { fetchFn, calls };
}

async function main(): Promise<void> {
  console.log(
    "TERMIX AACP — read-only reputation verify (offline fixtures, no live data, no signing)"
  );

  // 1. Valid BSC Testnet configuration (chain 97, public host, no mainnet).
  if (TERMIX_AACP_CHAIN_ID !== 97) fail("AACP chain id must be 97 (BSC Testnet)");
  if (!/^https:\/\//.test(TERMIX_AACP_DEFAULT_BASE_URL)) fail("default base URL must be https");
  const client = createTermixClient({ fetchFn: stubFetch(200, {}).fetchFn });
  if (client.chainId !== 97) fail("client.chainId must be 97");
  if (termixBaseUrl().length === 0) fail("base URL resolver must return a host");
  if (termixBaseUrl("https://example.test/") !== "https://example.test") {
    fail("base URL resolver must trim trailing slash");
  }
  console.log("ok   1 valid BSC Testnet config (chain 97, https, no mainnet)");

  // 2. Valid read-only request + 3. valid response parsing + 4. score normalization.
  {
    const { fetchFn, calls } = stubFetch(200, { success: true, data: FIXTURE_RAW });
    const res = await getTermixReputationByAgentId("7", { fetchFn });
    if (!res.ok) fail("well-formed reputation must parse ok");
    if (calls.length !== 1 || !calls[0]?.endsWith("/api/v1/reputation/7")) {
      fail("must GET the documented /api/v1/reputation/:agentId path");
    }
    if (res.data.score !== 85) fail("score must normalize from the raw body");
    if (res.data.chainId !== 97) fail("normalized record must record chain 97");
    if (res.data.source !== TERMIX_REPUTATION_SOURCE) fail("record must be labeled termix-aacp");
    if (typeof res.data.retrievedAt !== "string") fail("record must stamp retrievedAt");
    console.log("ok   2-4 read-only GET + envelope parse + honest score normalization");
  }

  // Anomaly decoding (documented 4-bit mask).
  if (decodeAnomalyFlags(0).length !== 0) fail("mask 0 must decode to no anomalies");
  if (decodeAnomalyFlags(3).join(",") !== "overturn-count,borderline-count") {
    fail("mask 3 must decode bits 0+1");
  }
  {
    const withFlags = normalizeReputation({ ...FIXTURE_RAW, anomalyFlags: 8 });
    if (withFlags.anomalies.join(",") !== "extreme-pass-rate")
      fail("bit 3 must decode to extreme-pass-rate");
  }
  console.log("ok   anomaly bit mask decodes per documented reputation.md");

  // 5. Missing agent → not-found (NEVER score 0).
  {
    const { fetchFn } = stubFetch(404, { success: false, error: { message: "agent not found" } });
    const res = await getTermixReputationByAgentId("999999", { fetchFn });
    if (res.ok) fail("404 must not be ok");
    if (res.reason !== "not-found") fail("404 must map to not-found");
    if ((res as { data?: unknown }).data !== undefined) fail("missing data must carry NO score");
    console.log("ok   5 missing agent → not-found (never fabricated as score 0)");
  }

  // 6. Unauthorized + 7. Forbidden (kept for completeness though GET is public).
  {
    const u = await getTermixReputationByAgentId("7", { fetchFn: stubFetch(401, {}).fetchFn });
    if (u.ok || u.reason !== "unauthorized") fail("401 must map to unauthorized");
    const f = await getTermixReputationByAgentId("7", { fetchFn: stubFetch(403, {}).fetchFn });
    if (f.ok || f.reason !== "forbidden") fail("403 must map to forbidden");
    console.log("ok   6-7 unauthorized/forbidden mapped honestly");
  }

  // 8. Rate-limit + 9. server error handling.
  {
    const r = await getTermixReputationByAgentId("7", { fetchFn: stubFetch(429, {}).fetchFn });
    if (r.ok || r.reason !== "rate-limited") fail("429 must map to rate-limited");
    const s = await getTermixReputationByAgentId("7", { fetchFn: stubFetch(503, {}).fetchFn });
    if (s.ok || s.reason !== "server-error") fail("5xx must map to server-error");
    console.log("ok   8-9 rate-limit + server-error handled");
  }

  // 10. Network failure + 11. timeout/abort → network-error.
  {
    const n = await getTermixReputationByAgentId("7", {
      fetchFn: stubFetch(200, {}, { throwNetwork: true }).fetchFn,
    });
    if (n.ok || n.reason !== "network-error") fail("network throw must map to network-error");
    const t = await getTermixReputationByAgentId("7", {
      fetchFn: stubFetch(200, {}, { abort: true }).fetchFn,
    });
    if (t.ok || t.reason !== "network-error") fail("abort/timeout must map to network-error");
    console.log("ok   10-11 network failure + timeout/abort → network-error");
  }

  // Malformed but 200 body → error (never a fake score).
  {
    const { fetchFn } = stubFetch(200, {
      success: true,
      data: { agentId: "7" /* missing fields */ },
    });
    const res = await getTermixReputationByAgentId("7", { fetchFn });
    if (res.ok) fail("malformed reputation body must not parse ok");
    if (res.reason !== "error") fail("malformed body must map to error");
    if (!isRawReputation(FIXTURE_RAW)) fail("valid raw record must pass the shape guard");
    console.log("ok   malformed 200 body → error (no fabricated score)");
  }

  // Identity mapping: deterministic only for MockAgentNFT on chain 97.
  {
    const good: Erc8004AgentIdentity = {
      tokenId: "7",
      chainId: 97,
      contractAddress: TERMIX_AGENT_NFT_ADDRESS.toUpperCase().replace("0X", "0x"),
    };
    const m = mapErc8004ToTermixAgentId(good);
    if (!m.ok || m.agentId !== "7") fail("MockAgentNFT token on chain 97 must map to agentId");

    const wrongChain = mapErc8004ToTermixAgentId({ ...good, chainId: 56 });
    if (wrongChain.ok || wrongChain.reason !== "unsupported") fail("chain 56 must be unsupported");

    const wrongContract = mapErc8004ToTermixAgentId({
      ...good,
      contractAddress: "0x0000000000000000000000000000000000000001",
    });
    if (wrongContract.ok || wrongContract.reason !== "unsupported") {
      fail("non-MockAgentNFT contract must be unsupported");
    }
    if (!isValidAgentId("42") || isValidAgentId("0xabc") || isValidAgentId("")) {
      fail("agentId validity must accept uint256 strings only");
    }

    // Unsupported identity must short-circuit WITHOUT any network call.
    const { fetchFn, calls } = stubFetch(200, { success: true, data: FIXTURE_RAW });
    const res = await getTermixReputationForAgent({ ...good, chainId: 56 }, { fetchFn });
    if (res.ok || res.reason !== "unsupported")
      fail("unsupported identity must return unsupported");
    if (calls.length !== 0) fail("unsupported identity must NOT perform a network call");
    console.log(
      "ok   identity mapping deterministic (chain 97 + MockAgentNFT); unsupported short-circuits"
    );
  }

  // 12. No transaction capability + 13. no signer requirement (surface audit).
  {
    const surface = createTermixClient({
      fetchFn: stubFetch(200, {}).fetchFn,
    }) as unknown as Record<string, unknown>;
    const forbidden = [
      "writeContract",
      "sendTransaction",
      "signMessage",
      "signTypedData",
      "hire",
      "stake",
      "settle",
      "createJob",
      "fundJob",
      "makeOffer",
      "approve",
      "transfer",
    ];
    for (const name of forbidden) {
      if (typeof surface[name] === "function")
        fail(`client must not expose write method "${name}"`);
    }
    const methods = Object.keys(surface).filter((k) => typeof surface[k] === "function");
    // Only read methods may exist.
    for (const m of methods) {
      if (!/^get/i.test(m)) fail(`client exposes non-read method "${m}"`);
    }
    console.log(
      "ok   12-13 read-only surface: no write/sign/hire/stake/settle; no signer required"
    );
  }

  // 14. No secret exposure — env presence-only, values never printed.
  {
    const CREDENTIAL_ENV_NAMES = [
      "PRIVATE_KEY",
      "PRIVATEKEY",
      "MNEMONIC",
      "SEED_PHRASE",
      "WALLET_PRIVATE_KEY",
      "WALLET_KEY",
      "SIGNER",
      "FACILITATOR_KEY",
      "TERMIX_API_KEY",
      "NEXT_PUBLIC_TERMIX_API_KEY",
    ];
    for (const name of CREDENTIAL_ENV_NAMES) {
      const present = process.env[name] !== undefined; // presence only — value never read/printed
      if (present && /NEXT_PUBLIC/.test(name)) {
        fail("a NEXT_PUBLIC_ TermiX credential must never be defined (browser exposure)");
      }
    }
    // The read path requires NO credential at all.
    if (process.env["TERMIX_API_KEY"] !== undefined) {
      console.log(
        "info TERMIX_API_KEY is present but UNUSED by the read-only path (name-only check)"
      );
    }
    console.log("ok   14 no secret exposure (public read path; presence-only env check)");
  }

  console.log("TERMIX AACP STATUS: READY FOR UI INTEGRATION (read-only reputation)");
  process.exitCode = 0;
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
