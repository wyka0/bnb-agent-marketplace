/**
 * Shared domain types used across the marketplace platform.
 *
 * These are contract-level types describing the marketplace's core identity
 * model (agents, categories, partners). They deliberately do NOT couple to any
 * database or HTTP schema; integration with data layers happens in the
 * `data-api` and `prisma` packages later.
 */

import type { AgentCategory, ChainId, PartnerId } from "./constants.js";

/**
 * Core identity of a publisher / builder who lists agents on the marketplace.
 * Minimal until authentication and wallet flows are implemented.
 */
export interface Publisher {
  /** Stable identifier assigned by the platform. */
  id: string;
  /** Public display name. */
  name: string;
  /** Optional slug for the publisher's public profile. */
  slug?: string;
  /** Wallet address the publisher controls (display only for now). */
  walletAddress?: string;
  createdAt: string;
}

/**
 * Canonical identity of an agent listing on the marketplace.
 * Represents the public catalog entry, not a configured deployment.
 */
export interface Agent {
  /** Unique slug used in URLs, e.g. "altana-grid-trader". */
  slug: string;
  /** Human-readable name. */
  name: string;
  /** Short marketing tagline. */
  tagline: string;
  /** Primary category. */
  category: AgentCategory;
  /** Associated chains. */
  chains: ChainId[];
  /** Partner track the agent is affiliated with, when applicable. */
  partner?: PartnerId;
  /** Optional icon/logo URL. */
  iconUrl?: string;
  /** Publisher owning the listing. */
  publisher: Publisher;
  /** Current publication status. */
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
}

/** Pagination envelope shared by all list endpoints. */
export interface PageParams {
  page: number;
  pageSize: number;
}

/** Generic paginated result container. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Discriminated union describing a status of a long-running operation. */
export type OperationStatus<TData = unknown> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TData }
  | { status: "error"; error: Error };

/** Union of all error codes emitted by the platform's API envelope. */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR"
  | "STALE_DATA";

/** Zero-cost marker to keep type-only imports referenced. */
export type { FeatureFlag } from "./feature-flags.js";
