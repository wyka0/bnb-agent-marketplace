/**
 * ERC-8183 job-escrow adapter (Phase 3A).
 *
 * SCOPE — BNB testnet (chain 97) ONLY, construction + read + boundary surfaces:
 *   - getErc8183Addresses           testnet-gated address table (from the SDK)
 *   - erc8183NetworkFromClient      resolve + validate a client's NetworkConfig
 *   - prepareErc8183Hire            validate inputs and build the atomic hire calls
 *   - getErc8183Job                 read a job from the AgenticCommerce kernel
 *   - parseErc8183Deliverable       pure parse/validation of a deliverable manifest
 *   - getErc8183Deliverable         on-chain deliverable lookup (untrusted content)
 *   - getErc8183SettlementStatus    pure job-state → approve/dispute availability
 *   - buildErc8183ClaimRefundCall   testnet-gated claimRefund call construction
 *
 * INTENTIONALLY ABSENT (documented boundaries, NOT implemented in 3A):
 *   - signing / submission. `hireErc8183Agent`, `settleErc8183Job`,
 *     `identify`/`execute` with a Signer or Session are NOT wired. Every
 *     execution path funnels through `assertErc8183SigningBoundary`, which
 *     ALWAYS throws with the explicit "no transaction was submitted" message.
 *     No private key, no session key, no wallet credential exists here.
 *   - mainnet (chain 56) is rejected for ERC-8183 regardless of environment.
 *   - x402, skills (Aave/Venus/PancakeSwap/Lista/Token Radar/Copy Trade),
 *     browser wallet connection, and production payments.
 *
 * Deliverables are untrusted data: we only surface the URL string; nothing
 * here downloads or executes deliverable content.
 */

import { isAddress } from "viem";
import type { Address, Hex } from "viem";
import {
  buildHireCalls as sdkBuildHireCalls,
  buildClaimRefundCall as sdkBuildClaimRefundCall,
  erc8183Addresses as sdkErc8183Addresses,
  getErc8183DeliverableUrl as sdkGetErc8183DeliverableUrl,
  getErc8183Job as sdkGetErc8183Job,
  JOB_STATUS,
} from "@altananetwork/sdk";
import type {
  Call,
  Erc8183Addresses,
  Erc8183Job,
  JobStatusName,
  NetworkConfig,
} from "@altananetwork/sdk";
import type { Client } from "@altananetwork/sdk";

/** The only chain ERC-8183 is enabled on this phase (BNB testnet). */
export const ALTANA_ERC8183_CHAIN_ID = 97 as const;
/** Human-readable network name reported by the adapter. */
export const ALTANA_ERC8183_NETWORK = "bnb-testnet" as const;
/** Kernel description byte limit — mirrors the SDK's own guard (≤4096). */
export const ERC8183_MAX_DESCRIPTION_BYTES = 4096;
/** Required string when execution would need an external signing authority. */
export const ERC8183_EXECUTION_REQUIRES_SIGNER =
  "Transaction execution requires an externally supplied testnet wallet/funding. No transaction was submitted.";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Base class for all adapter-normalized ERC-8183 errors. */
export class AltanaErc8183Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183Error";
  }
}

export class AltanaErc8183NetworkError extends AltanaErc8183Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183NetworkError";
  }
}

export class AltanaErc8183ConfigError extends AltanaErc8183Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183ConfigError";
  }
}

export class AltanaErc8183JobParamError extends AltanaErc8183Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183JobParamError";
  }
}

export class AltanaErc8183JobNotFoundError extends AltanaErc8183Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183JobNotFoundError";
  }
}

export class AltanaErc8183JobStateError extends AltanaErc8183Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183JobStateError";
  }
}

export class AltanaErc8183DeliverableError extends AltanaErc8183Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183DeliverableError";
  }
}

export class AltanaErc8183SettlementError extends AltanaErc8183Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183SettlementError";
  }
}

export class AltanaErc8183DisputeError extends AltanaErc8183Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183DisputeError";
  }
}

export class AltanaErc8183RefundError extends AltanaErc8183Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaErc8183RefundError";
  }
}

/** SDK / RPC / transaction-construction failure, normalized. */
export class AltanaErc8183ExecutionError extends AltanaErc8183Error {
  constructor(
    message: string,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = "AltanaErc8183ExecutionError";
  }
}

/** Snapshot of the ERC-8183-relevant part of a resolved testnet network. */
export interface Erc8183NetworkSnapshot {
  network: typeof ALTANA_ERC8183_NETWORK;
  chainId: typeof ALTANA_ERC8183_CHAIN_ID;
  keyStore: Address;
  keyStoreController: Address;
  publicRpcUrl: string;
  explorer: string;
  relayUrl?: string;
}

/** Resolved ERC-8183 address table for the testnet deployment. */
export interface Erc8183ResolvedConfig {
  /** Testnet chain id. */
  chainId: typeof ALTANA_ERC8183_CHAIN_ID;
  addresses: Erc8183Addresses;
  commerce: Address;
  router: Address;
  policy: Address;
  registry: Address;
  paymentToken: Address;
}

/** Input for the pure hire-call construction (jobId is the PREDICTED id). */
export interface Erc8183HireJobInput {
  /** ERC-8183 seller (provider) address. */
  provider: Address;
  /** Task text (Mode A) or anchored signed-quote JSON (Mode B), ≤4096 bytes. */
  description: string;
  /** Budget in raw $U units (18 decimals). */
  budget: bigint;
  /** Absolute unix seconds; must exceed now + disputeWindow. */
  expiredAt: bigint;
  /** Predicted job id — `jobCounter() + 1` (job ids are 1-indexed). */
  jobId: bigint;
}

/** Prepared (not submitted) hire draft. `calls` is the SDK's 5-call batch. */
export interface Erc8183HireDraft {
  network: Erc8183NetworkSnapshot;
  config: Erc8183ResolvedConfig;
  job: Erc8183HireJobInput;
  calls: Call[];
}

/** Deliverable parse result for a manifest (optParams JSON). */
export type Erc8183DeliverableParse =
  | { ok: true; url: string }
  | { ok: false; kind: "malformed-json" | "missing-field" | "not-http-url" };

/** On-chain deliverable lookup result. */
export type Erc8183DeliverableRead =
  { ok: true; url: string } | { ok: false; kind: "pre-submission" | "not-found" | "malformed" };

/** Job-state-derived settlement availability. */
export interface Erc8183SettlementStatus {
  /** Valid action for the job's current on-chain window. */
  action: "approve" | "dispute" | "none";
  /** Whether the action can be executed right now. */
  available: boolean;
  /** Short human-readable reason. */
  reason: string;
}

const KNOWN_JOB_STATUSES: ReadonlySet<string> = new Set<string>(JOB_STATUS);

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Message with a normalized, secrets-free SDK/RPC error suffix. */
function wrap(error: unknown, prefix: string): string {
  return `${prefix}: ${errorMessage(error)}`;
}

/** Throws if `chainId` is not the ERC-8183 testnet chain. */
export function assertErc8183TestnetChainOnly(chainId: number): void {
  if (chainId !== ALTANA_ERC8183_CHAIN_ID) {
    throw new AltanaErc8183NetworkError(
      `ERC-8183 is enabled on bnb-testnet (chain ${ALTANA_ERC8183_CHAIN_ID}) only; ` +
        `refusing chain ${chainId}. Mainnet ERC-8183 is not wired.`
    );
  }
}

/** Throws unless `network` is the ERC-8183 testnet NetworkConfig. */
export function assertErc8183TestnetNetwork(network: NetworkConfig): void {
  if (network.chainId !== ALTANA_ERC8183_CHAIN_ID) {
    throw new AltanaErc8183NetworkError(
      `ERC-8183 is enabled on bnb-testnet (chain ${ALTANA_ERC8183_CHAIN_ID}) only; ` +
        `refusing network chainId ${network.chainId}.`
    );
  }
}

/**
 * Resolve the ERC-8183 address table for a chain. Testnet-only gate wraps the
 * SDK's own address table (no addresses are hardcoded in this adapter).
 */
export function getErc8183Addresses(chainId: number): Erc8183Addresses {
  assertErc8183TestnetChainOnly(chainId);
  return sdkErc8183Addresses(chainId);
}

/** Build the full resolved ERC-8183 config for the testnet deployment. */
export function resolveErc8183Config(chainId: number): Erc8183ResolvedConfig {
  const addresses = getErc8183Addresses(chainId);
  return {
    chainId: ALTANA_ERC8183_CHAIN_ID,
    addresses,
    commerce: addresses.commerce,
    router: addresses.router,
    policy: addresses.policy,
    registry: addresses.registry,
    paymentToken: addresses.paymentToken,
  };
}

/**
 * Validate a client and extract its ERC-8183 network snapshot.
 * Rejects clients configured for any chain other than 97.
 */
export function erc8183NetworkFromClient(client: Client): Erc8183NetworkSnapshot {
  const chain = client.chains[0];
  if (chain === undefined) {
    throw new AltanaErc8183ConfigError("Altana client has no configured chains.");
  }
  if (chain.chainId !== ALTANA_ERC8183_CHAIN_ID) {
    throw new AltanaErc8183NetworkError(
      `Altana client is configured for chain ${chain.chainId}; ERC-8183 requires ` +
        `bnb-testnet (chain ${ALTANA_ERC8183_CHAIN_ID}).`
    );
  }
  return {
    network: ALTANA_ERC8183_NETWORK,
    chainId: ALTANA_ERC8183_CHAIN_ID,
    keyStore: chain.keyStore,
    keyStoreController: chain.keyStoreController,
    publicRpcUrl: chain.publicRpcUrl,
    explorer: chain.explorer,
    relayUrl: chain.relayUrl,
  };
}

/**
 * Validate hire inputs (pure; no network).
 * Throws `AltanaErc8183JobParamError` on the first violation.
 */
export function validateErc8183HireInput(input: Erc8183HireJobInput): void {
  if (isAddress(input.provider) === false || input.provider === ZERO_ADDRESS) {
    throw new AltanaErc8183JobParamError(
      `provider must be a non-zero address (got "${String(input.provider)}").`
    );
  }
  if (typeof input.description !== "string" || input.description.length === 0) {
    throw new AltanaErc8183JobParamError("description must be a non-empty string.");
  }
  if (byteLength(input.description) > ERC8183_MAX_DESCRIPTION_BYTES) {
    throw new AltanaErc8183JobParamError(
      `description exceeds ${ERC8183_MAX_DESCRIPTION_BYTES} bytes (kernel limit — do not truncate signed quotes).`
    );
  }
  if (typeof input.budget !== "bigint" || input.budget <= 0n) {
    throw new AltanaErc8183JobParamError("budget must be a positive bigint of raw $U units.");
  }
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  if (typeof input.expiredAt !== "bigint" || input.expiredAt <= nowSeconds) {
    throw new AltanaErc8183JobParamError(
      "expiredAt must be a future absolute unix timestamp (exceeds now + dispute window)."
    );
  }
  if (typeof input.jobId !== "bigint" || input.jobId <= 0n) {
    throw new AltanaErc8183JobParamError(
      "jobId must be a positive bigint (predicted jobCounter()+1)."
    );
  }
}

/**
 * Build the atomic hire calls for an ERC-8183 job on testnet. Pure — builds,
 * validates, and returns a `Erc8183HireDraft`; nothing is submitted. The
 * caller must still pass the calls through a Signer/Session (out of scope).
 */
export function prepareErc8183Hire(
  network: NetworkConfig,
  input: Erc8183HireJobInput
): Erc8183HireDraft {
  assertErc8183TestnetNetwork(network);
  validateErc8183HireInput(input);

  const addresses = getErc8183Addresses(network.chainId);
  const calls = sdkBuildHireCalls({
    addresses,
    jobId: input.jobId,
    provider: input.provider,
    description: input.description,
    budget: input.budget,
    expiredAt: input.expiredAt,
  });

  return {
    network: {
      network: ALTANA_ERC8183_NETWORK,
      chainId: ALTANA_ERC8183_CHAIN_ID,
      keyStore: network.keyStore,
      keyStoreController: network.keyStoreController,
      publicRpcUrl: network.publicRpcUrl,
      explorer: network.explorer,
      relayUrl: network.relayUrl,
    },
    config: {
      chainId: ALTANA_ERC8183_CHAIN_ID,
      addresses,
      commerce: addresses.commerce,
      router: addresses.router,
      policy: addresses.policy,
      registry: addresses.registry,
      paymentToken: addresses.paymentToken,
    },
    job: input,
    calls,
  };
}

/** Internal shape guard: rejects a job object that isn't a sane ERC-8183 job. */
function validateErc8183JobShape(job: Erc8183Job, jobId: bigint): void {
  if (job.id !== jobId) {
    throw new AltanaErc8183JobNotFoundError(
      `job id mismatch: requested ${jobId}, kernel returned ${job.id.toString()} — ` +
        "the predicted id was likely stolen by a concurrent createJob; retry."
    );
  }
  if (KNOWN_JOB_STATUSES.has(job.statusName) === false) {
    throw new AltanaErc8183JobStateError(
      `kernel returned unknown job status "${String(job.statusName)}" (status ${job.status}).`
    );
  }
}

/**
 * Read a job from the AgenticCommerce kernel (testnet). Wraps the SDK's
 * `getErc8183Job`; RPC/revert failures are normalized (no secrets, no stack
 * traces leak).
 */
export async function getErc8183Job(network: NetworkConfig, jobId: bigint): Promise<Erc8183Job> {
  assertErc8183TestnetNetwork(network);
  if (typeof jobId !== "bigint" || jobId <= 0n) {
    throw new AltanaErc8183JobParamError("jobId must be a positive bigint.");
  }
  try {
    const job = await sdkGetErc8183Job(network, jobId);
    validateErc8183JobShape(job, jobId);
    return job;
  } catch (error) {
    if (error instanceof AltanaErc8183Error) throw error;
    // SDK revert? RPC unreachable? Normalize as an execution/read failure.
    // A nonexistent job surfaces as `AltanaErc8183JobNotFoundError` from
    // validateErc8183JobShape (kernel id mismatch); anything else is a read
    // failure, NOT a "job not found".
    throw new AltanaErc8183ExecutionError(
      wrap(error, `job ${jobId.toString()} could not be read on bnb-testnet`)
    );
  }
}

/**
 * Pure parse + validation of a deliverable manifest (`optParams` JSON, e.g.
 * `{"deliverable_url": "https://…"}`). Deliverables are UNTRUSTED data: only
 * an http(s) URL string is accepted, nothing is downloaded or executed.
 */
export function parseErc8183Deliverable(optParamsJson: string): Erc8183DeliverableParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(optParamsJson.replace(/\0+$/, ""));
  } catch {
    return { ok: false, kind: "malformed-json" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, kind: "malformed-json" };
  }
  const record = parsed as Record<string, unknown>;
  const url = record.deliverable_url;
  if (typeof url !== "string" || url.length === 0) {
    return { ok: false, kind: "missing-field" };
  }
  if (/^https?:\/\//i.test(url) === false) {
    return { ok: false, kind: "not-http-url" };
  }
  return { ok: true, url };
}

/**
 * Locate the deliverable URL for a job on testnet (after submission). Wraps
 * the SDK's log-scanning `getErc8183DeliverableUrl`; the returned URL is
 * re-validated as an http(s) URL before being surfaced.
 */
export async function getErc8183Deliverable(
  network: NetworkConfig,
  jobId: bigint,
  opts?: { scanWindow?: bigint; maxWindows?: number }
): Promise<Erc8183DeliverableRead> {
  assertErc8183TestnetNetwork(network);
  const job = await getErc8183Job(network, jobId);
  if (job.submittedAt === 0n) {
    return { ok: false, kind: "pre-submission" };
  }
  try {
    const url = await sdkGetErc8183DeliverableUrl(network, jobId, opts);
    if (url === undefined || url.length === 0) {
      return { ok: false, kind: "not-found" };
    }
    const parsed = parseErc8183Deliverable(JSON.stringify({ deliverable_url: url }));
    if (!parsed.ok) {
      return { ok: false, kind: "malformed" };
    }
    return { ok: true, url: parsed.url };
  } catch (error) {
    throw new AltanaErc8183DeliverableError(
      wrap(error, `deliverable lookup failed for job ${jobId.toString()} on bnb-testnet`)
    );
  }
}

/**
 * Derive the valid settlement action for a job's on-chain state (pure).
 * - `dispute` — client-only, only inside the optimistic window (SUBMITTED).
 * - `approve` — Router.settle, valid once the dispute window has elapsed.
 */
export function getErc8183SettlementStatus(
  job: Erc8183Job,
  nowSeconds: bigint = BigInt(Math.floor(Date.now() / 1000))
): Erc8183SettlementStatus {
  if (KNOWN_JOB_STATUSES.has(job.statusName) === false) {
    throw new AltanaErc8183JobStateError(
      `cannot derive settlement from unknown job status "${String(job.statusName)}".`
    );
  }
  if (job.statusName === "COMPLETED") {
    const windowElapsed = job.submittedAt !== 0n && nowSeconds >= job.submittedAt;
    return {
      action: "approve",
      available: windowElapsed,
      reason: windowElapsed
        ? "dispute window elapsed; escrow can be released via Router.settle."
        : "still inside the dispute window; approve becomes available once it elapses.",
    };
  }
  if (job.statusName === "SUBMITTED") {
    return {
      action: "dispute",
      available: true,
      reason: "job submitted; client may dispute inside the optimistic window.",
    };
  }
  return {
    action: "none",
    available: false,
    reason: `job is ${String(job.statusName)}; no settlement/dispute action is available.`,
  };
}

/**
 * Build the claimRefund call for a job whose seller never delivered.
 * Testnet-gated wrapper around the SDK's `buildClaimRefundCall`.
 */
export function buildErc8183ClaimRefundCall(chainId: number, jobId: bigint): Call {
  assertErc8183TestnetChainOnly(chainId);
  if (typeof jobId !== "bigint" || jobId <= 0n) {
    throw new AltanaErc8183JobParamError("jobId must be a positive bigint.");
  }
  return sdkBuildClaimRefundCall(chainId, jobId);
}

/**
 * THE SIGNING BOUNDARY. Every ERC-8183 submission attempt funnels here and
 * ALWAYS stops: no signer/session authority is wired in this phase. This
 * function returns `never` — it cannot submit a transaction.
 */
export function assertErc8183SigningBoundary(
  operation: "hire" | "settle" | "dispute" | "claim-refund"
): never {
  throw new AltanaErc8183ExecutionError(
    `${ERC8183_EXECUTION_REQUIRES_SIGNER} Refusing operation "${operation}".`
  );
}

export type { Erc8183Addresses, Erc8183Job, JobStatusName, NetworkConfig };
export type { Address as AltanaAddress, Hex as AltanaHex };
