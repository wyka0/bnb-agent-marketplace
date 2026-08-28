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
} from "./main-track-user-hire.ts";
import { prepareLiveAgentHire } from "./main-track-negotiation.server.ts";
import type { LiveAgentHirePorts } from "./main-track-negotiation.server.ts";

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

  if (failures === 0) {
    console.log("X.149 main-track-user-hire verify: ALL CHECKS PASSED");
  } else {
    console.error(`X.149 main-track-user-hire verify: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

void main();
