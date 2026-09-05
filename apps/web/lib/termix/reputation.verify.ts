/**
 * TERMIX AACP — READ-ONLY web-layer reputation verification.
 *
 * Verifies the SERVER-ONLY web client (`apps/web/lib/termix/reputation.ts`) that
 * the Agent Details route uses. Safe by construction (mirrors the package adapter
 * harness + the Altana verify harnesses): NO credentials, NO signing, NO wallet,
 * NO transaction, and NO live network calls. Every HTTP interaction is driven by
 * an INJECTED fetch stub returning labeled
 *   TEST FIXTURE / NOT LIVE TERMIX DATA
 * bodies. Nothing here contacts the real TermiX backend.
 *
 * Run (Node >= 22, type-stripping):
 *   node --experimental-strip-types apps/web/lib/termix/reputation.verify.ts
 *
 * Exit: 1 on any failed assertion; 0 otherwise.
 */

import {
  TERMIX_AACP_CHAIN_ID,
  TERMIX_AACP_DEFAULT_BASE_URL,
  TERMIX_AGENT_NFT_ADDRESS,
  TERMIX_REPUTATION_SOURCE,
  decodeAnomalyFlags,
  getTermixReputationByAgentId,
  getTermixReputationForAgent,
  isValidAgentId,
  mapErc8004ToTermixAgentId,
  normalizeReputation,
  type Erc8004AgentIdentity,
  type TermixRawReputation,
} from "./reputation.ts";

function fail(message: string): never {
  console.error(`TERMIX WEB REPUTATION VERIFY FAILED: ${message}`);
  process.exit(1);
}

/** TEST FIXTURE — NOT LIVE TERMIX DATA. A well-formed AACP reputation record. */
const FIXTURE_RAW: TermixRawReputation = {
  agentId: "7",
  score: 85,
  totalJobs: 20,
  completedJobs: 17,
  onTimeJobs: 16,
  approvedJobs: 15,
  disputeWins: 2,
  anomalyFlags: 0,
};

/** Build a `fetch`-compatible stub returning a fixed status + JSON body (offline). */
function stubFetch(
  status: number,
  body: unknown,
  opts: { throwNetwork?: boolean; abort?: boolean } = {}
): { fetchFn: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(String(input));
    // Assert READ-ONLY: only GET, and never an Authorization header.
    if ((init?.method ?? "GET") !== "GET") fail("client issued a non-GET request");
    const headers = new Headers(init?.headers);
    if (headers.has("authorization"))
      fail("client sent an Authorization header (must be public GET)");
    if (opts.throwNetwork) throw new Error("simulated network failure");
    if (opts.abort) {
      throw new DOMException("aborted", "AbortError");
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

async function main(): Promise<void> {
  console.log(
    "TERMIX AACP — web read-only reputation verify (offline fixtures, no live data, no signing)"
  );

  // 1. Config: chain 97, https, no mainnet.
  if (TERMIX_AACP_CHAIN_ID !== 97) fail("AACP chain id must be 97 (BSC Testnet)");
  if (!/^https:\/\//.test(TERMIX_AACP_DEFAULT_BASE_URL)) fail("default base URL must be https");
  console.log("ok   1 valid BSC Testnet config (chain 97, https, no mainnet)");

  // 2. TermiX AVAILABLE — read-only GET + envelope parse + normalization.
  {
    const { fetchFn, calls } = stubFetch(200, { success: true, data: FIXTURE_RAW });
    const res = await getTermixReputationByAgentId("7", { fetchFn });
    if (!res.ok) fail("well-formed reputation must parse ok");
    if (calls.length !== 1 || !calls[0]?.endsWith("/api/v1/reputation/7")) {
      fail("must GET the documented /api/v1/reputation/:agentId path");
    }
    if (res.data.score !== 85) fail("score must normalize from raw body");
    if (res.data.chainId !== 97) fail("record must record chain 97");
    if (res.data.source !== TERMIX_REPUTATION_SOURCE) fail("record must be labeled termix-aacp");
    if (typeof res.data.retrievedAt !== "string") fail("record must stamp retrievedAt");
    console.log("ok   2 TermiX available: read-only GET + parse + normalization");
  }

  // 3. NOT_FOUND — missing agent, NEVER score 0.
  {
    const { fetchFn } = stubFetch(404, { success: false });
    const res = await getTermixReputationByAgentId("999999", { fetchFn });
    if (res.ok || res.reason !== "not-found") fail("404 must map to not-found");
    if ((res as { data?: unknown }).data !== undefined) fail("missing data must carry NO score");
    console.log("ok   3 not-found (never fabricated as score 0)");
  }

  // 4. UNSUPPORTED — identity does not map; short-circuits WITHOUT a network call.
  {
    const good: Erc8004AgentIdentity = {
      tokenId: "7",
      chainId: 97,
      contractAddress: TERMIX_AGENT_NFT_ADDRESS,
    };
    const m = mapErc8004ToTermixAgentId(good);
    if (!m.ok || m.agentId !== "7") fail("MockAgentNFT token on chain 97 must map to agentId");

    const { fetchFn, calls } = stubFetch(200, { success: true, data: FIXTURE_RAW });
    const wrongChain = await getTermixReputationForAgent({ ...good, chainId: 56 }, { fetchFn });
    if (wrongChain.ok || wrongChain.reason !== "unsupported") fail("chain 56 must be unsupported");
    const wrongContract = await getTermixReputationForAgent(
      { ...good, contractAddress: "0x0000000000000000000000000000000000000001" },
      { fetchFn }
    );
    if (wrongContract.ok || wrongContract.reason !== "unsupported")
      fail("non-MockAgentNFT must be unsupported");
    if (calls.length !== 0) fail("unsupported identity must NOT perform a network call");
    console.log("ok   4 unsupported identity → unsupported (no network call)");
  }

  // 5. NETWORK_ERROR — network throw + timeout/abort.
  {
    const n = await getTermixReputationByAgentId("7", {
      fetchFn: stubFetch(200, {}, { throwNetwork: true }).fetchFn,
    });
    if (n.ok || n.reason !== "network-error") fail("network throw must map to network-error");
    const t = await getTermixReputationByAgentId("7", {
      fetchFn: stubFetch(200, {}, { abort: true }).fetchFn,
    });
    if (t.ok || t.reason !== "network-error") fail("abort/timeout must map to network-error");
    console.log("ok   5 network failure + timeout/abort → network-error");
  }

  // 6. Missing score / malformed 200 → error (never a fabricated score).
  {
    const { fetchFn } = stubFetch(200, {
      success: true,
      data: { agentId: "7" /* missing fields */ },
    });
    const res = await getTermixReputationByAgentId("7", { fetchFn });
    if (res.ok || res.reason !== "error")
      fail("malformed body must map to error, not a fake score");
    console.log("ok   6 malformed/missing-score 200 body → error (no fabricated score)");
  }

  // 7. NO composite reputation — normalized record carries ONLY TermiX fields,
  //    no merged/registry/composite key.
  {
    const rec = normalizeReputation(FIXTURE_RAW) as unknown as Record<string, unknown>;
    for (const forbidden of [
      "composite",
      "combined",
      "registryScore",
      "compositeScore",
      "merged",
    ]) {
      if (forbidden in rec) fail(`normalized record must NOT contain "${forbidden}"`);
    }
    console.log("ok   7 no composite/combined reputation field");
  }

  // 8. Score = 0 is PRESERVED when the API genuinely returns 0.
  {
    const { fetchFn } = stubFetch(200, { success: true, data: { ...FIXTURE_RAW, score: 0 } });
    const res = await getTermixReputationByAgentId("7", { fetchFn });
    if (!res.ok) fail("genuine score 0 must still parse ok");
    if (res.data.score !== 0) fail("genuine score 0 must be preserved verbatim");
    console.log("ok   8 genuine score 0 preserved (not treated as missing)");
  }

  // 9. Anomaly mask decoding (documented 4-bit mask).
  {
    if (decodeAnomalyFlags(0).length !== 0) fail("mask 0 must decode to no anomalies");
    if (decodeAnomalyFlags(3).join(",") !== "overturn-count,borderline-count")
      fail("mask 3 must decode bits 0+1");
    if (
      normalizeReputation({ ...FIXTURE_RAW, anomalyFlags: 8 }).anomalies.join(",") !==
      "extreme-pass-rate"
    ) {
      fail("bit 3 must decode to extreme-pass-rate");
    }
    console.log("ok   9 anomaly bit mask decodes per documented reputation.md");
  }

  // 10. agentId validity — uint256 strings only; never a wallet address.
  {
    if (!isValidAgentId("42") || isValidAgentId("0xabc") || isValidAgentId("")) {
      fail("agentId validity must accept uint256 strings only (never a 0x wallet address)");
    }
    console.log("ok   10 agentId validity (uint256 only; wallet address rejected)");
  }

  // 11. No secret exposure — presence-only env check; a NEXT_PUBLIC_ credential is forbidden.
  {
    const names = [
      "PRIVATE_KEY",
      "WALLET_PRIVATE_KEY",
      "MNEMONIC",
      "SEED_PHRASE",
      "TERMIX_API_KEY",
      "NEXT_PUBLIC_TERMIX_API_KEY",
    ];
    for (const name of names) {
      const present = process.env[name] !== undefined; // presence only — value never read/printed
      if (present && /NEXT_PUBLIC/.test(name))
        fail("a NEXT_PUBLIC_ TermiX credential must never be defined");
    }
    console.log("ok   11 no secret exposure (public read path; presence-only env check)");
  }

  console.log("TERMIX AACP WEB STATUS: READY FOR VERIFICATION (read-only reputation UI)");
  process.exitCode = 0;
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
