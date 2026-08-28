/**
 * X.131 — Main Track V2 production wiring verify harness (isolated, no tx).
 *
 * Covers the 20 required cases at the route + policy + integration boundary
 * with injected fakes. Run:
 *   node --experimental-strip-types lib/activation/main-track-v2.server.verify.ts
 */

import { composeV2CommercialAgreement } from "@bnb-marketplace/integrations/altana";
import type {
  V2Quote,
  V2QuoteVerdict,
  V2RegistryIdentity,
  V2HireOutcome,
} from "@bnb-marketplace/integrations/altana";
import { resolveExecutionCapability } from "./capability-source.ts";
import {
  MAIN_TRACK_MODEL_A,
  MAIN_TRACK_MODEL_B,
  resolveMainTrackCustody,
  runMainTrackHireOrFailClosed,
} from "./main-track-v2.ts";
import type {
  MainTrackFundedJobRead,
  MainTrackV2HirePorts,
} from "@bnb-marketplace/integrations/altana";
import { mainTrackHireApi } from "./main-track-hire.api.ts";
import type { Scan8004Agent } from "../eight004scan/types.ts";

const SELLER = "0xB0f7681668f916eEd97dA066D31aA295D34727c0";
const OTHER = "0x1111111111111111111111111111111111111111";
const BUYER = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const MP = "0xeb237fb12588eaff8b907B8b9C1f5349969bb98d";
const AGENT_ID = "97:0x8004A818BFB912233c491871b3d84c89A494BD9e:1906";
const COMMERCE = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE";
const TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565";
const PRICE = "1000000000000000000";
const ORIGIN = "http://localhost";
const CSRF = "0x" + "12".repeat(32);

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function quote(overrides: Partial<V2Quote> = {}): V2Quote {
  const now = nowSeconds();
  return {
    accepted: true,
    price: PRICE,
    currency: TOKEN,
    chainId: 97,
    verifyingContract: COMMERCE,
    negotiatedAt: now - 10,
    quoteExpiresAt: now + 600,
    negotiationHash: "0x" + "ab".repeat(32),
    providerSig: "0x" + "cd".repeat(65),
    ...overrides,
  };
}

function verdict(overrides: Partial<V2QuoteVerdict> = {}): V2QuoteVerdict {
  return { valid: true, method: "eip191", signer: SELLER, ...overrides };
}

function agreement(opts: { provider?: string; verdict?: V2QuoteVerdict; q?: V2Quote } = {}) {
  const identity: V2RegistryIdentity = {
    agentId: AGENT_ID,
    chainId: 97,
    isTestnet: true,
    ownerAddress: opts.provider ?? SELLER,
  };
  return composeV2CommercialAgreement({
    identity,
    sellerEndpoint: "https://seller.example.com/.well-known/agent-card.json",
    quote: opts.q ?? quote(),
    verdict: opts.verdict ?? verdict(),
    ctx: {
      expectedChainId: 97,
      expectedCommerce: COMMERCE,
      expectedPaymentToken: TOKEN,
      expectedPrice: PRICE,
      nowSeconds: nowSeconds(),
    },
  });
}

function negotiation(opts: { provider?: string; verdict?: V2QuoteVerdict; q?: V2Quote } = {}): {
  outcome: V2HireOutcome;
  quote: Record<string, unknown> | null;
} {
  const ag = agreement(opts);
  if (!ag.validation.ok) {
    return {
      outcome: {
        available: false,
        agentId: AGENT_ID,
        blocked: { stage: "validation", reason: ag.validation.reason ?? "invalid" },
      },
      quote: null,
    };
  }
  return {
    outcome: {
      available: true,
      agentId: AGENT_ID,
      agreement: ag,
      activationState: {
        actionable: false,
        state: "commercial-agreement-only",
        reason: "commercial only",
      },
      nextRequiredAction: "fund",
    },
    quote: { negotiation_hash: ag.negotiationHash, provider_sig: "0x" + "cd".repeat(65) },
  };
}

function fundedJob(): MainTrackFundedJobRead {
  return {
    jobId: "641",
    client: MP,
    provider: SELLER,
    budget: PRICE,
    expiredAt: String(nowSeconds() + 100000),
    status: 1,
    statusName: "FUNDED",
  };
}

function ports(overrides: Partial<MainTrackV2HirePorts> = {}): MainTrackV2HirePorts {
  return {
    resolveMarketplaceClient: async () => ({ address: MP, source: "loaded_keystore", chainId: 97 }),
    runCommercialNegotiation: async () => negotiation(),
    executeErc8183Hire: async () => ({
      jobId: "641",
      txHashes: {
        createJob: "0x1",
        registerJob: "0x2",
        setBudget: "0x3",
        approve: "0x4",
        fund: "0x5",
      },
      blockNumbers: { createJob: "1", registerJob: "2", setBudget: "3", approve: "4", fund: "5" },
    }),
    readJob: async () => fundedJob(),
    ...overrides,
  };
}

const CUSTODY_ENV = {
  MAIN_TRACK_CUSTODY_PROVIDER: "kms",
  MAIN_TRACK_CUSTODY_KEY_REFERENCE: "key-1",
};

function hireInput(
  overrides: Partial<Parameters<typeof runMainTrackHireOrFailClosed>[0]["hire"]> = {}
) {
  return {
    agentId: AGENT_ID,
    sellerAddress: SELLER,
    forbiddenClientAddress: BUYER,
    expectedChainId: 97,
    expectedCommerce: COMMERCE,
    expectedPaymentToken: TOKEN,
    expectedPrice: PRICE,
    request: {
      taskDescription: "deterministic report",
      terms: { deliverables: "JSON", qualityStandards: "deterministic" },
    },
    ...overrides,
  };
}

function agentRecord(overrides: Partial<Scan8004Agent> = {}): Scan8004Agent {
  return {
    id: "rec-1906",
    agent_id: AGENT_ID,
    token_id: "1906",
    chain_id: 97,
    chain_type: "evm",
    contract_address: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    is_testnet: true,
    owner_id: null,
    owner_address: SELLER,
    owner_ens: null,
    owner_username: null,
    owner_avatar_url: null,
    owner_publisher_tier: null,
    owner_certified_name: null,
    name: "BNB Agent Studio v2 Testnet Seller",
    description: "testnet seller",
    image_url: null,
    is_verified: true,
    star_count: 0,
    supported_protocols: ["A2A"],
    x402_supported: false,
    total_score: 0,
    rank: null,
    network_rank: null,
    health_score: null,
    total_feedbacks: 0,
    average_score: 0,
    cross_chain_versions: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function routeDeps(overrides: Partial<Parameters<typeof mainTrackHireApi>[0]["deps"]> = {}) {
  return {
    resolveAgent: async (agentId: string) => (agentId === AGENT_ID ? agentRecord() : null),
    resolveCustody: (env: Record<string, string | undefined>) => resolveMainTrackCustody(env),
    reviewForAgent: async () => null,
    runHire: runMainTrackHireOrFailClosed,
    ports: ports(),
    mapError: (error: unknown) => ({
      status: 409,
      message: error instanceof Error ? error.message : String(error),
    }),
    ...overrides,
  };
}

function req(body: unknown, { csrf = CSRF } = {}): Request {
  return new Request(`${ORIGIN}/api/activation/main-track-hire`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "sec-fetch-site": "same-origin",
      "x-csrf-token": csrf,
    },
    body: JSON.stringify(body),
  });
}

function identity() {
  return { userId: "u1", walletId: "w1", walletAddress: MP, role: "user" as const };
}

async function main(): Promise<void> {
  console.log("X.131 — MAIN TRACK V2 PRODUCTION WIRING VERIFY (isolated, no tx)");

  // 1. Unauthenticated Hire remains rejected.
  {
    const out = await mainTrackHireApi({
      identity: null,
      request: req({ action: "review", agentId: AGENT_ID }),
      csrfCookie: CSRF,
      expectedOrigin: ORIGIN,
      env: CUSTODY_ENV,
      deps: routeDeps(),
    });
    check("1. unauthenticated rejected", out.status === 401);
  }

  // 2. CSRF failure remains rejected.
  {
    const out = await mainTrackHireApi({
      identity: identity(),
      request: req({ action: "review", agentId: AGENT_ID }, { csrf: "0x" + "00".repeat(32) }),
      csrfCookie: CSRF,
      expectedOrigin: ORIGIN,
      env: CUSTODY_ENV,
      deps: routeDeps(),
    });
    check("2. csrf mismatch rejected", out.status === 403);
  }

  // 3. Wrong agent remains rejected.
  {
    const out = await mainTrackHireApi({
      identity: identity(),
      request: req({ action: "review", agentId: AGENT_ID }),
      csrfCookie: CSRF,
      expectedOrigin: ORIGIN,
      env: CUSTODY_ENV,
      deps: routeDeps({ resolveAgent: async () => null }),
    });
    check("3. wrong agent rejected", out.status === 404);
  }

  // 4. Wrong seller (integration) rejected.
  {
    const out = await runMainTrackHireOrFailClosed({
      env: CUSTODY_ENV,
      ports: ports({
        runCommercialNegotiation: async () =>
          negotiation({ provider: OTHER, verdict: verdict({ signer: OTHER }) }),
      }),
      hire: hireInput(),
    });
    check(
      "4. wrong seller blocked",
      out.ok === false && out.blocked.reason.includes("seller identity mismatch")
    );
  }

  // 5. Invalid providerSig rejected.
  {
    const out = await runMainTrackHireOrFailClosed({
      env: CUSTODY_ENV,
      ports: ports({
        runCommercialNegotiation: async () =>
          negotiation({
            verdict: verdict({ valid: false, reason: "provider signature is not valid" }),
          }),
      }),
      hire: hireInput(),
    });
    check("5. invalid providerSig blocked", out.ok === false);
  }

  // 6. Wrong chain rejected (route + integration).
  {
    const route = await mainTrackHireApi({
      identity: identity(),
      request: req({ action: "review", agentId: AGENT_ID }),
      csrfCookie: CSRF,
      expectedOrigin: ORIGIN,
      env: CUSTODY_ENV,
      deps: routeDeps({ resolveAgent: async () => agentRecord({ chain_id: 56 }) }),
    });
    check("6. wrong chain (route) rejected", route.status === 409);
    const integ = await runMainTrackHireOrFailClosed({
      env: CUSTODY_ENV,
      ports: ports({
        runCommercialNegotiation: async () => negotiation({ q: quote({ chainId: 56 }) }),
      }),
      hire: hireInput(),
    });
    check("6. wrong chain (integration) blocked", integ.ok === false);
  }

  // 7. Wrong commerce contract rejected.
  {
    const out = await runMainTrackHireOrFailClosed({
      env: CUSTODY_ENV,
      ports: ports({
        runCommercialNegotiation: async () =>
          negotiation({ q: quote({ verifyingContract: OTHER }) }),
      }),
      hire: hireInput(),
    });
    check("7. wrong commerce contract blocked", out.ok === false);
  }

  // 8. Wrong price rejected.
  {
    const out = await runMainTrackHireOrFailClosed({
      env: CUSTODY_ENV,
      ports: ports({
        runCommercialNegotiation: async () =>
          negotiation({ q: quote({ price: "2000000000000000000" }) }),
      }),
      hire: hireInput(),
    });
    check("8. wrong price blocked", out.ok === false);
  }

  // 9. Expired quote rejected.
  {
    const out = await runMainTrackHireOrFailClosed({
      env: CUSTODY_ENV,
      ports: ports({
        runCommercialNegotiation: async () =>
          negotiation({ q: quote({ quoteExpiresAt: nowSeconds() - 5 }) }),
      }),
      hire: hireInput(),
    });
    check("9. expired quote blocked", out.ok === false);
  }

  // 10. Endpoint unavailable rejected.
  {
    const out = await runMainTrackHireOrFailClosed({
      env: CUSTODY_ENV,
      ports: ports({
        runCommercialNegotiation: async () => ({
          outcome: {
            available: false,
            agentId: AGENT_ID,
            blocked: {
              stage: "negotiation",
              reason: "seller negotiation failed or endpoint unreachable",
            },
          },
          quote: null,
        }),
      }),
      hire: hireInput(),
    });
    check(
      "10. endpoint unavailable blocked",
      out.ok === false && out.blocked.reason.includes("endpoint unreachable")
    );
  }

  // 11. No wallet (custody) rejected.
  {
    const route = await mainTrackHireApi({
      identity: identity(),
      request: req({ action: "review", agentId: AGENT_ID }),
      csrfCookie: CSRF,
      expectedOrigin: ORIGIN,
      env: {},
      deps: routeDeps(),
    });
    check(
      "11. no wallet (route custody) rejected",
      route.status === 409 &&
        (route.body.error as { code?: string })?.code === "main-track-custody-required"
    );
    const integ = await runMainTrackHireOrFailClosed({
      env: CUSTODY_ENV,
      ports: ports({ resolveMarketplaceClient: async () => null }),
      hire: hireInput(),
    });
    check(
      "11. no wallet (integration) blocked",
      integ.ok === false && integ.blocked.reason.includes("marketplace wallet unavailable")
    );
  }

  // 12. User confirmation required.
  {
    const out = await mainTrackHireApi({
      identity: identity(),
      request: req({ action: "activate", agentId: AGENT_ID }),
      csrfCookie: CSRF,
      expectedOrigin: ORIGIN,
      env: CUSTODY_ENV,
      deps: routeDeps(),
    });
    check(
      "12. confirmation required",
      out.status === 409 && (out.body.error as { code?: string })?.code === "confirmation-required"
    );
  }

  // 13 + 14 + 15. Funded state is not ACTIVE; real job id + transaction evidence returned.
  {
    const out = await mainTrackHireApi({
      identity: identity(),
      request: req({ action: "activate", agentId: AGENT_ID, confirmed: true }),
      csrfCookie: CSRF,
      expectedOrigin: ORIGIN,
      env: CUSTODY_ENV,
      deps: routeDeps(),
    });
    check("13. funded status 201", out.status === 201);
    const data = out.body.data as Record<string, unknown>;
    check("13. funded state is not ACTIVE", data.state === "funded" && data.active === false);
    check(
      "13. activationState funded-commercial-hire",
      (data.activationState as { state: string })?.state === "funded-commercial-hire"
    );
    check("14. real job id returned", data.jobId === "641");
    check(
      "15. transaction evidence returned",
      typeof (data.txHashes as Record<string, unknown>)?.fund === "string"
    );
  }

  // 16. Job 622 cannot be reused.
  {
    const out = await runMainTrackHireOrFailClosed({
      env: CUSTODY_ENV,
      ports: ports(),
      hire: hireInput({ historicalEvidence: { jobId: "622", status: "COMPLETED" } }),
    });
    check("16. job622 historical allowed as evidence", out.ok === true);
    if (out.ok) check("16. job622 not reused as new hire", out.jobId !== "622");
  }

  // 17. X.76 Model A remains unchanged (no provider → null).
  {
    const cap = await resolveExecutionCapability({ agentId: AGENT_ID });
    check("17. Model A unchanged (capability null without provider)", cap === null);
    check(
      "17. Model A constant",
      MAIN_TRACK_MODEL_A === "model-a-x76-verified-execution-capability"
    );
  }

  // 18. Main Track V2 is explicitly Model B.
  {
    const out = await mainTrackHireApi({
      identity: identity(),
      request: req({ action: "activate", agentId: AGENT_ID, confirmed: true }),
      csrfCookie: CSRF,
      expectedOrigin: ORIGIN,
      env: CUSTODY_ENV,
      deps: routeDeps(),
    });
    check(
      "18. response policy is Model B",
      (out.body.data as { policy?: string })?.policy === MAIN_TRACK_MODEL_B
    );
    check("18. Model B constant", MAIN_TRACK_MODEL_B === "model-b-v2-commercial-agreement");
  }

  // 19 + 20. No secret / no private key in API response.
  {
    const out = await mainTrackHireApi({
      identity: identity(),
      request: req({ action: "activate", agentId: AGENT_ID, confirmed: true }),
      csrfCookie: CSRF,
      expectedOrigin: ORIGIN,
      env: CUSTODY_ENV,
      deps: routeDeps(),
    });
    const serialized = JSON.stringify(out.body);
    const secretPattern =
      /private[_ ]?key|mnemonic|seed phrase|wallet_password|MARKETPLACE_WALLET_PASSWORD/i;
    check("19. no secret in API response", !secretPattern.test(serialized));
    check(
      "20. no private key in response",
      !/0x[0-9a-f]{64}/i.test(serialized) && !secretPattern.test(serialized)
    );
  }

  // Custody resolver: fail-closed and never returns a raw key.
  {
    const none = resolveMainTrackCustody({});
    check(
      "custody: unavailable when unprovisioned",
      none.available === false && none.reason.includes("no server-held raw private keys")
    );
    const unsafe = resolveMainTrackCustody({
      MAIN_TRACK_CUSTODY_PROVIDER: "raw-key",
      MAIN_TRACK_CUSTODY_KEY_REFERENCE: "0x1234",
    });
    check("custody: raw-key provider rejected", unsafe.available === false);
    const safe = resolveMainTrackCustody(CUSTODY_ENV);
    check("custody: kms accepted", safe.available === true && safe.provider === "kms");
  }

  if (failures === 0) {
    console.log("X.131 main-track-v2 server verify: ALL CHECKS PASSED");
  } else {
    console.error(`X.131 main-track-v2 server verify: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

void main();
