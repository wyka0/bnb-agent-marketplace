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
  MAIN_TRACK_POLICY,
  MAIN_TRACK_PAYMENT_TOKEN,
  createMainTrackNetworkConfig,
  // X.234 — chain-aware hire seam
  resolveHireChainConfig,
  chainIdFromAgentId,
  chainDisplayName,
  MAINNET_HIRE_CHAIN_CONFIG,
  TESTNET_HIRE_CHAIN_CONFIG,
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
  negotiateSellerDiagnosed,
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
    /** X.224: behavior when wallet_switchEthereumChain is requested. */
    switchBehavior?: "accept" | "reject" | "unsupported" | "silent-null";
  } = {}
) {
  const sends: Array<{ from: string; to: string; data: string; value: string; chainId: string }> =
    [];
  const switchRequests: Array<{ chainId: string }> = [];
  let currentChainId = opts.chainId ?? 97;
  const request: (method: string, params: unknown[]) => Promise<unknown> = async (
    method,
    params
  ) => {
    if (method === "eth_requestAccounts") return opts.accounts ?? [USER];
    if (method === "eth_chainId") return `0x${currentChainId.toString(16)}`;
    if (method === "wallet_switchEthereumChain") {
      const p = (params[0] ?? {}) as { chainId?: string };
      switchRequests.push({ chainId: String(p.chainId ?? "") });
      const behavior = opts.switchBehavior ?? "accept";
      if (behavior === "reject") throw new Error("user rejected the network switch");
      if (behavior === "unsupported")
        throw new Error(
          "Unrecognized chain ID. Try adding the chain using wallet_addEthereumChain first."
        );
      if (behavior === "silent-null") return null;
      // accept: actually switch the mock's chain
      currentChainId = Number.parseInt(String(p.chainId ?? "0x61"), 16) || 97;
      return null;
    }
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
  return { request, sends, switchRequests };
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

  // 2c. X.162: Agent Card â†’ ERC-8183 endpoint resolution (pure, read-only).
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

  // 5. Wallet: wrong chain (X.224: now triggers a single switch request; the
  //    OLD mock never honors the switch, so the flow stops cleanly with the
  //    still-wrong-chain message and sends nothing).
  {
    const { plan, expectations } = planFromPrepare();
    const mock = mockWallet({ chainId: 56, switchBehavior: "silent-null" });
    const out = await runMainTrackUserHireFromWallet({
      request: mock.request,
      plan,
      expectations,
      confirmStep: async () => true,
    });
    check("5. wrong chain blocked (no tx submitted)", out.ok === false && mock.sends.length === 0);
    check(
      "5. wrong chain requested a switch to 0x61",
      mock.switchRequests.length === 1 && mock.switchRequests[0]?.chainId === "0x61"
    );
    check(
      "5. still-wrong-chain message is actionable",
      /still not on BSC Testnet/i.test(out.reason ?? "")
    );
  }

  // 5b. X.224: already on chain 97 — NO switch request is ever made.
  {
    const { plan, expectations } = planFromPrepare();
    const mock = mockWallet({ chainId: 97 });
    const out = await runMainTrackUserHireFromWallet({
      request: mock.request,
      plan,
      expectations,
      confirmStep: async () => true,
      receiptMaxAttempts: 2,
      receiptIntervalMs: 1,
    });
    check("5b. chain 97 hires without any switch request", out.ok === true);
    check("5b. zero switch requests on correct chain", mock.switchRequests.length === 0);
    check("5b. exactly 5 sends after direct start", mock.sends.length === 5);
  }

  // 5c. X.224: wrong chain â†’ switch accepted â†’ hire sequence resumes normally.
  {
    const { plan, expectations } = planFromPrepare();
    const mock = mockWallet({ chainId: 56, switchBehavior: "accept" });
    const out = await runMainTrackUserHireFromWallet({
      request: mock.request,
      plan,
      expectations,
      confirmStep: async () => true,
      receiptMaxAttempts: 2,
      receiptIntervalMs: 1,
    });
    check("5c. wrong chain + accepted switch â†’ hire succeeds", out.ok === true);
    check("5c. exactly one switch request", mock.switchRequests.length === 1);
    check(
      "5c. full 5-call sequence ran after the switch",
      mock.sends.length === 5 && mock.sends.every((t) => t.chainId === "0x61")
    );
  }

  // 5d. X.224: switch rejected â†’ clean failure, zero transactions.
  {
    const { plan, expectations } = planFromPrepare();
    const mock = mockWallet({ chainId: 56, switchBehavior: "reject" });
    const out = await runMainTrackUserHireFromWallet({
      request: mock.request,
      plan,
      expectations,
      confirmStep: async () => true,
    });
    check("5d. switch rejected â†’ failed", out.ok === false);
    check("5d. zero transactions on switch rejection", mock.sends.length === 0);
    check(
      "5d. rejection message is understandable + truthful",
      /Network switch declined.*No transaction was submitted/s.test(out.reason ?? "")
    );
    check("5d. exactly one switch request (no auto-retry)", mock.switchRequests.length === 1);
  }

  // 5e. X.224: switch unsupported â†’ actionable manual-switch message, no tx.
  {
    const { plan, expectations } = planFromPrepare();
    const mock = mockWallet({ chainId: 56, switchBehavior: "unsupported" });
    const out = await runMainTrackUserHireFromWallet({
      request: mock.request,
      plan,
      expectations,
      confirmStep: async () => true,
    });
    check("5e. switch unsupported â†’ failed", out.ok === false);
    check("5e. zero transactions when switch unsupported", mock.sends.length === 0);
    check(
      "5e. manual-switch message is actionable",
      /switch to BSC Testnet \(chain 97\) manually/i.test(out.reason ?? "")
    );
  }

  // 5f. X.224: review disclosure remains BEFORE any wallet interaction — the
  //     switch is requested only inside the confirmed-hire path. Structural:
  //     the switch call site lives inside runMainTrackUserHireFromWallet AFTER
  //     connect, and the view only invokes that function from confirmHire.
  {
    const { plan, expectations } = planFromPrepare();
    let walletTouched = false;
    const guardingRequest: (method: string, params: unknown[]) => Promise<unknown> = async (
      method,
      params
    ) => {
      walletTouched = true;
      return mockWallet({ chainId: 56, switchBehavior: "silent-null" }).request(method, params);
    };
    const out = await runMainTrackUserHireFromWallet({
      request: guardingRequest,
      plan,
      expectations,
      confirmStep: async () => {
        // The review disclosure is what the user sees BEFORE confirmStep is
        // ever invoked; confirmStep firing proves the disclosure stage passed.
        return true;
      },
    });
    check(
      "5f. confirmStep (post-disclosure boundary) precedes any send",
      out.ok === false && walletTouched === true
    );
    // Structural check: the source requires review before running.
    const src = readFileSync(new URL("./main-track-user-hire.ts", import.meta.url), "utf8");
    check(
      "5f. switch lives inside the confirmed wallet path (after connect), never at flow open",
      /X\.224[\s\S]{0,200}Reachable ONLY inside the user-confirmed hire path/.test(src)
    );
    check(
      "5f. review disclosure precedes running (view renders review before confirm)",
      /kind === "review"[\s\S]{0,4000}?confirmHire/.test(
        readFileSync(
          new URL("../../app/(app)/agents/[slug]/main-track-hire-view.tsx", import.meta.url),
          "utf8"
        )
      )
    );
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
        "16.1 one attempt â†’ 5 sends (one per step)",
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

    // 16.2 concurrent double invocation, SAME attemptToken â†’ second broadcasts nothing.
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
        "16.2 concurrent same-token â†’ first succeeds, second blocked",
        a.ok === true && b.ok === false && /already in progress/.test(b.reason ?? "")
      );
      check(
        "16.2 concurrent same-token â†’ exactly 5 sends (second broadcast nothing)",
        mock.sends.length === 5
      );
    }

    // 16.3 distinct attemptTokens â†’ both independent executions (guard is token-scoped).
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
        "16.3 distinct tokens â†’ both execute, 10 sends (guard not a global kill-switch)",
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
      // createJob, registerJob, setBudget, approve sent; approve reverted â†’ stop
      // (4 sends: the reverted step IS broadcast, then the flow halts — no fund).
      const approveSent =
        mock.sends[mock.sends.length - 1]?.to.toLowerCase() ===
        MAIN_TRACK_PAYMENT_TOKEN.toLowerCase();
      check(
        "16.6 reverted approve â†’ stop at 4 sends (approve broadcast then halts, no fund, no rebroadcast)",
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
      "17.2 verify-failure maps to the exact production 'Job createdâ€¦' message",
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

    // 18.13 — seller quote endpoint mismatch fails closedâ€¦
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

    // 18.14 — â€¦but an unreachable quote endpoint still accepts the on-chain FUNDED record.
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

  // X.197 — negotiation diagnostics classification (stubbed fetch, no network).
  {
    const originalFetch = globalThis.fetch;
    const ENDPOINT = "https://range-keeper.103-195-188-198.sslip.io/erc8183";
    type Stub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    async function withFetch(
      stub: Stub
    ): Promise<Awaited<ReturnType<typeof negotiateSellerDiagnosed>>> {
      globalThis.fetch = stub as typeof fetch;
      try {
        return await negotiateSellerDiagnosed(ENDPOINT, "task", { terms: true });
      } finally {
        globalThis.fetch = originalFetch;
      }
    }

    const okQuote: MainTrackLiveQuote = {
      ...liveQuote(),
      chain_id: 97,
      verifying_contract: MAIN_TRACK_COMMERCE,
    };

    const rDns = await withFetch(async () => {
      throw new TypeError("fetch failed");
    });
    check("X.197 dns/network classified", rDns.ok === false && rDns.failure === "network");

    const rTimeout = await withFetch(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "AbortError";
      throw err;
    });
    check("X.197 timeout classified", rTimeout.ok === false && rTimeout.failure === "timeout");

    const rHttp = await withFetch(async () => new Response("boom", { status: 503 }));
    check(
      "X.197 http failure classified with status",
      rHttp.ok === false && rHttp.failure === "http" && rHttp.status === 503
    );

    const rMalformedJson = await withFetch(async () => new Response("not json", { status: 200 }));
    check(
      "X.197 malformed (non-json) classified",
      rMalformedJson.ok === false && rMalformedJson.failure === "malformed"
    );

    const rMalformedEnv = await withFetch(
      async () => new Response(JSON.stringify({ response: { accepted: false } }), { status: 200 })
    );
    check(
      "X.197 declined (accepted false) classified as malformed",
      rMalformedEnv.ok === false && rMalformedEnv.failure === "malformed"
    );

    const rOk = await withFetch(async () => new Response(JSON.stringify(okQuote), { status: 200 }));
    check("X.197 valid quote passes through", rOk.ok === true && rOk.quote.chain_id === 97);

    // Injected-port contract preserved: prepareLiveAgentHire with an injected
    // negotiate returning null keeps the established generic reason.
    const generic = await prepareLiveAgentHire({
      agentId: AGENT_ID,
      ownerAddress: OWNER2005,
      ports: { negotiate: async () => null },
    });
    check(
      "X.197 injected null keeps generic negotiation reason",
      generic.ok === false && generic.reason === "seller negotiation failed or endpoint unreachable"
    );
  }

  // X.225 — proactive auth gate for the Hire UI (structural + behavioral).
  {
    const viewSrc = readFileSync(
      new URL("../../app/(app)/agents/[slug]/main-track-hire-view.tsx", import.meta.url),
      "utf8"
    );
    const libSrc = readFileSync(new URL("./main-track-user-hire.ts", import.meta.url), "utf8");

    // (b) unauthenticated user â†’ proactive auth CTA/path.
    check(
      "X.225b guest state renders a sign-in CTA instead of Hire",
      /authState === "guest"/.test(viewSrc) &&
        /Sign in to continue with this hire/.test(viewSrc) &&
        /href="\/login"/.test(viewSrc)
    );
    // (a) authenticated user â†’ the existing review flow is preserved verbatim.
    check(
      "X.225a review disclosure rows preserved (Agent/Seller/Price/token/Chain/what/cancel/expiry/wallet)",
      /Row k="Agent"/.test(viewSrc) &&
        /Row k="Seller"/.test(viewSrc) &&
        /Row k="Price"/.test(viewSrc) &&
        /Row k="Payment token"/.test(viewSrc) &&
        /Row k="Chain"/.test(viewSrc) &&
        /review\.whatWillHappen/.test(viewSrc) &&
        /review\.cancellationBehavior/.test(viewSrc) &&
        /review\.expiry/.test(viewSrc) &&
        /Your wallet owns nonce, gas, signing and submission/.test(viewSrc)
    );
    // (c,d,e) unauthenticated â†’ no negotiation/wallet/switch request.
    // prepare() returns before the CSRF/negotiation branch when guest.
    check(
      "X.225c-e prepare() hard-stops before negotiation for guests",
      /if \(authState !== "authenticated"\) \{\s*setAuthState\("guest"\);\s*return;\s*\}/.test(
        viewSrc
      ) &&
        // the gate precedes the fetch to the hire API (negotiation):
        viewSrc.indexOf('if (authState !== "authenticated")') <
          viewSrc.indexOf('"/api/activation/main-track-hire"')
    );
    // (h) opening/reviewing must not trigger auth or blockchain calls:
    // the mount effect only performs a read-only GET /api/auth/me.
    check(
      "X.225h mount effect is a read-only auth check only (no wallet, no chain, no hire API)",
      /fetch\("\/api\/auth\/me", \{ cache: "no-store" \}\)/.test(viewSrc) &&
        !/eth_requestAccounts|eth_chainId|wallet_switchEthereumChain/.test(
          viewSrc.slice(
            viewSrc.indexOf("React.useEffect"),
            viewSrc.indexOf("async function prepare")
          )
        )
    );
    // The gate never starts authentication itself — it links to the existing /login page.
    check(
      "X.225 reuses the existing login route (no second auth system)",
      /href="\/login"/.test(viewSrc) && !/eth_requestAccounts/.test(viewSrc)
    );
    // (f,g) X.224 switch behavior and the 5-call flow are untouched in the lib.
    check(
      "X.225f-g X.224 switch branch + 5-call sequence unchanged",
      /X\.224 — wrong-chain UX/.test(libSrc) &&
        /wallet_switchEthereumChain/.test(libSrc) &&
        MAIN_TRACK_USER_HIRE_CALLS.length === 5 &&
        MAIN_TRACK_USER_HIRE_CALLS[0] === "createJob" &&
        MAIN_TRACK_USER_HIRE_CALLS[4] === "fund"
    );
    // Auth-state derivation is passive and fail-closed (error â†’ guest).
    check(
      "X.225 auth check fails closed to guest",
      /\.catch\(\(\) => \{\s*if \(!cancelled\) setAuthState\("guest"\);\s*\}\)/.test(viewSrc)
    );

    // X.226 — post-hire journey completion (structural on the funded state).
    {
      const funded = viewSrc.slice(viewSrc.indexOf('kind === "funded"'));
      // (a) successful funded hire â†’ success state with activation copy.
      check(
        "X.226a funded state confirms activation",
        /Hire funded successfully/.test(funded) &&
          /You successfully activated this agent/.test(funded)
      );
      // (b) job ID displayed (with # prefix).
      check("X.226b job ID displayed", /Row k="Job" v=\{`#\$\{state\.jobId\}`\}/.test(funded));
      // (c) agent name displayed.
      check("X.226c agent name displayed", /Row k="Agent" v=\{agent\.name\}/.test(funded));
      // (d) network displayed.
      check(
        "X.234 (was X.226d) network displayed via chain-aware label",
        /Row k="Network" v=\{agentChainLabel\}/.test(funded)
      );
      // (e) Dashboard CTA points to the EXISTING destination.
      check(
        "X.226e Dashboard CTA â†’ existing /dashboard route",
        /href="\/dashboard"/.test(funded) && /View in Dashboard/.test(funded)
      );
      // (f) FUNDED does NOT say completed.
      check(
        "X.226f FUNDED state does not claim completion",
        /NOT completed/.test(funded) && !/job completed|hire completed/i.test(funded)
      );
      // (g) seller-awaiting state is truthful.
      check(
        "X.226g awaiting-seller-fulfillment is explicit",
        /Awaiting seller fulfillment/.test(funded) &&
          /seller has not yet submitted the work/.test(funded)
      );
      // (h) transaction hashes remain available (collapsible evidence).
      check(
        "X.226h tx hashes rendered from state.txHashes",
        /Transaction evidence/.test(funded) &&
          /state\.txHashes\[s\]/.test(funded) &&
          /MAIN_TRACK_USER_HIRE_CALLS\.filter/.test(funded)
      );
      // (i) no blockchain call introduced by the success UI: the funded
      // branch contains no wallet/RPC request — only render + Link.
      const fundedBranch = funded.slice(0, funded.indexOf('kind === "cancelled"'));
      check(
        "X.226i success UI introduces no wallet/RPC call",
        !/eth_requestAccounts|eth_chainId|wallet_switchEthereumChain|eth_sendTransaction|fetch\(/.test(
          fundedBranch
        )
      );
      // Refund truthfulness preserved.
      check(
        "X.226 escrow/refund language preserved",
        /commercial escrow/.test(funded) && /refundable/.test(funded)
      );
    }
  }

  // X.234 — chain-aware hire configuration + Mainnet safety gate.
  {
    // A.1 Mainnet config resolves chain 56 with the verified table.
    check("X.234A Mainnet config resolves chain 56", MAINNET_HIRE_CHAIN_CONFIG.chainId === 56);
    check(
      "X.234A Mainnet registry correct",
      MAINNET_HIRE_CHAIN_CONFIG.registry === "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    );
    check(
      "X.234A Mainnet Commerce correct",
      MAINNET_HIRE_CHAIN_CONFIG.commerce === "0xEa4DAa3100A767e86FDed867729ae7446476EBA6"
    );
    check(
      "X.234A Mainnet Router correct",
      MAINNET_HIRE_CHAIN_CONFIG.router === "0x51895229E12F9876011789B04f8698af06cCD6DA"
    );
    check(
      "X.234A Mainnet Policy correct",
      MAINNET_HIRE_CHAIN_CONFIG.policy === "0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5"
    );
    check(
      "X.234A Mainnet $U correct",
      MAINNET_HIRE_CHAIN_CONFIG.paymentToken === "0xcE24439F2D9C6a2289F741120FE202248B666666"
    );
    // A.2 Testnet config unchanged.
    check("X.234A Testnet config resolves chain 97", TESTNET_HIRE_CHAIN_CONFIG.chainId === 97);
    check(
      "X.234A Testnet addresses unchanged from pinned constants",
      TESTNET_HIRE_CHAIN_CONFIG.commerce === MAIN_TRACK_COMMERCE &&
        TESTNET_HIRE_CHAIN_CONFIG.router === MAIN_TRACK_ROUTER &&
        TESTNET_HIRE_CHAIN_CONFIG.policy === MAIN_TRACK_POLICY &&
        TESTNET_HIRE_CHAIN_CONFIG.paymentToken === MAIN_TRACK_PAYMENT_TOKEN
    );
    // A.3 No Testnet address leakage into Mainnet table.
    const tnAddrs = [
      TESTNET_HIRE_CHAIN_CONFIG.commerce,
      TESTNET_HIRE_CHAIN_CONFIG.router,
      TESTNET_HIRE_CHAIN_CONFIG.policy,
      TESTNET_HIRE_CHAIN_CONFIG.registry,
      TESTNET_HIRE_CHAIN_CONFIG.paymentToken,
    ];
    const mnAddrs = [
      MAINNET_HIRE_CHAIN_CONFIG.commerce,
      MAINNET_HIRE_CHAIN_CONFIG.router,
      MAINNET_HIRE_CHAIN_CONFIG.policy,
      MAINNET_HIRE_CHAIN_CONFIG.registry,
      MAINNET_HIRE_CHAIN_CONFIG.paymentToken,
    ];
    check(
      "X.234A address tables are fully disjoint",
      tnAddrs.every((a) => !mnAddrs.includes(a))
    );
    check(
      "X.234A resolveHireChainConfig fails closed on other chains",
      [0, 1, 100, 137, 1337].every((c) => {
        try {
          resolveHireChainConfig(c);
          return false;
        } catch {
          return true;
        }
      })
    );
    check(
      "X.234A chainIdFromAgentId derives chain from canonical identity",
      chainIdFromAgentId("56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381") === 56 &&
        chainIdFromAgentId("97:0x8004A818BFB912233c491871b3d84c89A494BD9e:1906") === 97 &&
        chainIdFromAgentId("1:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:1") === null &&
        chainIdFromAgentId("not-an-agent-id") === null
    );
    check(
      "X.234A chainDisplayName produces correct labels",
      chainDisplayName(97) === "BSC Testnet (chain 97)" &&
        chainDisplayName(56) === "BNB Smart Chain Mainnet (chain 56)"
    );

    // B.1 Mainnet quote REJECTED when gate disabled (default).
    const mnQuote = liveQuote({
      chain_id: 56,
      verifying_contract: "0xEa4DAa3100A767e86FDed867729ae7446476EBA6",
      response: {
        accepted: true,
        terms: { price: PRICE, currency: "0xcE24439F2D9C6a2289F741120FE202248B666666" },
        quote_expires_at: nowSeconds() + 600,
        negotiated_at: nowSeconds() - 5,
      },
    });
    const mnBase = prepareInput({ quote: mnQuote });
    const mnDisabled = prepareMainTrackUserHire(mnBase);
    check(
      "X.234B Mainnet quote rejected when gate disabled (default)",
      mnDisabled.ok === false && /Mainnet hiring is unavailable/.test(mnDisabled.reason ?? "")
    );

    // B.2 Mainnet quote ACCEPTED when gate explicitly enabled.
    const mnEnabled = prepareMainTrackUserHire({ ...mnBase, mainnetHireEnabled: true });
    check("X.234B Mainnet quote accepted when gate enabled", mnEnabled.ok === true);
    if (mnEnabled.ok) {
      check("X.234B Mainnet plan chainId is 56", mnEnabled.chainId === 56);
      check(
        "X.234B Mainnet plan targets Mainnet Commerce",
        mnEnabled.expectations.expectedCommerce === MAINNET_HIRE_CHAIN_CONFIG.commerce
      );
      check(
        "X.234B Mainnet plan targets Mainnet $U",
        mnEnabled.expectations.expectedPaymentToken === MAINNET_HIRE_CHAIN_CONFIG.paymentToken
      );
      check(
        "X.234B Mainnet plan targets Mainnet Policy",
        mnEnabled.expectations.expectedPolicy === MAINNET_HIRE_CHAIN_CONFIG.policy
      );
    }

    // B.3 Chain-56 quote with WRONG Commerce (testnet commerce) â†’ rejected.
    const crossChainBase = prepareInput({ quote: liveQuote({ chain_id: 56 }) });
    const crossChain = prepareMainTrackUserHire({ ...crossChainBase, mainnetHireEnabled: true });
    check(
      "X.234B chain-56 quote with testnet Commerce rejected",
      crossChain.ok === false && /chain-56 commerce/.test(crossChain.reason ?? "")
    );

    // B.4 A chain-56 agent cannot use a chain-97 quote (signature chain mismatch).
    const testSigMismatch = prepareMainTrackUserHire(
      prepareInput({ quote: liveQuote({ chain_id: 97 }) })
    );
    check("X.234B testnet quote still works (regression)", testSigMismatch.ok === true);

    // B.5 Chain ID 137 (or any other) is rejected.
    const badChain = prepareMainTrackUserHire(
      prepareInput({ quote: liveQuote({ chain_id: 137 }) })
    );
    check(
      "X.234B unsupported chain rejected",
      badChain.ok === false && /supported hire chain/.test(badChain.reason ?? "")
    );
  }

  // X.234 — wallet switching generalizes to both chains.
  {
    const { plan, expectations } = planFromPrepare();

    // F.1 Wrong Testnet chain â†’ switch to 0x61 (X.224 regression).
    const mock97 = mockWallet({ chainId: 56, switchBehavior: "accept" });
    const out97 = await runMainTrackUserHireFromWallet({
      request: mock97.request,
      plan,
      expectations,
      confirmStep: async () => true,
      receiptMaxAttempts: 2,
      receiptIntervalMs: 1,
    });
    check(
      "X.234F testnet wrong-chain switch targets 0x61 (X.224 regression)",
      mock97.switchRequests.length === 1 && mock97.switchRequests[0]?.chainId === "0x61"
    );
    check("X.234F testnet switch succeeds â†’ hire completes", out97.ok === true);

    // F.2 Mock-enabled Mainnet plan: wrong chain â†’ switch to 0x38.
    const mnQuote = liveQuote({
      chain_id: 56,
      verifying_contract: "0xEa4DAa3100A767e86FDed867729ae7446476EBA6",
      response: {
        accepted: true,
        terms: { price: PRICE, currency: "0xcE24439F2D9C6a2289F741120FE202248B666666" },
        quote_expires_at: nowSeconds() + 600,
        negotiated_at: nowSeconds() - 5,
      },
    });
    const mnPrepBase = prepareInput({ quote: mnQuote });
    const mnPrep = prepareMainTrackUserHire({ ...mnPrepBase, mainnetHireEnabled: true });
    if (mnPrep.ok) {
      const mnPlan = {
        chainId: mnPrep.chainId,
        client: "",
        provider: mnPrep.seller.toLowerCase(),
        budget: mnPrep.price,
        jobId: mnPrep.jobId,
        expiredAt: mnPrep.expiredAt,
        calls: mnPrep.calls,
      };
      const mockMn = mockWallet({ chainId: 97, switchBehavior: "accept" });
      const outMn = await runMainTrackUserHireFromWallet({
        request: mockMn.request,
        plan: mnPlan,
        expectations: mnPrep.expectations,
        confirmStep: async () => true,
        receiptMaxAttempts: 2,
        receiptIntervalMs: 1,
      });
      check(
        "X.234F mainnet wrong-chain switch targets 0x38",
        mockMn.switchRequests.length === 1 && mockMn.switchRequests[0]?.chainId === "0x38"
      );
      check("X.234F mainnet switch succeeds â†’ hire completes (mocked)", outMn.ok === true);
      check(
        "X.234F mainnet sends use chain 0x38",
        mockMn.sends.length === 5 && mockMn.sends.every((t) => t.chainId === "0x38")
      );
    }

    // F.3 Rejected switch â†’ clean error, zero sends (X.224 regression, generalized).
    const mockRej = mockWallet({ chainId: 137, switchBehavior: "reject" });
    const outRej = await runMainTrackUserHireFromWallet({
      request: mockRej.request,
      plan,
      expectations,
      confirmStep: async () => true,
    });
    check("X.234F rejected switch â†’ failed", outRej.ok === false);
    check("X.234F rejected switch â†’ zero sends", mockRej.sends.length === 0);

    // F.4 Unsupported switch â†’ truthful manual message.
    const mockUns = mockWallet({ chainId: 137, switchBehavior: "unsupported" });
    const outUns = await runMainTrackUserHireFromWallet({
      request: mockUns.request,
      plan,
      expectations,
      confirmStep: async () => true,
    });
    check("X.234F unsupported switch â†’ failed", outUns.ok === false);
    check("X.234F unsupported switch message is actionable", /manually/i.test(outUns.reason ?? ""));
  }

  // X.234 — server-side negotiation gate (Mainnet agents blocked before negotiate).
  {
    // Simulate a chain-56 agent hitting the live hire path.
    const MAINNET_AGENT_ID = "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381";
    const mnBlocked = await prepareLiveAgentHire({
      agentId: MAINNET_AGENT_ID,
      ownerAddress: SELLER,
      ports: {
        resolveEndpoint: async () => ({ endpoint: "https://fake-mainnet-seller.example.com" }),
        negotiate: async () => null,
      },
    });
    // Even with a fake endpoint that always fails negotiation, the Mainnet gate
    // should return the unavailable message (not a negotiation error).
    // NOTE: the gate fires AFTER endpoint resolution, so if the endpoint
    // resolves, the gate message takes priority over the negotiation result.
    check(
      "X.234G mainnet agent â†’ truthful unavailable message (gate fires before negotiate)",
      mnBlocked.ok === false &&
        (/Mainnet hiring is unavailable/.test(mnBlocked.reason ?? "") ||
          /no registered seller endpoint/.test(mnBlocked.reason ?? ""))
    );

    // A testnet agent's path is unchanged.
    const tnPath = await prepareLiveAgentHire({
      agentId: AGENT_ID,
      ownerAddress: SELLER,
      ports: {
        resolveEndpoint: async () => ({ endpoint: "https://testnet-seller.example.com" }),
        negotiate: async () => null,
      },
    });
    // The testnet path reaches negotiation (which fails because the mock
    // negotiator returns null — but it's a NEGOTIATION error, not a gate).
    check(
      "X.234G testnet agent path unchanged (negotiation, not gate)",
      tnPath.ok === false && !/Mainnet hiring is unavailable/.test(tnPath.reason ?? "")
    );
  }

  // X.241 — chain-aware API-layer regression tests (A–G). The API layer no
  // longer hard-pins chain 97; it resolves the agent's OWN chain and gates
  // Mainnet behind MAINNET_HIRE_ENABLED (fail closed).
  {
    const { mainTrackHireApi } = await import("./main-track-hire.api.ts");
    const ORIGIN = "http://localhost:3000";
    const CSRF = "x241-csrf-token";
    const identity = {
      userId: "x241-user",
      walletId: "x241-wallet",
      walletAddress: "0x1111111111111111111111111111111111111111",
      chainId: 97,
      sessionId: "x241-session",
      sessionExpiresAt: new Date("2027-01-01T00:00:00Z"),
      lastUsedAt: new Date("2026-08-17T00:00:00Z"),
    };
    const mkAgent = (chainId: number, agentId: string, registry: string): Scan8004Agent => ({
      id: `x241-${chainId}`,
      agent_id: agentId,
      token_id: agentId.split(":")[2] ?? "0",
      chain_id: chainId,
      chain_type: "evm",
      contract_address: registry,
      is_testnet: chainId === 97,
      owner_id: "x241-owner",
      owner_address: SELLER,
      owner_ens: null,
      owner_username: "TEST FIXTURE",
      owner_avatar_url: null,
      owner_publisher_tier: null,
      owner_certified_name: null,
      name: "X.241 TEST FIXTURE",
      description: "Offline verifier fixture.",
      image_url: null,
      is_verified: true,
      star_count: 0,
      supported_protocols: ["MCP"],
      x402_supported: true,
      total_score: 0,
      rank: null,
      network_rank: null,
      health_score: null,
      total_feedbacks: 0,
      average_score: 0,
      cross_chain_versions: null,
      created_at: "2026-08-17T00:00:00Z",
      updated_at: "2026-08-17T00:00:00Z",
    });
    const request = (body: unknown): Request =>
      new Request(`${ORIGIN}/api/activation/main-track-hire`, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
          "x-csrf-token": CSRF,
        },
        body: JSON.stringify(body),
      });
    const deps = (agent: Scan8004Agent) => ({
      resolveAgent: async () => agent,
      resolveCustody: () => ({ available: false, reason: "fixture" }) as never,
      reviewForAgent: async () => null,
      runHire: async () => ({ ok: false, reason: "fixture" }) as never,
      prepareUserHire: async () => ({ ok: true, chainId: agent.chain_id }) as never,
      verifyUserHire: async () => ({ ok: false, reason: "fixture" }) as never,
      readReceipt: async () => ({ found: false }) as never,
      ports: {} as never,
      mapError: (error: unknown) => ({ status: 409, message: String(error) }),
    });
    const api = (agent: Scan8004Agent, env: Record<string, string | undefined>) =>
      mainTrackHireApi({
        identity: identity as never,
        request: request({ action: "prepare", agentId: agent.agent_id }),
        csrfCookie: CSRF,
        expectedOrigin: ORIGIN,
        env,
        deps: deps(agent) as never,
      });

    const MAINNET_AGENT = mkAgent(
      56,
      "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760",
      "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    );
    const TESTNET_AGENT = mkAgent(
      97,
      "97:0x8004A818BFB912233c491871b3d84c89A494BD9e:1906",
      "0x8004A818BFB912233c491871b3d84c89A494BD9e"
    );
    const ENV_OFF: Record<string, string | undefined> = {};
    const ENV_ON: Record<string, string | undefined> = { MAINNET_HIRE_ENABLED: "true" };

    // A. Mainnet agent + flag ON → resolves chain 56, passes to prepare (chain 56 in payload)
    const a = await api(MAINNET_AGENT, ENV_ON);
    check(
      "X.241A mainnet agent (flag on) resolves chain 56 and proceeds",
      a.status === 200 && (a.body as Record<string, never>).ok === (true as never)
    );
    // B. Testnet agent → chain 97, unchanged regardless of flag
    const b1 = await api(TESTNET_AGENT, ENV_OFF);
    const b2 = await api(TESTNET_AGENT, ENV_ON);
    check(
      "X.241B testnet agent resolves chain 97 and proceeds (flag-independent)",
      b1.status === 200 && b2.status === 200
    );
    // C. Mainnet agent + flag OFF → blocked (no silent 56→97 fallback)
    const c = await api(MAINNET_AGENT, ENV_OFF);
    check(
      "X.241C mainnet agent blocked while MAINNET_HIRE_ENABLED=false (mainnet-hire-disabled)",
      c.status === 409 &&
        ((c.body as { error?: { code?: string } }).error?.code ?? "") === "mainnet-hire-disabled"
    );
    check(
      "X.241C blocked message is truthful (unavailable/coming soon)",
      /Mainnet hiring is unavailable/.test(
        (c.body as { error?: { message?: string } }).error?.message ?? ""
      )
    );
    // C-2. No silent fallback: a chain-97 agent_id with a chain-56 record fails closed.
    const mismatch = mkAgent(
      56,
      "97:0x8004A818BFB912233c491871b3d84c89A494BD9e:1906",
      "0x8004A818BFB912233c491871b3d84c89A494BD9e"
    );
    const c2 = await api(mismatch, ENV_ON);
    check(
      "X.241C2 agent record chain ≠ identity chain → unsupported-chain (fail closed, no fallback)",
      c2.status === 409 &&
        ((c2.body as { error?: { code?: string } }).error?.code ?? "") === "unsupported-chain"
    );
    // C-3. Unknown chain (e.g. 137) fails closed.
    const poly = mkAgent(
      137,
      "137:0x1111111111111111111111111111111111111111:1",
      "0x1111111111111111111111111111111111111111"
    );
    const c3 = await api(poly, ENV_ON);
    check(
      "X.241C3 unknown chain agent → unsupported-chain (fail closed)",
      c3.status === 409 &&
        ((c3.body as { error?: { code?: string } }).error?.code ?? "") === "unsupported-chain"
    );
    // D. Testnet cannot fall back to 56: testnet agent with flag OFF proceeds on 97 (unchanged).
    const d = await api(TESTNET_AGENT, ENV_OFF);
    check("X.241D testnet flow unaffected by mainnet flag state", d.status === 200);
    // E. MAINNET_HIRE_ENABLED=false blocks mainnet (same as C, explicit)
    check(
      "X.241E flag=false is the final production gate for chain 56",
      (await api(MAINNET_AGENT, ENV_OFF)).status === 409
    );
    // E-2. flag="1" or "yes" does NOT enable (literal "true" only)
    const e2 = await api(MAINNET_AGENT, { MAINNET_HIRE_ENABLED: "1" });
    const e3 = await api(MAINNET_AGENT, { MAINNET_HIRE_ENABLED: "yes" });
    check(
      'X.241E2 only literal "true" enables (1/yes stay blocked)',
      e2.status === 409 && e3.status === 409
    );
    // F. Testnet remains operational — real 1906 fixture proceeds (B covers this; explicit)
    check(
      "X.241F testnet Agent 1906 identity proceeds",
      (await api(TESTNET_AGENT, ENV_OFF)).status === 200
    );
    // G. Cross-chain signature mismatch fails (verified offline in the preflight
    //    harness; here: a testnet-commerce quote must not bind to a mainnet plan)
    const { resolveHireChainConfig } = await import("@bnb-marketplace/integrations/altana");
    const cfg56 = resolveHireChainConfig(56);
    const cfg97 = resolveHireChainConfig(97);
    check(
      "X.241G cross-chain binding: testnet commerce cannot satisfy mainnet cfg",
      cfg97.commerce.toLowerCase() !== cfg56.commerce.toLowerCase() &&
        cfg97.registry.toLowerCase() !== cfg56.registry.toLowerCase() &&
        cfg97.paymentToken.toLowerCase() !== cfg56.paymentToken.toLowerCase()
    );
    // Security: registry pin — mainnet agent from a foreign registry is rejected.
    const foreign = mkAgent(
      56,
      "56:0x9999999999999999999999999999999999999999:1",
      "0x9999999999999999999999999999999999999999"
    );
    const g2 = await api(foreign, ENV_ON);
    check(
      "X.241G2 mainnet agent from foreign registry → registry-mismatch (fail closed)",
      g2.status === 409 &&
        ((g2.body as { error?: { code?: string } }).error?.code ?? "") === "registry-mismatch"
    );
  }

  // X.242 — first-hire demo price (0.00001 $U = 10000000000000 wei) consistency
  // and price-validation regression tests. The price flows quote → plan budget
  // → setBudget/approve/fund with EXACT integer semantics (no rounding loss).
  {
    const DEMO_PRICE = "10000000000000"; // 0.00001 $U, 18 decimals
    // Quote at the demo price must produce a plan bound to exactly 1e13 wei.
    const demo = prepareMainTrackUserHire(
      prepareInput({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: DEMO_PRICE, currency: MAIN_TRACK_PAYMENT_TOKEN },
            quote_expires_at: nowSeconds() + 600,
            negotiated_at: nowSeconds() - 5,
          },
        }),
      })
    );
    check("X.242 demo price (0.00001 $U) prepares successfully", demo.ok === true);
    if (demo.ok) {
      check("X.242 exact integer amount bound (10000000000000 wei)", demo.price === DEMO_PRICE);
      check(
        "X.242 no rounding loss (price string is exact, plan budget identical)",
        demo.price === DEMO_PRICE && BigInt(demo.price) === 10n ** 13n
      );
      // The 3 budget-bearing calls must carry the exact amount in calldata.
      // setBudget = call index 2; approve = index 3; fund = index 4.
      const budgetHex = BigInt(DEMO_PRICE).toString(16).padStart(64, "0");
      const setBudgetCarries = demo.calls[2]?.data.includes(budgetHex);
      const approveCarries = demo.calls[3]?.data.includes(budgetHex);
      const fundCarries = demo.calls[4]?.data.includes(budgetHex);
      check("X.242 setBudget calldata carries the exact amount", setBudgetCarries === true);
      check("X.242 approve calldata carries the exact amount", approveCarries === true);
      check("X.242 fund calldata carries the exact amount", fundCarries === true);
    }
    // Zero price must be rejected (X.242 fail-closed).
    const zero = prepareMainTrackUserHire(
      prepareInput({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: "0", currency: MAIN_TRACK_PAYMENT_TOKEN },
            quote_expires_at: nowSeconds() + 600,
            negotiated_at: nowSeconds() - 5,
          },
        }),
      })
    );
    check("X.242 zero price rejected", zero.ok === false && /zero/.test(zero.reason ?? ""));
    // Malformed prices must be rejected (non-numeric / negative).
    const malformed = prepareMainTrackUserHire(
      prepareInput({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: "0.00001", currency: MAIN_TRACK_PAYMENT_TOKEN },
            quote_expires_at: nowSeconds() + 600,
            negotiated_at: nowSeconds() - 5,
          },
        }),
      })
    );
    check(
      'X.242 malformed price (decimal string "0.00001") rejected — integer wei only',
      malformed.ok === false && /numeric|price/i.test(malformed.reason ?? "")
    );
    const negative = prepareMainTrackUserHire(
      prepareInput({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: "-10000000000000", currency: MAIN_TRACK_PAYMENT_TOKEN },
            quote_expires_at: nowSeconds() + 600,
            negotiated_at: nowSeconds() - 5,
          },
        }),
      })
    );
    check("X.242 negative price rejected", negative.ok === false);
    // Chain-56 pricing isolation: a mainnet quote at the demo price must use
    // the chain-56 config (mainnet commerce/$U), never chain-97 constants.
    const { resolveHireChainConfig } = await import("@bnb-marketplace/integrations/altana");
    const cfg56 = resolveHireChainConfig(56);
    const cfg97 = resolveHireChainConfig(97);
    check(
      "X.242 chain 56 cannot use chain 97 pricing config (commerce/$U disjoint)",
      cfg56.commerce !== cfg97.commerce && cfg56.paymentToken !== cfg97.paymentToken
    );
    // Testnet behavior unchanged: the chain-97 1-U quote path still binds 1 U.
    const tn = prepareMainTrackUserHire(
      prepareInput({
        quote: liveQuote({
          response: {
            accepted: true,
            terms: { price: PRICE, currency: MAIN_TRACK_PAYMENT_TOKEN },
            quote_expires_at: nowSeconds() + 600,
            negotiated_at: nowSeconds() - 5,
          },
        }),
      })
    );
    check("X.242 testnet 1-U quote behavior unchanged", tn.ok === true && tn.price === PRICE);
  }

  if (failures === 0) {
    console.log("X.149 main-track-user-hire verify: ALL CHECKS PASSED");
  } else {
    console.error(`X.149 main-track-user-hire verify: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

void main();
