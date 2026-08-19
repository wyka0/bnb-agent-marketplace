import { aadMetadataMatches } from "./aad.ts";
import { decryptSecret, encryptSecret } from "./envelope.ts";
import { errorCode, OwnershipError, SecretAlreadyExistsError, SecretDestroyedError, SecretNotFoundError, SessionNotFoundError, AadMismatchError } from "./errors.ts";
import type { AadMetadata, CustodyAuditResult, CustodyOwner, CustodyPersistence, EncryptedSecretRecord, EncryptedSecretType, KmsProvider, SessionBinding } from "./types.ts";

type OperationContext = { owner: CustodyOwner; sessionId: string; chainId: number; userId: string };

function auditContext(context: OperationContext, eventType: string, result: CustodyAuditResult, safeMetadata?: Record<string, string | number | boolean | null>) {
  return {
    eventType,
    result,
    userId: context.userId,
    sessionId: context.sessionId,
    chainId: context.chainId,
    walletAddress: context.owner.walletAddress,
    safeMetadata,
  };
}

async function requireSessionOwner(
  persistence: CustodyPersistence,
  owner: CustodyOwner,
  sessionId: string,
  eventType: string
): Promise<SessionBinding & OperationContext> {
  const session = await persistence.loadSession(sessionId);
  if (!session) {
    await persistence.writeAudit(
      auditContext({ owner, sessionId, chainId: 0, userId: owner.userId }, eventType, "DENIED", { reason: "session-not-found" })
    );
    throw new SessionNotFoundError("altana session not found");
  }
  if (session.userId !== owner.userId) {
    await persistence.writeAudit(
      auditContext({ owner, sessionId, chainId: session.chainId, userId: owner.userId }, eventType, "DENIED", { reason: "ownership-mismatch" })
    );
    throw new OwnershipError("encrypted secret is not owned by the authenticated user");
  }
  return { ...session, owner, sessionId };
}

/**
 * X.44 custody service. Pure logic over an injectable persistence boundary;
 * production wiring lives in the server-only entry (./index.ts). Every
 * operation derives ownership from the authenticated owner passed in — the
 * server only ever obtains that from the X.43 session, never from the client.
 */
export async function encryptAltanaSecret(input: {
  persistence: CustodyPersistence;
  provider: KmsProvider;
  owner: CustodyOwner;
  sessionId: string;
  plaintext: Buffer;
  secretType?: EncryptedSecretType;
  now?: Date;
}): Promise<{ encryptedSecretId: string }> {
  const now = input.now ?? new Date();
  const session = await requireSessionOwner(input.persistence, input.owner, input.sessionId, "ALTANA_SECRET_ENCRYPTED");
  const existing = await input.persistence.loadSecret(input.sessionId);
  if (existing && !existing.destroyedAt) {
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_ENCRYPTED", "DENIED", { secretType: existing.secretType, reason: "already-exists" })
    );
    throw new SecretAlreadyExistsError("an active encrypted secret already exists for this session");
  }
  const material = await encryptSecret({
    plaintext: input.plaintext,
    secretType: input.secretType ?? "ALTANA_SESSION_SIGNER",
    userId: session.userId,
    sessionId: input.sessionId,
    chainId: session.chainId,
    provider: input.provider,
  });
  let id: string;
  if (existing) {
    await input.persistence.replaceSecret({ id: existing.id, fields: material, now });
    id = existing.id;
  } else {
    id = (await input.persistence.insertSecret({ sessionId: input.sessionId, fields: material, now })).id;
  }
  await input.persistence.writeAudit(
    auditContext(session, "ALTANA_SECRET_ENCRYPTED", "SUCCESS", { secretType: material.secretType, kmsKeyId: material.kmsKeyId })
  );
  return { encryptedSecretId: id };
}

export async function decryptAltanaSecret(input: {
  persistence: CustodyPersistence;
  provider: KmsProvider;
  owner: CustodyOwner;
  sessionId: string;
}): Promise<Buffer> {
  const session = await requireSessionOwner(input.persistence, input.owner, input.sessionId, "ALTANA_SECRET_DECRYPTED");
  const record = await input.persistence.loadSecret(input.sessionId);
  if (!record) {
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_DECRYPTED", "DENIED", { reason: "secret-not-found" })
    );
    throw new SecretNotFoundError("no encrypted secret exists for this session");
  }
  if (record.destroyedAt) {
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_DECRYPTED", "DENIED", { secretType: record.secretType, reason: "secret-destroyed" })
    );
    throw new SecretDestroyedError("encrypted secret has been destroyed");
  }
  const expected: AadMetadata = {
    secretType: record.secretType,
    userId: session.userId,
    sessionId: input.sessionId,
    chainId: session.chainId,
  };
  if (!aadMetadataMatches(record, expected)) {
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_DECRYPT_FAILED", "FAILURE", { secretType: record.secretType, reason: "aad-mismatch" })
    );
    throw new AadMismatchError("ciphertext context does not match this session");
  }
  try {
    const plaintext = await decryptSecret({ record, provider: input.provider });
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_DECRYPTED", "SUCCESS", { secretType: record.secretType })
    );
    return plaintext;
  } catch (error) {
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_DECRYPT_FAILED", "FAILURE", { secretType: record.secretType, reason: errorCode(error) })
    );
    throw error;
  }
}

export async function destroyAltanaSecret(input: {
  persistence: CustodyPersistence;
  owner: CustodyOwner;
  sessionId: string;
  now?: Date;
}): Promise<{ destroyedAt: Date }> {
  const now = input.now ?? new Date();
  const session = await requireSessionOwner(input.persistence, input.owner, input.sessionId, "ALTANA_SECRET_DESTROYED");
  const record = await input.persistence.loadSecret(input.sessionId);
  if (!record) {
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_DESTROYED", "DENIED", { reason: "secret-not-found" })
    );
    throw new SecretNotFoundError("no encrypted secret exists for this session");
  }
  if (record.destroyedAt) return { destroyedAt: record.destroyedAt };
  await input.persistence.markDestroyed(record.id, now);
  await input.persistence.writeAudit(
    auditContext(session, "ALTANA_SECRET_DESTROYED", "SUCCESS", { secretType: record.secretType })
  );
  return { destroyedAt: now };
}

export async function rotateAltanaSecret(input: {
  persistence: CustodyPersistence;
  oldProvider: KmsProvider;
  newProvider: KmsProvider;
  owner: CustodyOwner;
  sessionId: string;
  now?: Date;
}): Promise<{ kmsKeyId: string; kmsKeyVersion: string }> {
  const now = input.now ?? new Date();
  const session = await requireSessionOwner(input.persistence, input.owner, input.sessionId, "ALTANA_SECRET_ROTATION_STARTED");
  const record = await input.persistence.loadSecret(input.sessionId);
  if (!record || record.destroyedAt) {
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_ROTATION_FAILED", "FAILURE", { reason: record ? "secret-destroyed" : "secret-not-found" })
    );
    throw record ? new SecretDestroyedError("encrypted secret has been destroyed") : new SecretNotFoundError("no encrypted secret exists for this session");
  }
  await input.persistence.writeAudit(
    auditContext(session, "ALTANA_SECRET_ROTATION_STARTED", "SUCCESS", { secretType: record.secretType, kmsKeyId: record.kmsKeyId })
  );
  try {
    const plaintext = await decryptSecret({ record, provider: input.oldProvider });
    const material = await encryptSecret({
      plaintext,
      secretType: record.secretType,
      userId: session.userId,
      sessionId: input.sessionId,
      chainId: session.chainId,
      provider: input.newProvider,
    });
    await input.persistence.replaceCiphertext({ id: record.id, fields: material, now });
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_ROTATION_COMPLETED", "SUCCESS", { secretType: material.secretType, kmsKeyId: material.kmsKeyId, kmsKeyVersion: material.kmsKeyVersion })
    );
    return { kmsKeyId: material.kmsKeyId, kmsKeyVersion: material.kmsKeyVersion };
  } catch (error) {
    await input.persistence.writeAudit(
      auditContext(session, "ALTANA_SECRET_ROTATION_FAILED", "FAILURE", { secretType: record.secretType, reason: errorCode(error) })
    );
    throw error;
  }
}

export type { EncryptedSecretRecord };
