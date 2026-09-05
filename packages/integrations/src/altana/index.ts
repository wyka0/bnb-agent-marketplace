/**
 * ALTANA — Agent wallet integration.
 *
 * Phase 2 ships the server-safe SDK facade: `createAltanaClient`,
 * `validateAltanaConfiguration`, `getAltanaStatus`, `checkAltanaReadonly`
 * (see ./client.ts). The session-level `AltanaAdapter` interface below
 * remains the stability contract that web/worker layers compile against;
 * its real session implementation (grantSession / execute / revokeSession /
 * x402 / skills) arrives in a later phase and is NOT wired here.
 *
 * Phase 3A adds the ERC-8183 job-escrow adapter (see ./erc8183.ts):
 * testnet-only address resolution, hire-call construction, job/deliverable
 * reads, settlement/dispute/claim-refund construction, and the signing
 * boundary. No signer/session path is wired — nothing can be submitted.
 *
 * Phase 4 adds the certified-skills capability adapter (see ./skills.ts):
 * the official Altana skills as marketplace capabilities, explicit agent →
 * skill mapping, 8004scan bridging, and validation. Capability metadata
 * ONLY — no execution, no sessions, no signers, no x402, no transactions.
 *
 * Phase X.1 adds the x402 payment-rail adapter (see ./x402.ts): buyer-side
 * BNB testnet client + 402 parsing + Permit2 surface and the sell-side
 * configuration/boundary for @altananetwork/x402-server. Foundation ONLY —
 * no payment, approval, settlement, or merchant is ever executed.
 *
 * Phase X.2 adds the controlled testnet flow verification (see
 * ./x402.testnet.ts + ./x402.testnet.verify.ts, runner-only, NOT a public
 * export): an in-process KEYLESS merchant proves the real 402 lifecycle
 * against the official server package. No signing, no settlement — the valid
 * payment branch is BLOCKED pending an externally supplied funded signer.
 *
 * Phase X.3 adds the marketplace service integration (see ./marketplace.ts):
 * a server-side typed service that resolves agent identity, derives a payment
 * requirement ONLY from configured/verified sell-side x402 config, and
 * normalizes payment + execution states. Verification is delegated to the
 * existing x402 adapter (never duplicated). The deterministic fixture service
 * + runner (./marketplace.testnet.ts + ./marketplace.verify.ts) prove the
 * eight mandated checks headlessly; live signing stays BLOCKED.
 */

/** Session spend allowance. */
export interface SpendCap {
  /** Maximum total spend allowed over the session lifetime. */
  total: string;
  /** Maximum spend per rolling window, keyed by period. */
  perPeriod?: Record<string, string>;
}

/** Lifecycle state of a wallet session. */
export type SessionStatus = "pending" | "active" | "expired" | "revoked" | "terminated";

/** An agent wallet session key. */
export interface SessionKey {
  id: string;
  /** Wallet / account this session entitles. */
  account: string;
  /** Bytes or base64 of the session public key. */
  publicKey: string;
  status: SessionStatus;
  cap: SpendCap;
  /** ISO expiry timestamp. */
  expiresAt: string;
  /** ISO creation timestamp. */
  createdAt: string;
  revokedAt?: string;
}

export interface CreateSessionInput {
  account: string;
  cap: SpendCap;
  /** Duration in ms before the session automatically expires. */
  expiresInMs: number;
}

export interface RevokeSessionInput {
  sessionId: string;
  reason?: string;
}

/** Contract that a real ALTANA adapter must satisfy. */
export interface AltanaAdapter {
  readonly providerName: "altana";

  createSession(input: CreateSessionInput): Promise<SessionKey>;
  revokeSession(input: RevokeSessionInput): Promise<void>;
  getSession(sessionId: string): Promise<SessionKey>;
  listSessions(account: string): Promise<SessionKey[]>;
}

/** Marker returned by placeholder adapters before real SDK wiring exists. */
export const ALTANA_ADAPTER_NOT_IMPLEMENTED = "ALTANA adapter is not implemented yet." as const;

export * from "./client.js";
export * from "./erc8183.js";
export * from "./v2/commercial-agreement.js";
export * from "./v2/hire-adapter.js";
export * from "./v2/main-track-hire.js";
export * from "./v2/main-track-user-wallet.js";
export * from "./hire-chains.js";
export * from "./skills.js";
export * from "./x402.js";
export * from "./x402.review.js";
export * from "./marketplace.js";
export * from "./registration-preview.js";
export * from "./session.js";
export * from "./session.x36.public.js";
