/**
 * X.80 — Capability resolution state classification (PURE).
 *
 * Distinguishes the six capability states the application must tell apart
 * before allowing a session. Only `verified-funded` may satisfy the gate.
 */
import type {
  VerifiedFundedErc8183JobEvidence,
  JobValidationContext,
} from "./erc8183-job-evidence.ts";
import { validateVerifiedJob } from "./erc8183-job-evidence.ts";

export type CapabilityState =
  | "no-capability"
  | "unverified-job"
  | "verified-funded"
  | "expired"
  | "invalid"
  | "revoked-disputed";

/**
 * Classify the capability resolution for a (possibly null) verified funded job
 * against the expected identity/chain context.
 *   - null evidence                       -> no-capability
 *   - status OPEN (created, not funded)   -> unverified-job
 *   - status EXPIRED                      -> expired
 *   - status REJECTED/COMPLETED           -> revoked-disputed
 *   - FUNDED/SUBMITTED + valid            -> verified-funded
 *   - FUNDED/SUBMITTED + invalid          -> expired/invalid/revoked-disputed
 */
export function classifyCapability(
  evidence: VerifiedFundedErc8183JobEvidence | null | undefined,
  ctx: JobValidationContext
): CapabilityState {
  if (!evidence || evidence.kind !== "verified") return "no-capability";

  switch (evidence.status) {
    case "OPEN":
      return "unverified-job";
    case "EXPIRED":
      return "expired";
    case "REJECTED":
    case "COMPLETED":
      return "revoked-disputed";
    case "FUNDED":
    case "SUBMITTED": {
      const result = validateVerifiedJob(evidence, ctx);
      if (result.ok) return "verified-funded";
      if (result.reason.includes("expired")) return "expired";
      if (
        result.reason.includes("dispute") ||
        result.reason.includes("settled") ||
        result.reason.includes("non-actionable")
      ) {
        return "revoked-disputed";
      }
      return "invalid";
    }
    default:
      return "invalid";
  }
}
