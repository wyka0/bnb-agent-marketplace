/**
 * X.80 — Session-creation gate (PURE, framework-free).
 *
 * Enforces the 12 preconditions for allowing real session creation. It performs
 * NO network, NO signing, NO custody. It returns an explicit allow/deny with a
 * reason and the resolved capability state. Fails closed: any missing input, a
 * failed consent, a non-verified-funded capability, or unavailable custody
 * yields a deny. It NEVER creates a session.
 */
import type { AuthenticatedIdentity } from "../auth/types.ts";
import { verifyConsentCommitment, type ConsentCommitment } from "./consent.commitment.ts";
import type {
  VerifiedFundedErc8183JobEvidence,
  JobValidationContext,
} from "./erc8183-job-evidence.ts";
import { classifyCapability, type CapabilityState } from "./capability-resolution.ts";

export interface SessionGateInput {
  identity: AuthenticatedIdentity | null;
  agentIdentity: string;
  consent: { commitment: ConsentCommitment; digest: string };
  verifiedJob: VerifiedFundedErc8183JobEvidence | null;
  custodyAvailable: boolean;
  gateCtx: JobValidationContext;
}

export interface SessionGateResult {
  allowed: boolean;
  reason: string;
  state: CapabilityState;
}

export function evaluateSessionGate(input: SessionGateInput): SessionGateResult {
  const { identity, agentIdentity, consent, verifiedJob, custodyAvailable, gateCtx } = input;

  // 1. authenticated user
  if (identity === null) {
    return { allowed: false, reason: "authentication required", state: "no-capability" };
  }
  // 2. wallet ownership
  if (!identity.walletAddress || identity.walletAddress.length === 0 || !identity.walletId) {
    return { allowed: false, reason: "wallet ownership unverified", state: "no-capability" };
  }
  // 3. exact agent identity binding
  if (consent.commitment.agentIdentity !== agentIdentity) {
    return { allowed: false, reason: "agent identity mismatch", state: "no-capability" };
  }
  // 4. valid consent (digest commitment)
  if (!verifyConsentCommitment(consent.commitment, consent.digest)) {
    return { allowed: false, reason: "consent digest mismatch", state: "no-capability" };
  }
  // 5-11. verified funded ERC-8183 job + provider/client/status/expiry/resource/capability
  const state = classifyCapability(verifiedJob, gateCtx);
  if (state !== "verified-funded") {
    return { allowed: false, reason: `capability not verified-funded: ${state}`, state };
  }
  // 12. custody availability — without it, no session may be created
  if (!custodyAvailable) {
    return { allowed: false, reason: "custody unavailable", state };
  }
  return { allowed: true, reason: "session creation allowed", state };
}
