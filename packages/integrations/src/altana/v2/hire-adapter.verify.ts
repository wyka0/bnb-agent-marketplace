/**
 * X.127 — Marketplace-to-V2 hire adapter verify harness (PURE, no network).
 *
 * Runs the isolated adapter against injected fakes for every security case the
 * integration must fail closed on. Run after build:
 *   node dist/altana/v2/hire-adapter.verify.js
 *
 * Exit policy: 0 all checks pass; 1 any check fails.
 */

import {
  V2_ACTIVATION_CHAIN_ID,
  V2_ACTIVATION_COMMERCE,
  V2_ACTIVATION_PAYMENT_TOKEN,
  V2_REFERENCE_PRICE,
  composeV2CommercialAgreement,
  validateV2Quote,
  v2AgreementActivationState,
} from "./commercial-agreement.js";
import type {
  V2Quote,
  V2QuoteValidationContext,
  V2QuoteVerdict,
  V2RegistryIdentity,
} from "./commercial-agreement.js";
import { runV2HireNegotiation } from "./hire-adapter.js";
import type { V2HirePorts } from "./hire-adapter.js";

const SELLER = "0xB0f7681668f916eEd97dA066D31aA295D34727c0";
const OTHER = "0x1111111111111111111111111111111111111111";
const AGENT_ID = "97:0x8004A818BFB912233c491871b3d84c89A494BD9e:1906";
const ENDPOINT = "https://seller.example.com/.well-known/agent-card.json";

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`ok   ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function ctx(overrides: Partial<V2QuoteValidationContext> = {}): V2QuoteValidationContext {
  return {
    expectedChainId: V2_ACTIVATION_CHAIN_ID,
    expectedCommerce: V2_ACTIVATION_COMMERCE,
    expectedPaymentToken: V2_ACTIVATION_PAYMENT_TOKEN,
    expectedPrice: V2_REFERENCE_PRICE,
    nowSeconds: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function quote(overrides: Partial<V2Quote> = {}): V2Quote {
  const now = Math.floor(Date.now() / 1000);
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

function identity(overrides: Partial<V2RegistryIdentity> = {}): V2RegistryIdentity {
  return {
    agentId: AGENT_ID,
    chainId: V2_ACTIVATION_CHAIN_ID,
    isTestnet: true,
    ownerAddress: SELLER,
    ...overrides,
  };
}

function ports(overrides: Partial<V2HirePorts> = {}): V2HirePorts {
  return {
    resolveAgentIdentity: async () => identity(),
    resolveRegisteredEndpoint: async () => ENDPOINT,
    negotiate: async () => quote(),
    verifyQuote: async () => verdict(),
    ...overrides,
  };
}

async function main(): Promise<void> {
  console.log("X.127 — MARKETPLACE-TO-V2 HIRE ADAPTER VERIFY (pure, no tx)");

  // 1. Success — commercial boundary reached; no fabrication.
  {
    const out = await runV2HireNegotiation(ports(), {
      agentId: AGENT_ID,
      request: { taskDescription: "test", terms: { deliverables: "x", qualityStandards: "y" } },
      ctx: ctx(),
    });
    check("success: available", out.available === true);
    if (out.available) {
      check("success: provider bound", out.agreement.provider === SELLER);
      check("success: chain 97", out.agreement.chainId === 97);
      check("success: commerce official", out.agreement.commerce === V2_ACTIVATION_COMMERCE);
      check("success: price 1 U", out.agreement.price === V2_REFERENCE_PRICE);
      check("success: signature verified", out.agreement.providerSignature.verified === true);
      check("success: signer == provider", out.agreement.providerSignature.signer === SELLER);
      check("success: no resource fabricated", out.agreement.resource === null);
      check(
        "success: no executionCapability fabricated",
        out.agreement.executionCapability === null
      );
      check("success: no jobId fabricated", out.agreement.jobId === null);
      check("success: no sessionId fabricated", out.agreement.sessionId === null);
      check("success: active is false", out.agreement.active === false);
      check("success: activationState actionable false", out.activationState.actionable === false);
      check(
        "success: next action states tx requirement",
        out.nextRequiredAction.includes("NEW ERC-8183 job")
      );
    }
  }

  // 2. Wrong signer rejection.
  {
    const out = await runV2HireNegotiation(
      ports({ verifyQuote: async () => verdict({ signer: OTHER }) }),
      {
        agentId: AGENT_ID,
        request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
        ctx: ctx(),
      }
    );
    check("wrong signer: blocked", out.available === false);
    if (!out.available) check("wrong signer: stage validation", out.blocked.stage === "validation");
  }

  // 3. Wrong chain rejection.
  {
    const out = await runV2HireNegotiation(
      ports({ negotiate: async () => quote({ chainId: 56 }) }),
      {
        agentId: AGENT_ID,
        request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
        ctx: ctx(),
      }
    );
    check("wrong chain: blocked", out.available === false);
    if (!out.available) check("wrong chain: stage validation", out.blocked.stage === "validation");
  }

  // 4. Wrong commerce contract rejection.
  {
    const out = await runV2HireNegotiation(
      ports({ negotiate: async () => quote({ verifyingContract: OTHER }) }),
      {
        agentId: AGENT_ID,
        request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
        ctx: ctx(),
      }
    );
    check("wrong commerce: blocked", out.available === false);
    if (!out.available)
      check("wrong commerce: stage validation", out.blocked.stage === "validation");
  }

  // 5. Expired quote rejection.
  {
    const now = Math.floor(Date.now() / 1000);
    const out = await runV2HireNegotiation(
      ports({ negotiate: async () => quote({ quoteExpiresAt: now - 5 }) }),
      {
        agentId: AGENT_ID,
        request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
        ctx: ctx(),
      }
    );
    check("expired quote: blocked", out.available === false);
  }

  // 6. Price mismatch rejection.
  {
    const out = await runV2HireNegotiation(
      ports({ negotiate: async () => quote({ price: "2000000000000000000" }) }),
      {
        agentId: AGENT_ID,
        request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
        ctx: ctx(),
      }
    );
    check("price mismatch: blocked", out.available === false);
    if (!out.available)
      check("price mismatch: stage validation", out.blocked.stage === "validation");
  }

  // 7. Provider mismatch rejection (verdict signer != registry owner).
  {
    const out = await runV2HireNegotiation(
      ports({ verifyQuote: async () => verdict({ valid: true, signer: OTHER }) }),
      {
        agentId: AGENT_ID,
        request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
        ctx: ctx(),
      }
    );
    check("provider mismatch: blocked", out.available === false);
  }

  // 8. Missing endpoint rejection.
  {
    const out = await runV2HireNegotiation(ports({ resolveRegisteredEndpoint: async () => null }), {
      agentId: AGENT_ID,
      request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
      ctx: ctx(),
    });
    check("missing endpoint: blocked", out.available === false);
    if (!out.available) check("missing endpoint: stage endpoint", out.blocked.stage === "endpoint");
  }

  // 9. Fail-closed behavior: missing identity / failed negotiation.
  {
    const noIdentity = await runV2HireNegotiation(
      ports({ resolveAgentIdentity: async () => null }),
      {
        agentId: AGENT_ID,
        request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
        ctx: ctx(),
      }
    );
    check("missing identity: blocked", noIdentity.available === false);
    const noNegotiation = await runV2HireNegotiation(ports({ negotiate: async () => null }), {
      agentId: AGENT_ID,
      request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
      ctx: ctx(),
    });
    check("failed negotiation: blocked", noNegotiation.available === false);
  }

  // 10. Job 622 historical evidence cannot become a new activation.
  {
    const out = await runV2HireNegotiation(ports(), {
      agentId: AGENT_ID,
      request: { taskDescription: "t", terms: { deliverables: "x", qualityStandards: "y" } },
      ctx: ctx(),
      historicalEvidence: { jobId: "622", status: "COMPLETED" },
    });
    check("job622 historical: available", out.available === true);
    if (out.available) {
      check("job622 historical: jobId NOT fabricated", out.agreement.jobId === null);
      check("job622 historical: active false", out.agreement.active === false);
      check(
        "job622 historical: recorded only as history",
        out.agreement.historicalEvidence?.jobId === "622"
      );
      check(
        "job622 historical: activationState actionable false",
        out.activationState.actionable === false
      );
      check(
        "job622 historical: activation reason excludes new-activation",
        out.activationState.reason.includes("no marketplace-funded ERC-8183 job")
      );
    }
  }

  // 11. Pure validator edge cases.
  {
    const c = ctx();
    check("validate: ok", validateV2Quote(quote(), c).ok === true);
    check("validate: wrong token", validateV2Quote(quote({ currency: OTHER }), c).ok === false);
    check(
      "validate: missing hash",
      validateV2Quote(quote({ negotiationHash: "" }), c).ok === false
    );
    check("validate: missing sig", validateV2Quote(quote({ providerSig: "" }), c).ok === false);
    check("validate: not accepted", validateV2Quote(quote({ accepted: false }), c).ok === false);
    check("validate: null", validateV2Quote(null, c).ok === false);
  }

  // 12. compose direct: identity not testnet / not chain 97 fails closed.
  {
    const agreement = composeV2CommercialAgreement({
      identity: identity({ chainId: 56, isTestnet: false }),
      sellerEndpoint: ENDPOINT,
      quote: quote(),
      verdict: verdict(),
      ctx: ctx(),
    });
    check("compose: mainnet identity fails closed", agreement.validation.ok === false);
    check("compose: mainnet identity active false", agreement.active === false);
  }

  // 13. v2AgreementActivationState is always not actionable.
  {
    const agreement = composeV2CommercialAgreement({
      identity: identity(),
      sellerEndpoint: ENDPOINT,
      quote: quote(),
      verdict: verdict(),
      ctx: ctx(),
    });
    const state = v2AgreementActivationState(agreement);
    check("activation state: actionable false", state.actionable === false);
    check(
      "activation state: commercial-agreement-only",
      state.state === "commercial-agreement-only"
    );
  }

  if (failures === 0) {
    console.log("X.127 hire-adapter verify: ALL CHECKS PASSED");
  } else {
    console.error(`X.127 hire-adapter verify: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

void main();
