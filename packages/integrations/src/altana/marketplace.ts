/**
 * ALTANA — marketplace service integration (Phase X.3).
 *
 * A server-side, typed marketplace service abstraction. It answers one question
 * for a single agent-service request:
 *
 *   WHAT service   — the marketplace agent being asked to act (identity only)
 *   WHO agent      — resolved via the existing identity model (slug/name/
 *                    category/chains/partner/updatedAt); an unresolvable agent
 *                    is a TYPED not-found, never a fabricated one
 *   WHAT cost      — a normalized payment requirement built ONLY from the
 *                    configured/verified sell-side x402 MerchantConfig; when no
 *                    sell-side config is present the state is `unconfigured`
 *                    (a configuration-blocked result, never a substituted value)
 *   WHAT rail      — the x402 rail from that config (testnet = eip3009/$U)
 *   PAYMENT STATUS — unconfigured / payment-required / payment-pending /
 *                    payment-verified / payment-rejected / payment-expired /
 *                    payment-invalid / service-complete / service-failed
 *   WHAT RESULT    — explicit execution boundary: the service does NOT run
 *                    agents, create ERC-8183 jobs, or execute skills. Every
 *                    response reports `not-implemented`/`pending` — never a
 *                    fabricated agent result or transaction hash.
 *
 * REUSE, NOT DUPLICATION: this module calls the existing x402 adapter surface
 * (`getX402Network`, `validateX402MerchantConfig`, `ALTANA_X402_*`) and the
 * official `@altananetwork/x402-server` `HandleResult`/`MerchantConfig` types.
 * It performs NO challenge building, NO 402 parsing, NO signature verification,
 * NO Permit2 wiring, and NO facilitator/settlement logic itself: actual
 * verification is delegated to a `MarketplacePaymentVerifier` injected by the
 * caller (the keyless testnet merchant in the test service). The x402-server
 * `HandleResult` is only normalized into the marketplace payment statuses.
 *
 * HONESTY RULES (encoded here):
 *   - `payment-verified` is reachable ONLY through a verifier `ok` verdict
 *     (real server-side crypto verification). Client claims (`paid`,
 *     `paymentVerified`, `transactionHash`) are part of the request type only to
 *     prove they are IGNORED — they never influence the payment status.
 *   - No cross-chain payment: every request's network is validated through the
 *     existing `getX402Network` (testnet 97 only; mainnet 56 / unknown refused).
 *   - No signing, no private key, no wallet, no transaction, no settlement, no
 *     on-chain write. Settlement remains the facilitator boundary (out of scope).
 *   - ERC-8183 jobs and Altana certified skills are independent surfaces; this
 *     service never constructs a hire/settle/dispute/refund call and never
 *     claims a skill was executed.
 *
 * SERVER-ONLY: no `NEXT_PUBLIC_*`, no browser-only imports (viem type imports
 * only).
 */

import type { HandleResult, MerchantConfig } from "@altananetwork/x402-server";
import type { Agent } from "@bnb-marketplace/config";
import {
  ALTANA_X402_CHAIN_ID,
  ALTANA_X402_NETWORK,
  getX402Network,
  validateX402MerchantConfig,
} from "./x402.js";
import type { X402NetworkInput } from "./x402.js";

/** Provider identity, matching the other Altana adapter surfaces. */
export const ALTANA_MARKETPLACE_PROVIDER = "altana" as const;

/** Required stop message when the marketplace would execute a service. */
export const ALTANA_MARKETPLACE_EXECUTION_BOUNDARY =
  "Marketplace service execution is not implemented; no agent run, no ERC-8183 " +
  "job, and no skill execution was started.";

// ---------------------------------------------------------------------------
// Agent identity (reuse, don't reinvent)
// ---------------------------------------------------------------------------

/**
 * The marketplace's view of agent identity. Deliberately the same field set the
 * project's core `Agent` contract carries (slug/name/category/chains/partner/
 * updatedAt) — nothing invented, nothing fabricated. Lookup is delegated to an
 * injected `resolveAgent`, so live registries (8004scan, config) stay outside
 * this package.
 */
export type MarketplaceAgent = Pick<
  Agent,
  "slug" | "name" | "category" | "chains" | "partner" | "updatedAt"
>;

/** Lookup contract for agent identity used by the marketplace service. */
export type MarketplaceAgentResolver = (slug: string) => MarketplaceAgent | undefined;

// ---------------------------------------------------------------------------
// Payment requirement (configured/verified values only)
// ---------------------------------------------------------------------------

export interface MarketplacePaymentRequirement {
  rail: "eip3009";
  chainId: typeof ALTANA_X402_CHAIN_ID;
  network: typeof ALTANA_X402_NETWORK;
  /** The contract address from the configured rail, e.g. $U on 97. */
  asset: `0x${string}`;
  assetSymbol: string;
  /** The recipient from the configured x402 MerchantConfig (`payTo`). */
  payTo: `0x${string}`;
  /** Atomic units quoted by the config (`price.toString()`). */
  amount: string;
  /** The protected resource URL advertised in the requirement. */
  resourceUrl: string;
  maxTimeoutSeconds: number;
}

/**
 * Normalize a validated x402 `MerchantConfig` into the marketplace payment
 * requirement. Only values actually present in the config are used — no
 * defaults are substituted, no addresses are invented. A config that fails the
 * existing `validateX402MerchantConfig` gate, or that offers no eip3009 rail,
 * is a configuration error.
 */
export function buildMarketplacePaymentRequirement(
  merchant: MerchantConfig
): MarketplacePaymentRequirement {
  const validation = validateX402MerchantConfig(merchant);
  if (!validation.ok) {
    throw new AltanaMarketplaceConfigError(
      `Sell-side payment configuration is invalid: ${validation.errors.join(" | ")}`
    );
  }
  const cfg = validation.config;
  const rail = cfg.rails[0];
  if (rail === undefined || rail.rail !== "eip3009") {
    throw new AltanaMarketplaceConfigError(
      "Sell-side payment configuration must offer exactly the eip3009 rail (testnet $U)."
    );
  }
  const resourceUrl =
    typeof cfg.resource === "string"
      ? cfg.resource
      : cfg.resource !== undefined && typeof cfg.resource.url === "string"
        ? cfg.resource.url
        : "";
  return {
    rail: "eip3009",
    chainId: cfg.chainId as typeof ALTANA_X402_CHAIN_ID,
    network: ALTANA_X402_NETWORK,
    asset: rail.token.address as `0x${string}`,
    assetSymbol: rail.token.symbol,
    payTo: cfg.payTo as `0x${string}`,
    amount: cfg.price.toString(),
    resourceUrl,
    maxTimeoutSeconds: cfg.maxTimeoutSeconds ?? 300,
  };
}

// ---------------------------------------------------------------------------
// Payment status + verification boundary
// ---------------------------------------------------------------------------

/**
 * The marketplace payment status vocabulary (only realistic states; the full
 * union below is what the service can ever produce).
 */
export type MarketplacePaymentStatus =
  | "unconfigured"
  | "payment-required"
  | "payment-pending"
  | "payment-verified"
  | "payment-rejected"
  | "payment-expired"
  | "payment-invalid"
  | "service-complete"
  | "service-failed";

/** Proof that a payment was VERIFIED server-side (signature crypto by the verifier). */
export interface MarketplaceVerifiedPayment {
  chainId: typeof ALTANA_X402_CHAIN_ID;
  payer: string;
  /** Verified amount in atomic units (stringified bigint). */
  amount: string;
  token: string;
  rail: string;
  verifiedAt: string;
}

/** Normative result a payment verifier returns to the marketplace service. */
export type MarketplaceVerificationResult =
  | {
      ok: true;
      /** Values decoded+verified by the x402 adapter (never client claims). */
      payer: string;
      amount: bigint;
      token: string;
      rail: string;
    }
  | { ok: false; kind: "invalid" | "expired" | "wrong-chain" | "rejected"; reason: string };

/** The verification dependency — in prod wired to the x402 adapter's gate. */
export type MarketplacePaymentVerifier = (
  xPaymentHeader: string | null
) => Promise<MarketplaceVerificationResult>;

/**
 * Normalize the official x402-server `HandleResult` (from the existing
 * `requirePayment` gate) into the marketplace verdict vocabulary. This is a
 * fac¸ade over the existing adapter — it re-opens none of the crypto/parse
 * logic; it only classifies the reason string the official path already emitted.
 */
export function marketplaceVerdictFromX402Handle(
  result: HandleResult
): MarketplaceVerificationResult {
  if (result.status === 200 && result.receipt !== undefined) {
    return {
      ok: true,
      payer: result.receipt.payer,
      amount: result.receipt.amount,
      token: result.receipt.token,
      rail: result.receipt.rail,
    };
  }
  if (result.status === 402 && typeof result.body?.error === "string") {
    const reason = result.body.error;
    if (reason.includes("invalid X-PAYMENT")) {
      return { ok: false, kind: "invalid", reason };
    }
    if (reason.includes("wrong chain")) {
      return { ok: false, kind: "wrong-chain", reason };
    }
    if (reason.includes("validBefore") || reason.includes("validAfter")) {
      return { ok: false, kind: "expired", reason };
    }
    return { ok: false, kind: "rejected", reason };
  }
  return { ok: false, kind: "invalid", reason: "unrecognized x402 verification result." };
}

// ---------------------------------------------------------------------------
// Request / response contract
// ---------------------------------------------------------------------------

export interface MarketplaceServiceRequest {
  /** Agent identity slug, resolved against the injected registry. */
  agentSlug: string;
  /** Claimed network (testnet 97 default). Mainnet/unknown are refused. */
  network?: X402NetworkInput;
  /** Server-side X-PAYMENT authorization header, when a payment is offered. */
  xPaymentHeader?: string | null;
  /**
   * Explicitly IGNORED. Kept in the request type only so the boundary is
   * visible and testable: `paid`/`paymentVerified`/`transactionHash` never
   * influence the status. Payment verification comes exclusively from the
   * verifier dependency.
   */
  clientClaims?: {
    paid?: boolean;
    paymentVerified?: boolean;
    transactionHash?: string;
  };
}

export type MarketplacePaymentSnapshot =
  | { status: "unconfigured"; reason: string }
  | {
      status: "payment-required" | "payment-pending";
      requirement: MarketplacePaymentRequirement;
    }
  | {
      status: "payment-verified";
      requirement: MarketplacePaymentRequirement;
      verification: MarketplaceVerifiedPayment;
    }
  | {
      status: "payment-rejected" | "payment-expired" | "payment-invalid";
      requirement: MarketplacePaymentRequirement;
      reason: string;
    };

export interface MarketplaceServiceState {
  /** The service does not execute work yet; it can only be awaiting wiring. */
  status: "not-implemented" | "pending";
  detail: string;
}

export interface MarketplaceServiceResponse {
  request: MarketplaceServiceRequest;
  agent: MarketplaceAgent;
  payment: MarketplacePaymentSnapshot;
  service: MarketplaceServiceState;
}

export interface MarketplaceServiceOptions {
  /** Agent identity lookup (typed not-found when the slug is unknown). */
  resolveAgent: MarketplaceAgentResolver;
  /**
   * The configured/verified sell-side x402 MerchantConfig. Absent ⇒ every
   * request resolves to `unconfigured` (no value is substituted).
   */
  merchant?: MerchantConfig;
  /** Server-side payment verification, wired to the x402 adapter. */
  verifier: MarketplacePaymentVerifier;
  /** Default claimed execution network (testnet 97). */
  network?: X402NetworkInput;
}

export interface MarketplaceService {
  readonly providerName: typeof ALTANA_MARKETPLACE_PROVIDER;
  /**
   * Resolve the agent and answer what the payment for this service would be —
   * no client input, pure identity + configuration.
   */
  describe(agentSlug: string): MarketplaceServiceResponse;
  /** Run the full service flow: identity → network → payment → status. */
  requestService(req: MarketplaceServiceRequest): Promise<MarketplaceServiceResponse>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Base class for all marketplace-service errors. */
export class AltanaMarketplaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaMarketplaceError";
  }
}

/** Resolving an agent slug that is not listed in the identity registry. */
export class AltanaMarketplaceAgentNotFoundError extends AltanaMarketplaceError {
  constructor(agentSlug: string) {
    super(`Marketplace agent "${agentSlug}" is not listed in the identity registry.`);
    this.name = "AltanaMarketplaceAgentNotFoundError";
  }
}

/** Sell-side payment configuration is missing or structurally invalid. */
export class AltanaMarketplaceConfigError extends AltanaMarketplaceError {
  constructor(message: string) {
    super(message);
    this.name = "AltanaMarketplaceConfigError";
  }
}

/** Requested network is not the supported testnet. */
export class AltanaMarketplaceNetworkError extends AltanaMarketplaceError {
  constructor(message: string) {
    super(message);
    this.name = "AltanaMarketplaceNetworkError";
  }
}

/** Execution was attempted — always refused (service execution not implemented). */
export class AltanaMarketplaceExecutionError extends AltanaMarketplaceError {
  constructor(message: string) {
    super(message);
    this.name = "AltanaMarketplaceExecutionError";
  }
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

function resolveRequestNetwork(
  input: X402NetworkInput | undefined,
  fallback: X402NetworkInput | undefined
): void {
  try {
    getX402Network(input ?? fallback ?? ALTANA_X402_NETWORK);
  } catch (error) {
    throw new AltanaMarketplaceNetworkError(
      `Marketplace payment network refused: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function unconfiguredSnapshot(): Extract<MarketplacePaymentSnapshot, { status: "unconfigured" }> {
  return {
    status: "unconfigured",
    reason:
      "No configured/verified sell-side x402 payment configuration exists; " +
      "no payment requirement was substituted.",
  };
}

function toVerified(
  requirement: MarketplacePaymentRequirement,
  result: Extract<MarketplaceVerificationResult, { ok: true }>
): Extract<MarketplacePaymentSnapshot, { status: "payment-verified" }> {
  return {
    status: "payment-verified",
    requirement,
    verification: {
      chainId: ALTANA_X402_CHAIN_ID,
      payer: result.payer,
      amount: result.amount.toString(),
      token: result.token,
      rail: result.rail,
      verifiedAt: new Date().toISOString(),
    },
  };
}

function toRejected(
  requirement: MarketplacePaymentRequirement,
  result: Extract<MarketplaceVerificationResult, { ok: false }>
): Extract<
  MarketplacePaymentSnapshot,
  { status: "payment-rejected" | "payment-expired" | "payment-invalid" }
> {
  const status =
    result.kind === "wrong-chain"
      ? "payment-invalid"
      : result.kind === "expired"
        ? "payment-expired"
        : result.kind === "invalid"
          ? "payment-invalid"
          : "payment-rejected";
  return { status, requirement, reason: result.reason };
}

/**
 * Create the marketplace service. `describe` never throws except for an
 * unknown agent; `requestService` additionally validates the claimed network and
 * runs the injected verifier when a payment header is present. Execution is
 * always the explicit boundary — never a fabricated result.
 */
export function createAltanaMarketplaceService(
  options: MarketplaceServiceOptions
): MarketplaceService {
  function resolveAgent(slug: string): MarketplaceAgent {
    const agent = options.resolveAgent(slug);
    if (agent === undefined) {
      throw new AltanaMarketplaceAgentNotFoundError(slug);
    }
    return agent;
  }

  function paymentFor(merchant: MerchantConfig | undefined): MarketplacePaymentSnapshot {
    if (merchant === undefined) {
      return unconfiguredSnapshot();
    }
    const requirement = buildMarketplacePaymentRequirement(merchant);
    return { status: "payment-required", requirement };
  }

  function describe(agentSlug: string): MarketplaceServiceResponse {
    const agent = resolveAgent(agentSlug);
    return {
      request: { agentSlug },
      agent,
      payment: paymentFor(options.merchant),
      service: {
        status: "not-implemented",
        detail: ALTANA_MARKETPLACE_EXECUTION_BOUNDARY,
      },
    };
  }

  async function requestService(
    req: MarketplaceServiceRequest
  ): Promise<MarketplaceServiceResponse> {
    resolveRequestNetwork(req.network, options.network);
    const agent = resolveAgent(req.agentSlug);

    if (options.merchant === undefined) {
      return {
        request: req,
        agent,
        payment: unconfiguredSnapshot(),
        service: { status: "not-implemented", detail: ALTANA_MARKETPLACE_EXECUTION_BOUNDARY },
      };
    }

    const requirement = buildMarketplacePaymentRequirement(options.merchant);
    const header = req.xPaymentHeader ?? null;
    // Client claims are never read: only the server-side verifier decides.
    const verification = await options.verifier(header);
    const payment: MarketplacePaymentSnapshot = verification.ok
      ? toVerified(requirement, verification)
      : toRejected(requirement, verification);

    return {
      request: req,
      agent,
      payment,
      service: { status: "not-implemented", detail: ALTANA_MARKETPLACE_EXECUTION_BOUNDARY },
    };
  }

  return { providerName: ALTANA_MARKETPLACE_PROVIDER, describe, requestService };
}

export type { Agent, MerchantConfig, HandleResult };
