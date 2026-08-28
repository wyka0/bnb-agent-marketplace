/**
 * X.127 — Marketplace-to-V2 hire adapter (PURE orchestration, injected I/O).
 *
 * Connects the marketplace Hire pipeline to the proven BNB Agent Studio V2
 * commercial path WITHOUT wiring the official @bnbagent/sdk into the
 * marketplace package. All I/O is injected through `V2HirePorts` so the
 * orchestration is deterministic, network-free, and unit-testable. The caller
 * (or an isolated proof harness) supplies the real SDK-backed implementations.
 *
 * The adapter:
 *   1. resolves an authoritative marketplace Agent identity
 *   2. requires chain-97 testnet + a registry owner
 *   3. resolves the registered seller endpoint
 *   4. negotiates against the seller
 *   5. verifies the provider signature (official SDK verdict, injected)
 *   6. validates chain / commerce / token / price / expiry / provider
 *   7. returns a typed `V2CommercialAgreement`
 *
 * It NEVER fabricates a capability, resource, job, session, ACTIVE state, or
 * transaction, and NEVER submits anything. `available:true` means only that the
 * verified commercial boundary was reached — NOT that activation is available.
 */

import type {
  V2CommercialAgreement,
  V2NegotiationRequest,
  V2Quote,
  V2QuoteValidationContext,
  V2QuoteVerdict,
  V2RegistryIdentity,
} from "./commercial-agreement.js";
import { composeV2CommercialAgreement } from "./commercial-agreement.js";

/** Injected I/O boundary. The real SDK-backed implementation is supplied by
 * the isolated proof harness (not this package). */
export interface V2HirePorts {
  /** Resolve the marketplace Agent identity from authoritative registry data. */
  resolveAgentIdentity(agentId: string): Promise<V2RegistryIdentity | null>;
  /** Resolve the registered seller endpoint for an agent. */
  resolveRegisteredEndpoint(agentId: string): Promise<string | null>;
  /** Perform a single negotiation round against the seller endpoint. */
  negotiate(sellerEndpoint: string, request: V2NegotiationRequest): Promise<V2Quote | null>;
  /** Verify the quote's provider signature (official SDK `verifyQuoteSignature`). */
  verifyQuote(
    quote: V2Quote,
    provider: string,
    expectedChainId: number,
    expectedCommerce: string
  ): Promise<V2QuoteVerdict>;
}

export interface RunV2HireNegotiationInput {
  agentId: string;
  request: V2NegotiationRequest;
  ctx: V2QuoteValidationContext;
  /** Proven historical job evidence — referenced ONLY as history, never a new activation. */
  historicalEvidence?: { jobId: string; status: string } | null;
}

export type V2HireOutcome =
  | { available: false; agentId: string; blocked: { stage: string; reason: string } }
  | {
      available: true;
      agentId: string;
      agreement: V2CommercialAgreement;
      activationState: { actionable: false; state: "commercial-agreement-only"; reason: string };
      nextRequiredAction: string;
    };

/** The exact next step a production activation would require (no tx authorized). */
export const V2_ACTIVATION_NEXT_REQUIRED_ACTION =
  "Create and fund a NEW ERC-8183 job with the marketplace as client (requires explicit authorization, marketplace client custody, budget, and a job-bound resource/executionCapability authority). No transaction is authorized by this adapter.";

/**
 * Run the marketplace-to-V2 hire negotiation boundary. Fails closed on any
 * missing/invalid input. Never fabricates, never submits.
 */
export async function runV2HireNegotiation(
  ports: V2HirePorts,
  input: RunV2HireNegotiationInput
): Promise<V2HireOutcome> {
  const { agentId, request, ctx } = input;
  if (typeof agentId !== "string" || agentId.length === 0) {
    return {
      available: false,
      agentId,
      blocked: { stage: "identity", reason: "missing agent id" },
    };
  }

  const identity = await ports.resolveAgentIdentity(agentId);
  if (
    !identity ||
    typeof identity.ownerAddress !== "string" ||
    identity.ownerAddress.length === 0
  ) {
    return {
      available: false,
      agentId,
      blocked: {
        stage: "identity",
        reason: "agent identity not resolved from authoritative registry",
      },
    };
  }
  if (identity.chainId !== ctx.expectedChainId || identity.isTestnet !== true) {
    return {
      available: false,
      agentId,
      blocked: {
        stage: "identity",
        reason: `agent is not chain-${ctx.expectedChainId} testnet (chain ${identity.chainId}, testnet ${identity.isTestnet})`,
      },
    };
  }

  const endpoint = await ports.resolveRegisteredEndpoint(agentId);
  if (typeof endpoint !== "string" || endpoint.trim().length === 0) {
    return {
      available: false,
      agentId,
      blocked: { stage: "endpoint", reason: "no registered seller endpoint" },
    };
  }

  const quote = await ports.negotiate(endpoint, request);
  if (!quote) {
    return {
      available: false,
      agentId,
      blocked: {
        stage: "negotiation",
        reason: "seller negotiation failed or endpoint unreachable",
      },
    };
  }

  const verdict = await ports.verifyQuote(
    quote,
    identity.ownerAddress,
    ctx.expectedChainId,
    ctx.expectedCommerce
  );

  const agreement = composeV2CommercialAgreement({
    identity,
    sellerEndpoint: endpoint,
    quote,
    verdict,
    ctx,
    historicalEvidence: input.historicalEvidence ?? null,
  });

  if (!agreement.validation.ok) {
    return {
      available: false,
      agentId,
      blocked: { stage: "validation", reason: agreement.validation.reason ?? "validation failed" },
    };
  }

  const activationState = {
    actionable: false as const,
    state: "commercial-agreement-only" as const,
    reason:
      "Verified commercial agreement reached, but activation is not available: no marketplace-funded ERC-8183 job, no job-bound resource/executionCapability authority, and no custody exist.",
  };

  return {
    available: true,
    agentId,
    agreement,
    activationState,
    nextRequiredAction: V2_ACTIVATION_NEXT_REQUIRED_ACTION,
  };
}
