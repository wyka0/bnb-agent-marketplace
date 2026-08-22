/**
 * X.80 — Extended consent commitment (PURE, framework-free).
 *
 * Canonical, deterministic commitment binding every security-relevant term of a
 * future ERC-8183-backed activation, so the user cannot consent to one set of
 * terms while the system later acts under another. No network, no env, no tx.
 *
 * Serialization is canonical: object keys sorted (Unicode order), no whitespace,
 * `undefined` rejected (never omitted), `null` kept as an explicit distinct
 * value. Numbers use JSON numbers; monetary/identity values use strings to avoid
 * coercion ambiguity. One canonical string per commitment — no duplicate reps.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { Scan8004Agent } from "../eight004scan/types.ts";

export type Address = string;
export type ChainId = number;

/** Structured, explicit permission set the user is consenting to. */
export interface ConsentPermissions {
  /** e.g. ["TOKEN_SPEND"] — explicit, never empty in a valid commitment. */
  kinds: string[];
}

/**
 * The full set of activation terms the user explicitly commits to. Every field
 * maps to a real security decision; none is cosmetic.
 */
export interface ConsentCommitment {
  /** Exact ERC-8004 agent identity `{chainId}:{contract}:{tokenId}`. */
  agentIdentity: string;
  chainId: ChainId;
  /** ERC-8004 owner address — must equal the ERC-8183 job `provider`. */
  provider: Address;
  /** Requested/attested resource (protocol endpoint / service URL). */
  resource: string;
  /** Explicit execution capability (NOT "enabled"). */
  executionCapability: string;
  /** Budget/price in raw $U units (string to avoid bigint coercion). */
  budget: string;
  /** ISO-8601 capability/session expiry. */
  expiresAt: string;
  permissions: ConsentPermissions;
  /** The user intends a session to be created. */
  sessionIntent: boolean;
  /** The user authorizes later execution within the granted scope. */
  executionIntent: boolean;
  /** Who funds the ERC-8183 escrow job. */
  fundingResponsibility: "marketplace";
  /**
   * The ERC-8183 job id this consent binds to, or null when no funded job
   * exists yet (pre-funding). Explicit null distinguishes "not yet funded"
   * from "unknown".
   */
  jobId: string | null;
  /** Verification provenance of the job evidence, or null pre-funding. */
  verification: { source: string; method: string } | null;
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    throw new Error("consent: undefined value is not permitted in a commitment");
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableStringify(item)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((key) => JSON.stringify(key) + ":" + stableStringify(obj[key]));
  return "{" + parts.join(",") + "}";
}

/** Canonical deterministic serialization (stable string). */
export function canonicalizeConsent(commitment: ConsentCommitment): string {
  if (commitment === undefined || commitment === null || typeof commitment !== "object") {
    throw new Error("consent: commitment must be an object");
  }
  return stableStringify(commitment);
}

/** SHA-256 hex digest of the canonical commitment. */
export function digestConsentCommitment(commitment: ConsentCommitment): string {
  return createHash("sha256").update(canonicalizeConsent(commitment), "utf8").digest("hex");
}

function buffersEqualHex(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Constant-time verification that `digest` matches the commitment. Returns
 * false (never throws) on malformed digests.
 */
export function verifyConsentCommitment(commitment: ConsentCommitment, digest: string): boolean {
  if (typeof digest !== "string" || digest.length === 0) return false;
  return buffersEqualHex(digestConsentCommitment(commitment), digest);
}

/**
 * Build a commitment from a registry agent record + (optional) funded-job
 * evidence. Used by the route wiring and tests. Pre-funding jobs pass `null`
 * for the job fields, producing an explicit-null commitment.
 */
export function commitmentFromAgent(
  record: Scan8004Agent,
  job: {
    jobId: string | null;
    resource: string;
    executionCapability: string;
    budget: string;
    expiresAt: string;
    verification: { source: string; method: string } | null;
  } | null
): ConsentCommitment {
  return {
    agentIdentity: record.agent_id,
    chainId: record.chain_id,
    provider: record.owner_address ?? "",
    resource: job?.resource ?? "",
    executionCapability: job?.executionCapability ?? "",
    budget: job?.budget ?? "0",
    expiresAt: job?.expiresAt ?? "",
    permissions: { kinds: ["TOKEN_SPEND"] },
    sessionIntent: true,
    executionIntent: true,
    fundingResponsibility: "marketplace",
    jobId: job?.jobId ?? null,
    verification: job?.verification ?? null,
  };
}
