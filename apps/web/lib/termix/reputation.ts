/**
 * TermiX AACP — server-only READ-ONLY reputation client (web app layer).
 *
 * WHY THIS LIVES HERE (not imported from @bnb-marketplace/integrations):
 *   `apps/web` does not link the `@bnb-marketplace/integrations` package
 *   (only config / data-api / telemetry / ui are linked). Adding it would
 *   require a package install. Following the EXACT precedent of
 *   `apps/web/lib/eight004scan/client.ts`, this is a thin server-only app-layer
 *   client that reuses the shared HTTP foundation (`@bnb-marketplace/data-api`)
 *   and mirrors the already-verified TermiX adapter's contract 1:1:
 *     - same constants (chain 97, MockAgentNFT, public base URL),
 *     - same deterministic identity mapping rule (MockAgentNFT @ 97 only),
 *     - same honest normalization + discriminated states,
 *     - same "missing data is NEVER score 0" guarantee.
 *   The canonical, test-covered implementation is
 *   `packages/integrations/src/termix/*` (verified by `termix:reputation:verify`).
 *
 * READ-ONLY. No wallet, no signer, no private key, no transaction, no auth
 * header. `GET /api/v1/reputation/:agentId` is public per authentication.md.
 * This module is only imported by server code (the route's server component),
 * so `termix-backend.dev.termix.click` is never called from the browser.
 *
 * No network calls happen at import time.
 */

import { createApiClient } from "@bnb-marketplace/data-api";

/* -- Constants mirrored from packages/integrations/src/termix/types.ts -- */

/** BSC Testnet — never mainnet. */
export const TERMIX_AACP_CHAIN_ID = 97 as const;
/** Public AACP backend (network.md). */
export const TERMIX_AACP_DEFAULT_BASE_URL = "https://termix-backend.dev.termix.click" as const;
/** TermiX MockAgentNFT on chain 97: the ONLY contract where tokenId === agentId. */
export const TERMIX_AGENT_NFT_ADDRESS = "0x23932e45071ba6ef687331f429b79c09c34d5eb0" as const;
/** Provenance label — a TermiX signal, kept distinct from 8004scan. */
export const TERMIX_REPUTATION_SOURCE = "termix-aacp" as const;

/* -- Types mirrored from the verified adapter -- */

export type TermixAnomaly =
  "overturn-count" | "borderline-count" | "llm-deviation" | "extreme-pass-rate";

export interface TermixEvaluatorMetrics {
  overturnCount: number;
  borderlineCount: number;
  avgDevFromLLM: number;
  passRate: number;
}

export interface TermixRawReputation {
  agentId: string;
  score: number;
  totalJobs: number;
  completedJobs: number;
  onTimeJobs: number;
  approvedJobs: number;
  disputeWins: number;
  anomalyFlags: number;
  evaluatorMetrics?: TermixEvaluatorMetrics;
}

/** Normalized, serializable reputation record (safe to pass to a client view). */
export interface TermixReputation {
  agentId: string;
  chainId: typeof TERMIX_AACP_CHAIN_ID;
  score: number;
  totalJobs: number;
  completedJobs: number;
  onTimeJobs: number;
  approvedJobs: number;
  disputeWins: number;
  anomalyFlags: number;
  anomalies: TermixAnomaly[];
  evaluatorMetrics?: TermixEvaluatorMetrics;
  source: typeof TERMIX_REPUTATION_SOURCE;
  retrievedAt: string;
}

/** Honest failure/absence reasons — the UI switches on these (never score 0). */
export type TermixReputationFailure =
  | "not-found"
  | "unsupported"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "bad-request"
  | "server-error"
  | "network-error"
  | "error";

export type TermixReputationResult =
  | { ok: true; data: TermixReputation }
  | { ok: false; reason: TermixReputationFailure; status?: number; message?: string };

/** Minimal ERC-8004 identity needed for a deterministic TermiX lookup. */
export interface Erc8004AgentIdentity {
  tokenId: string;
  chainId: number;
  contractAddress: string;
}

export type TermixIdentityMapping =
  { ok: true; agentId: string } | { ok: false; reason: "unsupported"; message: string };

/* -- Pure helpers (mirror reputation.ts) -- */

const ANOMALY_BITS: readonly { bit: number; flag: TermixAnomaly }[] = [
  { bit: 0, flag: "overturn-count" },
  { bit: 1, flag: "borderline-count" },
  { bit: 2, flag: "llm-deviation" },
  { bit: 3, flag: "extreme-pass-rate" },
];

/** Decode the documented 4-bit anomaly mask (0 = none). */
export function decodeAnomalyFlags(mask: number): TermixAnomaly[] {
  if (!Number.isFinite(mask) || mask <= 0) return [];
  const flags: TermixAnomaly[] = [];
  for (const { bit, flag } of ANOMALY_BITS) {
    if ((mask & (1 << bit)) !== 0) flags.push(flag);
  }
  return flags;
}

/** uint256 token-id string check. */
export function isValidAgentId(agentId: string): boolean {
  return typeof agentId === "string" && /^[0-9]+$/.test(agentId);
}

/**
 * Resolve an ERC-8004 identity to a TermiX AACP agentId. Deterministic ONLY for
 * MockAgentNFT on chain 97 (tokenId === agentId). Anything else → unsupported.
 * NEVER guesses a mapping and NEVER uses a wallet address as an agentId.
 */
export function mapErc8004ToTermixAgentId(identity: Erc8004AgentIdentity): TermixIdentityMapping {
  if (identity.chainId !== TERMIX_AACP_CHAIN_ID) {
    return {
      ok: false,
      reason: "unsupported",
      message: `TermiX AACP is BSC Testnet (chain ${TERMIX_AACP_CHAIN_ID}); identity is on chain ${identity.chainId}.`,
    };
  }
  if (identity.contractAddress.trim().toLowerCase() !== TERMIX_AGENT_NFT_ADDRESS) {
    return {
      ok: false,
      reason: "unsupported",
      message:
        "No deterministic mapping: the ERC-8004 NFT is not the TermiX MockAgentNFT, so its token id is not an AACP agentId.",
    };
  }
  if (!isValidAgentId(identity.tokenId)) {
    return {
      ok: false,
      reason: "unsupported",
      message: `token id "${identity.tokenId}" is not a uint256 string.`,
    };
  }
  return { ok: true, agentId: identity.tokenId };
}

/** Validate the RAW reputation shape (only documented fields). */
function isRawReputation(v: unknown): v is TermixRawReputation {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.agentId === "string" &&
    typeof r.score === "number" &&
    typeof r.totalJobs === "number" &&
    typeof r.completedJobs === "number" &&
    typeof r.onTimeJobs === "number" &&
    typeof r.approvedJobs === "number" &&
    typeof r.disputeWins === "number" &&
    typeof r.anomalyFlags === "number"
  );
}

/** Normalize a raw record. Preserves a genuine `score: 0`; never invents data. */
export function normalizeReputation(raw: TermixRawReputation): TermixReputation {
  const normalized: TermixReputation = {
    agentId: raw.agentId,
    chainId: TERMIX_AACP_CHAIN_ID,
    score: raw.score,
    totalJobs: raw.totalJobs,
    completedJobs: raw.completedJobs,
    onTimeJobs: raw.onTimeJobs,
    approvedJobs: raw.approvedJobs,
    disputeWins: raw.disputeWins,
    anomalyFlags: raw.anomalyFlags,
    anomalies: decodeAnomalyFlags(raw.anomalyFlags),
    source: TERMIX_REPUTATION_SOURCE,
    retrievedAt: new Date().toISOString(),
  };
  if (raw.evaluatorMetrics !== undefined) normalized.evaluatorMetrics = raw.evaluatorMetrics;
  return normalized;
}

function baseUrl(): string {
  const fromEnv = process.env["TERMIX_AACP_BASE_URL"];
  const chosen = fromEnv && fromEnv.trim().length > 0 ? fromEnv : TERMIX_AACP_DEFAULT_BASE_URL;
  return chosen.replace(/\/+$/, "");
}

function mapStatusToReason(status: number): TermixReputationFailure {
  if (status === 400) return "bad-request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server-error";
  return "error";
}

function isSuccessEnvelope(v: unknown): v is { success: true; data: unknown } {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { success?: unknown }).success === true &&
    "data" in (v as object) &&
    (v as { data?: unknown }).data != null
  );
}

/**
 * `GET /api/v1/reputation/:agentId` — public read. Never throws for HTTP/network
 * problems; returns a discriminated result. `timeoutMs` guards against hangs.
 */
export async function getTermixReputationByAgentId(
  agentId: string,
  options: { timeoutMs?: number; fetchFn?: typeof fetch } = {}
): Promise<TermixReputationResult> {
  if (!isValidAgentId(agentId)) {
    return {
      ok: false,
      reason: "bad-request",
      message: `agentId "${agentId}" must be a uint256 string.`,
    };
  }
  const client = createApiClient({
    baseUrl: baseUrl(),
    timeoutMs: options.timeoutMs ?? 8000,
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
  });
  try {
    // `forceLiterally` returns the raw AACP `{success,data}` body so we parse it
    // ourselves (distinct from the data-api `{ok,data,error}` envelope).
    const raw = await client.get<unknown>(`/api/v1/reputation/${encodeURIComponent(agentId)}`, {
      headers: { Accept: "application/json" }, // READ-ONLY: no Authorization header
      forceLiterally: true,
      cache: "no-store",
    });
    if (isSuccessEnvelope(raw) && isRawReputation(raw.data)) {
      return { ok: true, data: normalizeReputation(raw.data) };
    }
    return { ok: false, reason: "error", message: "unexpected reputation shape" };
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (typeof status === "number") {
      return { ok: false, reason: mapStatusToReason(status), status };
    }
    // Network failure / timeout / abort.
    return { ok: false, reason: "network-error" };
  }
}

/**
 * Resolve identity first, then fetch. When there is no deterministic mapping it
 * returns `unsupported` WITHOUT any network call.
 */
export async function getTermixReputationForAgent(
  identity: Erc8004AgentIdentity,
  options: { timeoutMs?: number; fetchFn?: typeof fetch } = {}
): Promise<TermixReputationResult> {
  const mapping = mapErc8004ToTermixAgentId(identity);
  if (!mapping.ok) return { ok: false, reason: "unsupported", message: mapping.message };
  return getTermixReputationByAgentId(mapping.agentId, options);
}
