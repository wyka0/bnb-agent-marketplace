/**
 * X.81 — Read-only ERC-8183 execution-capability provider (PURE, framework-free).
 *
 * This module implements the existing `ExecutionCapabilityProvider` interface
 * (X.76) as a STRICTLY READ-ONLY verifier. It NEVER creates, funds, signs,
 * submits, approves, executes, or provisions anything. It performs at most
 * read-only `eth_call`/log reads through an injected `Erc8183JobReader`.
 *
 * Conceptual flow (STEP 10):
 *   agent identity -> resolve trusted owner -> locate explicit job id ->
 *   read ERC-8183 state -> verify client -> verify provider ->
 *   verify status -> verify funding -> verify expiry -> verify resource ->
 *   verify capability -> construct VerifiedExecutionCapability.
 * Any failed step returns `null`. Never returns partial capability.
 *
 * CRITICAL ERC-8183 SCHEMA LIMITATION (STEP 7):
 *   The authoritative `Erc8183Job` (SDK) exposes ONLY:
 *     id, client, provider, evaluator, description, budget, expiredAt,
 *     status, statusName, hook, submittedAt, deliverable.
 *   It does NOT expose `resource` or `executionCapability`. Those two fields
 *   MUST therefore come from an EXPLICITLY TRUSTED, out-of-band binding
 *   (e.g. a marketplace catalog that maps a verified agent to its service
 *   endpoint and capability). The binding is supplied via
 *   `resolveCapabilityBinding`; when it returns null the provider returns null
 *   and documents the missing field. It is NEVER fabricated from registry
 *   description, tags, x402 flag, reputation, or historical activity.
 */

import type { Erc8183Job } from "@altananetwork/sdk";
import type {
  ExecutionCapabilityInput,
  ExecutionCapabilityProvider,
  VerifiedExecutionCapability,
} from "./capability-source.ts";
import {
  validateVerifiedJob,
  type JobValidationContext,
  type VerifiedFundedErc8183JobEvidence,
} from "./erc8183-job-evidence.ts";

/** The only chain ERC-8183 is enabled on this phase (BNB testnet). */
export const SUPPORTED_ERC8183_CHAIN_ID = 97 as const;

/** Actionable on-chain job statuses (post-funding). */
const ACTIONABLE_STATUSES: ReadonlyArray<string> = ["FUNDED", "SUBMITTED"];

/**
 * Read-only ERC-8183 job reader. The production implementation is
 * `getErc8183Job(BNB_TESTNET, jobId)` from the integrations package, which is a
 * pure view read; this interface lets tests inject a deterministic fake.
 */
export interface Erc8183JobReader {
  readJob(jobId: bigint): Promise<Erc8183Job>;
}

/**
 * The explicitly-trusted out-of-band binding that supplies the two fields the
 * ERC-8183 job schema does NOT carry: `resource` and `executionCapability`.
 * Returns `null` when no trusted binding exists for the (agent, job) pair.
 */
export interface Erc8183CapabilityBinding {
  resource: string;
  executionCapability: string;
}

export interface Erc8183CapabilityProviderConfig {
  /** Read-only job reader (testnet-gated in production). */
  reader: Erc8183JobReader;
  /** Only chain 97 is supported; any other value fails closed. */
  expectedChainId: number;
  /** Marketplace ERC-8183 client address the job.client MUST equal. */
  expectedClient: string;
  /**
   * Resolve the trusted ERC-8004 registry owner for an agent identity. Returns
   * null when the agent is unknown — this MUST come from trusted application
   * data (8004scan), never from user-supplied input.
   */
  resolveAgentOwner(agentId: string): Promise<string | null>;
  /**
   * Resolve the trusted resource/capability binding for the (agent, job) pair.
   * Returns null when no trusted binding exists (the ERC-8183-missing-field
   * case). This is the ONLY permitted source for resource/executionCapability.
   * May be async (e.g. X.85 signed-quote verification) — callers MUST await it.
   */
  resolveCapabilityBinding(
    agentId: string,
    job: Erc8183Job
  ): Erc8183CapabilityBinding | null | Promise<Erc8183CapabilityBinding | null>;
  /** Authoritative ERC-8183 contract address used as verification provenance. */
  verificationSource: string;
}

function isAddressLike(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function addressEqual(a: string, b: string): boolean {
  return isAddressLike(a) && isAddressLike(b) && a.toLowerCase() === b.toLowerCase();
}

function safeParseJobId(value: string | undefined): bigint | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    const parsed = BigInt(value.trim());
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

function isoFromUnixSeconds(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString();
}

/**
 * Read and verify an ERC-8183 job into the X.80 `VerifiedFundedErc8183JobEvidence`
 * shape. Returns `null` on ANY failure (fail closed). This is the core evidence
 * resolver; the X.76 `resolveExecutionCapability` delegates to it.
 */
export async function resolveErc8183VerifiedJob(
  input: ExecutionCapabilityInput,
  config: Erc8183CapabilityProviderConfig
): Promise<VerifiedFundedErc8183JobEvidence | null> {
  // STEP 3 — explicit chain only; no silent fallback.
  if (config.expectedChainId !== SUPPORTED_ERC8183_CHAIN_ID) return null;

  // STEP 11 — explicit trusted job id required; no job discovery fabrication.
  const jobId = safeParseJobId(input.hireId);
  if (jobId === null) return null;

  // STEP 5 — trusted owner from application data, never user-supplied.
  const owner = await config.resolveAgentOwner(input.agentId);
  if (!isAddressLike(owner ?? "")) return null;

  // STEP 4 — read-only job read; any RPC/contract error fails closed.
  let job: Erc8183Job;
  try {
    job = await config.reader.readJob(jobId);
  } catch {
    return null;
  }
  if (job === null || job === undefined || job.id !== jobId) return null;

  // STEP 6 — job-state validation.
  const status = job.statusName;
  if (!ACTIONABLE_STATUSES.includes(status)) {
    // OPEN (unfunded), EXPIRED, REJECTED (disputed), COMPLETED (settled) all fail.
    return null;
  }

  // STEP 5 — exact identity binding (authoritative, not user input).
  if (!addressEqual(job.provider, owner ?? "")) return null;
  if (!addressEqual(job.client, config.expectedClient)) return null;

  // STEP 8 — price / expiry from authoritative job state only.
  if (job.budget <= 0n) return null;
  if (job.expiredAt <= nowSeconds()) return null; // also rejects expiredAt === 0

  // STEP 7 — resource/capability are NOT in the ERC-8183 schema; require a
  // trusted out-of-band binding. Absent binding => null (missing field).
  const binding = await config.resolveCapabilityBinding(input.agentId, job);
  if (
    !binding ||
    typeof binding.resource !== "string" ||
    binding.resource.trim().length === 0 ||
    binding.resource.trim() === "default" ||
    typeof binding.executionCapability !== "string" ||
    binding.executionCapability.trim().length === 0 ||
    binding.executionCapability.trim() === "enabled"
  ) {
    return null;
  }

  const evidence: VerifiedFundedErc8183JobEvidence = {
    kind: "verified",
    chainId: SUPPORTED_ERC8183_CHAIN_ID,
    jobId: job.id.toString(),
    client: job.client,
    provider: job.provider,
    agentIdentity: input.agentId,
    resource: binding.resource,
    executionCapability: binding.executionCapability,
    budget: job.budget.toString(),
    expiresAt: isoFromUnixSeconds(job.expiredAt),
    status: status as VerifiedFundedErc8183JobEvidence["status"],
    verification: {
      source: config.verificationSource,
      method: "onchain:erc8183-job-state-read",
      verifiedAt: new Date().toISOString(),
    },
  };
  return evidence;
}

/**
 * Build an `ExecutionCapabilityProvider` that reads + verifies ERC-8183 jobs.
 * The returned object exposes ONLY `resolveExecutionCapability`; it performs no
 * session creation, custody, signing, or execution.
 */
export function createErc8183CapabilityProvider(
  config: Erc8183CapabilityProviderConfig
): ExecutionCapabilityProvider {
  return {
    async resolveExecutionCapability(
      input: ExecutionCapabilityInput
    ): Promise<VerifiedExecutionCapability | null> {
      const evidence = await resolveErc8183VerifiedJob(input, config);
      if (evidence === null) return null;

      // Defense in depth: re-run the X.80 validator with the evidence's own
      // identity/chain context. Guarantees the output satisfies the contract.
      const gateCtx: JobValidationContext = {
        expectedAgentOwner: evidence.provider,
        expectedClient: config.expectedClient,
        expectedChainId: SUPPORTED_ERC8183_CHAIN_ID,
      };
      const validated = validateVerifiedJob(evidence, gateCtx);
      if (!validated.ok) return null;

      const capability: VerifiedExecutionCapability = {
        agentId: evidence.agentIdentity,
        jobId: evidence.jobId,
        resource: evidence.resource,
        executionCapability: evidence.executionCapability,
        price: evidence.budget,
        expiresAt: evidence.expiresAt,
        verification: {
          source: evidence.verification.source,
          verifiedAt: evidence.verification.verifiedAt,
          method: evidence.verification.method,
        },
      };
      return capability;
    },
  };
}
