import "server-only";
import { prisma } from "@/lib/prisma/client.server";
import { RecordMalformedError } from "./errors.ts";
import type { AadMetadata, CustodyAuditInput, CustodyPersistence, EncryptedSecretRecord, SecretMaterialFields } from "./types.ts";

function parseAadMetadata(value: unknown): AadMetadata {
  if (
    typeof value === "object" &&
    value !== null &&
    "secretType" in value &&
    "userId" in value &&
    "sessionId" in value &&
    "chainId" in value
  ) {
    const candidate = value as Record<string, unknown>;
    if (
      candidate.secretType === "ALTANA_SESSION_SIGNER" &&
      typeof candidate.userId === "string" &&
      typeof candidate.sessionId === "string" &&
      typeof candidate.chainId === "number"
    ) {
      return {
        secretType: candidate.secretType,
        userId: candidate.userId,
        sessionId: candidate.sessionId,
        chainId: candidate.chainId,
      };
    }
  }
  throw new RecordMalformedError("encrypted secret record has malformed AAD metadata");
}

/** Node crypto produces ArrayBuffer-backed Buffers; Prisma Bytes wants Uint8Array<ArrayBuffer>. */
function toBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const buffer = value.buffer as ArrayBuffer;
  return new Uint8Array(buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
}

function toData(input: SecretMaterialFields) {
  return {
    secretType: input.secretType,
    ciphertext: toBytes(input.ciphertext),
    nonce: toBytes(input.nonce),
    authenticationTag: toBytes(input.authenticationTag),
    wrappedDataKey: toBytes(input.wrappedDataKey),
    kmsKeyId: input.kmsKeyId,
    kmsKeyVersion: input.kmsKeyVersion,
    algorithm: input.algorithm,
    aadMetadata: {
      secretType: input.secretType,
      userId: input.userId,
      sessionId: input.sessionId,
      chainId: input.chainId,
    },
    aadVersion: input.aadVersion,
  };
}

export const prismaCustodyPersistence: CustodyPersistence = {
  loadSession(sessionId) {
    return prisma.altanaSession
      .findUnique({ where: { id: sessionId }, select: { id: true, userId: true, chainId: true } })
      .then((row) => (row ? { id: row.id, userId: row.userId, chainId: row.chainId } : null));
  },

  async loadSecret(sessionId) {
    const row = await prisma.encryptedSecret.findUnique({ where: { sessionId } });
    if (!row) return null;
    const aad = parseAadMetadata(row.aadMetadata);
    if (aad.sessionId !== row.sessionId) {
      throw new RecordMalformedError("encrypted secret record has a session mismatch in AAD metadata");
    }
    const record: EncryptedSecretRecord = {
      id: row.id,
      secretType: row.secretType,
      userId: aad.userId,
      sessionId: aad.sessionId,
      chainId: aad.chainId,
      ciphertext: Buffer.from(row.ciphertext),
      nonce: Buffer.from(row.nonce),
      authenticationTag: Buffer.from(row.authenticationTag),
      wrappedDataKey: Buffer.from(row.wrappedDataKey),
      kmsKeyId: row.kmsKeyId,
      kmsKeyVersion: row.kmsKeyVersion,
      algorithm: row.algorithm,
      aadVersion: row.aadVersion,
      destroyedAt: row.destroyedAt,
    };
    return record;
  },

  async insertSecret(input) {
    const row = await prisma.encryptedSecret.create({
      data: { sessionId: input.sessionId, ...toData(input.fields), createdAt: input.now, updatedAt: input.now },
      select: { id: true },
    });
    return { id: row.id };
  },

  replaceSecret(input) {
    return prisma.encryptedSecret.update({
      where: { id: input.id },
      data: { ...toData(input.fields), destroyedAt: null, updatedAt: input.now },
    }).then(() => undefined);
  },

  replaceCiphertext(input) {
    return prisma.encryptedSecret.update({
      where: { id: input.id },
      data: { ...toData(input.fields), updatedAt: input.now },
    }).then(() => undefined);
  },

  markDestroyed(id, at) {
    return prisma.encryptedSecret.update({ where: { id }, data: { destroyedAt: at, updatedAt: at } }).then(() => undefined);
  },

  writeAudit(input: CustodyAuditInput) {
    return prisma.auditEvent.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        eventType: input.eventType,
        result: input.result,
        actorType: "USER",
        actorIdentifier: input.walletAddress ?? null,
        resourceType: "ALTANA_SESSION",
        resourceId: input.sessionId,
        chainId: input.chainId,
        safeMetadata: input.safeMetadata,
      },
    }).then(() => undefined);
  },
};
