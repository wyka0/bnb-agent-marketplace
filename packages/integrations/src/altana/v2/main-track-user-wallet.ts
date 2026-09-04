/**
 * X.134 — Main Track hire with a USER-CONTROLLED wallet (no AWS, no server key).
 *
 * The browser/user wallet is the authoritative signer for ERC-8183 funding.
 * The marketplace only orchestrates and verifies: it authenticates the user,
 * resolves the agent, negotiates and verifies the provider quote, builds the
 * exact 5-call ERC-8183 plan, and returns it; the browser signs and broadcasts
 * each call through an EIP-1193 wallet (`eth_sendTransaction`), with the user
 * explicitly approving every transaction in their wallet.
 *
 * This implements the SDK's `WalletProvider`/`IntentExecutor` self-broadcasting
 * seam (the same pattern as the SDK's Altana/TWAK wallets): `makeExecutor`
 * returns a wallet that owns the broadcast step, and `sign.*` methods are
 * NOT implemented (the base default raises) because a browser wallet cannot
 * produce raw signed transactions — it relays via `eth_sendTransaction`.
 *
 * SAFETY: no private key is ever received, stored, or transmitted. The server
 * never sees key material. Every gate fails closed. FUNDED is commercial
 * escrow — never ACTIVE.
 */

import { createPublicClient, encodeFunctionData, http, parseAbi } from "viem";
import type { PublicClient } from "viem";
import { resolveHireChainConfig } from "../hire-chains.js";

/** Authoritative BSC-Testnet (chain 97) ERC-8183 addresses, verified on-chain
 * via the official `@bnbagent/sdk` network table and every successful hire
 * (X.126–X.130). NOTE: `@altananetwork/sdk@0.7.0`'s table returns a stale
 * policy address, so the plan is built from these pinned constants instead. */
export const MAIN_TRACK_COMMERCE = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE" as const;
export const MAIN_TRACK_ROUTER = "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25" as const;
export const MAIN_TRACK_POLICY = "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA" as const;
export const MAIN_TRACK_PAYMENT_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565" as const;
/** ERC-8004 Identity Registry (chain 97), verified via `@bnbagent/sdk`. */
export const MAIN_TRACK_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;

/**
 * Reliable Main Track RPC for chain 97 (BSC Testnet): PublicNode, the public
 * endpoint already supported by this repository/tooling (`bsc-testnet-rpc.publicnode.com`).
 * X.144: the Main Track client NEVER routes chain operations through the
 * unreliable seed RPC (`@bnbagent/sdk` bsc-testnet preset `rpcUrl`), whose
 * pending-receipt response shape triggers viem 2.55.19's `Cannot mix BigInt`
 * failure. PublicNode is the single reliable Main Track public RPC.
 */
export const MAIN_TRACK_PUBLIC_RPC = "https://bsc-testnet-rpc.publicnode.com" as const;

/** A concrete `@bnbagent/sdk` `NetworkConfig` (preset shape) pinned to PublicNode. */
export interface MainTrackNetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  paymasterUrl?: string;
  usePaymaster: boolean;
  /** ERC-8004 Identity Registry (chain 97). */
  registryContract: string;
  /** ERC-8183 stack (chain 97), pinned to the verified authoritative addresses. */
  commerceContract: string;
  routerContract: string;
  policyContract: string;
  paymentTokenContract: string;
}

/** Build the SDK `NetworkConfig` that routes ALL SDK reads/writes (ERC-8183
 * job/allowance/balance reads, ERC-8004 agent reads) through PublicNode.
 * Pass to `ERC8183Client.create({ network })` and `ERC8004Agent.create({ network })`. */
export function createMainTrackNetworkConfig(): MainTrackNetworkConfig {
  return {
    name: "bsc-testnet",
    chainId: 97,
    rpcUrl: MAIN_TRACK_PUBLIC_RPC,
    usePaymaster: false,
    registryContract: MAIN_TRACK_REGISTRY,
    commerceContract: MAIN_TRACK_COMMERCE,
    routerContract: MAIN_TRACK_ROUTER,
    policyContract: MAIN_TRACK_POLICY,
    paymentTokenContract: MAIN_TRACK_PAYMENT_TOKEN,
  };
}

/** The ONE reliable Main Track public client (PublicNode). Used for chain id,
 * block number, nonce, gas price, estimateGas, sendRawTransaction and receipts —
 * never the seed RPC. */
export function createMainTrackPublicClient(): PublicClient {
  return createPublicClient({ transport: http(MAIN_TRACK_PUBLIC_RPC) });
}

/** Injected signer (headless executor). The application/server never receives a
 * private key — the signer holds custody (e.g. a keystore-loaded wallet). */
export interface MainTrackSignerRequest {
  from: string;
  to: string;
  data: string;
  value: string;
  chainId: number;
  nonce: bigint;
  gas: bigint;
  gasPrice: bigint;
}
export interface MainTrackSigner {
  sign(tx: MainTrackSignerRequest): Promise<{ rawTransaction: `0x${string}` }>;
}

/** Minimal EIP-1193 provider request seam (browser `window.ethereum.request`). */
export type Eip1193Request = (method: string, params: unknown[]) => Promise<unknown>;

/** A prepared unsigned ERC-8183 hire call. */
export interface MainTrackUserHireCall {
  to: string;
  data: string;
}

/** The verified, user-confirmed hire plan the browser executes. */
export interface MainTrackUserHirePlan {
  chainId: number;
  client: string;
  provider: string;
  budget: string;
  jobId: string;
  expiredAt: string;
  /** The 5-call ERC-8183 batch (createJob/registerJob/setBudget/approve/fund). */
  calls: MainTrackUserHireCall[];
}

export interface MainTrackUserHireExpectations {
  expectedChainId: number;
  expectedCommerce: string;
  expectedRouter: string;
  expectedPolicy: string;
  expectedPaymentToken: string;
  expectedPrice: string;
  expectedProvider: string;
}

export interface MainTrackUserHireJobRead {
  jobId: string;
  client: string;
  provider: string;
  budget: string;
  status: number;
  statusName: string;
  expiredAt: string;
}

export interface MainTrackUserHireDeps {
  /** EIP-1193 provider request (browser wallet). */
  request: Eip1193Request;
  /** Read the on-chain job for FUNDED verification. */
  readJob(jobId: string): Promise<MainTrackUserHireJobRead | null>;
  /** Optional per-call gas override; default uses a conservative constant. */
  gasFor?(call: MainTrackUserHireCall): bigint | Promise<bigint>;
}

export type MainTrackUserHireOutcome =
  | { ok: false; blocked: { stage: string; reason: string } }
  | {
      ok: true;
      stage: "funded";
      jobId: string;
      client: string;
      provider: string;
      budget: string;
      txHashes: Record<string, string>;
      blockNumbers: Record<string, string>;
      job: MainTrackUserHireJobRead;
      active: false;
      activationState: { actionable: false; state: "funded-commercial-hire" };
      nextRequiredAction: string;
    };

const CALL_NAMES = ["createJob", "registerJob", "setBudget", "approve", "fund"] as const;

/**
 * Build the exact 5-call ERC-8183 hire batch (chain 97) using the official
 * chain-97 address table. `description` must be the verified quote's on-chain
 * description (built by the official SDK server-side). Pure.
 */
export function buildMainTrackUserHireCalls(input: {
  provider: string;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  jobId: bigint;
  chainId: number;
}): { calls: MainTrackUserHireCall[]; commerce: string; router: string; token: string } {
  // X.234 — addresses resolve from the authoritative hire-chain seam. Chain 97
  // yields byte-identical values to the pinned MAIN_TRACK_* table above.
  const cfg = resolveHireChainConfig(input.chainId);
  const commerce = cfg.commerce.toLowerCase();
  const router = cfg.router.toLowerCase();
  const token = cfg.paymentToken.toLowerCase();

  const commerceAbi = parseAbi([
    "function createJob(address provider,address evaluator,uint256 expiredAt,string description,address hook) returns (uint256)",
    "function setBudget(uint256 jobId,uint256 amount,bytes optParams)",
    "function fund(uint256 jobId,uint256 expectedBudget,bytes optParams)",
  ]);
  const routerAbi = parseAbi(["function registerJob(uint256 jobId,address policy)"]);
  const tokenAbi = parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]);

  const calls: MainTrackUserHireCall[] = [
    {
      to: commerce,
      data: encodeFunctionData({
        abi: commerceAbi,
        functionName: "createJob",
        args: [
          input.provider as `0x${string}`,
          cfg.router,
          input.expiredAt,
          input.description,
          cfg.router,
        ],
      }),
    },
    {
      to: router,
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "registerJob",
        args: [input.jobId, cfg.policy],
      }),
    },
    {
      to: commerce,
      data: encodeFunctionData({
        abi: commerceAbi,
        functionName: "setBudget",
        args: [input.jobId, input.budget, "0x"],
      }),
    },
    {
      to: token,
      data: encodeFunctionData({
        abi: tokenAbi,
        functionName: "approve",
        args: [cfg.commerce, input.budget],
      }),
    },
    {
      to: commerce,
      data: encodeFunctionData({
        abi: commerceAbi,
        functionName: "fund",
        args: [input.jobId, input.budget, "0x"],
      }),
    },
  ];
  return { calls, commerce, router, token };
}

/**
 * Pure validation of a plan against the expected identity/contract/amount.
 * Fails closed on wrong chain, wrong contracts, wrong provider, wrong price,
 * a jobId bound to history (622), or any non-allowlisted target.
 */
export function validateMainTrackUserHirePlan(
  plan: MainTrackUserHirePlan,
  expected: MainTrackUserHireExpectations
): { ok: true } | { ok: false; reason: string } {
  if (plan.chainId !== expected.expectedChainId) {
    return { ok: false, reason: "wrong chain" };
  }
  if (plan.client.length === 0) return { ok: false, reason: "no connected wallet" };
  if (plan.provider.toLowerCase() !== expected.expectedProvider.toLowerCase()) {
    return { ok: false, reason: "wrong provider" };
  }
  if (plan.budget !== expected.expectedPrice) {
    return { ok: false, reason: "wrong price" };
  }
  const allowlist = new Set([
    expected.expectedCommerce.toLowerCase(),
    expected.expectedRouter.toLowerCase(),
    expected.expectedPolicy.toLowerCase(),
    expected.expectedPaymentToken.toLowerCase(),
  ]);
  if (!Array.isArray(plan.calls) || plan.calls.length !== 5) {
    return { ok: false, reason: "invalid call batch" };
  }
  for (const call of plan.calls) {
    if (typeof call.to !== "string" || typeof call.data !== "string" || call.data.length < 10) {
      return { ok: false, reason: "malformed call" };
    }
    if (!allowlist.has(call.to.toLowerCase())) {
      return { ok: false, reason: "non-allowlisted ERC-8183 target" };
    }
  }
  return { ok: true };
}

/**
 * A browser-safe, structural WalletProvider-shaped signer backed by an
 * injected EIP-1193 provider. The executor is self-broadcasting (each
 * `eth_sendTransaction` is approved in the user's wallet). No `sign.*` is
 * implemented, matching the SDK's self-broadcasting-wallet convention.
 *
 * NONCE: the transaction params sent to the wallet NEVER include `nonce` or
 * `gas` — the connected wallet owns nonce and gas determination (standard
 * EIP-1193 `eth_sendTransaction` behavior). The application only supplies
 * `from`, `to`, `data`, `value`, `chainId`.
 */
export function createMainTrackUserWallet(deps: { request: Eip1193Request }) {
  let connectedAddress = "";
  return {
    async connect(expectedChainId: number): Promise<{ address: string; chainId: number }> {
      const accounts = (await deps.request("eth_requestAccounts", [])) as string[];
      const address = Array.isArray(accounts) && accounts.length > 0 ? (accounts[0] as string) : "";
      if (!address) throw new Error("no connected wallet");
      const chainIdHex = (await deps.request("eth_chainId", [])) as string;
      const chainId = Number.parseInt(String(chainIdHex), 16);
      if (chainId !== expectedChainId) throw new Error("wrong chain");
      connectedAddress = address.toLowerCase();
      return { address: connectedAddress, chainId };
    },
    async sendCall(call: MainTrackUserHireCall, chainId: number): Promise<{ hash: string }> {
      if (!connectedAddress) throw new Error("wallet not connected");
      const result = await deps.request("eth_sendTransaction", [
        {
          from: connectedAddress,
          to: call.to,
          data: call.data,
          value: "0x0",
          chainId: `0x${chainId.toString(16)}`,
        },
      ]);
      if (typeof result !== "string" || result.length === 0) {
        throw new Error("user rejected transaction");
      }
      return { hash: result };
    },
  };
}

/** Deterministic nonce ledger for the HEADLESS executor. Never reuses a nonce;
 * a failed send marks the ledger failed (no further allocation) so a nonce
 * failure can never create another job or advance the ERC-8183 step. */
export class MainTrackNonceLedger {
  private next: bigint;
  private failed = false;
  constructor(initial: bigint) {
    this.next = initial;
  }
  /** The next nonce to use, or `null` if the ledger is failed. */
  allocate(): bigint | null {
    return this.failed ? null : this.next;
  }
  /** Advance after a confirmed send of exactly `nonce`. Never advances on a
   * stale/failed nonce. */
  commit(nonce: bigint): void {
    if (!this.failed && nonce === this.next) this.next += 1n;
  }
  markFailed(): void {
    this.failed = true;
  }
  get current(): bigint {
    return this.next;
  }
  get isFailed(): boolean {
    return this.failed;
  }
}

/** Typed signal that the provider rejected a transaction with a nonce error. */
export class MainTrackNonceTooLowError extends Error {
  constructor(message = "nonce too low") {
    super(message);
    this.name = "MainTrackNonceTooLowError";
  }
}

/** Heuristic detection of nonce-too-low / already-known RPC rejections. */
export function isNonceTooLowError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("nonce too low") ||
    lower.includes("nonce too low: next nonce") ||
    lower.includes("already known")
  );
}

/** Deterministic receipt-status normalization (handles string, hex, and bigint). */
export function normalizeReceiptStatus(receipt: unknown): "success" | "reverted" | "unknown" {
  if (!receipt || typeof receipt !== "object") return "unknown";
  const status = (receipt as { status?: unknown }).status;
  if (
    status === "success" ||
    status === "0x1" ||
    status === "0x01" ||
    status === 1 ||
    status === 1n
  ) {
    return "success";
  }
  if (status === "reverted" || status === "0x0" || status === 0 || status === 0n) {
    return "reverted";
  }
  return "unknown";
}

/** Normalized receipt with EXPLICIT bigint fields (never Number+BigInt mixing). */
export interface ReliableReceipt {
  status: "success" | "reverted" | "unknown";
  blockNumber: bigint | null;
  transactionIndex: bigint | null;
  gasUsed: bigint | null;
  effectiveGasPrice: bigint | null;
}

/** Convert a raw numeric field to bigint safely; never silently to Number. */
export function toBigintSafe(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  return null;
}

/** Explicit, deterministic normalization of a raw receipt into bigint fields. */
export function normalizeReceipt(raw: unknown): ReliableReceipt {
  if (!raw || typeof raw !== "object") {
    return {
      status: "unknown",
      blockNumber: null,
      transactionIndex: null,
      gasUsed: null,
      effectiveGasPrice: null,
    };
  }
  const r = raw as Record<string, unknown>;
  return {
    status: normalizeReceiptStatus(raw),
    blockNumber: toBigintSafe(r.blockNumber),
    transactionIndex: toBigintSafe(r.transactionIndex),
    gasUsed: toBigintSafe(r.gasUsed),
    effectiveGasPrice: toBigintSafe(r.effectiveGasPrice),
  };
}

export interface ReliableReceiptReaderOpts {
  /** Primary raw receipt read (returns null/undefined while pending). */
  read(hash: string): Promise<unknown>;
  /** Reliable RPC used only when the primary throws a non-pending error (e.g. the
   * X.141 BigInt-mix). The seed RPC exception is isolated behind this fallback. */
  fallback?(hash: string): Promise<unknown>;
  /** Pending detection for thrown errors. */
  isPending?(error: unknown): boolean;
}

/**
 * A receipt reader that isolates unreliable-RPC exceptions.
 *
 * - Primary read: success/reverted -> normalized; null -> pending.
 * - Primary throws pending wording -> treated as pending (null).
 * - Primary throws a NON-pending error (incl. viem BigInt-mix) -> the reliable
 *   `fallback` is queried; a working fallback result is normalized.
 * - If the fallback is absent or also throws, `null` is returned so the bounded
 *   poller retries and eventually times out (STOP) — the exception never
 *   corrupts the executor, never rebroadcasts, and never advances a step.
 */
export function createReliableReceiptReader(
  opts: ReliableReceiptReaderOpts
): (hash: string) => Promise<unknown> {
  const isPending = opts.isPending ?? isPendingReceiptError;
  return async (hash: string): Promise<unknown> => {
    try {
      const r = await opts.read(hash);
      if (r === null || r === undefined) return null;
      return normalizeReceipt(r);
    } catch (error) {
      if (isPending(error)) return null;
      if (opts.fallback) {
        try {
          const r2 = await opts.fallback(hash);
          if (r2 === null || r2 === undefined) return null;
          return normalizeReceipt(r2);
        } catch (error2) {
          if (isPending(error2)) return null;
          return null;
        }
      }
      return null;
    }
  };
}

/** True when a receipt read means "still pending" (safe to keep polling). */
export function isPendingReceiptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("could not be found") ||
    lower.includes("not be processed on a block yet") ||
    lower.includes("not yet mined") ||
    lower.includes("transaction not found") ||
    lower.includes("pending") ||
    lower.includes("blockhash") ||
    lower.includes("null")
  );
}

/** True when the RPC/viem threw the BigInt-mixing failure seen in X.138. */
export function isBigIntMixingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return lower.includes("cannot mix bigint") || lower.includes("bigint and other types");
}

export type ReceiptPollResult =
  | { status: "success" }
  | { status: "reverted" }
  | { status: "timeout"; error?: string }
  | { status: "error"; error: string };

export interface ReceiptPollOptions {
  /** Read a raw transaction receipt; return `null`/`undefined` while pending. */
  getReceipt(hash: string): Promise<unknown>;
  maxAttempts?: number;
  intervalMs?: number;
}

/**
 * Deterministic receipt polling (replaces fragile `waitForTransactionReceipt`).
 *
 * - Broadcasts are NOT done here: the caller broadcasts once and passes the
 *   hash; this function NEVER rebroadcasts.
 * - Polls `getTransactionReceipt(hash)` (raw) — a `null`/`undefined`/pending
 *   result is retried up to a bound; it never performs pending-tx arithmetic.
 * - Stops on `status == success` or `status == reverted`.
 * - A non-pending RPC error (incl. the X.138 BigInt-mixing viem failure), a
 *   malformed receipt status, or a timeout returns a typed failure — the caller
 *   must NOT proceed to the next ERC-8183 step and must NOT rebroadcast.
 */
export async function pollForReceipt(
  hash: string,
  opts: ReceiptPollOptions
): Promise<ReceiptPollResult> {
  const maxAttempts = opts.maxAttempts ?? 40;
  const intervalMs = opts.intervalMs ?? 750;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let lastError = "";
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let receipt: unknown;
    try {
      receipt = await opts.getReceipt(hash);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      if (isPendingReceiptError(error)) {
        await sleep(intervalMs);
        continue;
      }
      // Non-pending RPC error, malformed response, or the BigInt-mixing viem
      // failure seen in X.138: STOP. No unsafe arithmetic, no rebroadcast.
      return { status: "error", error: message };
    }
    if (receipt === null || receipt === undefined) {
      await sleep(intervalMs);
      continue;
    }
    const status = normalizeReceiptStatus(receipt);
    if (status === "success") return { status: "success" };
    if (status === "reverted") return { status: "reverted" };
    return { status: "error", error: "malformed receipt status" };
  }
  return { status: "timeout", error: lastError || "receipt never confirmed" };
}

/**
 * A HEADLESS, deterministic EIP-1193 provider with serialized, nonce-safe
 * execution and receipt-confirmed confirmation (used by the isolated test
 * harness / offline executor, NOT the production browser path — a real wallet
 * owns its own nonce and gas).
 *
 * - Serializes sends: only one transaction is in flight at a time.
 * - Allocates nonces from a local ledger initialized from the pending nonce.
 * - Broadcasts ONCE per transaction (never rebroadcasts).
 * - Confirms each receipt via `pollForReceipt` BEFORE committing the nonce; a
 *   missing / reverted / timeout / polling-error receipt means the next
 *   ERC-8183 step is NOT permitted and no job is auto-created.
 * - On `nonce too low` the ledger is marked failed and a typed error is thrown
 *   (fail closed); no blind retry.
 */
export function createNonceSafeEip1193Provider(opts: {
  request: Eip1193Request;
  /** Broadcast a single tx for `from` with the given `nonce`; returns the tx hash. */
  broadcast(
    tx: { from: string; to: string; data: string; value: string; chainId: number },
    nonce: bigint
  ): Promise<string>;
  /** Read a raw receipt by hash (null while pending). */
  getReceipt(hash: string): Promise<unknown>;
  /** Read the pending transaction count for an account (used to seed the ledger). */
  getPendingNonce(from: string): Promise<bigint>;
  receiptMaxAttempts?: number;
  receiptIntervalMs?: number;
}): Eip1193Request {
  let from = "";
  let ledger: MainTrackNonceLedger | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const confirm = (hash: string) =>
    pollForReceipt(hash, {
      getReceipt: opts.getReceipt,
      maxAttempts: opts.receiptMaxAttempts,
      intervalMs: opts.receiptIntervalMs,
    });
  return async (method, params) => {
    if (method === "eth_requestAccounts") {
      const accounts = (await opts.request("eth_requestAccounts", [])) as string[];
      from = Array.isArray(accounts) && accounts.length > 0 ? (accounts[0] as string) : "";
      return accounts;
    }
    if (method === "eth_chainId") return opts.request("eth_chainId", []);
    if (method === "eth_sendTransaction") {
      const tx = (params[0] as Record<string, string>) ?? {};
      const sender = (tx?.from ?? from).toLowerCase();
      const run = queue.then(async () => {
        if (!ledger) {
          try {
            ledger = new MainTrackNonceLedger(await opts.getPendingNonce(sender));
          } catch (error) {
            // Stage-annotated (X.144): any nonce-read failure is pinned to the
            // exact stage — the raw RPC error is never ambiguous. No broadcast.
            throw new Error(
              `nonce read failed: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
        const nonce = ledger.allocate();
        if (nonce === null)
          throw new MainTrackNonceTooLowError("nonce ledger failed; no further sends");
        let hash: string;
        try {
          hash = await opts.broadcast(
            {
              from: sender,
              to: tx.to ?? "",
              data: tx.data ?? "",
              value: tx.value ?? "0x0",
              chainId: Number.parseInt(String(tx.chainId), 16),
            },
            nonce
          );
        } catch (error) {
          if (isNonceTooLowError(error)) {
            ledger.markFailed();
            throw new MainTrackNonceTooLowError("nonce too low");
          }
          // Stage-annotated (X.144): a broadcast failure (incl. the X.143
          // viem BigInt-mix on the seed RPC) is pinned to the exact stage.
          throw new Error(
            `broadcast failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        const receipt = await confirm(hash);
        if (receipt.status === "success") {
          ledger.commit(nonce);
          return hash;
        }
        if (receipt.status === "reverted") throw new Error("transaction reverted");
        if (receipt.status === "timeout") throw new Error("receipt timeout; not confirmed");
        throw new Error(`receipt polling error: ${receipt.error}`);
      });
      queue = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    }
    throw new Error("unsupported method " + method);
  };
}

/**
 * X.144 — reliable receipt reader for the Main Track (PublicNode primary).
 *
 * Retains the X.142 reliable-reader semantics (pending -> null / bounded poll;
 * non-pending error -> isolate) but the PRIMARY is now the reliable PublicNode
 * client — the unreliable seed RPC is never used for Main Track receipts. An
 * optional caller-provided `fallback` may still be supplied, but the default
 * has none (PublicNode is the single reliable RPC; a non-pending PublicNode
 * error stops the executor, never rebroadcasts, never advances a step).
 */
export function createMainTrackReceiptReader(opts?: {
  publicClient?: PublicClient;
  fallback?(hash: string): Promise<unknown>;
}): (hash: string) => Promise<unknown> {
  const client = opts?.publicClient ?? createMainTrackPublicClient();
  return createReliableReceiptReader({
    read: async (hash: string): Promise<unknown> => {
      try {
        const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
        return receipt;
      } catch (error) {
        if (isPendingReceiptError(error)) return null;
        // Non-pending error on the reliable RPC: propagate so the reader's
        // fallback/bounded-poller semantics apply (never rebroadcast).
        throw error;
      }
    },
    fallback: opts?.fallback,
  });
}

/**
 * X.146 — the WALLET's own broadcast transport (separate from the read RPC).
 *
 * The X.145 investigation proved that the signed ERC-8183 createJob
 * transaction is valid (RLP well-formed, `parseTransaction` OK, ECDSA recovers
 * to the user wallet) yet PublicNode's `eth_sendRawTransaction` rejects it with
 * `failed to decode signed transaction` while the seed RPC mines the identical
 * shape (Job 653) and while PublicNode accepts small legacy transactions.
 *
 * The fix (per X.146): separate the READ RPC from the WALLET BROADCAST
 * TRANSPORT. Reads (chain, nonce, gas, estimateGas, receipts, job reads) stay on
 * the reliable PublicNode client; the wallet's own transport performs the actual
 * `eth_sendRawTransaction`. A browser wallet already owns this via
 * `eth_sendTransaction`; a headless keystore wallet uses its own network client.
 */
export interface MainTrackBroadcastTransport {
  sendRawTransaction(raw: `0x${string}`): Promise<`0x${string}`>;
}

/** Wrap any viem client as a broadcast transport (used ONLY for sendRawTransaction). */
export function createMainTrackBroadcastTransport(
  client: PublicClient
): MainTrackBroadcastTransport {
  return {
    sendRawTransaction: async (raw) => client.sendRawTransaction({ serializedTransaction: raw }),
  };
}

/**
 * X.144/X.146 — Main Track broadcast. Gas price and estimateGas are read from
 * the reliable read client (`publicClient`, PublicNode); the signed transaction
 * is then broadcast through the WALLET's own transport (`transport`), never
 * forced through PublicNode's `eth_sendRawTransaction` (which X.145 proved
 * rejects valid large legacy ERC-8183 transactions). The injected `signer` owns
 * custody; the application never receives a private key.
 */
export function createMainTrackBroadcast(opts: {
  signer: MainTrackSigner;
  publicClient?: PublicClient;
  transport?: MainTrackBroadcastTransport;
}): (
  tx: { from: string; to: string; data: string; value: string; chainId: number },
  nonce: bigint
) => Promise<string> {
  const client = opts.publicClient ?? createMainTrackPublicClient();
  const transport = opts.transport ?? createMainTrackBroadcastTransport(client);
  return async (tx, nonce) => {
    const gasPrice = await client.getGasPrice();
    const gas = await client.estimateGas({
      account: tx.from as `0x${string}`,
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
    });
    const signed = await opts.signer.sign({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      chainId: tx.chainId,
      nonce,
      gas,
      gasPrice,
    });
    return transport.sendRawTransaction(signed.rawTransaction);
  };
}

/**
 * X.144/X.146 — Main Track headless executor. READ RPC (PublicNode): nonce,
 * gas price, estimateGas, receipts. BROADCAST TRANSPORT (`transport`): the
 * wallet's own transport for `eth_sendRawTransaction`. A browser wallet is
 * unaffected (it owns `eth_sendTransaction` via `createMainTrackUserWallet`).
 *
 * `signer` is the custody holder (e.g. a keystore-loaded wallet); the
 * application/server never receives a private key.
 */
export function createMainTrackHeadlessProvider(opts: {
  request: Eip1193Request;
  signer: MainTrackSigner;
  publicClient?: PublicClient;
  transport?: MainTrackBroadcastTransport;
  receiptMaxAttempts?: number;
  receiptIntervalMs?: number;
}): Eip1193Request {
  const client = opts.publicClient ?? createMainTrackPublicClient();
  return createNonceSafeEip1193Provider({
    request: opts.request,
    broadcast: createMainTrackBroadcast({
      signer: opts.signer,
      publicClient: client,
      transport: opts.transport,
    }),
    getReceipt: createMainTrackReceiptReader({ publicClient: client }),
    getPendingNonce: async (from) =>
      BigInt(await client.getTransactionCount({ address: from as `0x${string}` })),
    receiptMaxAttempts: opts.receiptMaxAttempts,
    receiptIntervalMs: opts.receiptIntervalMs,
  });
}

/**
 * Orchestrate a user-controlled Main Track hire. The caller must have already
 * obtained the user's explicit confirmation. Each ERC-8183 call is sent through
 * the wallet (`eth_sendTransaction`), so every transaction is explicitly
 * approved by the user in their wallet. On completion the funded job is read
 * back and verified. Never fabricates ACTIVE.
 */
export async function runMainTrackUserHire(input: {
  deps: MainTrackUserHireDeps;
  plan: MainTrackUserHirePlan;
  expected: MainTrackUserHireExpectations;
  historyJobIds?: string[];
  /** The user must have explicitly confirmed before any wallet call. */
  confirmed: boolean;
  nowSeconds?: number;
}): Promise<MainTrackUserHireOutcome> {
  const blocked = (stage: string, reason: string): MainTrackUserHireOutcome => ({
    ok: false,
    blocked: { stage, reason },
  });

  if (input.confirmed !== true) {
    return blocked("confirmation", "user confirmation required");
  }
  const now = BigInt(input.nowSeconds ?? Math.floor(Date.now() / 1000));
  const expiredAt = BigInt(input.plan.expiredAt || "0");
  if (expiredAt <= now) {
    return blocked("plan", "quote expired");
  }

  const wallet = createMainTrackUserWallet({ request: input.deps.request });
  let identity: { address: string; chainId: number };
  try {
    identity = await wallet.connect(input.expected.expectedChainId);
  } catch (error) {
    return blocked("wallet", error instanceof Error ? error.message : "wallet unavailable");
  }
  if (identity.address !== input.plan.client.toLowerCase()) {
    return blocked("wallet", "wrong wallet (plan client mismatch)");
  }

  const validated = validateMainTrackUserHirePlan(input.plan, input.expected);
  if (!validated.ok) return blocked("plan", validated.reason);

  const history = new Set((input.historyJobIds ?? []).map((id) => String(id)));
  if (history.has(String(input.plan.jobId))) {
    return blocked("plan", "historical job id cannot be reused as a new hire");
  }

  const txHashes: Record<string, string> = {};
  const blockNumbers: Record<string, string> = {};
  for (let i = 0; i < input.plan.calls.length; i += 1) {
    const call = input.plan.calls[i] as MainTrackUserHireCall;
    const name = CALL_NAMES[i] as string;
    try {
      const { hash } = await wallet.sendCall(call, input.expected.expectedChainId);
      txHashes[name] = hash;
      blockNumbers[name] = "";
    } catch (error) {
      return blocked(
        "transaction",
        `${name} failed or rejected: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (!txHashes.fund) return blocked("transaction", "fund was not broadcast");

  const job = await input.deps.readJob(input.plan.jobId);
  if (!job || job.jobId !== input.plan.jobId) return blocked("verify", "job not found on chain");
  if (job.status !== 1)
    return blocked("verify", `job not FUNDED (status ${job.statusName ?? job.status})`);
  if (job.client.toLowerCase() !== identity.address) return blocked("verify", "client mismatch");
  if (job.provider.toLowerCase() !== input.expected.expectedProvider.toLowerCase())
    return blocked("verify", "provider mismatch");
  if (job.budget !== input.expected.expectedPrice)
    return blocked("verify", "funded budget mismatch");

  return {
    ok: true,
    stage: "funded",
    jobId: input.plan.jobId,
    client: identity.address,
    provider: job.provider,
    budget: job.budget,
    txHashes,
    blockNumbers,
    job,
    active: false,
    activationState: { actionable: false, state: "funded-commercial-hire" },
    nextRequiredAction:
      "Submit and settle are NOT authorized. A separate explicit authorization is required before any provider submit or settlement of this funded job.",
  };
}
