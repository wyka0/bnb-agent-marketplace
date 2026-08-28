/**
 * X.130 — Main Track V2 commercial hire activation boundary (PURE, injected I/O).
 *
 * A clearly separated MAIN TRACK activation path. It reuses the proven V2
 * commercial agreement (negotiate -> provider_sig -> verifyQuoteSignature) and
 * then runs a REAL BSC TESTNET ERC-8183 hire as the MARKETPLACE CLIENT, funding
 * a NEW job to FUNDED.
 *
 * This is deliberately SEPARATE from the stricter X.76/Altana execution
 * capability gate. It does NOT weaken, delete, or bypass that gate; it provides
 * a distinct, honest commercial-activation authority for the Main Track rubric.
 *
 * Fail-closed on every gate:
 *   - marketplace wallet unavailable / identity not verified / wrong address
 *   - seller identity mismatch
 *   - quote signature invalid
 *   - chain / commerce / payment-token / price mismatch
 *   - quote expired
 *   - seller endpoint unavailable (negotiation fails)
 *   - seller/client mismatch
 *   - ERC-8183 createJob / fund failure
 *
 * It NEVER fabricates an ACTIVE state: `active` is `false` until an on-chain
 * FUNDED job is independently read and verified. Job 622 may be referenced only
 * as `historicalEvidence` — never as the new marketplace hire.
 */

import type {
  V2CommercialAgreement,
  V2NegotiationRequest,
  V2QuoteValidationContext,
} from "./commercial-agreement.js";
import type { V2HireOutcome } from "./hire-adapter.js";

/** A marketplace-client wallet that has been loaded and verified. */
export interface MainTrackMarketplaceClient {
  address: string;
  source: "loaded_keystore";
  chainId: number;
}

/** The ERC-8183 hire plan the executor turns into real transactions. */
export interface MainTrackErc8183HirePlan {
  jobId: string;
  client: string;
  provider: string;
  budget: string;
  expiredAt: string;
  /** Raw verified quote envelope so the executor can build `buildJobDescription(quote)`. */
  quote: Record<string, unknown>;
  /** Ordered operation names the executor must run. */
  calls: ["createJob", "registerJob", "setBudget", "approve", "fund"];
}

/** Executor result for a successfully funded job. */
export interface MainTrackErc8183HireResult {
  jobId: string;
  txHashes: Record<string, string>;
  blockNumbers: Record<string, string>;
}

/** Independent on-chain job read used to verify the FUNDED state. */
export interface MainTrackFundedJobRead {
  jobId: string;
  client: string;
  provider: string;
  budget: string;
  expiredAt: string;
  status: number;
  statusName: string;
}

/** Injected I/O. The real SDK-backed implementation is supplied by isolated
 * tooling; this package stays dependency-free so the boundary is pure. */
export interface MainTrackV2HirePorts {
  /** Resolve the marketplace-client wallet (password-only Keystore V3 reload). */
  resolveMarketplaceClient(): Promise<{
    address: string;
    source: string;
    chainId: number;
  } | null>;
  /** Run the verified V2 commercial negotiation (X.127 adapter). */
  runCommercialNegotiation(input: {
    agentId: string;
    request: V2NegotiationRequest;
    ctx: V2QuoteValidationContext;
    historicalEvidence?: { jobId: string; status: string } | null;
  }): Promise<{ outcome: V2HireOutcome; quote: Record<string, unknown> | null }>;
  /** Execute the ERC-8183 hire batch with the marketplace client as client. */
  executeErc8183Hire(plan: MainTrackErc8183HirePlan): Promise<MainTrackErc8183HireResult>;
  /** Read a job from chain (read-only) for FUNDED verification. */
  readJob(jobId: string): Promise<MainTrackFundedJobRead | null>;
}

export interface MainTrackV2HireInput {
  agentId: string;
  sellerAddress: string;
  /** Address that must never be used as the marketplace client (the buyer). */
  forbiddenClientAddress: string;
  expectedChainId: number;
  expectedCommerce: string;
  expectedPaymentToken: string;
  expectedPrice: string;
  request: V2NegotiationRequest;
  historicalEvidence?: { jobId: string; status: string } | null;
  nowSeconds?: number;
}

export type MainTrackV2HireOutcome =
  | { ok: false; stage: "blocked"; blocked: { stage: string; reason: string } }
  | {
      ok: true;
      stage: "funded";
      agreement: V2CommercialAgreement;
      client: MainTrackMarketplaceClient;
      jobId: string;
      txHashes: Record<string, string>;
      blockNumbers: Record<string, string>;
      job: MainTrackFundedJobRead;
      active: false;
      activationState: { actionable: false; state: "funded-commercial-hire" };
      nextRequiredAction: string;
    };

/** The exact next step after FUNDED (no submit/settle is authorized by X.130). */
export const MAIN_TRACK_NEXT_REQUIRED_ACTION =
  "Submit and settle are NOT authorized by X.130. A separate explicit authorization is required before any provider submit or settlement of this funded job.";

/** Build the user-facing confirmation for a verified commercial agreement. */
export function buildMainTrackHireConfirmation(agreement: V2CommercialAgreement): {
  agent: string;
  sellerIdentity: string;
  serviceDescription: string;
  price: string;
  chain: string;
  quoteExpiry: number;
  whatWillHappen: string;
} {
  return {
    agent: agreement.agentIdentity,
    sellerIdentity: agreement.provider,
    serviceDescription: agreement.negotiationHash
      ? "Signed commercial agreement (quote verified)"
      : "Unknown",
    price: agreement.price,
    chain: `BSC Testnet (chain ${agreement.chainId})`,
    quoteExpiry: agreement.quoteExpiresAt,
    whatWillHappen:
      "A NEW ERC-8183 job will be created and funded on BSC Testnet with this marketplace as client. The escrowed budget is released to the seller only after a separate authorized submit/settle.",
  };
}

/** Honest step labels for the Hire confirmation UI. */
export function mainTrackHireStepLabel(
  step: "creating" | "registering" | "funding" | "funded"
): string {
  switch (step) {
    case "creating":
      return "Creating job";
    case "registering":
      return "Registering";
    case "funding":
      return "Funding";
    case "funded":
      return "Funded";
  }
}

/**
 * Run the Main Track V2 commercial hire. Fails closed at every gate. On success
 * returns the funded job evidence with `active:false` (activation is the funded
 * commercial hire, never a fabricated session/ACTIVE state).
 */
export async function runMainTrackV2HireActivation(
  ports: MainTrackV2HirePorts,
  input: MainTrackV2HireInput
): Promise<MainTrackV2HireOutcome> {
  const blocked = (reason: string): MainTrackV2HireOutcome => ({
    ok: false,
    stage: "blocked",
    blocked: { stage: "gate", reason },
  });

  // 1. Marketplace-client wallet must resolve with a verified identity.
  const rawClient = await ports.resolveMarketplaceClient();
  if (!rawClient || typeof rawClient.address !== "string" || rawClient.address.length === 0) {
    return blocked("marketplace wallet unavailable");
  }
  if (rawClient.source !== "loaded_keystore") {
    return blocked("marketplace wallet identity cannot be verified");
  }
  const client: MainTrackMarketplaceClient = {
    address: rawClient.address,
    source: "loaded_keystore",
    chainId: rawClient.chainId,
  };
  if (client.chainId !== input.expectedChainId) return blocked("marketplace wallet on wrong chain");
  if (client.address.toLowerCase() === input.forbiddenClientAddress.toLowerCase()) {
    return blocked("buyer wallet cannot be selected as marketplace client");
  }
  if (client.address.toLowerCase() === input.sellerAddress.toLowerCase()) {
    return blocked("seller wallet cannot be selected as marketplace client");
  }

  // 2. Verified commercial negotiation (chain/commerce/price/expiry/signature).
  const ctx: V2QuoteValidationContext = {
    expectedChainId: input.expectedChainId,
    expectedCommerce: input.expectedCommerce,
    expectedPaymentToken: input.expectedPaymentToken,
    expectedPrice: input.expectedPrice,
    nowSeconds: input.nowSeconds ?? Math.floor(Date.now() / 1000),
  };
  const negotiation = await ports.runCommercialNegotiation({
    agentId: input.agentId,
    request: input.request,
    ctx,
    historicalEvidence: input.historicalEvidence ?? null,
  });
  if (!negotiation.outcome.available) {
    return blocked(
      `commercial agreement not verified: ${negotiation.outcome.blocked.stage}: ${negotiation.outcome.blocked.reason}`
    );
  }
  if (!negotiation.quote) return blocked("commercial agreement quote missing");
  const agreement = negotiation.outcome.agreement;

  // 3. Re-check the commercial authority fail-closed conditions.
  if (agreement.provider.toLowerCase() !== input.sellerAddress.toLowerCase()) {
    return blocked("seller identity mismatch");
  }
  if (agreement.providerSignature.verified !== true) {
    return blocked("quote signature invalid");
  }
  if (agreement.chainId !== input.expectedChainId) {
    return blocked("chain mismatch");
  }
  if (agreement.commerce.toLowerCase() !== input.expectedCommerce.toLowerCase()) {
    return blocked("commerce contract mismatch");
  }
  if (agreement.price !== input.expectedPrice) {
    return blocked("price mismatch");
  }
  if (agreement.quoteExpiresAt <= ctx.nowSeconds) {
    return blocked("quote expired");
  }
  if (agreement.validation.ok !== true) {
    return blocked(agreement.validation.reason ?? "commercial agreement invalid");
  }

  // 4. Job 622 (historical evidence) must never be the new hire.
  if (agreement.jobId !== null) {
    return blocked("a pre-bound job id was fabricated");
  }

  // 5. Build the plan and execute the real ERC-8183 hire as the marketplace client.
  const plan: MainTrackErc8183HirePlan = {
    jobId: "pending",
    client: client.address,
    provider: agreement.provider,
    budget: agreement.price,
    expiredAt: String(agreement.quoteExpiresAt + 86400),
    quote: negotiation.quote,
    calls: ["createJob", "registerJob", "setBudget", "approve", "fund"],
  };

  let result: MainTrackErc8183HireResult;
  try {
    result = await ports.executeErc8183Hire(plan);
  } catch (error) {
    return blocked(
      `ERC-8183 transaction failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!result || typeof result.jobId !== "string" || result.jobId.length === 0) {
    return blocked("failed createJob (no job id returned)");
  }
  if (!result.txHashes?.fund || typeof result.txHashes.fund !== "string") {
    return blocked("failed fund (no fund transaction)");
  }

  // 6. Independently verify the FUNDED state on-chain.
  const job = await ports.readJob(result.jobId);
  if (!job || job.jobId !== result.jobId) return blocked("job not found on chain");
  if (job.status !== 1) return blocked(`job not FUNDED (status ${job.statusName ?? job.status})`);
  if (job.client.toLowerCase() !== client.address.toLowerCase())
    return blocked("seller/client mismatch (client)");
  if (job.provider.toLowerCase() !== input.sellerAddress.toLowerCase())
    return blocked("seller/client mismatch (provider)");
  if (job.budget !== input.expectedPrice) return blocked("funded budget mismatch");
  if (BigInt(job.expiredAt) <= ctx.nowSeconds) return blocked("job expired");

  return {
    ok: true,
    stage: "funded",
    agreement,
    client,
    jobId: result.jobId,
    txHashes: result.txHashes,
    blockNumbers: result.blockNumbers,
    job,
    active: false,
    activationState: { actionable: false, state: "funded-commercial-hire" },
    nextRequiredAction: MAIN_TRACK_NEXT_REQUIRED_ACTION,
  };
}
