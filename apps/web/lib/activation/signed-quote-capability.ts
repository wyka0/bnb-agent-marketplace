/**
 * X.85 — ERC-8183 signed-quote capability resolution (PURE verifier, candidate).
 *
 * An ERC-8183 *signed quote* is a provider-signed attestation that, for a given
 * funded `jobId`, the provider will expose `resource` with
 * `executionCapability`, expiring at `quoteExpiresAt`. Unlike the X.84
 * registration file (self-asserted, mutable, off-chain, NOT job-bound), a signed
 * quote is CRYPTOGRAPHICALLY BOUND to the on-chain job and provider:
 *
 *   - the signature recovers to the quote signer;
 *   - the signer MUST equal the on-chain `job.provider`;
 *   - the signer MUST equal the trusted ERC-8004 registry `owner_address`;
 *   - the `jobId` inside the quote MUST equal the on-chain job id;
 *   - the quote MUST NOT be expired.
 *
 * When all hold, the quote is a genuine execution-authority source and feeds the
 * X.81 `resolveCapabilityBinding` (producing a `VerifiedExecutionCapability`).
 *
 * However, the marketplace repo does NOT currently publish signed quotes and has
 * NO quote reader wired in production. Therefore — exactly as X.83 concluded —
 * the production resolver defaults to null and the activation gate stays
 * fail-closed. This module implements the verification logic and is unit-tested
 * with a synthetic keypair to prove the crypto path; it does NOT, by itself,
 * unlock any agent. All I/O is injected so it is deterministic and network-free.
 */

import { getAddress, isAddress, recoverMessageAddress, type Hex } from "viem";
import type { Erc8183Job } from "@altananetwork/sdk";
import type { Erc8183CapabilityBinding } from "./erc8183-capability-provider.ts";

/** A provider-signed ERC-8183 capability quote. */
export interface Erc8183SignedQuote {
  /** On-chain job id the quote is bound to. */
  jobId: string;
  /** Expected signer = on-chain job.provider = registry owner. */
  provider: string;
  /** Service endpoint / a2a URI the job authority grants. */
  resource: string;
  /** Comma/semicolon-separated capability tokens. */
  executionCapability: string;
  /** Unix seconds; quote is invalid after this. */
  quoteExpiresAt: number;
  /** Unix seconds; quote issued at (for replay/freshness context). */
  signedAt: number;
  /** EIP-191 personal_sign signature over `buildQuoteMessage`. */
  signature: string;
}

/** Reads a signed quote for an agent. Injected; production has none. */
export interface SignedQuoteReader {
  readSignedQuote(agentId: string): Promise<Erc8183SignedQuote | null>;
}

/**
 * Canonical, deterministic serialization of a quote into the signed string.
 * Field order and separators are fixed; do not reorder without bumping a
 * version prefix (otherwise existing signatures silently fail verification).
 */
export function buildQuoteMessage(quote: {
  jobId: string;
  provider: string;
  resource: string;
  executionCapability: string;
  quoteExpiresAt: number;
  signedAt: number;
}): string {
  return [
    "ALTANA-ERC8183-QUOTE/1",
    `jobId=${quote.jobId}`,
    `provider=${quote.provider.toLowerCase()}`,
    `resource=${quote.resource}`,
    `executionCapability=${quote.executionCapability}`,
    `expiresAt=${quote.quoteExpiresAt}`,
    `signedAt=${quote.signedAt}`,
  ].join("\n");
}

function addressEqual(a: string, b: string): boolean {
  return isAddress(a) && isAddress(b) && getAddress(a) === getAddress(b);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isBlank(value: string): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

/**
 * Verify a signed quote against its on-chain job and trusted registry owner.
 * Returns `null` on ANY failure (fail closed). On success returns the two fields
 * the ERC-8183 schema lacks: `resource` + `executionCapability`, now proven to
 * be provider-authoritative and job-bound.
 *
 * `job` is the read-only on-chain job (X.81 `reader.readJob`). `trustedOwner`
 * is the trusted 8004scan `owner_address`. The signer must equal both
 * `job.provider` and `trustedOwner`, and the quote `jobId` must equal `job.id`.
 */
export async function verifySignedQuote(
  quote: Erc8183SignedQuote,
  job: Erc8183Job,
  trustedOwner: string
): Promise<Erc8183CapabilityBinding | null> {
  if (
    isBlank(quote.resource) ||
    quote.resource.trim() === "default" ||
    isBlank(quote.executionCapability) ||
    quote.executionCapability.trim() === "enabled"
  ) {
    return null;
  }
  if (!isAddress(quote.provider) || !isAddress(trustedOwner)) return null;

  // Quote is bound to a specific on-chain job and must not be expired.
  if (quote.jobId !== job.id.toString()) return null;
  if (quote.quoteExpiresAt <= nowSeconds()) return null;
  if (quote.signedAt > quote.quoteExpiresAt) return null;

  // Recover the signer and require it to be the job provider AND registry owner.
  const message = buildQuoteMessage(quote);
  let signer: string;
  try {
    signer = await recoverMessageAddress({
      message,
      signature: quote.signature as Hex,
    });
  } catch {
    return null;
  }
  if (!addressEqual(signer, quote.provider)) return null;
  if (!addressEqual(quote.provider, job.provider)) return null;
  if (!addressEqual(quote.provider, trustedOwner)) return null;

  return {
    resource: quote.resource.trim(),
    executionCapability: quote.executionCapability.trim(),
  };
}

/**
 * Build an X.81-compatible `resolveCapabilityBinding` that resolves the
 * resource/capability from a trusted signed quote. Returns null when no quote
 * reader is supplied or the quote fails verification — preserving fail-closed.
 *
 * @param reader   injected signed-quote reader (production: none => null)
 * @param resolveOwner  trusted registry owner resolver (X.81 supplies 8004scan)
 */
export function makeSignedQuoteBindingResolver(
  reader: SignedQuoteReader | null,
  resolveOwner: (agentId: string) => Promise<string | null>
): (agentId: string, job: Erc8183Job) => Promise<Erc8183CapabilityBinding | null> {
  if (reader === null) return () => Promise.resolve(null);
  return async (agentId, job) => {
    const quote = await reader.readSignedQuote(agentId);
    if (quote === null) return null;
    const owner = await resolveOwner(agentId);
    if (isBlank(owner ?? "")) return null;
    return verifySignedQuote(quote, job, owner as string);
  };
}

/** Re-export the job type for callers composing with X.81. */
export type { Erc8183Job };
