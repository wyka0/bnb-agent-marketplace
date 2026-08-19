import { randomBytes } from "node:crypto";
import { encodeAad } from "./aad.ts";
import { open, seal } from "./aead.ts";
import { KmsAccessError, KmsKeyError, WrappedKeyCorruptionError } from "./errors.ts";
import { CUSTODY_AAD_VERSION } from "./types.ts";
import type { EncryptedSecretRecord, EncryptedSecretType, KmsProvider, SecretMaterialFields } from "./types.ts";

const DATA_KEY_BYTES = 32;

/**
 * Envelope encryption: fresh random DEK per record -> AEAD seal with AAD ->
 * KMS wrap of the DEK. No plaintext or DEK leaves this function.
 */
export async function encryptSecret(input: {
  plaintext: Buffer;
  secretType: EncryptedSecretType;
  userId: string;
  sessionId: string;
  chainId: number;
  provider: KmsProvider;
}): Promise<SecretMaterialFields> {
  const dataKey = randomBytes(DATA_KEY_BYTES);
  const aad = encodeAad(CUSTODY_AAD_VERSION, {
    secretType: input.secretType,
    userId: input.userId,
    sessionId: input.sessionId,
    chainId: input.chainId,
  });
  const sealed = seal(input.plaintext, dataKey, aad);
  const wrapped = await input.provider.wrapDataKey(dataKey);
  return {
    secretType: input.secretType,
    ciphertext: sealed.ciphertext,
    nonce: sealed.nonce,
    authenticationTag: sealed.authenticationTag,
    wrappedDataKey: wrapped.wrappedKey,
    kmsKeyId: wrapped.keyId,
    kmsKeyVersion: wrapped.keyVersion,
    algorithm: wrapped.algorithm,
    userId: input.userId,
    sessionId: input.sessionId,
    chainId: input.chainId,
    aadVersion: CUSTODY_AAD_VERSION,
  };
}

/**
 * Envelope decryption: KMS unwrap of the DEK -> AEAD open with the canonical
 * AAD derived from the record. KMS failures are mapped; wrapped-key corruption
 * never falls back to plaintext.
 */
export async function decryptSecret(input: {
  record: EncryptedSecretRecord;
  provider: KmsProvider;
}): Promise<Buffer> {
  let dataKey: Buffer;
  try {
    dataKey = await input.provider.unwrapDataKey(input.record.wrappedDataKey);
  } catch (error) {
    if (error instanceof KmsAccessError || error instanceof KmsKeyError) throw error;
    throw new WrappedKeyCorruptionError("wrapped data key could not be unwrapped");
  }
  if (dataKey.length !== DATA_KEY_BYTES) {
    throw new WrappedKeyCorruptionError("unwrapped data key has an unexpected length");
  }
  const aad = encodeAad(input.record.aadVersion, {
    secretType: input.record.secretType,
    userId: input.record.userId,
    sessionId: input.record.sessionId,
    chainId: input.record.chainId,
  });
  return open(input.record.ciphertext, input.record.nonce, input.record.authenticationTag, dataKey, aad);
}
