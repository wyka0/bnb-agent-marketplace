import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AeadError, RecordMalformedError } from "./errors.ts";

export const AEAD_ALGORITHM = "aes-256-gcm";
export const AEAD_KEY_BYTES = 32;
export const AEAD_NONCE_BYTES = 12;
export const AEAD_TAG_BYTES = 16;

export type SealedPayload = {
  ciphertext: Buffer;
  nonce: Buffer;
  authenticationTag: Buffer;
};

/**
 * AES-256-GCM seal. A fresh random 96-bit nonce is generated per call unless
 * one is supplied (tests only). The AAD is bound into the authentication tag.
 */
export function seal(plaintext: Buffer, dataKey: Buffer, aad: Buffer): SealedPayload {
  const nonce = randomBytes(AEAD_NONCE_BYTES);
  if (dataKey.length !== AEAD_KEY_BYTES) throw new RecordMalformedError("data key must be exactly 32 bytes");
  if (nonce.length !== AEAD_NONCE_BYTES) throw new RecordMalformedError("nonce must be exactly 12 bytes");
  const cipher = createCipheriv(AEAD_ALGORITHM, dataKey, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  return { ciphertext, nonce, authenticationTag };
}

/**
 * AES-256-GCM open. The authentication tag is verified by the cipher before
 * any plaintext is returned; any failure (bad tag, tampered ciphertext/nonce,
 * AAD mismatch) throws and never yields plaintext.
 */
export function open(
  ciphertext: Buffer,
  nonce: Buffer,
  authenticationTag: Buffer,
  dataKey: Buffer,
  aad: Buffer
): Buffer {
  if (dataKey.length !== AEAD_KEY_BYTES) throw new RecordMalformedError("data key must be exactly 32 bytes");
  if (nonce.length !== AEAD_NONCE_BYTES) throw new RecordMalformedError("nonce is corrupt: expected 12 bytes");
  if (authenticationTag.length !== AEAD_TAG_BYTES) throw new AeadError("authentication tag is corrupt");
  try {
    const decipher = createDecipheriv(AEAD_ALGORITHM, dataKey, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(authenticationTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new AeadError("authenticated decryption failed");
  }
}
