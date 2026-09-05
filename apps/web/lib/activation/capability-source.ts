/**
 * X.76 — Verified Execution Capability source boundary (PURE, framework-free).
 *
 * This module is the adapter BOUNDARY only. It does NOT implement a real
 * execution-capability provider, does NOT read any environment variable, does
 * NOT perform any network call, and does NOT change production activation
 * behavior.
 *
 * Why this exists:
 *   The Hire -> Consent -> Session -> Custody -> Execution pipeline requires,
 *   per the existing `AgentActivationCapability` contract (./capability.ts),
 *   five fields that no current integration provides:
 *     - verified price      (amount)
 *     - expiry              (expiresAt)
 *     - job id              (jobId)
 *     - resource            (resourceUrl)
 *     - execution capability (kind)
 *
 *   The only agent integration present is 8004scan (`../eight004scan`), whose
 *   `Scan8004Agent` contract carries identity and metadata ONLY:
 *     agent_id, chain_id, owner_address, name, description,
 *     supported_protocols[], x402_supported (boolean flag), metrics.
 *   It exposes NO price, NO expiry, NO job id, NO resource, and NO verified
 *   execution-capability record. A boolean `x402_supported` flag is NOT proof
 *   that an agent is executable; a registry listing and a natural-language
 *   description are likewise NOT executable evidence.
 *
 * Therefore the authoritative capability source DOES NOT EXIST in the current
 * architecture. This module documents the required external dependency as a
 * typed provider contract and returns `null` (activation unavailable) until a
 * real, verified provider is supplied. It is fail-closed by construction.
 */

/**
 * Authoritative verification metadata attached to every resolved capability.
 * Every field must name an authoritative source and an explicit method so the
 * capability can be audited; placeholders are rejected by `verifyExecutionCapability`.
 */
export interface VerifiedExecutionCapabilityVerification {
  /** Authoritative origin of the capability (e.g. an on-chain job registry, an attestation service). */
  source: string;
  /** ISO-8601 timestamp at which the capability was verified. */
  verifiedAt: string;
  /** Explicit verification method (e.g. "onchain:erc8004-job", "attestation:altana-session"). */
  method: string;
}

/**
 * A capability that has been resolved from an authoritative source and carries
 * an explicit verification trail. Every field is mandatory; none has a default.
 * This is the contract a future provider must satisfy before any agent can be
 * considered ACTIVATABLE.
 */
export interface VerifiedExecutionCapability {
  agentId: string;
  jobId: string;
  resource: string;
  executionCapability: string;
  price: string;
  expiresAt: string;
  verification: VerifiedExecutionCapabilityVerification;
}

/** Minimal input the resolver needs to locate a capability for an agent. */
export interface ExecutionCapabilityInput {
  agentId: string;
  hireId?: string;
  resource?: string;
}

/**
 * The external boundary that an authoritative execution-capability provider
 * must implement. The current repository has NO implementation of this
 * interface; that absence is the exact blocker documented by X.76.
 */
export interface ExecutionCapabilityProvider {
  resolveExecutionCapability(
    input: ExecutionCapabilityInput
  ): Promise<VerifiedExecutionCapability | null>;
}

/**
 * Defensive, non-coercing validation of a resolved capability. Returns a
 * detailed reason on the first failure. Rejects:
 *   - empty/placeholder jobId ("unknown", "")
 *   - empty/placeholder resource ("default", "")
 *   - empty/placeholder executionCapability ("enabled", "")
 *   - non-positive / unparseable / NaN price ("0", "", "abc")
 *   - empty / unparseable expiry
 *   - elapsed expiry
 *   - missing/untrusted verification metadata (empty source/method, "untrusted")
 * No value is silently coerced.
 */
export function verifyExecutionCapability(cap: VerifiedExecutionCapability | null | undefined): {
  ok: boolean;
  reason: string;
} {
  if (!cap || typeof cap !== "object") {
    return { ok: false, reason: "capability is null or malformed" };
  }
  if (typeof cap.agentId !== "string" || cap.agentId.length === 0) {
    return { ok: false, reason: "agentId is missing" };
  }
  if (
    typeof cap.jobId !== "string" ||
    cap.jobId.trim().length === 0 ||
    cap.jobId.trim() === "unknown"
  ) {
    return { ok: false, reason: "jobId is missing or placeholder" };
  }
  if (
    typeof cap.resource !== "string" ||
    cap.resource.trim().length === 0 ||
    cap.resource.trim() === "default"
  ) {
    return { ok: false, reason: "resource is missing or placeholder" };
  }
  if (
    typeof cap.executionCapability !== "string" ||
    cap.executionCapability.trim().length === 0 ||
    cap.executionCapability.trim() === "enabled"
  ) {
    return { ok: false, reason: "executionCapability is missing or placeholder" };
  }
  if (typeof cap.price !== "string" || cap.price.trim().length === 0) {
    return { ok: false, reason: "price is missing" };
  }
  const priceNumber = Number(cap.price);
  if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
    return { ok: false, reason: "price is not a positive numeric value" };
  }
  if (typeof cap.expiresAt !== "string" || cap.expiresAt.trim().length === 0) {
    return { ok: false, reason: "expiry is missing" };
  }
  const expiryMs = Date.parse(cap.expiresAt);
  if (!Number.isFinite(expiryMs)) {
    return { ok: false, reason: "expiry is not a parseable timestamp" };
  }
  if (expiryMs <= Date.now()) {
    return { ok: false, reason: "expiry has already elapsed" };
  }
  if (
    !cap.verification ||
    typeof cap.verification.source !== "string" ||
    cap.verification.source.trim().length === 0 ||
    cap.verification.source.trim() === "untrusted"
  ) {
    return { ok: false, reason: "verification source is missing or untrusted" };
  }
  if (typeof cap.verification.method !== "string" || cap.verification.method.trim().length === 0) {
    return { ok: false, reason: "verification method is missing" };
  }
  if (
    typeof cap.verification.verifiedAt !== "string" ||
    !Number.isFinite(Date.parse(cap.verification.verifiedAt))
  ) {
    return { ok: false, reason: "verification timestamp is missing or malformed" };
  }
  return { ok: true, reason: "verified" };
}

/**
 * Resolve a verified execution capability for an agent.
 *
 * SAFETY CONTRACT: when no authoritative `provider` is supplied (the current
 * production reality — there is no verified execution-capability source in the
 * repository), this returns `null`. Activation therefore stays UNAVAILABLE.
 *
 * A provider is accepted ONLY as an explicit, test/injection argument; the
 * module never constructs or imports one, never reads configuration, and never
 * reaches the network. Until a genuine `ExecutionCapabilityProvider`
 * implementation exists and is deliberately wired in, every call resolves to
 * `null`.
 */
export async function resolveExecutionCapability(
  _input: ExecutionCapabilityInput,
  provider?: ExecutionCapabilityProvider
): Promise<VerifiedExecutionCapability | null> {
  if (!provider) {
    return null;
  }
  const capability = await provider.resolveExecutionCapability(_input);
  if (!capability) {
    return null;
  }
  const result = verifyExecutionCapability(capability);
  return result.ok ? capability : null;
}
