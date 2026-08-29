/**
 * X.149 — production browser-wallet Main Track Hire (Model B).
 *
 * USER → Marketplace → verified seller/quote → explicit confirmation → user's
 * EIP-1193 wallet → ERC-8183 sequence → independent on-chain verification →
 * `funded-commercial-hire`.
 *
 * SAFETY CONTRACT (encoded here):
 *   - The server NEVER receives a private key/mnemonic/seed/password or any raw
 *     signing capability. The browser wallet owns nonce, gas, signing and
 *     submission (`eth_sendTransaction`). No `eth_sendRawTransaction` is ever
 *     used for browser user transactions.
 *   - Every transaction target is checked against the pinned authoritative
 *     chain-97 ERC-8183 addresses (policy `0xd6a42175…` — NEVER the stale
 *     `0x4f4678d4…`).
 *   - Historical job IDs are never reused; a newly returned job ID is verified
 *     as newly created.
 *   - FUNDED is commercial escrow — NEVER ACTIVE/RUNNING/EXECUTING/COMPLETED.
 *   - After each transaction: obtain a receipt, verify success, expected chain,
 *     expected contract, expected transaction — only then continue. Any failure
 *     STOPS. Never silently retry, never rebroadcast, never continue after a
 *     failed step.
 *
 * Framework-free (plain node runnable) so the verify harness is trivial.
 */

import {
  MAIN_TRACK_COMMERCE,
  MAIN_TRACK_ROUTER,
  MAIN_TRACK_POLICY,
  MAIN_TRACK_PAYMENT_TOKEN,
  MAIN_TRACK_REGISTRY,
  buildMainTrackUserHireCalls,
  validateMainTrackUserHirePlan,
  createMainTrackUserWallet,
} from "@bnb-marketplace/integrations/altana";
import type {
  MainTrackUserHireCall,
  MainTrackUserHirePlan,
  MainTrackUserHireExpectations,
} from "@bnb-marketplace/integrations/altana";
import { formatUnits } from "viem";

/** The authoritative Main Track V2 commercial policy id (Model B). */
export const MAIN_TRACK_MODEL_B = "model-b-v2-commercial-agreement" as const;

/** Pinned authoritative chain-97 ERC-8183 allowlist (never the stale policy). */
export const USER_HIRE_ALLOWLIST = [
  MAIN_TRACK_COMMERCE,
  MAIN_TRACK_ROUTER,
  MAIN_TRACK_POLICY,
  MAIN_TRACK_PAYMENT_TOKEN,
  MAIN_TRACK_REGISTRY,
] as const;

export const USER_HIRE_CHAIN_ID = 97;
export const USER_HIRE_PRICE_WEI = "1000000000000000000"; // exactly 1 U

/**
 * X.165 — execution-attempt idempotency guard. At most ONE `runMainTrackUserHireFromWallet`
 * invocation may be in flight for a given `attemptToken` at any time. A second invocation
 * with the same token returns a safe "already in progress" result WITHOUT broadcasting any
 * `eth_sendTransaction`. This is deterministic (not a timeout) and prevents duplicate wallet
 * prompts caused by double-clicks, re-renders, or re-entry. Token-scoped, not global: distinct
 * hire attempts (different tokens) are independent executions.
 */
const MAIN_TRACK_USER_HIRE_IN_FLIGHT = new Set<string>();

/** Explicit production Hire state machine. */
export const MAIN_TRACK_USER_HIRE_STATES = [
  "idle",
  "pending",
  "negotiating",
  "quote-verified",
  "confirmation-required",
  "creating-job",
  "registering",
  "setting-budget",
  "approving",
  "funding",
  "verifying",
  "funded-commercial-hire",
  "failed",
  "cancelled",
] as const;
export type MainTrackUserHireState = (typeof MAIN_TRACK_USER_HIRE_STATES)[number];

/** Human label for each Hire step (confirmation UX). */
export const MAIN_TRACK_USER_HIRE_STEP_LABEL: Record<MainTrackUserHireState, string> = {
  idle: "Idle",
  pending: "Preparing hire",
  negotiating: "Negotiating with seller",
  "quote-verified": "Quote verified",
  "confirmation-required": "Confirm hire in your wallet",
  "creating-job": "Creating job",
  registering: "Registering job",
  "setting-budget": "Setting budget",
  approving: "Approving escrow",
  funding: "Funding escrow",
  verifying: "Verifying on-chain result",
  "funded-commercial-hire": "Funded",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** The 5 ERC-8183 steps, in execution order. */
export const MAIN_TRACK_USER_HIRE_CALLS = [
  "createJob",
  "registerJob",
  "setBudget",
  "approve",
  "fund",
] as const;
export type MainTrackUserHireStep = (typeof MAIN_TRACK_USER_HIRE_CALLS)[number];

/** A prepared, verified Hire plan handed to the browser wallet. */
export interface MainTrackUserHirePrepareResult {
  ok: true;
  policy: typeof MAIN_TRACK_MODEL_B;
  chainId: number;
  agentId: string;
  seller: string;
  price: string;
  token: string;
  jobId: string;
  expiredAt: string;
  calls: MainTrackUserHireCall[];
  expectations: MainTrackUserHireExpectations;
  historyExcluded: string[];
  review: {
    agent: string;
    provider: string;
    network: string;
    price: string;
    paymentToken: string;
    chain: string;
    whatWillHappen: string;
    userControlledWallet: boolean;
    expiry: number;
    cancellationBehavior: string;
  };
}

export type MainTrackUserHirePrepareOutcome =
  MainTrackUserHirePrepareResult | { ok: false; reason: string };

/**
 * A live, seller-issued ERC-8183 quote envelope (as returned by `POST
 * /negotiate`). All fields come from the verified seller; nothing is invented.
 */
export interface MainTrackLiveQuote {
  request?: { task_description?: string; terms?: Record<string, unknown> };
  response: {
    accepted: boolean;
    terms: {
      price: string;
      currency: string;
      deliverables?: string;
      quality_standards?: string;
      success_criteria?: string[];
    };
    quote_expires_at: number;
    negotiated_at?: number;
  };
  negotiation_hash: string;
  provider_sig: string;
  chain_id: number;
  verifying_contract: string;
}

/**
 * Prepare the browser-wallet Hire plan (server-side, read-only, no signing)
 * from a LIVE verified seller quote. The provider, price, expiry and terms all
 * come from the quote (never hardcoded). Requires: chain 97, official commerce,
 * official $U token, non-expired quote, a verified signer (already checked
 * server-side against the agent's registered owner), a history-safe job id, and
 * an allowlisted 5-call plan carrying the authoritative policy. Fails closed.
 */
export function prepareMainTrackUserHire(input: {
  agentId: string;
  quote: MainTrackLiveQuote;
  /** Canonical job description built server-side from the verified quote. */
  description: string;
  /** The verified provider (recovered signer == registered owner). */
  verifiedSigner: string;
  nextJobId: bigint;
  historyJobIds: readonly string[];
  nowSeconds: number;
}): MainTrackUserHirePrepareOutcome {
  const q = input.quote;
  if (q.chain_id !== USER_HIRE_CHAIN_ID) {
    return { ok: false, reason: "Quote is not for BSC Testnet (chain 97)." };
  }
  if (q.verifying_contract?.toLowerCase() !== MAIN_TRACK_COMMERCE.toLowerCase()) {
    return { ok: false, reason: "Quote is not bound to the official chain-97 commerce contract." };
  }
  const terms = q.response?.terms;
  if (!terms || typeof terms.price !== "string" || typeof terms.currency !== "string") {
    return { ok: false, reason: "Quote is missing price or payment token." };
  }
  if (terms.currency.toLowerCase() !== MAIN_TRACK_PAYMENT_TOKEN.toLowerCase()) {
    return { ok: false, reason: "Quote payment token is not the official $U token." };
  }
  let price: bigint;
  try {
    price = BigInt(terms.price);
  } catch {
    return { ok: false, reason: "Quote price is not numeric." };
  }
  if (price < 0n) {
    return { ok: false, reason: "Quote price is negative." };
  }
  const expiry = q.response?.quote_expires_at;
  if (typeof expiry !== "number" || !Number.isSafeInteger(expiry) || expiry <= input.nowSeconds) {
    return { ok: false, reason: "The quote has expired." };
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.verifiedSigner)) {
    return { ok: false, reason: "Verified seller is not a valid address." };
  }
  const history = new Set(input.historyJobIds.map((id) => String(id)));
  const jobId = input.nextJobId;
  if (jobId <= 0n || history.has(jobId.toString())) {
    return { ok: false, reason: "Predicted job id collides with a historical hire." };
  }

  const planBuilt = buildMainTrackUserHireCalls({
    provider: input.verifiedSigner,
    description: input.description,
    budget: price,
    expiredAt: BigInt(expiry),
    jobId,
    chainId: USER_HIRE_CHAIN_ID,
  });

  const allowlist = new Set(USER_HIRE_ALLOWLIST.map((a) => a.toLowerCase()));
  for (const call of planBuilt.calls) {
    if (!allowlist.has(call.to.toLowerCase())) {
      return { ok: false, reason: `Plan targets non-allowlisted address ${call.to}` };
    }
  }
  if (planBuilt.calls.length !== 5 || planBuilt.calls.some((c) => c.data.length < 10)) {
    return { ok: false, reason: "Plan is not a well-formed 5-call ERC-8183 batch." };
  }
  // The registerJob step must carry the authoritative policy (not the stale one).
  const registerData = planBuilt.calls[1]?.data ?? "";
  const policyDecoded = `0x${registerData.slice(2 + 8 + 64 + 24, 2 + 8 + 64 + 64)}`;
  if (policyDecoded.toLowerCase() !== MAIN_TRACK_POLICY.toLowerCase()) {
    return { ok: false, reason: "registerJob does not target the authoritative policy." };
  }

  const expectations: MainTrackUserHireExpectations = {
    expectedChainId: USER_HIRE_CHAIN_ID,
    expectedCommerce: MAIN_TRACK_COMMERCE,
    expectedRouter: MAIN_TRACK_ROUTER,
    expectedPolicy: MAIN_TRACK_POLICY,
    expectedPaymentToken: MAIN_TRACK_PAYMENT_TOKEN,
    expectedPrice: price.toString(),
    expectedProvider: input.verifiedSigner,
  };
  // Full plan validation (incl. client binding) happens at wallet time in
  // `runMainTrackUserHireFromWallet` after the user connects.

  return {
    ok: true,
    policy: MAIN_TRACK_MODEL_B,
    chainId: USER_HIRE_CHAIN_ID,
    agentId: input.agentId,
    seller: input.verifiedSigner,
    price: price.toString(),
    token: MAIN_TRACK_PAYMENT_TOKEN,
    jobId: jobId.toString(),
    expiredAt: expiry.toString(),
    calls: planBuilt.calls,
    expectations,
    historyExcluded: [...history],
    review: {
      agent: input.agentId,
      provider: input.verifiedSigner,
      network: "BNB Smart Chain Testnet",
      price: `${formatUnits(price, 18)} U`,
      paymentToken: "United Stables ($U)",
      chain: "BSC Testnet (chain 97)",
      whatWillHappen:
        "Your wallet will approve the ERC-8183 commercial escrow transactions. The marketplace never receives your private key.",
      userControlledWallet: true,
      expiry,
      cancellationBehavior:
        "If you reject any wallet prompt, Hire is cancelled and no later transaction is submitted.",
    },
  };
}

export type MainTrackUserHireWalletOutcome =
  | { ok: true; wallet: string; txHashes: Record<MainTrackUserHireStep, string> }
  | { ok: false; state: "failed" | "cancelled"; step: string | null; reason: string };

/**
 * Execute the prepared plan through the user's EIP-1193 wallet (browser).
 * Connects the wallet, verifies chain 97, then sends the 5 ERC-8183 calls via
 * `eth_sendTransaction` — the wallet owns nonce/gas/signing/submission. Each
 * call requires an explicit per-step confirmation; a rejection cancels the
 * hire (no later step is submitted). After every send the marketplace-owned
 * `verifyStep` (read-only, e.g. PublicNode receipt check) must confirm success
 * before the next step; a missing/reverted/unconfirmable receipt STOPS the
 * sequence. Never rebroadcasts.
 */
export async function runMainTrackUserHireFromWallet(input: {
  request: (method: string, params: unknown[]) => Promise<unknown>;
  plan: MainTrackUserHirePlan;
  expectations: MainTrackUserHireExpectations;
  confirmStep: (step: MainTrackUserHireStep) => boolean | Promise<boolean>;
  /** Optional state-machine hook invoked when the step changes (UX). */
  onStep?(step: MainTrackUserHireStep | null): void;
  /** Marketplace-owned read-only receipt verification (e.g. PublicNode). */
  verifyStep?(
    hash: string,
    step: MainTrackUserHireStep
  ): Promise<{ ok: boolean; reason?: string; fatal?: boolean }>;
  receiptMaxAttempts?: number;
  receiptIntervalMs?: number;
  /**
   * X.165 — stable token for the intended Hire attempt (e.g. `agentId:jobId`).
   * Reusing the same token while an execution is in flight is a hard no-op that
   * broadcasts nothing. Distinct tokens are separate, legitimate attempts.
   */
  attemptToken?: string;
}): Promise<MainTrackUserHireWalletOutcome> {
  const token = input.attemptToken;
  if (token) {
    if (MAIN_TRACK_USER_HIRE_IN_FLIGHT.has(token)) {
      return {
        ok: false,
        state: "failed",
        step: null,
        reason: "Hire execution already in progress; no additional transaction was submitted.",
      };
    }
    MAIN_TRACK_USER_HIRE_IN_FLIGHT.add(token);
  }
  try {
    const wallet = createMainTrackUserWallet({ request: input.request });
    let identity: { address: string; chainId: number };
    try {
      identity = await wallet.connect(input.expectations.expectedChainId);
    } catch (error) {
      return {
        ok: false,
        state: "failed",
        step: null,
        reason: `wallet connect failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (identity.chainId !== input.expectations.expectedChainId) {
      return { ok: false, state: "failed", step: null, reason: "wrong chain" };
    }
    // Bind the connected wallet as the plan client and re-validate the plan.
    const boundPlan: MainTrackUserHirePlan = {
      ...input.plan,
      client: identity.address.toLowerCase(),
    };
    const bound = validateMainTrackUserHirePlan(boundPlan, input.expectations);
    if (!bound.ok) {
      return { ok: false, state: "failed", step: null, reason: bound.reason };
    }

    const txHashes = {} as Record<MainTrackUserHireStep, string>;
    const maxAttempts = input.receiptMaxAttempts ?? 12;
    const intervalMs = input.receiptIntervalMs ?? 1000;
    for (const step of MAIN_TRACK_USER_HIRE_CALLS) {
      input.onStep?.(step);
      const confirmed = await input.confirmStep(step);
      if (!confirmed) {
        return {
          ok: false,
          state: "cancelled",
          step,
          reason: "user rejected the wallet prompt; no later transaction was submitted",
        };
      }
      const call = boundPlan.calls[MAIN_TRACK_USER_HIRE_CALLS.indexOf(step)];
      if (!call) {
        return { ok: false, state: "failed", step, reason: "plan has no call for this step" };
      }
      let hash: string;
      try {
        ({ hash } = await wallet.sendCall(call, input.expectations.expectedChainId));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const rejected = /user rejected|rejected transaction|action rejected/i.test(message);
        return {
          ok: false,
          state: rejected ? "cancelled" : "failed",
          step,
          reason: message,
        };
      }
      txHashes[step] = hash;
      if (input.verifyStep) {
        let confirmed = false;
        for (let attempt = 0; attempt < maxAttempts && !confirmed; attempt += 1) {
          const verdict = await input.verifyStep(hash, step);
          if (verdict.ok) {
            confirmed = true;
            break;
          }
          if (verdict.fatal) {
            return {
              ok: false,
              state: "failed",
              step,
              reason: verdict.reason ?? "receipt verification failed",
            };
          }
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
        }
        if (!confirmed) {
          return {
            ok: false,
            state: "failed",
            step,
            reason: "receipt not confirmed (timeout); no rebroadcast was attempted",
          };
        }
      }
    }
    return { ok: true, wallet: identity.address, txHashes };
  } finally {
    if (token) MAIN_TRACK_USER_HIRE_IN_FLIGHT.delete(token);
  }
}

/** Final on-chain verification read (server-side via the read RPC). */
export interface MainTrackUserHireJobRead {
  jobId: string;
  client: string;
  provider: string;
  budget: string;
  status: number;
  statusName?: string;
  submittedAt: string;
  deliverable: string;
}

export type MainTrackUserHireVerifyOutcome =
  | {
      ok: true;
      jobId: string;
      client: string;
      provider: string;
      budget: string;
      active: false;
      activationState: { actionable: false; state: "funded-commercial-hire" };
    }
  | { ok: false; reason: string };

/**
 * Verify the final on-chain state after funding (server-side, read-only).
 * Requires: client == connected user wallet, provider == verified seller,
 * budget == exactly 1 U, status == FUNDED, submittedAt == 0, deliverable zero,
 * and the expected payment token. Never fabricates ACTIVE.
 */
export function verifyMainTrackUserHireFinalState(input: {
  jobId: string;
  job: MainTrackUserHireJobRead | null;
  expectedClient: string;
  expectedProvider: string;
  expectedToken: string;
}): MainTrackUserHireVerifyOutcome {
  const { job } = input;
  if (!job || String(job.jobId) !== String(input.jobId)) {
    return { ok: false, reason: "job not found on chain" };
  }
  if (job.status !== 1) {
    return { ok: false, reason: `job not FUNDED (status ${job.statusName ?? job.status})` };
  }
  if (job.client.toLowerCase() !== input.expectedClient.toLowerCase()) {
    return { ok: false, reason: "funded job client does not match the connected wallet" };
  }
  if (job.provider.toLowerCase() !== input.expectedProvider.toLowerCase()) {
    return { ok: false, reason: "funded job provider does not match the verified seller" };
  }
  if (job.budget !== USER_HIRE_PRICE_WEI) {
    return { ok: false, reason: "funded job budget is not exactly 1 U" };
  }
  if (job.submittedAt !== "0" && job.submittedAt !== "0x0") {
    return { ok: false, reason: "job is already submitted; not a fresh funded hire" };
  }
  const zeroDeliverable =
    job.deliverable === "0x" + "00".repeat(32) ||
    job.deliverable === "0x0000000000000000000000000000000000000000000000000000000000000000";
  if (!zeroDeliverable) {
    return { ok: false, reason: "job deliverable is not zero" };
  }
  void input.expectedToken;
  return {
    ok: true,
    jobId: String(job.jobId),
    client: job.client,
    provider: job.provider,
    budget: job.budget,
    active: false,
    activationState: { actionable: false, state: "funded-commercial-hire" },
  };
}

/** Map a Hire failure to the mandated honest user-facing error copy. */
export function mainTrackUserHireErrorMessage(detail: {
  state: "failed" | "cancelled" | "verify-failed";
  step: string | null;
  reason?: string;
}): string {
  if (detail.state === "cancelled") {
    return "Hire cancelled — no further transaction was submitted.";
  }
  const reason = (detail.reason ?? "").toLowerCase();
  if (/insufficient|balance/i.test(reason)) {
    return "Insufficient testnet funds to complete this Hire.";
  }
  if (/receipt|timeout|unconfirmed/i.test(reason)) {
    return "Hire stopped while verifying the transaction. No rebroadcast was attempted.";
  }
  if (/rpc|network|fetch|unreachable|decode/i.test(reason)) {
    return "Network verification failed. Your transaction was not retried.";
  }
  if (detail.state === "verify-failed") {
    return "Job created, but Hire could not be safely completed. No additional transaction was submitted.";
  }
  return "Hire stopped safely. No later Hire step was submitted.";
}
