/**
 * X.130 — Main Track V2 commercial hire verify harness (PURE, no network).
 *
 * Runs the isolated Main Track activation boundary against injected fakes for
 * every fail-closed case. Run after build:
 *   node dist/altana/v2/main-track-hire.verify.js
 *
 * Exit policy: 0 all checks pass; 1 any check fails.
 */

import {
  V2_ACTIVATION_CHAIN_ID,
  V2_ACTIVATION_COMMERCE,
  V2_ACTIVATION_PAYMENT_TOKEN,
  V2_REFERENCE_PRICE,
  composeV2CommercialAgreement,
} from "./commercial-agreement.js";
import type {
  V2CommercialAgreement,
  V2Quote,
  V2QuoteVerdict,
  V2RegistryIdentity,
} from "./commercial-agreement.js";
import type { V2HireOutcome } from "./hire-adapter.js";
import {
  buildMainTrackHireConfirmation,
  mainTrackHireStepLabel,
  runMainTrackV2HireActivation,
} from "./main-track-hire.js";
import type { MainTrackFundedJobRead, MainTrackV2HirePorts } from "./main-track-hire.js";

const SELLER = "0xB0f7681668f916eEd97dA066D31aA295D34727c0";
const OTHER = "0x1111111111111111111111111111111111111111";
const BUYER = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const MP = "0xeb237fb12588eaff8b907B8b9C1f5349969bb98d";
const AGENT_ID = "97:0x8004A818BFB912233c491871b3d84c89A494BD9e:1906";

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
    price: V2_REFERENCE_PRICE,
    currency: V2_ACTIVATION_PAYMENT_TOKEN,
    chainId: V2_ACTIVATION_CHAIN_ID,
    verifyingContract: V2_ACTIVATION_COMMERCE,
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

function agreement(
  opts: {
    provider?: string;
    verdict?: V2QuoteVerdict;
    q?: V2Quote;
  } = {}
): V2CommercialAgreement {
  const identity: V2RegistryIdentity = {
    agentId: AGENT_ID,
    chainId: V2_ACTIVATION_CHAIN_ID,
    isTestnet: true,
    ownerAddress: opts.provider ?? SELLER,
  };
  return composeV2CommercialAgreement({
    identity,
    sellerEndpoint: "https://seller.example.com/.well-known/agent-card.json",
    quote: opts.q ?? quote(),
    verdict: opts.verdict ?? verdict(),
    ctx: {
      expectedChainId: V2_ACTIVATION_CHAIN_ID,
      expectedCommerce: V2_ACTIVATION_COMMERCE,
      expectedPaymentToken: V2_ACTIVATION_PAYMENT_TOKEN,
      expectedPrice: V2_REFERENCE_PRICE,
      nowSeconds: nowSeconds(),
    },
  });
}

function negotiationOutcome(
  ag: V2CommercialAgreement,
  available = ag.validation.ok
): { outcome: V2HireOutcome; quote: Record<string, unknown> | null } {
  if (!available) {
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
    budget: V2_REFERENCE_PRICE,
    expiredAt: String(nowSeconds() + 100000),
    status: 1,
    statusName: "FUNDED",
  };
}

function ports(overrides: Partial<MainTrackV2HirePorts> = {}): MainTrackV2HirePorts {
  const ag = agreement();
  return {
    resolveMarketplaceClient: async () => ({ address: MP, source: "loaded_keystore", chainId: 97 }),
    runCommercialNegotiation: async () => negotiationOutcome(ag),
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

function input(overrides: Partial<Parameters<typeof runMainTrackV2HireActivation>[1]> = {}) {
  return {
    agentId: AGENT_ID,
    sellerAddress: SELLER,
    forbiddenClientAddress: BUYER,
    expectedChainId: V2_ACTIVATION_CHAIN_ID,
    expectedCommerce: V2_ACTIVATION_COMMERCE,
    expectedPaymentToken: V2_ACTIVATION_PAYMENT_TOKEN,
    expectedPrice: V2_REFERENCE_PRICE,
    request: {
      taskDescription: "deterministic report",
      terms: { deliverables: "JSON", qualityStandards: "deterministic" },
    },
    ...overrides,
  };
}

async function main(): Promise<void> {
  console.log("X.130 — MAIN TRACK V2 HIRE VERIFY (pure, no tx)");

  // 1. Success — marketplace client funds a new job to FUNDED; active stays false.
  {
    const out = await runMainTrackV2HireActivation(ports(), input());
    check("success: funded", out.ok === true && out.stage === "funded");
    if (out.ok) {
      check("success: jobId present", out.jobId === "641");
      check("success: fund tx present", typeof out.txHashes.fund === "string");
      check("success: client == marketplace", out.job.client.toLowerCase() === MP.toLowerCase());
      check("success: provider == seller", out.job.provider.toLowerCase() === SELLER.toLowerCase());
      check("success: budget == 1 U", out.job.budget === V2_REFERENCE_PRICE);
      check("success: status FUNDED", out.job.statusName === "FUNDED");
      check("success: active is false", out.active === false);
      check(
        "success: activationState funded-commercial-hire",
        out.activationState.state === "funded-commercial-hire"
      );
      check(
        "success: next action forbids submit/settle",
        out.nextRequiredAction.includes("NOT authorized by X.130")
      );
    }
  }

  // 2. Marketplace wallet missing.
  {
    const out = await runMainTrackV2HireActivation(
      ports({ resolveMarketplaceClient: async () => null }),
      input()
    );
    check("wallet missing: blocked", out.ok === false);
    if (!out.ok)
      check(
        "wallet missing: reason",
        out.blocked.reason.includes("marketplace wallet unavailable")
      );
  }

  // 3. Marketplace wallet wrong identity (not loaded_keystore).
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        resolveMarketplaceClient: async () => ({ address: MP, source: "imported", chainId: 97 }),
      }),
      input()
    );
    check("wallet identity: blocked", out.ok === false);
  }

  // 4. Buyer wallet cannot be selected as marketplace client.
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        resolveMarketplaceClient: async () => ({
          address: BUYER,
          source: "loaded_keystore",
          chainId: 97,
        }),
      }),
      input()
    );
    check("buyer-as-client: blocked", out.ok === false);
    if (!out.ok) check("buyer-as-client: reason", out.blocked.reason.includes("buyer wallet"));
  }

  // 5. Seller wallet cannot be selected as marketplace client.
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        resolveMarketplaceClient: async () => ({
          address: SELLER,
          source: "loaded_keystore",
          chainId: 97,
        }),
      }),
      input()
    );
    check("seller-as-client: blocked", out.ok === false);
  }

  // 6. Mainnet wallet (chain 56) cannot be used.
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        resolveMarketplaceClient: async () => ({
          address: MP,
          source: "loaded_keystore",
          chainId: 56,
        }),
      }),
      input()
    );
    check("mainnet wallet: blocked", out.ok === false);
  }

  // 7. Wrong provider (seller identity mismatch — valid agreement, wrong seller).
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        runCommercialNegotiation: async () =>
          negotiationOutcome(agreement({ provider: OTHER, verdict: verdict({ signer: OTHER }) })),
      }),
      input()
    );
    check("wrong provider: blocked", out.ok === false);
    if (!out.ok)
      check("wrong provider: reason", out.blocked.reason.includes("seller identity mismatch"));
  }

  // 8. Wrong signer (quote signature invalid).
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        runCommercialNegotiation: async () =>
          negotiationOutcome(
            agreement({
              verdict: verdict({ valid: false, reason: "provider signature is not valid" }),
            })
          ),
      }),
      input()
    );
    check("wrong signer: blocked", out.ok === false);
    if (!out.ok)
      check(
        "wrong signer: reason",
        out.blocked.reason.includes("commercial agreement not verified")
      );
  }

  // 9. Wrong chain.
  {
    const ag = agreement();
    const q = quote({ chainId: 56 });
    const bad = composeV2CommercialAgreement({
      identity: { agentId: AGENT_ID, chainId: 56, isTestnet: false, ownerAddress: SELLER },
      sellerEndpoint: "https://x/.well-known/agent-card.json",
      quote: q,
      verdict: verdict(),
      ctx: {
        expectedChainId: V2_ACTIVATION_CHAIN_ID,
        expectedCommerce: V2_ACTIVATION_COMMERCE,
        expectedPaymentToken: V2_ACTIVATION_PAYMENT_TOKEN,
        expectedPrice: V2_REFERENCE_PRICE,
        nowSeconds: nowSeconds(),
      },
    });
    void ag;
    const out = await runMainTrackV2HireActivation(
      ports({ runCommercialNegotiation: async () => negotiationOutcome(bad, false) }),
      input()
    );
    check("wrong chain: blocked", out.ok === false);
  }

  // 10. Wrong commerce contract.
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        runCommercialNegotiation: async () =>
          negotiationOutcome(
            composeV2CommercialAgreement({
              identity: { agentId: AGENT_ID, chainId: 97, isTestnet: true, ownerAddress: SELLER },
              sellerEndpoint: "https://x/.well-known/agent-card.json",
              quote: quote({ verifyingContract: OTHER }),
              verdict: verdict(),
              ctx: {
                expectedChainId: 97,
                expectedCommerce: V2_ACTIVATION_COMMERCE,
                expectedPaymentToken: V2_ACTIVATION_PAYMENT_TOKEN,
                expectedPrice: V2_REFERENCE_PRICE,
                nowSeconds: nowSeconds(),
              },
            }),
            false
          ),
      }),
      input()
    );
    check("wrong commerce: blocked", out.ok === false);
  }

  // 11. Wrong price.
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        runCommercialNegotiation: async () =>
          negotiationOutcome(
            composeV2CommercialAgreement({
              identity: { agentId: AGENT_ID, chainId: 97, isTestnet: true, ownerAddress: SELLER },
              sellerEndpoint: "https://x/.well-known/agent-card.json",
              quote: quote({ price: "2000000000000000000" }),
              verdict: verdict(),
              ctx: {
                expectedChainId: 97,
                expectedCommerce: V2_ACTIVATION_COMMERCE,
                expectedPaymentToken: V2_ACTIVATION_PAYMENT_TOKEN,
                expectedPrice: V2_REFERENCE_PRICE,
                nowSeconds: nowSeconds(),
              },
            }),
            false
          ),
      }),
      input()
    );
    check("wrong price: blocked", out.ok === false);
  }

  // 12. Expired quote.
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        runCommercialNegotiation: async () =>
          negotiationOutcome(
            composeV2CommercialAgreement({
              identity: { agentId: AGENT_ID, chainId: 97, isTestnet: true, ownerAddress: SELLER },
              sellerEndpoint: "https://x/.well-known/agent-card.json",
              quote: quote({ quoteExpiresAt: nowSeconds() - 5 }),
              verdict: verdict(),
              ctx: {
                expectedChainId: 97,
                expectedCommerce: V2_ACTIVATION_COMMERCE,
                expectedPaymentToken: V2_ACTIVATION_PAYMENT_TOKEN,
                expectedPrice: V2_REFERENCE_PRICE,
                nowSeconds: nowSeconds(),
              },
            }),
            false
          ),
      }),
      input()
    );
    check("expired quote: blocked", out.ok === false);
  }

  // 13. Unavailable endpoint (negotiation blocked).
  {
    const out = await runMainTrackV2HireActivation(
      ports({
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
      input()
    );
    check("endpoint unavailable: blocked", out.ok === false);
    if (!out.ok)
      check("endpoint unavailable: reason", out.blocked.reason.includes("endpoint unreachable"));
  }

  // 14. Failed createJob (no job id returned).
  {
    const out = await runMainTrackV2HireActivation(
      ports({ executeErc8183Hire: async () => ({ jobId: "", txHashes: {}, blockNumbers: {} }) }),
      input()
    );
    check("failed createJob: blocked", out.ok === false);
    if (!out.ok) check("failed createJob: reason", out.blocked.reason.includes("createJob"));
  }

  // 15. Failed fund (no fund transaction hash).
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        executeErc8183Hire: async () => ({
          jobId: "641",
          txHashes: { createJob: "0x1" },
          blockNumbers: {},
        }),
      }),
      input()
    );
    check("failed fund: blocked", out.ok === false);
    if (!out.ok) check("failed fund: reason", out.blocked.reason.includes("fund"));
  }

  // 16. Executor throws (transaction failure).
  {
    const out = await runMainTrackV2HireActivation(
      ports({
        executeErc8183Hire: async () => {
          throw new Error("reverted");
        },
      }),
      input()
    );
    check("executor throws: blocked", out.ok === false);
    if (!out.ok)
      check("executor throws: reason", out.blocked.reason.includes("transaction failed"));
  }

  // 17. Seller/client mismatch on the on-chain read.
  {
    const out = await runMainTrackV2HireActivation(
      ports({ readJob: async () => ({ ...fundedJob(), client: OTHER }) }),
      input()
    );
    check("seller/client mismatch (client): blocked", out.ok === false);
  }

  // 18. Job read not FUNDED.
  {
    const out = await runMainTrackV2HireActivation(
      ports({ readJob: async () => ({ ...fundedJob(), status: 0, statusName: "OPEN" }) }),
      input()
    );
    check("not funded on chain: blocked", out.ok === false);
  }

  // 19. Job 622 historical evidence cannot become a new activation.
  {
    const out = await runMainTrackV2HireActivation(
      ports(),
      input({ historicalEvidence: { jobId: "622", status: "COMPLETED" } })
    );
    check("job622 historical: funded (allowed as history only)", out.ok === true);
    if (out.ok) {
      check("job622 historical: new jobId != 622", out.jobId !== "622");
      check("job622 historical: active false", out.active === false);
    }
  }

  // 20. Confirmation + step labels (pure UI surface).
  {
    const confirmation = buildMainTrackHireConfirmation(agreement());
    check("confirmation: agent identity", confirmation.agent === AGENT_ID);
    check("confirmation: seller identity", confirmation.sellerIdentity === SELLER);
    check("confirmation: price 1 U", confirmation.price === V2_REFERENCE_PRICE);
    check("confirmation: chain BSC testnet", confirmation.chain.includes("97"));
    check("confirmation: quote expiry set", typeof confirmation.quoteExpiry === "number");
    check("confirmation: what will happen", confirmation.whatWillHappen.length > 0);
    check(
      "step labels honest",
      mainTrackHireStepLabel("creating") === "Creating job" &&
        mainTrackHireStepLabel("funded") === "Funded"
    );
  }

  if (failures === 0) {
    console.log("X.130 main-track-hire verify: ALL CHECKS PASSED");
  } else {
    console.error(`X.130 main-track-hire verify: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

void main();
