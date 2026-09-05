import "server-only";
import { prisma } from "@/lib/prisma/client.server";
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

/**
 * X.49: shape of the spend ledger inside `publicMetadata` (Json). Kept flat
 * and JSON-path addressable so the row-locked transaction can read/write it
 * atomically. Stale window buckets contribute zero confirmed usage until the
 * next confirmed settle rolls them forward.
 */
type SpendLedger = { spentRaw?: string; spentWindow?: string; pendingRaw?: string; pendingWindow?: string };

function readLedger(meta: unknown): SpendLedger {
  return (meta ?? {}) as SpendLedger;
}

function windowOf(ledger: SpendLedger, key: "spentWindow" | "pendingWindow"): string {
  const value = ledger[key];
  return typeof value === "string" ? value : "";
}

function confirmedFor(ledger: SpendLedger, window: string): bigint {
  return windowOf(ledger, "spentWindow") === window ? BigInt(ledger.spentRaw ?? "0") : 0n;
}

function pendingFor(ledger: SpendLedger, window: string): bigint {
  return windowOf(ledger, "pendingWindow") === window ? BigInt(ledger.pendingRaw ?? "0") : 0n;
}

type AltanaSessionRow = Awaited<ReturnType<typeof loadRawRow>>;

async function loadRawRow(id: string) {
  return prisma.altanaSession.findUnique({
    where: { id },
    include: {
      permissions: { orderBy: { createdAt: "asc" } },
      encryptedSecret: { select: { id: true } },
    },
  });
}

function toSessionRecord(row: AltanaSessionRow): SessionRecord {
  if (!row) throw new Error("X.45 prisma store: session row missing.");
  const dbStatus = DB_STATUS_TO_LIFECYCLE[row.status] ?? "grantSubmitted";
  const permissions: SessionPermissionRow[] = row.permissions.map((permission) => ({
    id: permission.id,
    kind: permission.kind,
    targetAddress: permission.targetAddress,
    functionSelector: permission.functionSelector,
    functionSignature: permission.functionSignature,
    tokenAddress: permission.tokenAddress,
    spendCapRaw: permission.spendCapRaw?.toString() ?? null,
    spendPeriod: (permission.spendPeriod ?? null) as SessionPermissionRow["spendPeriod"],
    expiresAt: permission.expiresAt?.toISOString() ?? null,
    enabled: permission.enabled,
    revokedAt: permission.revokedAt?.toISOString() ?? null,
  }));
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
    publicMetadata: (row.publicMetadata as SessionRecord["publicMetadata"] | null) ?? null,
    permissions,
    hasEncryptedSecret: row.encryptedSecret !== null,
  };
}

export const prismaSessionStore: SessionStore = {
  createSession(input) {
    return prisma.altanaSession.create({
      data: {
        userId: input.userId,
        walletId: input.walletId,
        chainId: input.chainId,
        sessionIdentifier: `a45:${input.chainId}:${input.walletId}:${input.now.getTime().toString(36)}:${Math.random().toString(36).slice(2, 10)}`,
        walletAddress: "",
        publicKey: "",
        keyId: "",
        status: LIFECYCLE_TO_DB_STATUS.creating,
        expiresAt: new Date(0),
        createdAt: input.now,
        updatedAt: input.now,
      },
      select: { id: true },
    });
  },

  async updateSession(input) {
    const patch = input.patch;
    const data: Record<string, unknown> = { updatedAt: input.now };
    if (patch.status !== undefined) data.status = LIFECYCLE_TO_DB_STATUS[patch.status];
    if (patch.keyStoreActive !== undefined) data.keyStoreActive = patch.keyStoreActive;
    if (patch.revokedAt !== undefined) data.revokedAt = patch.revokedAt ? new Date(patch.revokedAt) : null;
    if (patch.lastVerifiedAt !== undefined) data.lastVerifiedAt = patch.lastVerifiedAt ? new Date(patch.lastVerifiedAt) : null;
    if (patch.grantCallsId !== undefined) data.grantCallsId = patch.grantCallsId ?? null;
    if (patch.registrationCallsId !== undefined) data.registrationCallsId = patch.registrationCallsId ?? null;
    if (patch.registrationTxHash !== undefined) data.registrationTxHash = patch.registrationTxHash ?? null;
    if (patch.revokeCallsId !== undefined) data.revokeCallsId = patch.revokeCallsId ?? null;
    if (patch.revokeTxHash !== undefined) data.revokeTxHash = patch.revokeTxHash ?? null;
    if (patch.walletAddress !== undefined) data.walletAddress = patch.walletAddress;
    if (patch.publicKey !== undefined) data.publicKey = patch.publicKey;
    if (patch.keyId !== undefined) data.keyId = patch.keyId;
    if (patch.expiresAt !== undefined) data.expiresAt = new Date(patch.expiresAt);
    if (patch.publicMetadata !== undefined) data.publicMetadata = patch.publicMetadata;
    // hasEncryptedSecret is derived from the encryptedSecret relation; ignored here.
    await prisma.altanaSession.update({ where: { id: input.id }, data });
  },

  async savePermissions(input) {
    await prisma.sessionPermission.createMany({
      data: input.permissions.map((permission) => ({
        sessionId: input.sessionId,
        kind: permission.kind,
        targetAddress: permission.targetAddress,
        functionSelector: permission.functionSelector,
        functionSignature: permission.functionSignature,
        tokenAddress: permission.tokenAddress,
        spendCapRaw: permission.spendCapRaw !== null ? permission.spendCapRaw : null,
        spendPeriod: permission.spendPeriod,
        enabled: permission.enabled,
      })),
    });
  },

  async loadLatestForWallet(input) {
    const row = await prisma.altanaSession.findFirst({
      where: { userId: input.userId, walletId: input.walletId },
      orderBy: { createdAt: "desc" },
      include: {
        permissions: { orderBy: { createdAt: "asc" } },
        encryptedSecret: { select: { id: true } },
      },
    });
    return row ? toSessionRecord(row) : null;
  },

  async loadById(input) {
    const row = await loadRawRow(input.id);
    return row ? toSessionRecord(row) : null;
  },

  /**
   * X.49 atomic spend reservation. Interactive transaction + `SELECT ... FOR
   * UPDATE` row lock: concurrent reservations serialize on the session row, so
   * the check-and-increment of `pendingRaw` is atomic across processes and
   * instances. Caller-provided usage is never trusted; confirmed and reserved
   * figures are re-read inside the lock.
   */
  async tryReserveSpend(input): Promise<SpendReservationAttempt> {
    const window = utcDayWindow(input.now);
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ meta: string }>>`
        SELECT COALESCE("publicMetadata"::TEXT, '{}') AS "meta"
        FROM "AltanaSession"
        WHERE "id" = ${input.sessionId}
        FOR UPDATE`;
      const row = locked[0];
      if (!row) throw new Error("X.49 prisma store: session row missing.");
      const ledger = readLedger(JSON.parse(row.meta));
      const confirmed = confirmedFor(ledger, window);
      const reserved = pendingFor(ledger, window);
      const attempt: SpendReservationAttempt = {
        allowed: confirmed + reserved + input.amountRaw <= input.capRaw,
        windowSpentRaw: confirmed.toString(),
        pendingRaw: reserved.toString(),
        amountRaw: input.amountRaw.toString(),
      };
      if (attempt.allowed) {
        const updated: Record<string, unknown> = {
          ...(ledger as Record<string, unknown>),
          pendingRaw: (reserved + input.amountRaw).toString(),
          pendingWindow: window,
        };
        await tx.altanaSession.update({
          where: { id: input.sessionId },
          data: { publicMetadata: JSON.parse(JSON.stringify(updated)), updatedAt: input.now },
        });
      }
      return attempt;
    });
  },

  /**
   * X.49 settlement under the same row lock. "confirmed" moves the amount
   * from pending into the window's confirmed usage; "released" (pre-broadcast
   * failure only) returns it; "held" (post-broadcast, unconfirmed) leaves it
   * reserved — it is never released blindly, and recovers on window reset.
   */
  async settleReservation(input) {
    const window = utcDayWindow(input.now);
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ meta: string }>>`
        SELECT COALESCE("publicMetadata"::TEXT, '{}') AS "meta"
        FROM "AltanaSession"
        WHERE "id" = ${input.sessionId}
        FOR UPDATE`;
      const row = locked[0];
      if (!row) throw new Error("X.49 prisma store: session row missing.");
      const ledger = readLedger(JSON.parse(row.meta));
      const updated: Record<string, unknown> = { ...(ledger as Record<string, unknown>) };
      if (input.mode === "released" || input.mode === "confirmed") {
        const reserved = pendingFor(ledger, window);
        const remainingReservation = reserved - input.amountRaw;
        updated.pendingRaw = (remainingReservation > 0n ? remainingReservation : 0n).toString();
        updated.pendingWindow = window;
      }
      if (input.mode === "confirmed") {
        const confirmed = confirmedFor(ledger, window);
        updated.spentRaw = (confirmed + input.amountRaw).toString();
        updated.spentWindow = window;
        updated.lastSpentAt = input.now.toISOString();
      }
      await tx.altanaSession.update({
        where: { id: input.sessionId },
        data: { publicMetadata: JSON.parse(JSON.stringify(updated)), updatedAt: input.now },
      });
    });
  },

  writeAudit(input: SessionAuditInput) {
    return prisma.auditEvent.create({
      data: {
        userId: input.userId,
        walletId: input.walletId ?? null,
        sessionId: input.sessionId ?? null,
        eventType: input.eventType,
        result: input.result,
        actorType: "USER",
        actorIdentifier: null,
        resourceType: "ALTANA_SESSION",
        resourceId: input.sessionId ?? null,
        requestId: null,
        chainId: input.chainId ?? null,
        callsId: input.callsId ?? null,
        transactionHash: input.transactionHash ?? null,
        safeMetadata: input.safeMetadata,
      },
    }).then(() => undefined);
  },
};
