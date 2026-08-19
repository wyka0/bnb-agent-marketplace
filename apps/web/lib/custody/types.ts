export const ENCRYPTED_SECRET_TYPE = "ALTANA_SESSION_SIGNER" as const;
export type EncryptedSecretType = typeof ENCRYPTED_SECRET_TYPE;

export const CUSTODY_AAD_VERSION = 1 as const;

export type AadMetadata = {
  secretType: EncryptedSecretType;
  userId: string;
  sessionId: string;
  chainId: number;
};

export type SecretMaterialFields = AadMetadata & {
  ciphertext: Buffer;
  nonce: Buffer;
  authenticationTag: Buffer;
  wrappedDataKey: Buffer;
  kmsKeyId: string;
  kmsKeyVersion: string;
  algorithm: string;
  aadVersion: number;
};

export type EncryptedSecretRecord = SecretMaterialFields & {
  id: string;
  destroyedAt: Date | null;
};

export interface WrappedDataKey {
  wrappedKey: Buffer;
  keyId: string;
  keyVersion: string;
  algorithm: string;
}

export interface KmsProvider {
  readonly providerName: "aws" | "test";
  wrapDataKey(dataKey: Buffer): Promise<WrappedDataKey>;
  unwrapDataKey(wrappedKey: Buffer): Promise<Buffer>;
  getKeyMetadata(): Promise<{ keyId: string; keyVersion: string; algorithm: string }>;
}

export interface SessionBinding {
  id: string;
  userId: string;
  chainId: number;
}

export type CustodyAuditResult = "SUCCESS" | "FAILURE" | "DENIED";

export type CustodyAuditInput = {
  eventType: string;
  result: CustodyAuditResult;
  userId: string;
  sessionId: string;
  chainId: number;
  walletAddress?: string;
  safeMetadata?: Record<string, string | number | boolean | null>;
};

export interface CustodyPersistence {
  loadSession(sessionId: string): Promise<SessionBinding | null>;
  loadSecret(sessionId: string): Promise<EncryptedSecretRecord | null>;
  insertSecret(input: { sessionId: string; fields: SecretMaterialFields; now: Date }): Promise<{ id: string }>;
  replaceSecret(input: { id: string; fields: SecretMaterialFields; now: Date }): Promise<void>;
  replaceCiphertext(input: { id: string; fields: SecretMaterialFields; now: Date }): Promise<void>;
  markDestroyed(id: string, at: Date): Promise<void>;
  writeAudit(input: CustodyAuditInput): Promise<void>;
}

export interface CustodyOwner {
  userId: string;
  walletAddress?: string;
}
