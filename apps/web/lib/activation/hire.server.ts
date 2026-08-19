/**
 * X.6 — real marketplace HIRE activation (server-only).
 *
 * The first PRODUCTION call sites of the verified activation builders:
 *
 *   prepareErc8183Hire        (erc8183.ts)          — the atomic 5-call hire batch
 *   createAltanaMarketplaceService.describe /
 *     .requestService         (marketplace.ts)      — REAL sell-side x402 quote
 *   buildX402LiveReview       (x402.review.ts)      — the LIVE review boundary
 *   pinX402Consent            (x402.review.ts)      — consent digest binding
 *
 * HONESTY CONTRACT (encoded here, matching ./capability.ts)
 *   - Resolves the EXACT 8004scan record for the requested agent_id; unknown
 *     identities are rejected, never fabricated.
 *   - The only supported activation chain is BNB testnet (97). Every real
 *     8004scan agent is chain-56 mainnet and classifies NOT_ACTIVATABLE.
 *   - Real capability (pricing/jobId/expiry) does NOT exist in the 8004scan
 *     contract, so every real record classifies CAPABILITY_UNKNOWN. Nothing
 *     here invents pricing, calldata, recipients, or capabilities: the
 *     ACTIVATABLE branch runs ONLY when a real capability is resolved and it
 *     refuses at the first missing/unsafe value (typed `blocked` outcomes).
 *   - The authoritative gates stay in the verified builders: chain 97 only,
 *     verified $U, configured payTo/facilitator/operator (distinct), the
 *     verified ERC-8183 destination allowlist, fixture rejection, exact
 *     amount/calldata pinning, consent digest + invalidation.
 *   - No signing, no broadcast, no settlement, no payment, no credentials in
 *     any response. The payment verifier is an explicit guard that can only
 *     reject — `payment-verified` stays unreachable.
 *
 * SERVER-ONLY: no NEXT_PUBLIC_* reads, no browser imports, no credential
 * rendering. Relative imports keep this module runnable by the plain-node
 * verify harness (`node --experimental-strip-types`).
 */

import {
  ALTANA_X402_NETWORK,
  buildX402LiveReview,
  createAltanaMarketplaceService,
  getErc8183Addresses,
  isX402ReviewPayTo,
  isX402StructuralFixture,
  pinX402Consent,
  prepareErc8183Hire,
  validateX402MerchantConfig,
  x402ReviewToJson,
  X402_REVIEW_TOKEN,
} from "@bnb-marketplace/integrations/altana";
import type {
  MerchantConfig,
  MarketplaceAgent,
  MarketplacePaymentRequirement,
  MarketplacePaymentVerifier,
  X402Consent,
  X402LiveActionKind,
  X402TransactionReview,
  AltanaHex,
} from "@bnb-marketplace/integrations/altana";
import type { AgentCategory } from "@bnb-marketplace/config";
import {
  ACTIVATION_CHAIN_ID,
  classifyAgentActivation,
  resolveAgentActivationCapability,
} from "./capability.ts";
import type { AgentActivationCapability } from "./capability.ts";
import type { RegistryAgentIdentity } from "./capability.ts";
import { listAgents } from "../eight004scan/client.ts";
import type { Scan8004Agent } from "../eight004scan/types.ts";
import { BNB_TESTNET } from "@altananetwork/sdk";

/** Environment surface (public addresses only — no secrets are ever read). */
export type HireEnv = Record<string, string | undefined>;

/** Verified chain-97 $U metadata (cross-pinned by buildX402LiveReview). */
const HIRE_ACTIVATION_TOKEN = {
  address: X402_REVIEW_TOKEN,
  name: "United Stables",
  version: "1",
  symbol: "U",
  decimals: 18,
} as const;

/** Unique `GET /agents` identity shape: `{chainId}:{contract}:{tokenId}`. */
const AGENT_IDENTITY_RE = /^\d+:0x[0-9a-fA-F]{40}:\d+$/;

/** Address matcher accepted by the review builder (any-case 40-hex). */
const ADDRESS_SHAPE_RE = /^0x[a-fA-F0-9]{40}$/;

/** Minimal hire-call shape (structural — mirrors the SDK `Call`). */
export interface HireCallLike {
  to: string;
  data?: string;
}

/** Map a raw 8004scan record onto the classifier's registry identity surface. */
function toRegistryIdentity(record: Scan8004Agent): RegistryAgentIdentity {
  return {
    agentId: record.agent_id,
    chainId: record.chain_id,
    isTestnet: record.is_testnet,
    name: record.name,
    description: record.description,
    ownerAddress: record.owner_address,
  };
}

export class HireActivationError extends Error {}

// ---------------------------------------------------------------------------
// Identity resolution (exact match, no fabrication)
// ---------------------------------------------------------------------------

/** Parse the route body: a single `agentId` string is required. */
export function parseHireRequest(
  input: unknown
): { ok: true; agentId: string } | { ok: false; reason: string } {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const value = (input as Record<string, unknown>)["agentId"];
    if (typeof value === "string" && value.length > 0 && value.length <= 256) {
      return { ok: true, agentId: value };
    }
  }
  return { ok: false, reason: "A non-empty agentId string is required." };
}

/** Whether `value` is a real 8004scan agent identity (`{chain}:{0x}:{id}`). */
export function isValidAgentIdentity(value: unknown): value is string {
  return typeof value === "string" && value.length <= 256 && AGENT_IDENTITY_RE.test(value);
}

/** Exact identity match against raw `GET /agents` rows. Null when absent. */
export function findAgentByIdentity(
  rows: readonly Scan8004Agent[],
  agentId: string
): Scan8004Agent | null {
  return rows.find((record) => record.agent_id === agentId) ?? null;
}

/** Fetch the agent list from the 8004scan public API (bounded, read-only). */
export async function fetchAgentRows(search?: string): Promise<Scan8004Agent[]> {
  const result = await listAgents({ limit: 100, search });
  if (!result.ok) {
    throw new HireActivationError(
      `The 8004scan agent list is unavailable (reason: ${result.reason}).`
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Configured activation addresses (PUBLIC addresses only, presence-based)
// ---------------------------------------------------------------------------

export interface HireActivationConfig {
  /** Configured operator merchant recipient (public address). */
  payTo: AltanaHex;
  /** Gas-only facilitator EOA (public address). */
  facilitator: AltanaHex;
  /** Distinct operator signer EOA (public address). */
  operator: AltanaHex;
}

/**
 * Resolve the three PUBLIC activation addresses from the environment. No
 * secret is read; every value must be a non-fixture address-shaped string and
 * the review builder re-verifies all of them authoritatively.
 */
export function hireActivationConfigFromEnv(
  env: HireEnv
): { ok: true; config: HireActivationConfig } | { ok: false; reason: string } {
  const payTo = env["ALTANA_PAYTO"]?.trim();
  const facilitator = env["ALTANA_FACILITATOR_ADDRESS"]?.trim();
  const operator = env["ALTANA_OPERATOR_ADDRESS"]?.trim();

  if (!payTo || !isX402ReviewPayTo(payTo)) {
    return { ok: false, reason: "ALTANA_PAYTO is not a configured non-fixture payTo address." };
  }
  if (!facilitator || !ADDRESS_SHAPE_RE.test(facilitator) || isX402StructuralFixture(facilitator)) {
    return {
      ok: false,
      reason: "ALTANA_FACILITATOR_ADDRESS is not a configured facilitator address.",
    };
  }
  if (!operator || !ADDRESS_SHAPE_RE.test(operator) || isX402StructuralFixture(operator)) {
    return {
      ok: false,
      reason: "ALTANA_OPERATOR_ADDRESS is not a configured operator address.",
    };
  }
  if (facilitator === payTo || operator === payTo || operator === facilitator) {
    return {
      ok: false,
      reason: "payTo, facilitator and operator must be pairwise distinct addresses.",
    };
  }
  return {
    ok: true,
    config: {
      payTo: payTo as AltanaHex,
      facilitator: facilitator as AltanaHex,
      operator: operator as AltanaHex,
    },
  };
}

// ---------------------------------------------------------------------------
// Marketplace service wiring (REAL config; never a fabricated verdict)
// ---------------------------------------------------------------------------

/**
 * The production payment-verification guard. The signed X-PAYMENT gate is not
 * wired in this phase, so this verifier can ONLY reject — it never fabricates
 * a payment-verified verdict (`payment-verified` stays unreachable).
 */
export function createHirePaymentGuard(): MarketplacePaymentVerifier {
  return async () => ({
    ok: false,
    kind: "rejected",
    reason:
      "The signed X-PAYMENT verification gate is not wired in this phase; no payment was presented or verified.",
  });
}

/**
 * Map a registry record to the marketplace identity model. `category` is the
 * ONLY honest route to a platform category: it is supplied exclusively by
 * verified platform-category data (never derived from registry fields, which
 * 8004scan does not classify). Without it the record has no honest identity
 * mapping and the marketplace service yields its typed not-found.
 */
export function recordToMarketplaceAgent(
  record: Scan8004Agent,
  category: AgentCategory | undefined
): MarketplaceAgent | undefined {
  if (category === undefined) return undefined;
  return {
    slug: record.agent_id,
    name: record.name && record.name.trim().length > 0 ? record.name : `Agent #${record.token_id}`,
    category,
    chains: record.chain_id === ACTIVATION_CHAIN_ID ? ["bsc"] : [],
    partner: "altana",
    updatedAt: record.updated_at ?? "",
  };
}

/** Build the REAL sell-side x402 MerchantConfig from the real capability. */
export function buildHireMerchantConfig(
  record: Scan8004Agent,
  capability: AgentActivationCapability,
  payTo: AltanaHex
): MerchantConfig {
  return {
    chainId: ACTIVATION_CHAIN_ID,
    payTo,
    price: capability.amount,
    rails: [
      {
        rail: "eip3009",
        token: { ...HIRE_ACTIVATION_TOKEN },
      },
    ],
    maxTimeoutSeconds: 300,
    resource: { url: capability.resourceUrl },
    description: `hire activation for ${record.agent_id}`,
  };
}

export interface HireMarketplaceQuote {
  available: boolean;
  reason: string;
  requirement?: MarketplacePaymentRequirement;
}

/**
 * Wire the existing marketplace service into the hire path. The service is
 * constructed with the REAL merchant config (derived from the real capability)
 * and the payment guard; `describe` answers what the payment WOULD be and
 * `requestService` runs the full identity -> network -> payment flow. Both are
 * production call sites of the existing contracts — no parallel implementation.
 */
export async function hireMarketplaceQuote(
  record: Scan8004Agent,
  capability: AgentActivationCapability,
  config: HireActivationConfig,
  category: AgentCategory | undefined
): Promise<HireMarketplaceQuote> {
  const agent: MarketplaceAgent | undefined = recordToMarketplaceAgent(record, category);
  if (agent === undefined) {
    return {
      available: false,
      reason:
        "Marketplace identity not mapped: the platform has no honest category mapping for this registry agent.",
    };
  }
  const merchant = buildHireMerchantConfig(record, capability, config.payTo);
  const validation = validateX402MerchantConfig(merchant);
  if (!validation.ok) {
    return {
      available: false,
      reason: `Sell-side payment configuration is invalid: ${validation.errors.join(" | ")}`,
    };
  }
  const service = createAltanaMarketplaceService({
    resolveAgent: (slug) => (slug === agent.slug ? agent : undefined),
    merchant,
    verifier: createHirePaymentGuard(),
    network: ALTANA_X402_NETWORK,
  });
  try {
    const describe = service.describe(agent.slug);
    const request = await service.requestService({
      agentSlug: agent.slug,
      network: ALTANA_X402_NETWORK,
    });
    const quoteReason =
      describe.payment.status === "payment-required"
        ? `payment-required from the REAL configured sell-side config; payment flow: ${request.payment.status}`
        : `payment state: ${describe.payment.status}`;
    return {
      available: true,
      reason: quoteReason,
      requirement:
        describe.payment.status === "payment-required" ? describe.payment.requirement : undefined,
    };
  } catch (error) {
    return {
      available: false,
      reason: `Marketplace quote refused: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Canonical ERC-8183 hire-batch encoding (deterministic, digest-pinned)
// ---------------------------------------------------------------------------

/**
 * Encode the SDK hire `Call[]` batch into the single canonical `calldata` hex
 * bound by the review digest: [to(20B, lowercase) | dataLen(4B BE) | data]*.
 * Purely a canonical binding format — it is NOT a contract encoding.
 */
export function encodeErc8183HireCalldata(calls: readonly HireCallLike[]): string {
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new HireActivationError("hire calldata requires a non-empty call batch.");
  }
  let hex = "0x";
  for (const call of calls) {
    if (typeof call.to !== "string" || typeof call.data !== "string") {
      throw new HireActivationError("malformed hire call in batch.");
    }
    const data = call.data.startsWith("0x") ? call.data.slice(2) : call.data;
    hex += call.to.toLowerCase().slice(2);
    hex += (data.length / 2).toString(16).padStart(8, "0");
    hex += data;
  }
  return hex;
}

/** Decode the canonical encoding back to `{to, data}` (verify harness only). */
export function decodeErc8183HireCalldata(calldata: string): HireCallLike[] {
  const hex = calldata.toLowerCase().startsWith("0x")
    ? calldata.toLowerCase().slice(2)
    : calldata.toLowerCase();
  const calls: HireCallLike[] = [];
  let offset = 0;
  while (offset < hex.length) {
    const to = `0x${hex.slice(offset, offset + 40)}`;
    offset += 40;
    const len = Number.parseInt(hex.slice(offset, offset + 8), 16);
    offset += 8;
    const data = `0x${hex.slice(offset, offset + len * 2)}`;
    offset += len * 2;
    calls.push({ to, data });
  }
  if (offset !== hex.length) {
    throw new HireActivationError("malformed canonical hire calldata");
  }
  return calls;
}

// ---------------------------------------------------------------------------
// The ACTIVATABLE pipeline (REAL values only; the verified builders gate it)
// ---------------------------------------------------------------------------

export interface HireReviewResult {
  review: X402TransactionReview;
  consent: X402Consent;
  actionKind: X402LiveActionKind;
  quote: HireMarketplaceQuote;
}

/**
 * Build the immutable LIVE review for a REAL hire capability. Runs ONLY after
 * the classifier resolved ACTIVATABLE; every building block is the existing
 * verified surface (prepareErc8183Hire -> encode -> buildX402LiveReview ->
 * pinX402Consent). Throws `HireActivationError` with the honest reason on any
 * missing/unsafe value — nothing is substituted.
 */
export async function buildHireReviewFromCapability(
  record: Scan8004Agent,
  capability: AgentActivationCapability,
  config: HireActivationConfig,
  category: AgentCategory | undefined
): Promise<HireReviewResult> {
  if (record.chain_id !== ACTIVATION_CHAIN_ID) {
    throw new HireActivationError(`hire activation requires chain ${ACTIVATION_CHAIN_ID}.`);
  }
  if (capability.kind !== "erc8183-hire") {
    throw new HireActivationError("only the erc8183-hire capability is actionable.");
  }
  if (capability.jobId <= 0n) {
    throw new HireActivationError("capability jobId must be a positive predicted job id.");
  }
  if (capability.amount <= 0n) {
    throw new HireActivationError("capability amount must be positive atomic $U units.");
  }
  const provider = record.owner_address;
  if (!provider || !ADDRESS_SHAPE_RE.test(provider)) {
    throw new HireActivationError("the registry record carries no valid owner (provider) address.");
  }
  const description =
    record.description && record.description.trim().length > 0
      ? record.description
      : record.name && record.name.trim().length > 0
        ? record.name
        : null;
  if (description === null) {
    throw new HireActivationError("the registry record carries no hire description.");
  }

  const quote = await hireMarketplaceQuote(record, capability, config, category);

  const draft = prepareErc8183Hire(BNB_TESTNET, {
    provider: provider as AltanaHex,
    description,
    budget: capability.amount,
    expiredAt: capability.expiresAt,
    jobId: capability.jobId,
  });
  if (draft.calls.length === 0) {
    throw new HireActivationError("the hire batch is empty; refusing to review.");
  }
  const verified = getErc8183Addresses(ACTIVATION_CHAIN_ID);
  const allowlist = new Set([
    verified.commerce,
    verified.router,
    verified.policy,
    verified.registry,
    verified.paymentToken,
  ]);
  for (const call of draft.calls) {
    if (!allowlist.has(call.to)) {
      throw new HireActivationError(
        `hire batch targets ${call.to}, which is not a verified chain-97 ERC-8183 contract.`
      );
    }
  }

  const calldata = encodeErc8183HireCalldata(draft.calls);
  const review = buildX402LiveReview({
    kind: "erc8183-hire",
    chainId: ACTIVATION_CHAIN_ID,
    token: X402_REVIEW_TOKEN,
    amount: capability.amount,
    payTo: config.payTo,
    destination: verified.commerce,
    calldata,
    facilitator: config.facilitator,
    operator: config.operator,
    jobId: capability.jobId,
    configuredPayTo: config.payTo,
  });
  const consent = pinX402Consent(review);
  return { review, consent, actionKind: "erc8183-hire", quote };
}

// ---------------------------------------------------------------------------
// Orchestration used by the route AND the verify harness
// ---------------------------------------------------------------------------

export type HireActivationOutcome =
  | {
      classifier: "NOT_ACTIVATABLE" | "CAPABILITY_UNKNOWN";
      agentId: string;
      chainId: number;
      reason: string | null;
      detail: string;
      available: false;
    }
  | {
      classifier: "ACTIVATABLE";
      agentId: string;
      chainId: number;
      available: false;
      blocked: { stage: string; reason: string };
    }
  | {
      classifier: "ACTIVATABLE";
      agentId: string;
      chainId: number;
      available: true;
      reviewJson: ReturnType<typeof x402ReviewToJson>;
      consent: { consentDigest: string; reviewRef: string; state: "PINNED" };
      quote: HireMarketplaceQuote;
    };

/**
 * The full hire-activation pipeline: classify the real record, then — and only
 * then — build the live review from the REAL capability. Never fabricates.
 */
export async function runHireActivation(
  record: Scan8004Agent,
  opts: {
    env: HireEnv;
    category?: AgentCategory;
    capability?: AgentActivationCapability;
  }
): Promise<HireActivationOutcome> {
  const recordCapability =
    opts.capability ?? resolveAgentActivationCapability(toRegistryIdentity(record));
  const classification = classifyAgentActivation(
    toRegistryIdentity(record),
    recordCapability ?? undefined
  );
  if (classification.state !== "ACTIVATABLE") {
    return {
      classifier: classification.state,
      agentId: record.agent_id,
      chainId: record.chain_id,
      reason: classification.reason,
      detail: classification.detail,
      available: false,
    };
  }

  const envConfig = hireActivationConfigFromEnv(opts.env);
  if (!envConfig.ok) {
    return {
      classifier: "ACTIVATABLE",
      agentId: record.agent_id,
      chainId: record.chain_id,
      available: false,
      blocked: { stage: "configuration", reason: envConfig.reason },
    };
  }

  const capability = recordCapability;
  if (capability === null) {
    return {
      classifier: "ACTIVATABLE",
      agentId: record.agent_id,
      chainId: record.chain_id,
      available: false,
      blocked: {
        stage: "capability",
        reason: "no real actionable capability could be resolved for this agent.",
      },
    };
  }

  try {
    const result = await buildHireReviewFromCapability(
      record,
      capability,
      envConfig.config,
      opts.category
    );
    return {
      classifier: "ACTIVATABLE",
      agentId: record.agent_id,
      chainId: record.chain_id,
      available: true,
      reviewJson: x402ReviewToJson(result.review),
      consent: {
        consentDigest: result.consent.consentDigest,
        reviewRef: result.consent.reviewRef,
        state: result.consent.state,
      },
      quote: result.quote,
    };
  } catch (error) {
    return {
      classifier: "ACTIVATABLE",
      agentId: record.agent_id,
      chainId: record.chain_id,
      available: false,
      blocked: {
        stage: "review",
        reason: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
