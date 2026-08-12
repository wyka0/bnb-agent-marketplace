/**
 * 8004scan Public API — typed response contract.
 *
 * Types transcribed EXACTLY from the official OpenAPI spec + live response of
 * `GET /agents` (https://8004scan.io/api/v1/public, docs: /developers).
 * No fields are invented; every property below is one the API actually returns.
 *
 * Response envelope (all endpoints):
 *   { success: true,  data: T,     meta: {...} }
 *   { success: false, error: {...}, meta: {...} }
 */

/** Raw agent record as returned by `GET /agents`. Every key is documented. */
export interface Scan8004Agent {
  id: string;
  agent_id: string;
  token_id: string;
  chain_id: number;
  chain_type: string; // "evm" | "solana" | …
  contract_address: string;
  is_testnet: boolean;
  owner_id: string | null;
  owner_address: string | null;
  owner_ens: string | null;
  owner_username: string | null;
  owner_avatar_url: string | null;
  owner_publisher_tier: string | null;
  owner_certified_name: string | null;
  name: string | null;
  description: string | null;
  image_url: string | null;
  is_verified: boolean;
  star_count: number;
  supported_protocols: string[];
  x402_supported: boolean;
  total_score: number;
  rank: number | null;
  network_rank: number | null;
  health_score: number | null;
  total_feedbacks: number;
  average_score: number;
  cross_chain_versions: unknown | null;
  created_at: string;
  updated_at: string;
}

/** `meta.pagination` block (documented). */
export interface Scan8004Pagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface Scan8004Meta {
  version?: string;
  timestamp?: string;
  requestId?: string;
  pagination?: Scan8004Pagination;
}

/** Success envelope for a list endpoint. */
export interface Scan8004ListEnvelope<T> {
  success: true;
  data: T[];
  meta: Scan8004Meta;
}

/** Documented error codes (from the OpenAPI `ErrorResponse` examples). */
export type Scan8004ErrorCode =
  "INVALID_PARAMS" | "NOT_FOUND" | "RATE_LIMIT_EXCEEDED" | "INTERNAL_ERROR" | (string & {});

export interface Scan8004ErrorEnvelope {
  success: false;
  error: { code: Scan8004ErrorCode; message: string; details?: unknown };
  meta?: Scan8004Meta;
}

export type Scan8004Envelope<T> = Scan8004ListEnvelope<T> | Scan8004ErrorEnvelope;

/** Documented `GET /agents` query parameters (subset we use). */
export interface ListAgentsParams {
  page?: number;
  limit?: number; // 1..100
  chainId?: number;
  ownerAddress?: string;
  search?: string;
  protocol?: "MCP" | "A2A" | "OASF" | "Web" | "Email";
  sortBy?: "created_at" | "stars" | "name" | "token_id" | "total_score";
  sortOrder?: "asc" | "desc";
  isTestnet?: boolean;
}
