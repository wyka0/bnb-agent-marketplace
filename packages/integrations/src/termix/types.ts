/**
 * TermiX AACP — typed response contract (READ-ONLY reputation surface).
 *
 * Types transcribed EXACTLY from the current authoritative TermiX AACP docs:
 *   - https://docs.termix.ai/api-reference/reputation.md  (GET /api/v1/reputation/:agentId)
 *   - https://docs.termix.ai/api-reference/agents.md       (agent record shape)
 *   - https://docs.termix.ai/aacp/network.md               (BSC Testnet, chain 97, contracts)
 *   - https://docs.termix.ai/aacp/authentication.md        (GET is public — no auth)
 *
 * No fields are invented; every property below is one the API actually returns.
 *
 * Response envelope (AACP REST): `{ success: true, data: T }` on success.
 * NOTE: this differs from the internal `@bnb-marketplace/data-api` envelope
 * (`{ ok, data, error }`) — we parse the AACP envelope ourselves.
 */

/** AACP settlement/network facts (from network.md). Read-only constants. */
export const TERMIX_AACP_CHAIN_ID = 97 as const; // BSC Testnet — never mainnet
export const TERMIX_AACP_DEFAULT_BASE_URL = "https://termix-backend.dev.termix.click" as const;

/**
 * The TermiX Agent-NFT contract on BSC Testnet (`MockAgentNFT`).
 * From network.md: `tokenId = agentId`. This is the ONLY contract whose token
 * ids map deterministically onto AACP `agentId`s. Address is checksum-normalized
 * at use sites; stored lowercase here for stable comparison.
 */
export const TERMIX_AGENT_NFT_ADDRESS = "0x23932e45071ba6ef687331f429b79c09c34d5eb0" as const;

/* --------------------------------------------------------------------------
 * RAW response types — EXACT AACP shapes. Prefixed `TermiXRaw*`.
 * ------------------------------------------------------------------------ */

/** Evaluator rolling-window stats. Only present for evaluator agents. */
export interface TermiXRawEvaluatorMetrics {
  overturnCount: number;
  borderlineCount: number;
  avgDevFromLLM: number;
  passRate: number;
}

/**
 * Raw reputation record from `GET /api/v1/reputation/:agentId` `data`.
 * Every field is documented in reputation.md.
 */
export interface TermiXRawReputation {
  agentId: string;
  /** 0–100 (new agents start at 50). */
  score: number;
  totalJobs: number;
  completedJobs: number;
  onTimeJobs: number;
  approvedJobs: number;
  disputeWins: number;
  /** 4-bit mask for evaluator behavioral anomalies. `0` = none. */
  anomalyFlags: number;
  /** Only present for evaluator agents. */
  evaluatorMetrics?: TermiXRawEvaluatorMetrics;
}

/** Nested reputation object as embedded in an agent record (agents.md). */
export interface TermiXRawAgentReputation {
  score: number;
  totalJobs: number;
  completedJobs: number;
  onTimeJobs: number;
  approvedJobs: number;
  disputeWins: number;
  anomalyFlags: number;
}

/** Raw agent record from `GET /api/v1/agents/:agentId` `data` (agents.md). */
export interface TermiXRawAgent {
  agentId: string;
  name: string | null;
  ownerAddress: string;
  /** "AACP" once bound; may be on-chain-synced otherwise. */
  source: string;
  registeredAt?: string;
  roles?: string[];
  reputation?: TermiXRawAgentReputation | null;
}

/** AACP success envelope. */
export interface TermiXSuccessEnvelope<T> {
  success: true;
  data: T;
}

/** AACP error envelope (documented `{ success:false, error }` shape). */
export interface TermiXErrorEnvelope {
  success: false;
  error?: { code?: string; message?: string; details?: unknown };
}

export type TermiXEnvelope<T> = TermiXSuccessEnvelope<T> | TermiXErrorEnvelope;

/* --------------------------------------------------------------------------
 * NORMALIZED application representation — honest, read-only, never fabricated.
 * ------------------------------------------------------------------------ */

/** Which upstream source produced a normalized record (never merged/overwritten). */
export const TERMIX_REPUTATION_SOURCE = "termix-aacp" as const;
export type TermixReputationSource = typeof TERMIX_REPUTATION_SOURCE;

/**
 * Normalized TermiX reputation — ONLY fields the official API supports.
 * A missing/unavailable lookup is NEVER represented as `score: 0`; callers get
 * a discriminated result (see `TermixReputationResult`) instead.
 */
export interface TermixReputation {
  /** AACP agent id (NFT token id, uint256 string). */
  agentId: string;
  /** BSC Testnet chain id (97). Recorded so consumers keep sources distinct. */
  chainId: typeof TERMIX_AACP_CHAIN_ID;
  /** Reputation score 0–100. */
  score: number;
  totalJobs: number;
  completedJobs: number;
  onTimeJobs: number;
  approvedJobs: number;
  disputeWins: number;
  /** Raw 4-bit anomaly mask (0 = none). Decoded flags in `anomalies`. */
  anomalyFlags: number;
  /** Decoded human-readable anomaly flags (empty when `anomalyFlags === 0`). */
  anomalies: TermixAnomaly[];
  /** Evaluator-only rolling stats, when the API returns them. */
  evaluatorMetrics?: TermiXRawEvaluatorMetrics;
  /** Provenance label — this record is a TermiX signal, distinct from 8004scan. */
  source: TermixReputationSource;
  /** ISO time the lookup was performed (client clock; not upstream data). */
  retrievedAt: string;
}

/** Decoded anomaly bit (documented bit mask, reputation.md). */
export type TermixAnomaly =
  "overturn-count" | "borderline-count" | "llm-deviation" | "extreme-pass-rate";

/** Discriminated failure/absence reasons — the UI switches on these honestly. */
export type TermixReputationFailure =
  | "not-found" // 404 — agent has no AACP reputation record
  | "unsupported" // no deterministic 8004scan→AACP identity mapping exists
  | "unauthorized" // 401 (not expected for public GET, kept for completeness)
  | "forbidden" // 403
  | "rate-limited" // 429
  | "bad-request" // 400
  | "server-error" // 5xx
  | "network-error" // fetch failed / timeout / abort
  | "error"; // malformed body / unexpected shape

/**
 * Read-only lookup result. `ok:true` carries a fully-normalized record;
 * `ok:false` carries an honest reason. Missing data is NEVER score 0.
 */
export type TermixReputationResult =
  | { ok: true; data: TermixReputation }
  | { ok: false; reason: TermixReputationFailure; status?: number; message?: string };

/**
 * Minimal ERC-8004 agent identity needed to attempt a TermiX lookup.
 * Mirrors the fields 8004scan exposes (`token_id`, `chain_id`,
 * `contract_address`) so the mapping is explicit and never guessed.
 */
export interface Erc8004AgentIdentity {
  /** NFT token id (uint256 string) — equals AACP `agentId` when the NFT matches. */
  tokenId: string;
  /** Chain the NFT lives on. Must be 97 for a TermiX AACP lookup. */
  chainId: number;
  /** NFT contract address. Must be the TermiX `MockAgentNFT` for a mapping. */
  contractAddress: string;
}

/** Result of resolving an ERC-8004 identity to a TermiX AACP agent id. */
export type TermixIdentityMapping =
  { ok: true; agentId: string } | { ok: false; reason: "unsupported"; message: string };
