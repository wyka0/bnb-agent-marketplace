/**
 * X.168 — Dashboard funded-hire visibility (pure, read-only resolver).
 *
 * Distinguishes FUNDED commercial hires (Model B) from ACTIVE managed agents
 * (Model A) using ONLY public on-chain reads. A FUNDED hire is displayed as a
 * real hired position and is NEVER labelled ACTIVE/RUNNING/Managed/Autonomous.
 *
 * The resolver is framework-free (plain-node runnable) so the verify harness
 * is trivial and deterministic: every external read — the ERC-8183 job counter,
 * per-job reads, and provider → agent identity resolution — flows through
 * injectable ports. No wallet key, no signing, and no transaction can ever be
 * issued from this module.
 */

import { formatUnits } from "viem";

/** BNB Smart Chain Testnet — the only chain the marketplace hire path supports. */
export const HIRED_CHAIN_ID = 97;
export const HIRED_PAYMENT_DECIMALS = 18;
export const HIRED_PAYMENT_SYMBOL = "U";
export const HIRED_PAYMENT_TOKEN_NAME = "United Stables ($U)";
export const HIRED_STATUS_FUNDED = "FUNDED";
export const HIRED_TYPE_COMMERCIAL = "commercial-hire";

/**
 * Bound for the live dashboard's read-only scan. The resolver only ever reads
 * the most recent `HIRED_DEFAULT_MAX_SCAN` jobs (newest hire id is scanned in
 * full); it never walks an unbounded counter. Tests may pass `maxScan` to
 * widen or narrow the window deterministically.
 */
export const HIRED_DEFAULT_MAX_SCAN = 2048;

/** ERC-8183 kernel `JobStatus` names, mirroring `@bnbagent/sdk`. */
const JOB_STATUS_NAMES = [
  "OPEN",
  "FUNDED",
  "SUBMITTED",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
] as const;

/** Minimal structural read of an ERC-8183 job (from `getJob`). */
export interface HiredJobRead {
  jobId: string | bigint;
  client: string;
  provider: string;
  budget: string | bigint;
  status: number;
  statusName?: string;
  /** When present must equal the expected chain (defensive wrong-chain gate). */
  chainId?: number;
}

/** Registry identity resolved for a funded hire's provider. */
export interface HiredAgentIdentity {
  agentId: string;
  agentName: string;
  tokenId: string;
  chainId: number;
}

/**
 * Provider → agent resolution verdict. `not-registered` (wrong provider) is a
 * hard exclusion; `unavailable` (registry lookup failed) still shows the hire
 * because the on-chain FUNDED state is authoritative — the dashboard only
 * degrades the identity display, never the funded-hire visibility.
 */
export type AgentResolution =
  | { status: "registered"; agent: HiredAgentIdentity }
  | { status: "not-registered" }
  | { status: "unavailable"; reason?: string };

/** A verified FUNDED commercial hire shown on the dashboard. */
export interface HiredAgent {
  jobId: string;
  chainId: number;
  client: string;
  provider: string;
  budgetWei: string;
  /** Human amount, e.g. `0.001` for a 0.001 U budget (18-decimals). */
  budgetFormatted: string;
  status: typeof HIRED_STATUS_FUNDED;
  type: typeof HIRED_TYPE_COMMERCIAL;
  agentId: string | null;
  agentName: string | null;
  tokenId: string | null;
  /** True when the provider identity could not be confirmed (registry unavailable). */
  identityUnavailable: boolean;
}

/** Injectable read-only ports — defaulted to the live path by the server module. */
export interface HiredAgentsPorts {
  readJobCount(): Promise<bigint | null>;
  /** Read a batch of job ids (parallel-friendly). A `null` entry = read failed. */
  readJobs(ids: readonly bigint[]): Promise<ReadonlyArray<HiredJobRead | null>>;
  resolveAgent(provider: string): Promise<AgentResolution | null>;
}

export interface ResolveHiredAgentsInput {
  walletAddress: string;
  chainId?: number;
  maxScan?: number;
  ports: HiredAgentsPorts;
}

export interface HiresDashboardResult {
  /** Whether an authenticated wallet is present. */
  connected: boolean;
  state: "no-wallet" | "ready" | "unavailable" | "error";
  reason?: string;
  hires: HiredAgent[];
  /** Model A semantics — always 0 unless an ACTIVE session is independently verified. */
  activeAgents: 0;
  fundedHires: number;
  scanned: number;
  readFailures: number;
  malformed: number;
  truncated: boolean;
  registryUnavailable: boolean;
  /** Existing product convention for BNB portfolio value (escrow is $U, not BNB). */
  totalValue: string;
  /** Honest "no performance dataset" label — never implies a zero-loss result. */
  netPnl: string;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = "0x" + "00".repeat(20);

export function isValidAddress(value: unknown): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

export function isZeroAddress(value: string): boolean {
  return value.toLowerCase() === ZERO_ADDRESS;
}

export function parseBudgetWei(value: string | bigint): bigint | null {
  try {
    const n = typeof value === "bigint" ? value : BigInt(value);
    return n >= 0n ? n : null;
  } catch {
    return null;
  }
}

/** FUNDED is the numeric status `1` in the ERC-8183 kernel; a present name must agree. */
export function isFundedJob(job: HiredJobRead): boolean {
  if (job.status !== 1) return false;
  if (job.statusName === undefined) return true;
  return job.statusName.toUpperCase() === HIRED_STATUS_FUNDED;
}

/** Structural sanity of a job record — a malformed record is never trusted. */
export function validateJobShape(job: HiredJobRead): boolean {
  if (!isValidAddress(job.client)) return false;
  if (!isValidAddress(job.provider) || isZeroAddress(job.provider)) return false;
  if (!Number.isInteger(job.status)) return false;
  return parseBudgetWei(job.budget) !== null;
}

/** Format a wei budget for display, e.g. `0.001` for a 0.001 U hire. */
export function formatHireBudget(wei: string): string {
  try {
    return formatUnits(BigInt(wei), HIRED_PAYMENT_DECIMALS);
  } catch {
    return wei;
  }
}

/** `0x1234…abcd`-style short address for compact provider display. */
export function shortenAddress(address: string): string {
  if (!isValidAddress(address)) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function baseDashboard(): Omit<HiresDashboardResult, "connected" | "state" | "reason"> {
  return {
    hires: [],
    activeAgents: 0,
    fundedHires: 0,
    scanned: 0,
    readFailures: 0,
    malformed: 0,
    truncated: false,
    registryUnavailable: false,
    totalValue: "0.00 BNB",
    netPnl: "Not available",
  };
}

/** No connected wallet → the existing empty-state dashboard shape. */
export function noWalletHiresDashboard(): HiresDashboardResult {
  return { ...baseDashboard(), connected: false, state: "no-wallet" };
}

/**
 * Resolve the connected wallet's FUNDED commercial hires from read-only
 * on-chain state. Enumerates the pinned chain-97 ERC-8183 commerce's job
 * range (bounded by `maxScan`), keeps only well-formed jobs where
 * `client == wallet`, `chain == 97`, `status == FUNDED`, and a valid
 * registered provider, then enriches each with its agent identity. FUNDED is
 * never coerced into ACTIVE.
 */
export async function resolveHiredAgents(
  input: ResolveHiredAgentsInput
): Promise<HiresDashboardResult> {
  if (!isValidAddress(input.walletAddress) || isZeroAddress(input.walletAddress)) {
    return noWalletHiresDashboard();
  }
  const wallet = input.walletAddress.toLowerCase();
  const expectedChain = input.chainId ?? HIRED_CHAIN_ID;
  const maxScan = input.maxScan ?? HIRED_DEFAULT_MAX_SCAN;

  let counter: bigint;
  try {
    const value = await input.ports.readJobCount();
    if (value === null) {
      return {
        ...baseDashboard(),
        connected: true,
        state: "unavailable",
        reason: "job counter unavailable",
      };
    }
    counter = value;
  } catch {
    return {
      ...baseDashboard(),
      connected: true,
      state: "unavailable",
      reason: "job counter read failed",
    };
  }

  if (counter <= 0n) {
    return { ...baseDashboard(), connected: true, state: "ready", scanned: 0 };
  }

  const bounded = Number.isFinite(maxScan) && counter > BigInt(maxScan);
  const start = bounded ? counter - BigInt(maxScan) + 1n : 1n;
  const ids: bigint[] = [];
  for (let id = start; id <= counter; id += 1n) ids.push(id);

  let jobs: ReadonlyArray<HiredJobRead | null>;
  try {
    jobs = await input.ports.readJobs(ids);
  } catch {
    return { ...baseDashboard(), connected: true, state: "error", reason: "job reads failed" };
  }

  const hires: HiredAgent[] = [];
  const agentCache = new Map<string, AgentResolution | null>();
  let readFailures = 0;
  let malformed = 0;
  let registryUnavailable = false;

  for (const job of jobs) {
    if (job === null) {
      readFailures += 1;
      continue;
    }
    if (!validateJobShape(job)) {
      malformed += 1;
      continue;
    }
    if (job.chainId !== undefined && job.chainId !== expectedChain) continue;
    if (job.client.toLowerCase() !== wallet) continue;
    if (!isFundedJob(job)) continue;

    const budgetWei = parseBudgetWei(job.budget);
    if (budgetWei === null) {
      malformed += 1;
      continue;
    }

    const provider = job.provider;
    let resolution = agentCache.get(provider);
    if (resolution === undefined) {
      try {
        resolution = await input.ports.resolveAgent(provider);
      } catch {
        resolution = { status: "unavailable" };
      }
      agentCache.set(provider, resolution);
    }

    let agentId: string | null = null;
    let agentName: string | null = null;
    let tokenId: string | null = null;
    let identityUnavailable = false;
    if (resolution === null || resolution.status === "unavailable") {
      // Registry could not confirm identity — the funded on-chain state is still
      // authoritative, so the hire remains visible with identity degraded.
      identityUnavailable = true;
      registryUnavailable = true;
    } else if (resolution.status === "registered") {
      agentId = resolution.agent.agentId;
      agentName = resolution.agent.agentName;
      tokenId = resolution.agent.tokenId;
    } else {
      // not-registered → wrong provider: not a marketplace hire.
      continue;
    }

    hires.push({
      jobId: String(job.jobId),
      chainId: expectedChain,
      client: job.client,
      provider,
      budgetWei: budgetWei.toString(),
      budgetFormatted: formatHireBudget(budgetWei.toString()),
      status: HIRED_STATUS_FUNDED,
      type: HIRED_TYPE_COMMERCIAL,
      agentId,
      agentName,
      tokenId,
      identityUnavailable,
    });
  }

  // Newest hire first — deterministic, no invented ordering signal.
  hires.sort((a, b) => {
    const diff = BigInt(b.jobId) - BigInt(a.jobId);
    return diff > 0n ? 1 : diff < 0n ? -1 : 0;
  });

  return {
    ...baseDashboard(),
    connected: true,
    state: "ready",
    hires,
    fundedHires: hires.length,
    scanned: ids.length,
    readFailures,
    malformed,
    truncated: bounded,
    registryUnavailable,
  };
}

void HIRED_PAYMENT_TOKEN_NAME;
void JOB_STATUS_NAMES;
