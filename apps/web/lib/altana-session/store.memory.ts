/**
 * X.45 in-memory SessionStore — offline test double. Mirrors the Prisma
 * boundary contract exactly (records round-trip through the same mapping
 * functions the Prisma store uses). Never used by the server entry.
 */

import { randomUUID } from "node:crypto";
import {
  DB_STATUS_TO_LIFECYCLE,
  LIFECYCLE_TO_DB_STATUS,
  utcDayWindow,
} from "./types.ts";
import type {
  SessionAuditInput,
  SessionPermissionRow,
  SessionRecord,
  SessionStore,
  SpendReservationAttempt,
} from "./types.ts";

export type MemorySessionRow = {
  id: string;
  userId: string;
  walletId: string;
  chainId: number;
  walletAddress: string;
  publicKey: string;
  keyId: string;
  dbStatus: string;
  keyStoreActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastVerifiedAt: Date | null;
  grantCallsId: string | null;
  registrationCallsId: string | null;
  registrationTxHash: string | null;
  revokeCallsId: string | null;
  revokeTxHash: string | null;
  publicMetadata: Record<string, unknown> | null;
  permissions: Array<Omit<SessionPermissionRow, "id" | "expiresAt" | "revokedAt">>;
  hasEncryptedSecret: boolean;
};

export function toSessionRecord(row: MemorySessionRow): SessionRecord {
  const dbStatus = DB_STATUS_TO_LIFECYCLE[row.dbStatus as keyof typeof DB_STATUS_TO_LIFECYCLE] ?? "grantSubmitted";
  return {
    id: row.id,
    userId: row.userId,
    walletId: row.walletId,
    chainId: row.chainId,
    walletAddress: row.walletAddress,
    publicKey: row.publicKey,
    keyId: row.keyId,
    status: dbStatus,
    keyStoreActive: row.keyStoreActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    grantCallsId: row.grantCallsId,
    registrationCallsId: row.registrationCallsId,
    registrationTxHash: row.registrationTxHash,
    revokeCallsId: row.revokeCallsId,
    revokeTxHash: row.revokeTxHash,
    publicMetadata: row.publicMetadata as SessionRecord["publicMetadata"] | null,
    permissions: row.permissions.map((permission) => ({
      ...permission,
      id: randomUUID(),
      expiresAt: null,
      revokedAt: null,
    })),
    hasEncryptedSecret: row.hasEncryptedSecret,
  };
}

export function toMemoryRow(record: SessionRecord, now: Date): MemorySessionRow {
  return {
    id: record.id,
    userId: record.userId,
    walletId: record.walletId,
    chainId: record.chainId,
    walletAddress: record.walletAddress,
    publicKey: record.publicKey,
    keyId: record.keyId,
    dbStatus: LIFECYCLE_TO_DB_STATUS[record.status],
    keyStoreActive: record.keyStoreActive,
    createdAt: new Date(record.createdAt),
    updatedAt: now,
    expiresAt: new Date(record.expiresAt),
    revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
    lastVerifiedAt: record.lastVerifiedAt ? new Date(record.lastVerifiedAt) : null,
    grantCallsId: record.grantCallsId,
    registrationCallsId: record.registrationCallsId,
    registrationTxHash: record.registrationTxHash,
    revokeCallsId: record.revokeCallsId,
    revokeTxHash: record.revokeTxHash,
    publicMetadata: record.publicMetadata as Record<string, unknown> | null,
    permissions: record.permissions.map((permission) => ({
      kind: permission.kind,
      targetAddress: permission.targetAddress,
      functionSelector: permission.functionSelector,
      functionSignature: permission.functionSignature,
      tokenAddress: permission.tokenAddress,
      spendCapRaw: permission.spendCapRaw,
      spendPeriod: permission.spendPeriod,
      enabled: permission.enabled,
    })),
    hasEncryptedSecret: record.hasEncryptedSecret,
  };
}

export function createMemorySessionStore(): SessionStore & { rows: Map<string, MemorySessionRow>; audits: SessionAuditInput[] } {
  const rows = new Map<string, MemorySessionRow>();
  const audits: SessionAuditInput[] = [];
  /** X.49: granted-but-not-yet-confirmed reservations, keyed `${sessionId}:${window}`, amount in raw units. */
  const pending = new Map<string, bigint>();

  return {
    rows,
    audits,

    async createSession(input) {
      const row: MemorySessionRow = {
        id: randomUUID(),
        userId: input.userId,
        walletId: input.walletId,
        chainId: input.chainId,
        walletAddress: "",
        publicKey: "",
        keyId: "",
        dbStatus: LIFECYCLE_TO_DB_STATUS.creating,
        keyStoreActive: false,
        createdAt: input.now,
        updatedAt: input.now,
        expiresAt: new Date(0),
        revokedAt: null,
        lastVerifiedAt: null,
        grantCallsId: null,
        registrationCallsId: null,
        registrationTxHash: null,
        revokeCallsId: null,
        revokeTxHash: null,
        publicMetadata: null,
        permissions: [],
        hasEncryptedSecret: false,
      };
      rows.set(row.id, row);
      return { id: row.id };
    },

    async updateSession(input) {
      const row = rows.get(input.id);
      if (!row) throw new Error(`X.45 memory store: session ${input.id} not found.`);
      if (input.patch.status !== undefined) row.dbStatus = LIFECYCLE_TO_DB_STATUS[input.patch.status];
      if (input.patch.keyStoreActive !== undefined) row.keyStoreActive = input.patch.keyStoreActive;
      if (input.patch.revokedAt !== undefined) row.revokedAt = input.patch.revokedAt ? new Date(input.patch.revokedAt) : null;
      if (input.patch.lastVerifiedAt !== undefined) row.lastVerifiedAt = input.patch.lastVerifiedAt ? new Date(input.patch.lastVerifiedAt) : null;
      if (input.patch.grantCallsId !== undefined) row.grantCallsId = input.patch.grantCallsId ?? null;
      if (input.patch.registrationCallsId !== undefined) row.registrationCallsId = input.patch.registrationCallsId ?? null;
      if (input.patch.registrationTxHash !== undefined) row.registrationTxHash = input.patch.registrationTxHash ?? null;
      if (input.patch.revokeCallsId !== undefined) row.revokeCallsId = input.patch.revokeCallsId ?? null;
      if (input.patch.revokeTxHash !== undefined) row.revokeTxHash = input.patch.revokeTxHash ?? null;
      if (input.patch.walletAddress !== undefined) row.walletAddress = input.patch.walletAddress;
      if (input.patch.publicKey !== undefined) row.publicKey = input.patch.publicKey;
      if (input.patch.keyId !== undefined) row.keyId = input.patch.keyId;
      if (input.patch.expiresAt !== undefined) row.expiresAt = new Date(input.patch.expiresAt);
      if (input.patch.publicMetadata !== undefined) row.publicMetadata = input.patch.publicMetadata as Record<string, unknown> | null;
      if (input.patch.hasEncryptedSecret !== undefined) row.hasEncryptedSecret = input.patch.hasEncryptedSecret;
      row.updatedAt = input.now;
    },

    async savePermissions(input) {
      const row = rows.get(input.sessionId);
      if (!row) throw new Error(`X.45 memory store: session ${input.sessionId} not found.`);
      row.permissions = input.permissions.map((permission) => ({ ...permission }));
    },

    async loadLatestForWallet(input) {
      const candidates = [...rows.values()]
        .filter((row) => row.userId === input.userId && row.walletId === input.walletId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const latest = candidates[0];
      return latest ? toSessionRecord(latest) : null;
    },

    async loadById(input) {
      const row = rows.get(input.id);
      return row ? toSessionRecord(row) : null;
    },

    /**
     * X.49 atomic reservation (memory double). Node is single-threaded, so the
     * check-and-increment below runs as an uninterruptible critical section —
     * no await occurs between reading usage and committing the reservation.
     */
    async tryReserveSpend(input): Promise<SpendReservationAttempt> {
      const row = rows.get(input.sessionId);
      if (!row) throw new Error(`X.49 memory store: session ${input.sessionId} not found.`);
      const window = utcDayWindow(input.now);
      const meta = (row.publicMetadata ?? {}) as Record<string, unknown>;
      // Window rollover rollup: stale buckets contribute zero confirmed usage.
      const confirmedWindow =
        typeof meta.spentWindow === "string" &&
        meta.spentWindow === window &&
        typeof meta.spentRaw === "string"
          ? BigInt(meta.spentRaw)
          : 0n;
      const key = `${input.sessionId}:${window}`;
      const reservedNow = pending.get(key) ?? 0n;
      const attempt: SpendReservationAttempt = {
        allowed: confirmedWindow + reservedNow + input.amountRaw <= input.capRaw,
        windowSpentRaw: confirmedWindow.toString(),
        pendingRaw: reservedNow.toString(),
        amountRaw: input.amountRaw.toString(),
      };
      if (attempt.allowed) pending.set(key, reservedNow + input.amountRaw);
      return attempt;
    },

    /** X.49 reservation settlement — atomic single-threaded update. */
    async settleReservation(input) {
      const row = rows.get(input.sessionId);
      if (!row) throw new Error(`X.49 memory store: session ${input.sessionId} not found.`);
      const window = utcDayWindow(input.now);
      const key = `${input.sessionId}:${window}`;
      const reserved = pending.get(key) ?? 0n;
      if (input.mode === "released" || input.mode === "confirmed") {
        pending.set(key, reserved - input.amountRaw > 0n ? reserved - input.amountRaw : 0n);
      }
      if (input.mode === "confirmed") {
        const meta = (row.publicMetadata ?? {}) as Record<string, unknown>;
        const confirmed =
          typeof meta.spentWindow === "string" &&
          meta.spentWindow === window &&
          typeof meta.spentRaw === "string"
            ? BigInt(meta.spentRaw)
            : 0n;
        row.publicMetadata = { ...meta, spentRaw: (confirmed + input.amountRaw).toString(), spentWindow: window, lastSpentAt: input.now.toISOString() };
      }
    },

    async writeAudit(input) {
      audits.push(input);
    },
  };
}
