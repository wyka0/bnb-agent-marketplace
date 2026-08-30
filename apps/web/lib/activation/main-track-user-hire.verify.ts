/**
 * X.149 — production browser-wallet Main Track Hire verify harness.
 *
 * Framework-free (plain node): `node --experimental-strip-types
 * lib/activation/main-track-user-hire.verify.ts`.
 *
 * Covers: prepare (all rejection modes), wallet execution (success, rejection
 * per step, wrong chain, per-step receipt failure, no rebroadcast), final
 * verification (all mismatch modes), mandated error UX, historical-job
 * protection, no private key / no server signing / no sendRawTransaction / no
 * ACTIVE fabrication.
 */

import {
  MAIN_TRACK_COMMERCE,
  MAIN_TRACK_ROUTER,
  MAIN_TRACK_PAYMENT_TOKEN,
  createMainTrackNetworkConfig,
} from "@bnb-marketplace/integrations/altana";
import {
  MAIN_TRACK_USER_HIRE_STATES,
  MAIN_TRACK_USER_HIRE_CALLS,
  prepareMainTrackUserHire,
  runMainTrackUserHireFromWallet,
  verifyMainTrackUserHireFinalState,
  mainTrackUserHireErrorMessage,
} from "./main-track-user-hire.ts";
import type {
  MainTrackLiveQuote,
  MainTrackUserHirePlan,
  MainTrackUserHireExpectations,
  MainTrackUserHireJobRead,
  MainTrackUserHirePrepareOutcome,
} from "./main-track-user-hire.ts";
import {
  verifyMainTrackUserHireFunded,
  type MainTrackUserHireFundedVerifyPorts,
  type MainTrackSdkJobRead,
} from "./main-track-user-hire.server.ts";
import { prepareLiveAgentHire } from "./main-track-negotiation.server.ts";
import {
  resolveServiceEndpointFromCard,
  decodeAgentCard,
} from "./main-track-negotiation.server.ts";
import type { LiveAgentHirePorts } from "./main-track-negotiation.server.ts";
import type { Scan8004Agent } from "../eight004scan/types.ts";
import { readFileSync } from "node:fs";

const SELLER = "0xB0f7681668f916eEd97dA066D31aA295D34727c0";
const OTHER = "0x1111111111111111111111111111111111111111";
const USER = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const AGENT_ID = "97:0x8004A818BFB912233c491871b3d84c89A494BD9e:1906";
const PRICE = "1000000000000000000";
const AGENT2005 = "97:0x8004A818BFB912233c491871b3d84c89A494BD9e:2005";
const OWNER2005 = "0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a";
const HISTORY = ["622", "641", "646", "648", "649", "650", "651", "652", "653"];

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

function liveQuote(overrides: Partial<MainTrackLiveQuote> = {}): MainTrackLiveQuote {
  const now = nowSeconds();
  return {
    request: {
      task_description:
        "Produce a deterministic BSC testnet grid-strategy report; no trading or transaction execution.",
    },
    response: {
      accepted: true,
      terms: {
        price: PRICE,
        currency: MAIN_TRACK_PAYMENT_TOKEN,
        deliverables: "JSON analysis report",
        quality_standards: "Deterministic output",
        success_criteria: ["valid JSON", "chain 97 only"],
      },
      quote_expires_at: now + 600,
      negotiated_at: now - 10,
    },
    negotiation_hash: "0x" + "ab".repeat(32),
    provider_sig: "0x" + "cd".repeat(65),
    chain_id: 97,
    verifying_contract: MAIN_TRACK_COMMERCE,
    ...overrides,
  };
}

function prepareInput(
  overrides: Partial<{
    quote: MainTrackLiveQuote;
    verifiedSigner: string;
    description: string;
    nextJobId: bigint;
    historyJobIds: readonly string[];
    nowSeconds: number;
  }> = {}
) {
  const quote = overrides.quote ?? liveQuote();
  return {
    agentId: AGENT_ID,
    quote,
    description:
      overrides.description ??
      JSON.stringify({
        version: 1,
        chain_id: 97,
        currency: MAIN_TRACK_PAYMENT_TOKEN,
        price: String(quote.response.terms.price),
        task: quote.request?.task_description ?? "task",
      }),
    verifiedSigner: overrides.verifiedSigner ?? SELLER,
    nextJobId: overrides.nextJobId ?? 900n,
    historyJobIds: overrides.historyJobIds ?? HISTORY,
    nowSeconds: overrides.nowSeconds ?? nowSeconds(),
  };
}

function planFromPrepare(): {
  plan: MainTrackUserHirePlan;
  expectations: MainTrackUserHireExpectations;
} {
  const prep = prepareMainTrackUserHire(prepareInput());
  if (!prep.ok) throw new Error("prepare failed: " + prep.reason);
  return {
    plan: {
      chainId: prep.chainId,
      client: "",
      provider: prep.seller.toLowerCase(),
      budget: prep.price,
      jobId: prep.jobId,
      expiredAt: prep.expiredAt,
      calls: prep.calls,
    },
    expectations: prep.expectations,
  };
}

/** Mock live-agent Hire ports (deterministic; mirrors a discovered seller). */
function livePorts(
  opts: {
    endpoint?: string | null;
    reason?: string;
    quote?: MainTrackLiveQuote | null;
    verify?: { valid: boolean; signer: string; reason?: string };
    nextJobId?: bigint | null;
    resolveCalls?: string[];
  } = {}
): LiveAgentHirePorts {
  const resolveCalls = opts.resolveCalls ?? [];
  return {
    resolveEndpoint: async (agentId) => {
      resolveCalls.push(agentId);
      return opts.endpoint === undefined
        ? { endpoint: "https://range-keeper.103-195-188-198.sslip.io/erc8183" }
        : { endpoint: opts.endpoint, reason: opts.reason };
    },
    negotiate: async () => (opts.quote === undefined ? liveQuote() : opts.quote),
    verifyQuote: async (quote, owner) =>
      opts.verify ?? {
        valid: true,
        signer: quote ? owner : SELLER,
        reason: undefined,
      },
    nextJobId: async () => (opts.nextJobId === undefined ? 900n : opts.nextJobId),
  };
}

/** Mock EIP-1193 wallet. Records sends; can reject/fail at a given send index. */
function mockWallet(
  opts: {
    chainId?: number;
    accounts?: string[];
    rejectSendAt?: number;
    failSendAt?: number;
    malformedHash?: boolean;
  } = {}
) {
  const sends: Array<{ from: string; to: string; data: string; value: string; chainId: string }> =
    [];
  const request: (method: string, params: unknown[]) => Promise<unknown> = async (
    method,
    params
  ) => {
    if (method === "eth_requestAccounts") return opts.accounts ?? [USER];
    if (method === "eth_chainId") return `0x${(opts.chainId ?? 97).toString(16)}`;
    if (method === "eth_sendTransaction") {
      const tx = (params[0] ?? {}) as {
        from: string;
        to: string;
        data: string;
        value: string;
        chainId: string;
      };
      sends.push(tx);
      const index = sends.length;
      if (opts.rejectSendAt === index) throw new Error("user rejected transaction");
      if (opts.failSendAt === index) throw new Error("rpc error: execution reverted");
      return opts.malformedHash ? "" : "0x" + "ab".repeat(32);
    }
    return null;
  };
  return { request, sends };
}

function fundedJobRead(
  overrides: Partial<MainTrackUserHireJobRead> = {}
): MainTrackUserHireJobRead {
  return {
    jobId: "900",
    client: USER.toLowerCase(),
    provider: SELLER.toLowerCase(),
    budget: PRICE,
    status: 1,
    statusName: "FUNDED",
    submittedAt: "0",
    deliverable: "0x" + "00".repeat(32),
    ...overrides,
  };
}

// --- X.167 fixtures: read-only server-path verification (offline ports) ----

function fundedJobFixture(overrides: Partial<Record<string, unknown>> = {}): MainTrackSdkJobRead {
  return {
    id: 900n,
    client: USER,
    provider: SELLER,
    budget: BigInt(PRICE),
    status: 1,
    statusName: "FUNDED",
    submittedAt: 0n,
    deliverable: "0x" + "00".repeat(32),
    ...overrides,
  } as MainTrackSdkJobRead;
}

function agentFixture(overrides: Partial<Scan8004Agent> = {}): Scan8004Agent {
  return {
    id: "2005",
    agent_id: AGENT2005,
    token_id: "2005",
    chain_id: 97,
    chain_type: "evm",
    contract_address: MAIN_TRACK_COMMERCE,
    is_testnet: true,
    owner_id: "owner-1",
    owner_address: SELLER,
    owner_ens: null,
    owner_username: null,
    owner_avatar_url: null,
    owner_publisher_tier: null,
    owner_certified_name: null,
    name: "Canned Range Keeper",
    description: null,
    image_url: null,
    is_verified: true,
    star_count: 0,
    supported_protocols: [],
    x402_supported: false,
    total_score: 0,
    rank: null,
    network_rank: null,
    health_score: null,
    total_feedbacks: 0,
    average_score: 0,
    cross_chain_versions: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const QUOTE_UNAVAILABLE = { ok: false, reason: "endpoint unreachable" } as const;

function fundedVerifyPorts(
  overrides: Partial<MainTrackUserHireFundedVerifyPorts> = {}
): MainTrackUserHireFundedVerifyPorts {
  return {
    readPaymentToken: async () => MAIN_TRACK_PAYMENT_TOKEN,
    readJob: async () => fundedJobFixture(),
    negotiate: async () => QUOTE_UNAVAILABLE as unknown as MainTrackUserHirePrepareOutcome,
    ...overrides,
  };
}

function fundedVerifyInput(
  overrides: Partial<{
    jobId: string;
    walletAddress: string;
    agent: Scan8004Agent;
    expectedBudget: string;
  }> = {}
) {
  return {
    jobId: "900",
    walletAddress: USER,
    agent: agentFixture(),
    expectedBudget: PRICE,
    ...overrides,
  };
}

async function main(): Promise<void> {
  console.log("X.149 — PRODUCTION MAIN TRACK USER HIRE VERIFY (mocked EIP-1193, no tx)");

  // 1. Prepare (quote-driven): success binds the quote's provider/price/expiry.
  {
    const out = prepareMainTrackUserHire(prepareInput());
    check("1. prepare success", out.ok === true);
    if (out.ok) {
      check("1. policy Model B", out.policy === "model-b-v2-commercial-agreement");
      check("1. jobId fresh not historical", !HISTORY.includes(out.jobId));
      check("1. price bound to the quote (1 U)", out.price === PRICE);
      check(
        "1. provider bound to the verified signer",
        out.seller.toLowerCase() === SELLER.toLowerCase()
      );
      check("1. chain 97", out.chainId === 97);
      check(
        "1. 5 allowlisted calls",
        out.calls.length === 5 &&
          out.calls.every((c) =>
            [MAIN_TRACK_COMMERCE, MAIN_TRACK_ROUTER, MAIN_TRACK_PAYMENT_TOKEN].some(
              (a) => a.toLowerCase() === c.to.toLowerCase()
            )
          )
      );
      check(
        "1. user-controlled wallet review",
        out.review.userControlledWallet === true &&
          out.review.whatWillHappen.includes("never receives your private key")
      );
    }
    // Dynamic price (Agent 2005 quotes 0.001 U): the plan must bind it, not 1 U.
    const dynamic = prepareMainTrackUserHire(
      prepareInput({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: "1000000000000000", currency: MAIN_TRACK_PAYMENT_TOKEN },
            quote_expires_at: nowSeconds() + 600,
            negotiated_at: nowSeconds() - 5,
          },
        }),
      })
    );
    check(
      "1. dynamic quote price is bound (0.001 U, not 1 U)",
      dynamic.ok === true &&
        dynamic.ok &&
        dynamic.price === "1000000000000000" &&
        dynamic.review.price === "0.001 U"
    );
  }

  // 2. Prepare: rejections (quote-driven).
  {
    const wrongChain = prepareMainTrackUserHire(
      prepareInput({ quote: liveQuote({ chain_id: 56 }) })
    );
    check(
      "2. wrong chain rejected",
      wrongChain.ok === false && /chain 97/.test(wrongChain.reason ?? "")
    );
    const wrongCommerce = prepareMainTrackUserHire(
      prepareInput({ quote: liveQuote({ verifying_contract: OTHER }) })
    );
    check(
      "2. wrong commerce rejected",
      wrongCommerce.ok === false && /commerce/.test(wrongCommerce.reason ?? "")
    );
    const wrongToken = prepareMainTrackUserHire(
      prepareInput({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: PRICE, currency: OTHER },
            quote_expires_at: nowSeconds() + 600,
            negotiated_at: nowSeconds() - 5,
          },
        }),
      })
    );
    check(
      "2. wrong payment token rejected",
      wrongToken.ok === false && /token/.test(wrongToken.reason ?? "")
    );
    const badPrice = prepareMainTrackUserHire(
      prepareInput({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: "not-a-number", currency: MAIN_TRACK_PAYMENT_TOKEN },
            quote_expires_at: nowSeconds() + 600,
            negotiated_at: nowSeconds() - 5,
          },
        }),
      })
    );
    check("2. malformed price rejected", badPrice.ok === false);
    const expired = prepareMainTrackUserHire(
      prepareInput({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: PRICE, currency: MAIN_TRACK_PAYMENT_TOKEN },
            quote_expires_at: nowSeconds() - 5,
            negotiated_at: nowSeconds() - 60,
          },
        }),
      })
    );
    check(
      "2. expired quote rejected",
      expired.ok === false && /expired/.test(expired.reason ?? "")
    );
    const historic = prepareMainTrackUserHire(prepareInput({ nextJobId: 622n }));
    check(
      "2. historical job id rejected",
      historic.ok === false && /historical/.test(historic.reason ?? "")
    );
    const historic2 = prepareMainTrackUserHire(prepareInput({ nextJobId: 641n }));
    check("2. job 641 cannot be reused", historic2.ok === false);
  }

  // 2b. Dynamic live-agent path (prepareLiveAgentHire with injected ports).
  {
    // Agent 2005 accepted: real owner + endpoint + quote price + verified sig.
    const okOut = await prepareLiveAgentHire({
      agentId: AGENT2005,
      ownerAddress: OWNER2005,
      historyJobIds: HISTORY,
      nowSeconds: nowSeconds(),
      ports: livePorts({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: "1000000000000000", currency: MAIN_TRACK_PAYMENT_TOKEN },
            quote_expires_at: nowSeconds() + 600,
            negotiated_at: nowSeconds() - 5,
          },
        }),
        verify: { valid: true, signer: OWNER2005 },
      }),
    });
    check("2b. Agent 2005 accepted", okOut.ok === true);
    if (okOut.ok) {
      check("2b. owner used as provider", okOut.seller.toLowerCase() === OWNER2005.toLowerCase());
      check("2b. actual quote price used", okOut.price === "1000000000000000");
      check("2b. review shows actual price", okOut.review.price === "0.001 U");
    }
    // Wrong owner: signature verification rejects the registered-owner mismatch.
    const wrongOwner = await prepareLiveAgentHire({
      agentId: AGENT2005,
      ownerAddress: OTHER,
      historyJobIds: HISTORY,
      nowSeconds: nowSeconds(),
      ports: livePorts({
        verify: { valid: false, signer: OTHER, reason: "verifying_contract mismatch" },
      }),
    });
    check(
      "2b. wrong owner rejected",
      wrongOwner.ok === false &&
        /signature|verifying_contract|invalid/.test(wrongOwner.reason ?? "")
    );
    // Fabricated provider: signer does not match the registered owner.
    const fabricated = await prepareLiveAgentHire({
      agentId: AGENT2005,
      ownerAddress: OWNER2005,
      historyJobIds: HISTORY,
      nowSeconds: nowSeconds(),
      ports: livePorts({ verify: { valid: true, signer: OTHER } }),
    });
    check(
      "2b. fabricated provider rejected",
      fabricated.ok === false && /signature/.test(fabricated.reason ?? "")
    );
    // Endpoint unavailable.
    const noEndpoint = await prepareLiveAgentHire({
      agentId: AGENT2005,
      ownerAddress: OWNER2005,
      historyJobIds: HISTORY,
      nowSeconds: nowSeconds(),
      ports: livePorts({ endpoint: null, reason: "agent card has no HTTP A2A endpoint" }),
    });
    check(
      "2b. endpoint unavailable rejected",
      noEndpoint.ok === false && /endpoint/.test(noEndpoint.reason ?? "")
    );
    // Negotiation unavailable.
    const noQuote = await prepareLiveAgentHire({
      agentId: AGENT2005,
      ownerAddress: OWNER2005,
      historyJobIds: HISTORY,
      nowSeconds: nowSeconds(),
      ports: livePorts({ quote: null }),
    });
    check(
      "2b. negotiation unavailable rejected",
      noQuote.ok === false && /negotiation|endpoint/.test(noQuote.reason ?? "")
    );
    // Historical job id from the live nextJobId.
    const historicalNext = await prepareLiveAgentHire({
      agentId: AGENT2005,
      ownerAddress: OWNER2005,
      historyJobIds: HISTORY,
      nowSeconds: nowSeconds(),
      ports: livePorts({ nextJobId: 622n }),
    });
    check(
      "2b. historical job id rejected (live path)",
      historicalNext.ok === false && /historical/.test(historicalNext.reason ?? "")
    );
    // No hardcoded seller / price: Agent 1906 (dead endpoint) is not required.
    const agent1906 = await prepareLiveAgentHire({
      agentId: AGENT_ID,
      ownerAddress: SELLER,
      historyJobIds: HISTORY,
      nowSeconds: nowSeconds(),
      ports: livePorts({ endpoint: null, reason: "agent card has no HTTP A2A endpoint" }),
    });
    check(
      "2b. Agent 1906 (dead endpoint) does not block dynamic hire",
      agent1906.ok === false && /endpoint/.test(agent1906.reason ?? "")
    );
  }

  // 2c. X.162: Agent Card → ERC-8183 endpoint resolution (pure, read-only).
  {
    const erc8183 = resolveServiceEndpointFromCard({
      services: [
        {
          name: "ERC-8183",
          endpoint: "https://range-keeper.103-195-188-198.sslip.io/erc8183",
          version: "v1",
        },
      ],
    });
    check(
      "2c. ERC-8183 service endpoint resolved (not A2A-only)",
      erc8183.endpoint === "https://range-keeper.103-195-188-198.sslip.io/erc8183"
    );
    const a2a = resolveServiceEndpointFromCard({
      services: [{ name: "A2A", endpoint: "https://a2a.example.com/erc8183" }],
    });
    check("2c. A2A service endpoint resolved", a2a.endpoint === "https://a2a.example.com/erc8183");
    const webFallback = resolveServiceEndpointFromCard({
      services: [{ name: "Web", endpoint: "https://web.example.com/erc8183" }],
    });
    check(
      "2c. other HTTPS registered service resolved (fallback)",
      webFallback.endpoint === "https://web.example.com/erc8183"
    );
    check(
      "2c. http:// (non-HTTPS) rejected",
      resolveServiceEndpointFromCard({
        services: [{ name: "ERC-8183", endpoint: "http://range-keeper.example" }],
      }).endpoint === null
    );
    check(
      "2c. arbitrary/non-http scheme rejected",
      resolveServiceEndpointFromCard({
        services: [{ name: "ERC-8183", endpoint: "ftp://x.example" }],
      }).endpoint === null
    );
    check(
      "2c. no services -> fail closed",
      resolveServiceEndpointFromCard({ services: [] }).endpoint === null
    );
    check("2c. null card -> fail closed", resolveServiceEndpointFromCard(null).endpoint === null);
    check(
      "2c. no endpoint key -> fail closed",
      resolveServiceEndpointFromCard({ services: [{ name: "ERC-8183" }] }).endpoint === null
    );
    // The real Agent 2005 on-chain card (base64 data URI) decodes to the service.
    const realCard = decodeAgentCard(
      "data:application/json;base64," +
        Buffer.from(
          JSON.stringify({
            name: "Canned Range Keeper",
            services: [
              {
                name: "ERC-8183",
                endpoint: "https://range-keeper.103-195-188-198.sslip.io/erc8183",
              },
            ],
          }),
          "utf8"
        ).toString("base64")
    );
    const real = resolveServiceEndpointFromCard(realCard);
    check(
      "2c. Agent 2005 card decodes to ERC-8183 endpoint",
      real.endpoint === "https://range-keeper.103-195-188-198.sslip.io/erc8183"
    );
  }

  // 3. Plan validation: wrong policy / wrong target / invalid calldata / wrong price.
  {
    const { plan, expectations } = planFromPrepare();
    const wrongPolicy = {
      ...plan,
      calls: plan.calls.map((c, i) => (i === 1 ? { ...c, to: OTHER.toLowerCase() } : c)),
    };
    const out1 = await runMainTrackUserHireFromWallet({
      request: mockWallet().request,
      plan: wrongPolicy,
      expectations,
      confirmStep: async () => true,
    });
    check(
      "3. wrong target/policy blocked",
      out1.ok === false && out1.reason.includes("non-allowlisted")
    );
    const wrongCalldata = {
      ...plan,
      calls: plan.calls.map((c, i) => (i === 3 ? { ...c, data: "0x" } : c)),
    };
    const out2 = await runMainTrackUserHireFromWallet({
      request: mockWallet().request,
      plan: wrongCalldata,
      expectations,
      confirmStep: async () => true,
    });
    check("3. invalid calldata blocked", out2.ok === false);
    const wrongPrice = {
      ...plan,
      budget: "2000000000000000000",
    };
    const out3 = await runMainTrackUserHireFromWallet({
      request: mockWallet().request,
      plan: wrongPrice,
      expectations,
      confirmStep: async () => true,
    });
    check("3. wrong price blocked", out3.ok === false);
    const wrongCommerce = {
      ...plan,
      calls: plan.calls.map((c, i) => (i === 0 ? { ...c, to: OTHER.toLowerCase() } : c)),
    };
    const out4 = await runMainTrackUserHireFromWallet({
      request: mockWallet().request,
      plan: wrongCommerce,
      expectations,
      confirmStep: async () => true,
    });
    check("3. wrong commerce blocked", out4.ok === false);
    const wrongToken = {
      ...plan,
      calls: plan.calls.map((c, i) => (i === 3 ? { ...c, to: OTHER.toLowerCase() } : c)),
    };
    const out5 = await runMainTrackUserHireFromWallet({
      request: mockWallet().request,
      plan: wrongToken,
      expectations,
      confirmStep: async () => true,
    });
    check("3. wrong token blocked", out5.ok === false);
  }

  // 4. Wallet: successful complete sequence (5 sends, per-step receipt ok, no nonce/gas in tx).
  {
    const { plan, expectations } = planFromPrepare();
    const mock = mockWallet();
    const out = await runMainTrackUserHireFromWallet({
      request: mock.request,
      plan,
      expectations,
      confirmStep: async () => true,
      verifyStep: async () => ({ ok: true }),
      receiptMaxAttempts: 2,
      receiptIntervalMs: 1,
    });
    check("4. successful complete sequence", out.ok === true);
    if (out.ok) {
      check(
        "4. five tx hashes returned",
        MAIN_TRACK_USER_HIRE_CALLS.every((s) => typeof out.txHashes[s] === "string")
      );
      check("4. wallet is the client", out.wallet.toLowerCase() === USER.toLowerCase());
    }
    check("4. exactly 5 sends", mock.sends.length === 5);
    check(
      "4. sends omit nonce/gas (wallet-owned)",
      mock.sends.every((t) => !("nonce" in t) && !("gas" in t) && t.chainId === "0x61")
    );
  }

  // 5. Wallet: wrong chain.
  {
    const { plan, expectations } = planFromPrepare();
    const out = await runMainTrackUserHireFromWallet({
      request: mockWallet({ chainId: 56 }).request,
      plan,
      expectations,
      confirmStep: async () => true,
    });
    check("5. wrong chain blocked", out.ok === false && /wrong chain/.test(out.reason ?? ""));
  }

  // 6. Wallet: user rejection at each step -> cancelled, no later sends.
  {
    for (let at = 1; at <= 5; at += 1) {
      const { plan, expectations } = planFromPrepare();
      const mock = mockWallet({ rejectSendAt: at });
      const out = await runMainTrackUserHireFromWallet({
        request: mock.request,
        plan,
        expectations,
        confirmStep: async () => true,
      });
      check(
        `6. wallet rejection at step ${at} -> cancelled, ${at} send(s)`,
        out.ok === false &&
          out.state === "cancelled" &&
          mock.sends.length === at &&
          out.step === MAIN_TRACK_USER_HIRE_CALLS[at - 1]
      );
    }
  }

  // 7. Wallet: pre-step confirmation rejection -> cancelled with NO sends.
  {
    const { plan, expectations } = planFromPrepare();
    const mock = mockWallet();
    const out = await runMainTrackUserHireFromWallet({
      request: mock.request,
      plan,
      expectations,
      confirmStep: async () => false,
    });
    check(
      "7. confirm-step reject -> cancelled, zero sends",
      out.ok === false && out.state === "cancelled" && mock.sends.length === 0
    );
  }

  // 8. Wallet: each step failure -> failed, no further sends, no rebroadcast.
  {
    for (let at = 1; at <= 5; at += 1) {
      const { plan, expectations } = planFromPrepare();
      const mock = mockWallet({ failSendAt: at });
      const out = await runMainTrackUserHireFromWallet({
        request: mock.request,
        plan,
        expectations,
        confirmStep: async () => true,
      });
      check(
        `8. step ${at} failure -> failed, ${at} send(s), no rebroadcast`,
        out.ok === false && out.state === "failed" && mock.sends.length === at
      );
    }
  }

  // 9. Wallet: per-step receipt failure -> STOP, no later step, no rebroadcast.
  {
    for (let at = 1; at <= 5; at += 1) {
      const { plan, expectations } = planFromPrepare();
      const mock = mockWallet();
      const out = await runMainTrackUserHireFromWallet({
        request: mock.request,
        plan,
        expectations,
        confirmStep: async () => true,
        verifyStep: async (_hash, step) =>
          step === MAIN_TRACK_USER_HIRE_CALLS[at - 1]
            ? { ok: false, fatal: true, reason: "receipt reverted" }
            : { ok: true },
        receiptMaxAttempts: 1,
      });
      check(
        `9. step ${at} receipt failure -> STOP at ${at} sends, no rebroadcast`,
        out.ok === false && out.state === "failed" && mock.sends.length === at
      );
    }
  }

  // 10. Wallet: receipt timeout -> failed, stops after first step, no rebroadcast.
  {
    const { plan, expectations } = planFromPrepare();
    const mock = mockWallet();
    const out = await runMainTrackUserHireFromWallet({
      request: mock.request,
      plan,
      expectations,
      confirmStep: async () => true,
      verifyStep: async () => ({ ok: false }),
      receiptMaxAttempts: 2,
      receiptIntervalMs: 1,
    });
    check(
      "10. receipt timeout -> failed at createJob, no rebroadcast",
      out.ok === false && out.state === "failed" && mock.sends.length === 1
    );
  }

  // 11. Final verification: success.
  {
    const out = verifyMainTrackUserHireFinalState({
      jobId: "900",
      job: fundedJobRead(),
      expectedClient: USER.toLowerCase(),
      expectedProvider: SELLER.toLowerCase(),
      expectedToken: MAIN_TRACK_PAYMENT_TOKEN,
      expectedBudget: PRICE,
    });
    check("11. final verification success", out.ok === true);
    if (out.ok) {
      check(
        "11. funded-commercial-hire + active false",
        out.activationState.state === "funded-commercial-hire" && out.active === false
      );
    }
  }

  // 12. Final verification: mismatches.
  {
    const base = {
      jobId: "900",
      expectedClient: USER.toLowerCase(),
      expectedProvider: SELLER.toLowerCase(),
      expectedToken: MAIN_TRACK_PAYMENT_TOKEN,
      expectedBudget: PRICE,
    };
    const notFound = verifyMainTrackUserHireFinalState({ ...base, job: null });
    check("12. job not found", notFound.ok === false);
    const notFunded = verifyMainTrackUserHireFinalState({
      ...base,
      job: fundedJobRead({ status: 0, statusName: "OPEN" }),
    });
    check(
      "12. not funded blocked",
      notFunded.ok === false && /FUNDED/.test(notFunded.reason ?? "")
    );
    const wrongClient = verifyMainTrackUserHireFinalState({
      ...base,
      job: fundedJobRead({ client: OTHER.toLowerCase() }),
    });
    check("12. client mismatch blocked", wrongClient.ok === false);
    const wrongProvider = verifyMainTrackUserHireFinalState({
      ...base,
      job: fundedJobRead({ provider: OTHER.toLowerCase() }),
    });
    check("12. provider mismatch blocked", wrongProvider.ok === false);
    const wrongBudget = verifyMainTrackUserHireFinalState({
      ...base,
      job: fundedJobRead({ budget: "2000000000000000000" }),
    });
    check("12. budget mismatch blocked", wrongBudget.ok === false);
    const submitted = verifyMainTrackUserHireFinalState({
      ...base,
      job: fundedJobRead({ submittedAt: "1787000000" }),
    });
    check("12. already submitted blocked", submitted.ok === false);
    const deliverable = verifyMainTrackUserHireFinalState({
      ...base,
      job: fundedJobRead({ deliverable: "0x" + "11".repeat(32) }),
    });
    check("12. non-zero deliverable blocked", deliverable.ok === false);
  }

  // 13. Error UX strings.
  {
    check(
      "13. cancelled copy",
      mainTrackUserHireErrorMessage({
        state: "cancelled",
        step: "fund",
        reason: "user rejected transaction",
      }) === "Hire cancelled — no further transaction was submitted."
    );
    check(
      "13. insufficient funds copy",
      mainTrackUserHireErrorMessage({
        state: "failed",
        step: "fund",
        reason: "insufficient balance",
      }) === "Insufficient testnet funds to complete this Hire."
    );
    check(
      "13. receipt copy",
      mainTrackUserHireErrorMessage({
        state: "failed",
        step: "createJob",
        reason: "receipt not confirmed (timeout)",
      }) === "Hire stopped while verifying the transaction. No rebroadcast was attempted."
    );
    check(
      "13. rpc copy",
      mainTrackUserHireErrorMessage({
        state: "failed",
        step: "createJob",
        reason: "rpc error: failed to decode",
      }) === "Network verification failed. Your transaction was not retried."
    );
    check(
      "13. created-but-unverified copy",
      mainTrackUserHireErrorMessage({
        state: "verify-failed",
        step: "fund",
        reason: "job not FUNDED",
      }) ===
        "Job created, but Hire could not be safely completed. No additional transaction was submitted."
    );
    check(
      "13. generic copy",
      mainTrackUserHireErrorMessage({ state: "failed", step: "approve", reason: "boom" }) ===
        "Hire stopped safely. No later Hire step was submitted."
    );
  }

  // 14. State machine completeness.
  {
    const required = [
      "idle",
      "pending",
      "negotiating",
      "quote-verified",
      "confirmation-required",
      "creating-job",
      "registering",
      "setting-budget",
      "approving",
      "funding",
      "verifying",
      "funded-commercial-hire",
      "failed",
      "cancelled",
    ];
    check(
      "14. explicit state machine",
      required.every((s) =>
        MAIN_TRACK_USER_HIRE_STATES.includes(s as (typeof MAIN_TRACK_USER_HIRE_STATES)[number])
      )
    );
  }

  // 15. No-broadcast invariant + no ACTIVE fabrication in production code.
  {
    const { readFileSync } = await import("node:fs");
    const files = [
      "C:/bnb-agent-marketplace/apps/web/lib/activation/main-track-user-hire.ts",
      "C:/bnb-agent-marketplace/apps/web/lib/activation/main-track-hire.api.ts",
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      check(
        `15. no eth_sendRawTransaction invocation in ${f.split("/").pop()}`,
        !/eth_sendRawTransaction\(|\.sendRawTransaction\(/.test(src)
      );
      check(
        `15. no ACTIVE fabrication in ${f.split("/").pop()}`,
        !/"active"\s*:\s*true/.test(src) &&
          !/state\s*:\s*"ACTIVE"/.test(src) &&
          !/activationState.*state:\s*"active"/i.test(src)
      );
      check(
        `15. no private key handling in ${f.split("/").pop()}`,
        !/privateKey\b|fromPrivateKey|signTransaction\(|eth_sign\(|seedPhrase|PRIVATE_KEY|walletPassword|WALLET_PASSWORD/i.test(
          src
        )
      );
    }
  }

  // 16. X.165 — execution idempotency / single-broadcast invariants.
  {
    // 16.1 baseline: one attempt = exactly 5 sends, one per step.
    {
      const { plan, expectations } = planFromPrepare();
      const mock = mockWallet();
      const out = await runMainTrackUserHireFromWallet({
        request: mock.request,
        plan,
        expectations,
        confirmStep: async () => true,
        verifyStep: async () => ({ ok: true }),
        receiptMaxAttempts: 1,
        receiptIntervalMs: 1,
        attemptToken: "x165-baseline",
      });
      check(
        "16.1 one attempt → 5 sends (one per step)",
        out.ok === true && mock.sends.length === 5
      );
      const createJobSends = mock.sends.filter(
        (s) =>
          s.to.toLowerCase() === MAIN_TRACK_COMMERCE.toLowerCase() && s.data === plan.calls[0].data
      );
      const approve = mock.sends.filter(
        (s) => s.to.toLowerCase() === MAIN_TRACK_PAYMENT_TOKEN.toLowerCase()
      );
      check("16.1 createJob sent exactly once (no duplicate job)", createJobSends.length === 1);
      check("16.1 approve sent exactly once (no duplicate approval)", approve.length === 1);
      const uniqueSteps = new Set(mock.sends.map((s) => `${s.to.toLowerCase()}:${s.data}`));
      check("16.1 no step broadcast twice", uniqueSteps.size === mock.sends.length);
    }

    // 16.2 concurrent double invocation, SAME attemptToken → second broadcasts nothing.
    {
      const { plan, expectations } = planFromPrepare();
      const mock = mockWallet();
      const verify = async () => ({ ok: true });
      const [a, b] = await Promise.all([
        runMainTrackUserHireFromWallet({
          request: mock.request,
          plan,
          expectations,
          confirmStep: async () => true,
          verifyStep: verify,
          receiptMaxAttempts: 2,
          receiptIntervalMs: 1,
          attemptToken: "x165-same",
        }),
        runMainTrackUserHireFromWallet({
          request: mock.request,
          plan,
          expectations,
          confirmStep: async () => true,
          verifyStep: verify,
          receiptMaxAttempts: 2,
          receiptIntervalMs: 1,
          attemptToken: "x165-same",
        }),
      ]);
      check(
        "16.2 concurrent same-token → first succeeds, second blocked",
        a.ok === true && b.ok === false && /already in progress/.test(b.reason ?? "")
      );
      check(
        "16.2 concurrent same-token → exactly 5 sends (second broadcast nothing)",
        mock.sends.length === 5
      );
    }

    // 16.3 distinct attemptTokens → both independent executions (guard is token-scoped).
    {
      const { plan, expectations } = planFromPrepare();
      const mock = mockWallet();
      const verify = async () => ({ ok: true });
      const [a, b] = await Promise.all([
        runMainTrackUserHireFromWallet({
          request: mock.request,
          plan,
          expectations,
          confirmStep: async () => true,
          verifyStep: verify,
          receiptMaxAttempts: 2,
          receiptIntervalMs: 1,
          attemptToken: "x165-A",
        }),
        runMainTrackUserHireFromWallet({
          request: mock.request,
          plan,
          expectations,
          confirmStep: async () => true,
          verifyStep: verify,
          receiptMaxAttempts: 2,
          receiptIntervalMs: 1,
          attemptToken: "x165-B",
        }),
      ]);
      check(
        "16.3 distinct tokens → both execute, 10 sends (guard not a global kill-switch)",
        a.ok === true && b.ok === true && mock.sends.length === 10
      );
    }

    // 16.4 receipt polling reads never broadcast.
    {
      const { plan, expectations } = planFromPrepare();
      const mock = mockWallet();
      let polls = 0;
      const verify = async (): Promise<{ ok: boolean }> => {
        polls += 1;
        return { ok: polls % 2 === 0 }; // pending then confirmed, per step
      };
      const out = await runMainTrackUserHireFromWallet({
        request: mock.request,
        plan,
        expectations,
        confirmStep: async () => true,
        verifyStep: verify,
        receiptMaxAttempts: 2,
        receiptIntervalMs: 1,
        attemptToken: "x165-poll",
      });
      check(
        "16.4 receipt polling never broadcasts (still 5 sends)",
        out.ok === true && mock.sends.length === 5
      );
      check("16.4 each step polled exactly twice (10 reads, 0 broadcasts)", polls === 10);
    }

    // 16.5 successful receipt advances exactly once.
    {
      const { plan, expectations } = planFromPrepare();
      const mock = mockWallet();
      let polls = 0;
      const verify = async (): Promise<{ ok: boolean }> => {
        polls += 1;
        return { ok: true };
      };
      const out = await runMainTrackUserHireFromWallet({
        request: mock.request,
        plan,
        expectations,
        confirmStep: async () => true,
        verifyStep: verify,
        receiptMaxAttempts: 1,
        receiptIntervalMs: 1,
        attemptToken: "x165-once",
      });
      check(
        "16.5 successful receipt advances once (5 sends, 5 polls)",
        out.ok === true && mock.sends.length === 5 && polls === 5
      );
    }

    // 16.6 reverted receipt stops the flow (no later step, no rebroadcast).
    {
      const { plan, expectations } = planFromPrepare();
      const mock = mockWallet();
      const verify = async (_h: string, step: string): Promise<{ ok: boolean; fatal?: boolean }> =>
        step === "approve" ? { ok: false, fatal: true, reason: "reverted" } : { ok: true };
      const out = await runMainTrackUserHireFromWallet({
        request: mock.request,
        plan,
        expectations,
        confirmStep: async () => true,
        verifyStep: verify,
        receiptMaxAttempts: 1,
        receiptIntervalMs: 1,
        attemptToken: "x165-revert",
      });
      // createJob, registerJob, setBudget, approve sent; approve reverted → stop
      // (4 sends: the reverted step IS broadcast, then the flow halts — no fund).
      const approveSent =
        mock.sends[mock.sends.length - 1]?.to.toLowerCase() ===
        MAIN_TRACK_PAYMENT_TOKEN.toLowerCase();
      check(
        "16.6 reverted approve → stop at 4 sends (approve broadcast then halts, no fund, no rebroadcast)",
        out.ok === false && out.state === "failed" && mock.sends.length === 4 && approveSent
      );
    }
  }

  // 17. X.166 — production scenario: the executor completes ALL 5 steps, then the
  // read-only final verify (a separate, fail-closed stub) reports not-ok. The
  // executor must NOT stop early and must release the in-flight guard so a later
  // legitimate attempt can still run. This refutes the "stopped at a later step"
  // hypothesis: the hire fully completed on-chain; only verification failed.
  {
    const { plan, expectations } = planFromPrepare();
    const mock = mockWallet();
    const out = await runMainTrackUserHireFromWallet({
      request: mock.request,
      plan,
      expectations,
      confirmStep: async () => true,
      verifyStep: async () => ({ ok: true }),
      receiptMaxAttempts: 1,
      receiptIntervalMs: 1,
      attemptToken: "x166-complete",
    });
    check(
      "17.1 all 5 steps broadcast and completed (executor did NOT stop early)",
      out.ok === true && mock.sends.length === 5
    );
    check(
      "17.1 every step returned a tx hash (full sequence ran)",
      typeof out.txHashes === "object" && Object.keys(out.txHashes ?? {}).length === 5
    );
    // The in-flight guard must be released after a terminal (success) outcome,
    // otherwise a correct later attempt would be wrongly blocked.
    const mock2 = mockWallet();
    const out2 = await runMainTrackUserHireFromWallet({
      request: mock2.request,
      plan,
      expectations,
      confirmStep: async () => true,
      verifyStep: async () => ({ ok: true }),
      receiptMaxAttempts: 1,
      receiptIntervalMs: 1,
      attemptToken: "x166-complete",
    });
    check(
      "17.1 in-flight guard released after success (no false block, no duplicate-job risk)",
      out2.ok === true && mock2.sends.length === 5
    );

    // The read-only verify failure maps to the exact production message and
    // triggers zero additional broadcasts.
    const message = mainTrackUserHireErrorMessage({ state: "verify-failed", step: "fund" });
    check(
      "17.2 verify-failure maps to the exact production 'Job created…' message",
      message ===
        "Job created, but Hire could not be safely completed. No additional transaction was submitted."
    );
    check(
      "17.2 read-only verify adds no broadcast (still exactly 5 sends)",
      mock.sends.length === 5
    );
  }

  // -------------------------------------------------------------------------
  // 18. X.167 — Model-B read-only final verification (dynamic price).
  //     No signer, no private key, no KMS, no custody, no broadcast.
  // -------------------------------------------------------------------------
  {
    // 18.1 — Agent 2005's real quote: 0.001 U = 1000000000000000 wei.
    const milli = "1000000000000000";
    const out = await verifyMainTrackUserHireFunded(
      fundedVerifyInput({ expectedBudget: milli }),
      fundedVerifyPorts({ readJob: async () => fundedJobFixture({ budget: BigInt(milli) }) })
    );
    check("18.1 0.001 U dynamic quote verifies FUNDED", out.ok === true);
    if (out.ok) {
      check(
        "18.1 activationState funded-commercial-hire + active:false",
        out.activationState.state === "funded-commercial-hire" && out.active === false
      );
    }
    check(
      "18.1 no custody needed (read-only verified without any custody)",
      out.ok === true && /custody/i.test(out.ok ? "" : (out.reason ?? "")) === false
    );

    // 18.2 — 1 U quote still verifies.
    const one = await verifyMainTrackUserHireFunded(fundedVerifyInput(), fundedVerifyPorts());
    check("18.2 1 U quote verifies FUNDED", one.ok === true);

    // 18.3 — another arbitrary valid quote (0.25 U) verifies.
    const quarter = "250000000000000000";
    const arb = await verifyMainTrackUserHireFunded(
      fundedVerifyInput({ expectedBudget: quarter }),
      fundedVerifyPorts({ readJob: async () => fundedJobFixture({ budget: BigInt(quarter) }) })
    );
    check("18.3 arbitrary quote verifies FUNDED", arb.ok === true);

    // 18.4 — wrong expected amount fails closed (0.001 U job, expected 1 U).
    const wrongAmount = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({ readJob: async () => fundedJobFixture({ budget: 1000000000000000n }) })
    );
    check(
      "18.4 wrong expected amount fails closed",
      wrongAmount.ok === false && /budget/.test(wrongAmount.reason ?? "")
    );

    // 18.5 — wrong job fails closed.
    const wrongJob = await verifyMainTrackUserHireFunded(
      fundedVerifyInput({ jobId: "999" }),
      fundedVerifyPorts({ readJob: async () => fundedJobFixture() })
    );
    check(
      "18.5 wrong job fails closed",
      wrongJob.ok === false && /not found/.test(wrongJob.reason ?? "")
    );

    // 18.6 — wrong buyer fails closed.
    const wrongBuyer = await verifyMainTrackUserHireFunded(
      fundedVerifyInput({ walletAddress: OTHER }),
      fundedVerifyPorts()
    );
    check(
      "18.6 wrong buyer fails closed",
      wrongBuyer.ok === false && /client/.test(wrongBuyer.reason ?? "")
    );

    // 18.7 — wrong provider fails closed.
    const wrongProvider = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({
        readJob: async () => fundedJobFixture({ provider: OTHER }),
      })
    );
    check(
      "18.7 wrong provider fails closed",
      wrongProvider.ok === false && /provider/.test(wrongProvider.reason ?? "")
    );

    // 18.8 — wrong payment token fails closed.
    const wrongToken = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({ readPaymentToken: async () => OTHER })
    );
    check(
      "18.8 wrong token fails closed",
      wrongToken.ok === false && /token/.test(wrongToken.reason ?? "")
    );

    // 18.9 — wrong commerce fails closed (injected network config).
    const wrongCommerce = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({
        network: { ...createMainTrackNetworkConfig(), commerceContract: OTHER },
      })
    );
    check(
      "18.9 wrong commerce fails closed",
      wrongCommerce.ok === false && /commerce/.test(wrongCommerce.reason ?? "")
    );

    // 18.10 — OPEN (not funded) job is NOT funded.
    const open = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({
        readJob: async () => fundedJobFixture({ status: 0, statusName: "OPEN" }),
      })
    );
    check("18.10 OPEN job is not funded", open.ok === false && /FUNDED/.test(open.reason ?? ""));

    // 18.11 — FUNDED job succeeds (explicit).
    const funded = await verifyMainTrackUserHireFunded(fundedVerifyInput(), fundedVerifyPorts());
    check("18.11 FUNDED job verifies success", funded.ok === true);

    // 18.12 — RPC unavailable yields an HONEST verification error (not a false failure claim).
    const rpcDown = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({
        readJob: async () => {
          throw new Error("rpc timeout");
        },
      })
    );
    check(
      "18.12 RPC unavailable -> honest verification error",
      rpcDown.ok === false &&
        /could not read job/.test(rpcDown.reason ?? "") &&
        /RPC unavailable/.test(rpcDown.reason ?? "")
    );
    const tokenDown = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({
        readPaymentToken: async () => {
          throw new Error("rpc timeout");
        },
      })
    );
    check(
      "18.12 paymentToken RPC unavailable -> honest verification error",
      tokenDown.ok === false && /could not read commerce payment token/.test(tokenDown.reason ?? "")
    );

    // 18.13 — seller quote endpoint mismatch fails closed…
    const quoteMismatch = await verifyMainTrackUserHireFunded(
      fundedVerifyInput({ expectedBudget: PRICE }),
      fundedVerifyPorts({
        negotiate: async () =>
          ({ ok: true, price: "1000000000000000" }) as unknown as MainTrackUserHirePrepareOutcome,
      })
    );
    check(
      "18.13 live quote mismatch fails closed",
      quoteMismatch.ok === false && /quoted price/.test(quoteMismatch.reason ?? "")
    );

    // 18.14 — …but an unreachable quote endpoint still accepts the on-chain FUNDED record.
    const quoteDown = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({
        negotiate: async () => {
          throw new Error("endpoint timeout");
        },
      })
    );
    check(
      "18.14 quote endpoint unavailable -> on-chain FUNDED still accepted",
      quoteDown.ok === true
    );

    // 18.15 — already-submitted job is blocked (fresh-funding guard).
    const submitted = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({ readJob: async () => fundedJobFixture({ submittedAt: 1787000000n }) })
    );
    check(
      "18.15 already-submitted job blocked",
      submitted.ok === false && /submitted/.test(submitted.reason ?? "")
    );

    // 18.16 — non-zero deliverable is blocked.
    const deliverableSet = await verifyMainTrackUserHireFunded(
      fundedVerifyInput(),
      fundedVerifyPorts({
        readJob: async () => fundedJobFixture({ deliverable: "0x" + "11".repeat(32) }),
      })
    );
    check(
      "18.16 non-zero deliverable blocked",
      deliverableSet.ok === false && /deliverable/.test(deliverableSet.reason ?? "")
    );

    // 18.17 — the read-only server path contains NO private key / no raw broadcast.
    const serverSource = readFileSync(
      new URL("./main-track-user-hire.server.ts", import.meta.url),
      "utf8"
    );
    check(
      "18.17 server verifier has no private-key handling",
      /privateKey|signTransaction|sendRawTransaction|eth_sendRawTransaction/i.test(serverSource) ===
        false
    );
    check(
      "18.17 server verifier performs only public chain reads",
      /getErc8183Job/.test(serverSource) === true
    );

    // 18.18 — dynamic-verify equivalence at the pure layer: same budget both ways.
    const pure = verifyMainTrackUserHireFinalState({
      jobId: "900",
      job: fundedJobRead(),
      expectedClient: USER.toLowerCase(),
      expectedProvider: SELLER.toLowerCase(),
      expectedToken: MAIN_TRACK_PAYMENT_TOKEN,
      expectedBudget: PRICE,
    });
    check(
      "18.18 pure final-state verify still passes with dynamic expectedBudget",
      pure.ok === true
    );
  }

  if (failures === 0) {
    console.log("X.149 main-track-user-hire verify: ALL CHECKS PASSED");
  } else {
    console.error(`X.149 main-track-user-hire verify: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

void main();
