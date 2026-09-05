/**
 * X.131 — Main Track V2 activation policy (PURE, framework-free).
 *
 * Two explicit activation policies, kept distinct in code:
 *
 *   MODEL A — VerifiedExecutionCapability (X.76): the strict execution/Altana
 *             path. Requires resource + executionCapability + marketplace-as-
 *             client + custody. UNCHANGED and still fail-closed (X.128 D).
 *
 *   MODEL B — Verified V2 commercial agreement (X.130/X.131): a valid Main
 *             Track commercial hire boundary. Requires a verified commercial
 *             quote and a funded marketplace-client ERC-8183 job. FUNDED is
 *             commercial escrow — it is NEVER represented as ACTIVE/RUNNING/
 *             EXECUTING/COMPLETED.
 *
 * This module also owns:
 *   - the marketplace-client CUSTODY seam (fail-closed; no server-held raw
 *     private keys are ever accepted),
 *   - the explicit Hire state model,
 *   - the user-confirmation review view,
 *   - the fail-closed orchestration wrapper around the integration boundary.
 */

import {
  MAIN_TRACK_NEXT_REQUIRED_ACTION,
  buildMainTrackHireConfirmation,
  runMainTrackV2HireActivation,
} from "@bnb-marketplace/integrations/altana";
import type {
  MainTrackV2HireInput,
  MainTrackV2HirePorts,
  V2CommercialAgreement,
} from "@bnb-marketplace/integrations/altana";

/** Model A — the strict execution/Altana capability-authority path. */
export const MAIN_TRACK_MODEL_A = "model-a-x76-verified-execution-capability" as const;
/** Model B — the Main Track verified-commercial hire path. */
export const MAIN_TRACK_MODEL_B = "model-b-v2-commercial-agreement" as const;

/** Explicit Hire state model. FUNDED is escrow, never ACTIVE. */
export const MAIN_TRACK_HIRE_STATES = [
  "pending",
  "negotiating",
  "quote-verified",
  "creating-job",
  "registering",
  "funding",
  "funded",
  "failed",
] as const;
export type MainTrackHireState = (typeof MAIN_TRACK_HIRE_STATES)[number];

export const MAIN_TRACK_HIRE_STEP_LABEL: Record<MainTrackHireState, string> = {
  pending: "Preparing hire",
  negotiating: "Negotiating",
  "quote-verified": "Quote verified",
  "creating-job": "Creating job",
  registering: "Registering job",
  funding: "Funding",
  funded: "Funded",
  failed: "Failed",
};

/** Marketplace-client custody result. Never exposes a secret. */
export interface MainTrackCustodyResult {
  available: boolean;
  provider: string | null;
  reason: string;
}

/**
 * Resolve the marketplace-client custody mechanism from the environment.
 *
 * SAFETY: only remote/non-raw-key providers are ever accepted. A raw private
 * key is NEVER read here; `MAIN_TRACK_CUSTODY_KEY_REFERENCE` is a provider
 * key reference (e.g. KMS key id / remote signer id), not a private key. In
 * the current production environment nothing is configured, so this returns
 * `available:false` (fail-closed).
 */
export function resolveMainTrackCustody(
  env: Record<string, string | undefined>
): MainTrackCustodyResult {
  const provider = env["MAIN_TRACK_CUSTODY_PROVIDER"]?.trim();
  const keyRef = env["MAIN_TRACK_CUSTODY_KEY_REFERENCE"]?.trim();
  if (!provider || !keyRef) {
    return {
      available: false,
      provider: null,
      reason: "main-track marketplace custody not provisioned; no server-held raw private keys",
    };
  }
  const safeProviders = new Set(["kms", "remote-signer", "external-custody"]);
  if (!safeProviders.has(provider)) {
    return { available: false, provider, reason: "unsupported main-track custody provider" };
  }
  return { available: true, provider, reason: "" };
}

/** The user-facing Main Track review view (Model B). */
export interface MainTrackHireReviewView {
  policy: typeof MAIN_TRACK_MODEL_B;
  available: boolean;
  reason?: string;
  agent: string;
  provider: string;
  network: string;
  price: string;
  commerce: string;
  quote: "Verified" | "Unavailable";
  quoteExpiry: number | null;
  marketplaceWalletIdentified: boolean;
  requiresConfirmation: boolean;
  confirmationLabel: string;
  active: false;
  state: "pending" | "quote-verified";
}

/** Honest "not available" review (e.g. custody or negotiation not wired). */
export function mainTrackHireReviewUnavailable(reason: string): MainTrackHireReviewView {
  return {
    policy: MAIN_TRACK_MODEL_B,
    available: false,
    reason,
    agent: "",
    provider: "",
    network: "",
    price: "",
    commerce: "ERC-8183",
    quote: "Unavailable",
    quoteExpiry: null,
    marketplaceWalletIdentified: false,
    requiresConfirmation: false,
    confirmationLabel: "",
    active: false,
    state: "pending",
  };
}

/** Build the explicit-confirmation review for a verified agreement. */
export function buildMainTrackHireReviewView(
  agreement: V2CommercialAgreement
): MainTrackHireReviewView {
  const confirmation = buildMainTrackHireConfirmation(agreement);
  return {
    policy: MAIN_TRACK_MODEL_B,
    available: true,
    agent: confirmation.agent,
    provider: confirmation.sellerIdentity,
    network: confirmation.chain,
    price: confirmation.price,
    commerce: "ERC-8183",
    quote: "Verified",
    quoteExpiry: confirmation.quoteExpiry,
    marketplaceWalletIdentified: agreement.providerSignature.verified === true,
    requiresConfirmation: true,
    confirmationLabel: "Confirm Hire — 1 U",
    active: false,
    state: "quote-verified",
  };
}

export type MainTrackHireRunResult =
  | {
      ok: true;
      stage: "funded";
      policy: typeof MAIN_TRACK_MODEL_B;
      jobId: string;
      txHashes: Record<string, string>;
      blockNumbers: Record<string, string>;
      job: { status: number; statusName: string; client: string; provider: string; budget: string };
      active: false;
      activationState: { actionable: false; state: "funded-commercial-hire" };
      nextRequiredAction: string;
    }
  | {
      ok: false;
      blocked: { stage: string; reason: string };
      custodyRequired: boolean;
    };

/**
 * Fail-closed orchestration: custody is required before ANY transaction. When
 * custody is unavailable this returns `ok:false` with `custodyRequired:true`
 * and never touches the network. When custody is available it delegates to the
 * integration boundary `runMainTrackV2HireActivation`.
 */
export async function runMainTrackHireOrFailClosed(input: {
  env: Record<string, string | undefined>;
  ports: MainTrackV2HirePorts;
  hire: MainTrackV2HireInput;
}): Promise<MainTrackHireRunResult> {
  const custody = resolveMainTrackCustody(input.env);
  if (!custody.available) {
    return {
      ok: false,
      blocked: { stage: "custody", reason: custody.reason },
      custodyRequired: true,
    };
  }
  const out = await runMainTrackV2HireActivation(input.ports, input.hire);
  if (!out.ok) {
    return { ok: false, blocked: out.blocked, custodyRequired: false };
  }
  return {
    ok: true,
    stage: "funded",
    policy: MAIN_TRACK_MODEL_B,
    jobId: out.jobId,
    txHashes: out.txHashes,
    blockNumbers: out.blockNumbers,
    job: {
      status: out.job.status,
      statusName: out.job.statusName,
      client: out.job.client,
      provider: out.job.provider,
      budget: out.job.budget,
    },
    active: false,
    activationState: out.activationState,
    nextRequiredAction: MAIN_TRACK_NEXT_REQUIRED_ACTION,
  };
}
