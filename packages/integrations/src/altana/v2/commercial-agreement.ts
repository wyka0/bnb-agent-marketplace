/**
 * X.127 — V2 commercial agreement (PURE, framework-free, no I/O).
 *
 * The typed boundary between the marketplace Hire pipeline and the proven
 * BNB Agent Studio V2 commercial path (official @bnbagent/sdk negotiation:
 * negotiate -> provider_sig -> verifyQuoteSignature -> funded job).
 *
 * This module defines the SHAPE of a verified commercial agreement and the
 * pure validation of its fields. It performs NO network, NO signing, NO
 * transaction, NO session, and NEVER fabricates a capability, resource, job,
 * session, or ACTIVE state. Every field that the V2 commercial agreement does
 * NOT authoritatively attest is explicitly `null` / `false`.
 *
 * The V2 commercial agreement attests:
 *   - provider identity (registry owner == quote signer)
 *   - verified provider signature (EIP-191 / ERC-1271)
 *   - chain binding (97)
 *   - commerce-contract binding
 *   - payment token
 *   - exact price
 *   - quote expiry
 *
 * It does NOT attest `resource`, `executionCapability`, or a job binding.
 * Those remain absent on the agreement object; nothing here invents them.
 */

/** The only chain the V2 commercial path is supported on (BNB testnet). */
export const V2_ACTIVATION_CHAIN_ID = 97 as const;

/** Official chain-97 ERC-8183 commerce contract (authoritative SDK table). */
export const V2_ACTIVATION_COMMERCE = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE" as const;

/** Official chain-97 $U payment token. */
export const V2_ACTIVATION_PAYMENT_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565" as const;

/** Reference price used by the proven testnet lifecycle (1 U raw). */
export const V2_REFERENCE_PRICE = "1000000000000000000" as const;

/** The seller's negotiated request shape (mirrors the official SDK request). */
export interface V2NegotiationRequest {
  taskDescription: string;
  terms: {
    deliverables: string;
    qualityStandards: string;
    successCriteria?: string[];
  };
}

/**
 * A provider quote as returned by a seller's `/negotiate` endpoint. Field names
 * mirror the official SDK `NegotiationResult.toDict()` / quote wire shape.
 */
export interface V2Quote {
  accepted: boolean;
  price: string;
  currency: string;
  chainId: number;
  verifyingContract: string;
  negotiatedAt: number;
  quoteExpiresAt: number;
  negotiationHash: string;
  providerSig: string;
  task?: string;
}

/** Result of verifying the quote's provider signature (official SDK verdict). */
export interface V2QuoteVerdict {
  valid: boolean;
  method?: "eip191" | "erc1271";
  signer?: string;
  reason?: string;
}

/** The authoritative marketplace registry identity (8004scan / ERC-8004). */
export interface V2RegistryIdentity {
  agentId: string;
  chainId: number;
  isTestnet: boolean;
  ownerAddress: string | null;
  name?: string | null;
}

/** Validation context for a quote (expected/authoritative values). */
export interface V2QuoteValidationContext {
  expectedChainId: number;
  expectedCommerce: string;
  expectedPaymentToken: string;
  expectedPrice: string;
  nowSeconds: number;
}

/** A typed, verified V2 commercial agreement. No capability/resource/job/session. */
export interface V2CommercialAgreement {
  kind: "v2-commercial-agreement";
  agentIdentity: string;
  provider: string;
  chainId: number;
  commerce: string;
  paymentToken: string;
  price: string;
  sellerEndpoint: string;
  negotiationHash: string;
  quoteExpiresAt: number;
  providerSignature: {
    present: boolean;
    verified: boolean;
    method: "eip191" | "erc1271" | null;
    signer: string | null;
  };
  /** Explicitly absent — the V2 quote schema does not attest a resource. */
  resource: null;
  /** Explicitly absent — the V2 quote schema does not attest an execution capability. */
  executionCapability: null;
  /** Explicitly absent — this adapter never creates or binds a job. */
  jobId: null;
  /** Explicitly absent — no session is created by this adapter. */
  sessionId: null;
  /** Always false — a commercial agreement is NOT an active activation. */
  active: false;
  createdAt: string;
  /** Historical (proven) job evidence, referenced ONLY as history — never as a new activation. */
  historicalEvidence: { jobId: string; status: string } | null;
  validation: { ok: boolean; reason: string | null };
}

function eqAddress(a: string, b: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(a) && a.toLowerCase() === b.toLowerCase();
}

/**
 * Pure, deterministic validation of a provider quote against the expected
 * chain / commerce / token / price / expiry. Rejects every security case the
 * V2 path must fail closed on. Returns `{ ok, reason }`; never throws.
 */
export function validateV2Quote(
  quote: V2Quote | null | undefined,
  ctx: V2QuoteValidationContext
): { ok: boolean; reason: string | null } {
  if (!quote || typeof quote !== "object") {
    return { ok: false, reason: "no provider quote" };
  }
  if (quote.accepted !== true) {
    return { ok: false, reason: "quote not accepted" };
  }
  if (quote.chainId !== ctx.expectedChainId) {
    return {
      ok: false,
      reason: `wrong chain: expected ${ctx.expectedChainId}, got ${quote.chainId}`,
    };
  }
  if (!eqAddress(quote.verifyingContract, ctx.expectedCommerce)) {
    return { ok: false, reason: "wrong commerce contract" };
  }
  if (!eqAddress(quote.currency, ctx.expectedPaymentToken)) {
    return { ok: false, reason: "wrong payment token" };
  }
  if (quote.price !== ctx.expectedPrice) {
    return {
      ok: false,
      reason: `price mismatch: expected ${ctx.expectedPrice}, got ${quote.price}`,
    };
  }
  if (
    typeof quote.quoteExpiresAt !== "number" ||
    !Number.isSafeInteger(quote.quoteExpiresAt) ||
    quote.quoteExpiresAt <= ctx.nowSeconds
  ) {
    return { ok: false, reason: "quote expired or malformed expiry" };
  }
  if (typeof quote.negotiationHash !== "string" || quote.negotiationHash.length === 0) {
    return { ok: false, reason: "missing negotiation hash" };
  }
  if (typeof quote.providerSig !== "string" || quote.providerSig.length === 0) {
    return { ok: false, reason: "missing provider signature" };
  }
  return { ok: true, reason: null };
}

/**
 * Compose a typed `V2CommercialAgreement` from authoritative inputs.
 *
 * The result always carries `active:false`, `resource:null`,
 * `executionCapability:null`, `jobId:null`, `sessionId:null` — no fabricated
 * activation. `validation.ok` is false unless EVERY gate passes:
 *   - agent is chain-97 testnet with a registry owner
 *   - a seller endpoint is present
 *   - the quote validates (chain/commerce/token/price/expiry/hash/sig)
 *   - the provider signature verifies to exactly the registry owner
 */
export function composeV2CommercialAgreement(input: {
  identity: V2RegistryIdentity;
  sellerEndpoint: string;
  quote: V2Quote;
  verdict: V2QuoteVerdict;
  ctx: V2QuoteValidationContext;
  historicalEvidence?: { jobId: string; status: string } | null;
  nowIso?: string;
}): V2CommercialAgreement {
  const { identity, sellerEndpoint, quote, verdict, ctx } = input;
  const provider = identity.ownerAddress ?? "";
  const createdAt = input.nowIso ?? new Date().toISOString();

  let reason: string | null = null;
  if (!provider) {
    reason = "registry identity has no owner address (provider missing)";
  } else if (identity.chainId !== ctx.expectedChainId || identity.isTestnet !== true) {
    reason = `agent is not chain-${ctx.expectedChainId} testnet (chain ${identity.chainId}, testnet ${identity.isTestnet})`;
  } else if (typeof sellerEndpoint !== "string" || sellerEndpoint.trim().length === 0) {
    reason = "missing seller endpoint";
  } else {
    const quoteValidation = validateV2Quote(quote, ctx);
    if (!quoteValidation.ok) {
      reason = quoteValidation.reason;
    } else if (verdict?.valid !== true || !eqAddress(verdict.signer ?? "", provider)) {
      reason = "provider signature invalid or signer mismatch";
    }
  }

  return {
    kind: "v2-commercial-agreement",
    agentIdentity: identity.agentId,
    provider,
    chainId: identity.chainId,
    commerce: ctx.expectedCommerce,
    paymentToken: ctx.expectedPaymentToken,
    price: quote?.price ?? ctx.expectedPrice,
    sellerEndpoint,
    negotiationHash: quote?.negotiationHash ?? "",
    quoteExpiresAt: quote?.quoteExpiresAt ?? 0,
    providerSignature: {
      present: typeof quote?.providerSig === "string" && quote.providerSig.length > 0,
      verified:
        verdict?.valid === true && eqAddress(verdict.signer ?? "", provider) && reason === null,
      method: verdict?.valid === true && reason === null ? (verdict.method ?? null) : null,
      signer: verdict?.valid === true ? (verdict.signer ?? null) : null,
    },
    resource: null,
    executionCapability: null,
    jobId: null,
    sessionId: null,
    active: false,
    createdAt,
    historicalEvidence: input.historicalEvidence ?? null,
    validation: { ok: reason === null, reason },
  };
}

/**
 * Whether a composed agreement is actionable as an ACTIVATION.
 *
 * A V2 commercial agreement is NEVER an activation: no job exists, no resource
 * is attested, no execution capability is attested, and no custody is granted.
 * This function always returns false so downstream gates can never treat the
 * commercial boundary as an active session or an executable capability.
 */
export function v2AgreementActivationState(_agreement: V2CommercialAgreement): {
  actionable: false;
  state: "commercial-agreement-only";
  reason: string;
} {
  return {
    actionable: false,
    state: "commercial-agreement-only",
    reason:
      "Verified commercial agreement reached, but activation is not available: no marketplace-funded ERC-8183 job, no job-bound resource/executionCapability authority, and no custody exist.",
  };
}
