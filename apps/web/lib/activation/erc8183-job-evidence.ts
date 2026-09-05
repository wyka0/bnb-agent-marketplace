/**
 * X.80 — Internal representation of a VERIFIED FUNDED ERC-8183 job (PURE).
 *
 * This is NOT a provider integration. It is the typed shape a future
 * ERC-8183 ExecutionCapabilityProvider would produce after reading on-chain
 * job state. It deliberately distinguishes a `RequestedErc8183Job` (what a
 * hire flow wants to create) from a `VerifiedFundedErc8183JobEvidence` (what
 * the chain attests after funding). Calldata, creation requests, and unsigned
 * transactions are NEVER accepted as funded evidence.
 */

export type Erc8183JobStatus =
  "OPEN" | "FUNDED" | "SUBMITTED" | "COMPLETED" | "REJECTED" | "EXPIRED";

export interface Erc8183JobVerification {
  /** Authoritative origin, e.g. the AgenticCommerce contract address. */
  source: string;
  /** Explicit method, e.g. "onchain:erc8183-job". */
  method: string;
  /** ISO-8601 timestamp the evidence was read/verified. */
  verifiedAt: string;
}

/** What a hire flow requests — NOT funded, NOT authoritative. */
export interface RequestedErc8183Job {
  kind: "requested";
  chainId: number;
  agentIdentity: string;
  provider: string;
  resource: string;
  executionCapability: string;
  budget: string;
  expiresAt: string;
  predictedJobId: string;
}

/** Authoritative, on-chain-attested funded job. */
export interface VerifiedFundedErc8183JobEvidence {
  kind: "verified";
  chainId: number;
  jobId: string;
  client: string;
  provider: string;
  agentIdentity: string;
  resource: string;
  executionCapability: string;
  budget: string;
  expiresAt: string;
  status: Erc8183JobStatus;
  verification: Erc8183JobVerification;
}

export interface JobValidationContext {
  /** Registry owner address the provider MUST equal. */
  expectedAgentOwner: string;
  /** Marketplace ERC-8183 client address the job.client MUST equal. */
  expectedClient: string;
  expectedChainId: number;
}

export type JobValidationResult = { ok: true } | { ok: false; reason: string };

function isAddressLike(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

/**
 * Pure, deterministic, side-effect-free validation of funded-job evidence.
 * Rejects every case enumerated in X.80 STEP 4. The two identity rules are
 * paramount: `job.provider === expectedAgentOwner` AND
 * `job.client === expectedClient`. No user-provided string may override them.
 */
export function validateVerifiedJob(
  evidence: VerifiedFundedErc8183JobEvidence | null | undefined,
  ctx: JobValidationContext
): JobValidationResult {
  if (!evidence || evidence.kind !== "verified") {
    return { ok: false, reason: "no verified funded job evidence" };
  }
  if (evidence.chainId !== ctx.expectedChainId) {
    return {
      ok: false,
      reason: `wrong chain: expected ${ctx.expectedChainId}, got ${evidence.chainId}`,
    };
  }
  if (
    typeof evidence.jobId !== "string" ||
    evidence.jobId.length === 0 ||
    evidence.jobId === "unknown"
  ) {
    return { ok: false, reason: "missing or placeholder jobId" };
  }
  if (
    !isAddressLike(evidence.client) ||
    evidence.client.toLowerCase() !== ctx.expectedClient.toLowerCase()
  ) {
    return { ok: false, reason: "client mismatch (job.client !== marketplace client)" };
  }
  if (
    !isAddressLike(evidence.provider) ||
    evidence.provider.toLowerCase() !== ctx.expectedAgentOwner.toLowerCase()
  ) {
    return { ok: false, reason: "provider mismatch (job.provider !== registry owner)" };
  }
  if (typeof evidence.agentIdentity !== "string" || evidence.agentIdentity.length === 0) {
    return { ok: false, reason: "missing agent identity" };
  }
  if (
    typeof evidence.resource !== "string" ||
    evidence.resource.length === 0 ||
    evidence.resource === "default"
  ) {
    return { ok: false, reason: "missing or placeholder resource" };
  }
  if (
    typeof evidence.executionCapability !== "string" ||
    evidence.executionCapability.length === 0 ||
    evidence.executionCapability === "enabled"
  ) {
    return { ok: false, reason: "missing or placeholder execution capability" };
  }
  const budget = BigInt(evidence.budget ?? "0");
  if (!Number.isFinite(Number(budget)) || budget <= 0n) {
    return { ok: false, reason: "invalid price/budget" };
  }
  const expiryMs = Date.parse(evidence.expiresAt);
  if (!Number.isFinite(expiryMs)) {
    return { ok: false, reason: "missing or malformed expiry" };
  }
  if (expiryMs <= Date.now()) {
    return { ok: false, reason: "job expired" };
  }
  const actionable: Erc8183JobStatus[] = ["FUNDED", "SUBMITTED"];
  if (!actionable.includes(evidence.status)) {
    if (evidence.status === "EXPIRED") return { ok: false, reason: "job expired" };
    if (evidence.status === "REJECTED" || evidence.status === "COMPLETED") {
      return { ok: false, reason: "job disputed/settled/non-actionable" };
    }
    return { ok: false, reason: `invalid status for activation: ${evidence.status}` };
  }
  if (
    !evidence.verification ||
    typeof evidence.verification.source !== "string" ||
    evidence.verification.source.length === 0 ||
    evidence.verification.source === "untrusted"
  ) {
    return { ok: false, reason: "missing or untrusted verification source" };
  }
  if (
    typeof evidence.verification.method !== "string" ||
    evidence.verification.method.length === 0
  ) {
    return { ok: false, reason: "missing verification method" };
  }
  return { ok: true };
}
