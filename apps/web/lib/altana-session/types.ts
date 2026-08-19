/**
 * X.45 persistent Altana session — shared types (pure module, no server-only
 * imports, no SDK imports). The DB enum `AltanaSessionStatus` is deliberately
 * reused as-is (no schema change): the explicit application-level state
 * machine below maps onto it. Rationale: Postgres is currently unreachable
 * (P1001), so any enum extension would be untestable SQL; the six existing
 * values cover every durable state, and the two PENDING-facing phases
 * (creating / grantSubmitted) are distinguished in memory during the create
 * flow and reconciled as "incomplete grant" after a crash.
 */

export const ALTANA_SESSION_PROTOCOL_VERSION = 1 as const;

export type SessionLifecycleState =
  | "creating"
  | "grantSubmitted"
  | "active"
  | "expired"
  | "revoking"
  | "revoked"
  | "failed";

export type DbSessionStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKING" | "REVOKED" | "FAILED";

export const LIFECYCLE_TO_DB_STATUS: Record<SessionLifecycleState, DbSessionStatus> = {
  creating: "PENDING",
  grantSubmitted: "PENDING",
  active: "ACTIVE",
  expired: "EXPIRED",
  revoking: "REVOKING",
  revoked: "REVOKED",
  failed: "FAILED",
};

export const DB_STATUS_TO_LIFECYCLE: Record<DbSessionStatus, SessionLifecycleState> = {
  PENDING: "grantSubmitted",
  ACTIVE: "active",
  EXPIRED: "expired",
  REVOKING: "revoking",
  REVOKED: "revoked",
  FAILED: "failed",
};

export type SessionPermissionPeriod = "minute" | "hour" | "day" | "week" | "month" | "year";

export type SessionPermissionRow = {
  id: string;
  kind: "CALL" | "TOKEN_SPEND" | "NATIVE_SPEND";
  targetAddress: string | null;
  functionSelector: string | null;
  functionSignature: string | null;
  tokenAddress: string | null;
  spendCapRaw: string | null;
  spendPeriod: SessionPermissionPeriod | null;
  expiresAt: string | null;
  enabled: boolean;
  revokedAt: string | null;
};

export type SessionPublicMetadata = {
  spentRaw?: string;
  lastReconstructedAt?: string;
  /** UTC day bucket ("YYYY-MM-DD") the `spentRaw` counter was last written in. */
  spentWindow?: string;
  lastSpentAt?: string;
  errorDetail?: string;
  /** Exact server-resolved ERC-8004 identity this session activates. */
  agentId?: string;
  agentName?: string;
  agentSource?: "8004scan";
};

/**
 * X.49 daily spend-window bucket (UTC). Deterministic in every timezone: the
 * on-chain KeyStore "day" period is UTC-based, and this matches it.
 */
export function utcDayWindow(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Effective confirmed spend for a window: metadata written in an earlier UTC
 * day bucket is treated as spent 0 in the current day (window reset).
 */
export function effectiveSpentForWindow(record: { publicMetadata?: SessionPublicMetadata | null }, now: Date): bigint {
  const meta = record.publicMetadata;
  if (!meta) return 0n;
  if (meta.spentWindow !== utcDayWindow(now)) return 0n;
  return BigInt(meta.spentRaw ?? "0");
}

export type SpendReservationAttempt = {
  allowed: boolean;
  /** Confirmed usage inside the current window seen by the reservation (post-rollup). */
  windowSpentRaw: string;
  /** Reserved-but-not-yet-confirmed usage inside the current window (post-rollup). */
  pendingRaw: string;
  /** The amount this reservation would have consumed (equals ALTANA_SESSION_APPROVAL_RAW when allowed). */
  amountRaw: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  walletId: string;
  chainId: number;
  walletAddress: string;
  publicKey: string;
  keyId: string;
  status: SessionLifecycleState;
  keyStoreActive: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastVerifiedAt: string | null;
  grantCallsId: string | null;
  registrationCallsId: string | null;
  registrationTxHash: string | null;
  revokeCallsId: string | null;
  revokeTxHash: string | null;
  publicMetadata: SessionPublicMetadata | null;
  permissions: SessionPermissionRow[];
  hasEncryptedSecret: boolean;
};

export type SessionPatch = Partial<
  Pick<
    SessionRecord,
    | "status"
    | "keyStoreActive"
    | "revokedAt"
    | "lastVerifiedAt"
    | "grantCallsId"
    | "registrationCallsId"
    | "registrationTxHash"
    | "revokeCallsId"
    | "revokeTxHash"
    | "walletAddress"
    | "publicKey"
    | "keyId"
    | "expiresAt"
    | "publicMetadata"
    | "hasEncryptedSecret"
  >
>;

export type SessionAuditResult = "SUCCESS" | "FAILURE" | "DENIED";

export type SessionAuditInput = {
  eventType: string;
  result: SessionAuditResult;
  userId: string;
  walletId?: string;
  sessionId?: string;
  chainId?: number;
  transactionHash?: string;
  callsId?: string;
  safeMetadata?: Record<string, string | number | boolean | null>;
};

export interface SessionStore {
  createSession(input: { userId: string; walletId: string; chainId: number; now: Date }): Promise<{ id: string }>;
  updateSession(input: { id: string; patch: SessionPatch; now: Date }): Promise<void>;
  savePermissions(input: {
    sessionId: string;
    permissions: readonly Omit<SessionPermissionRow, "id" | "expiresAt" | "revokedAt" | "createdAt">[];
  }): Promise<void>;
  loadLatestForWallet(input: { userId: string; walletId: string }): Promise<SessionRecord | null>;
  loadById(input: { id: string }): Promise<SessionRecord | null>;
  /**
   * X.49 atomic spend reservation. The ONLY place a reservation may be
   * granted; stores MUST implement this as a single atomic, concurrency-safe
   * check-and-increment (memory: single-threaded op; Prisma: row-locked
   * transaction). Never trusts caller-provided usage figures.
   */
  tryReserveSpend(input: { sessionId: string; amountRaw: bigint; capRaw: bigint; now: Date }): Promise<SpendReservationAttempt>;
  /**
   * X.49 reservation settlement (must be atomic with the store's pending
   * ledger):
   * - "confirmed": move the reserved amount into the window's confirmed usage
   *   (never freed until the UTC day window resets).
   * - "released": the operation failed BEFORE any broadcast — give the amount
   *   back.
   * - "held": the operation was broadcast but did not confirm — the amount is
   *   NOT returned (it may still land on-chain); it is merely removed from the
   *   pending ledger and will be recovered by post-confirmation reconciliation
   *   when the broadcast eventually confirms.
   */
  settleReservation(input: { sessionId: string; amountRaw: bigint; mode: "confirmed" | "released" | "held"; now: Date }): Promise<void>;
  writeAudit(input: SessionAuditInput): Promise<void>;
}

export type SessionOwner = {
  userId: string;
  walletId: string;
  walletAddress: string;
};

export type SessionCall = {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
};

export type SessionExecutionLog = {
  address: string;
  topics: readonly string[];
  data: string;
};

export type SessionExecutionResult = {
  status: string;
  transactionHash: string;
  receiptStatus: string;
  logs: readonly SessionExecutionLog[];
};

/**
 * X.49 execution-boundary error classification. A reservation may be
 * released only when `broadcastPossible === false`; ambiguous SDK/RPC errors
 * are held conservatively because a transaction may still land on-chain.
 */
export class SessionExecutionError extends Error {
  readonly broadcastPossible: boolean;

  constructor(message: string, broadcastPossible: boolean) {
    super(message);
    this.name = "SessionExecutionError";
    this.broadcastPossible = broadcastPossible;
  }
}

export type AdapterSessionPermissions = {
  calls: readonly { to: string; signature: string }[];
  spend: readonly { limit: bigint; period: SessionPermissionPeriod; token?: `0x${string}` }[];
};

export type AdapterSessionSigner = {
  address: string;
  publicKey: string;
  signDigest(digest: string): Promise<string>;
  _privateKey: string;
};

export type AdapterSession = {
  walletAddress: string;
  publicKey: string;
  expiry: number;
  permissions: AdapterSessionPermissions;
  signer: AdapterSessionSigner;
};

export type GrantSessionInput = {
  permissions: AdapterSessionPermissions;
  expiry: number;
};

export type GrantSessionResult = {
  /** Relay callsId when the grant was relayed through a call pipeline; absent for account-level grants. */
  grantCallsId?: string;
  session: AdapterSession;
};

export type RegisterSessionKeyResult = {
  alreadyRegistered: boolean;
  callsId: string | null;
  transactionHash: string | null;
  status: string;
};

export interface AltanaSessionAdapter {
  readonly chainId: number;
  adoptWallet(): Promise<{ walletAddress: string }>;
  grantSession(input: GrantSessionInput): Promise<GrantSessionResult>;
  registerSessionKey(input: { session: AdapterSession }): Promise<RegisterSessionKeyResult>;
  isKeyStoreActive(input: { walletAddress: string; publicKey: string }): Promise<boolean>;
  executeSessionCall(input: { session: AdapterSession; call: SessionCall }): Promise<SessionExecutionResult>;
  revokeSession(input: { publicKey: string }): Promise<{ transactionHash: string }>;
  readAllowance(input: { token: string; owner: string; spender: string }): Promise<bigint>;
  readChainId(): Promise<number>;
}

export interface CustodyLike {
  encryptAltanaSecret(input: {
    owner: { userId: string; walletAddress?: string };
    sessionId: string;
    plaintext: Buffer;
  }): Promise<{ encryptedSecretId: string }>;
  decryptAltanaSecret(input: { owner: { userId: string; walletAddress?: string }; sessionId: string }): Promise<Buffer>;
  destroyAltanaSecret(input: { owner: { userId: string; walletAddress?: string }; sessionId: string }): Promise<{ destroyedAt: Date }>;
}

export type LoadedSessionResult =
  | { kind: "active"; session: AdapterSession; record: SessionRecord }
  | { kind: "blocked"; reason: string; record: SessionRecord }
  | { kind: "none" };

export type ExecuteOutcome =
  | { outcome: "executed"; transactionHash: string; spentRaw: string; remainingRaw: string }
  | { outcome: "skipped-existing"; spentRaw: string; remainingRaw: string }
  | { outcome: "denied"; reason: string; spentRaw: string; remainingRaw: string };

export type RevokeOutcome =
  | { outcome: "revoked"; revokeTxHash: string }
  | { outcome: "already-revoked" }
  | { outcome: "blocked"; reason: string };

export class AltanaSessionError extends Error {
  readonly code:
    | "policy-violation"
    | "chain-mismatch"
    | "session-not-found"
    | "session-blocked"
    | "key-store-inactive"
    | "grant-failed"
    | "registration-failed"
    | "revoke-failed"
    | "custody-failed"
    | "persistence-unavailable"
    | "execution-failed";

  constructor(code: AltanaSessionError["code"], message: string) {
    super(message);
    this.name = "AltanaSessionError";
    this.code = code;
  }
}
