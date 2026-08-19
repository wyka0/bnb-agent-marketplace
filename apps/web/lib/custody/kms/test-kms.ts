import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { CustodyConfigError, KmsAccessError, KmsKeyError, WrappedKeyCorruptionError } from "../errors.ts";
import type { KmsProvider, WrappedDataKey } from "../types.ts";

const WRAP_ALGORITHM = "aes-256-gcm";
const WRAP_KEY = createHash("sha256").update("bnb-marketplace TEST-ONLY KMS adapter fixture material — never used in production").digest();
const FIXTURE_KEY_ID = "test-kms-key";
const FIXTURE_KEY_VERSION = "test-v1";
const FIXTURE_ALGORITHM = "TEST_AES_256_GCM";

export type TestKmsFailure = "none" | "access-denied" | "unknown-key" | "corrupt-unwrap";

/**
 * Test-only KMS adapter with the exact same interface as the production AWS
 * provider. Never selectable in production: the constructor throws when
 * NODE_ENV=production, and resolveKmsConfig rejects ALTANA_KMS_PROVIDER=test
 * in production.
 */
export class TestKmsProvider implements KmsProvider {
  readonly providerName = "test" as const;
  private readonly failure: TestKmsFailure;

  constructor(options: { failure?: TestKmsFailure } = {}) {
    if (process.env.NODE_ENV === "production") {
      throw new CustodyConfigError("the test KMS adapter cannot be constructed in production");
    }
    this.failure = options.failure ?? "none";
  }

  async getKeyMetadata(): Promise<{ keyId: string; keyVersion: string; algorithm: string }> {
    return { keyId: FIXTURE_KEY_ID, keyVersion: FIXTURE_KEY_VERSION, algorithm: FIXTURE_ALGORITHM };
  }

  async wrapDataKey(dataKey: Buffer): Promise<WrappedDataKey> {
    if (this.failure === "access-denied") throw new KmsAccessError("simulated KMS access denied");
    if (this.failure === "unknown-key") throw new KmsKeyError("simulated unknown KMS key");
    const nonce = randomBytes(12);
    const cipher = createCipheriv(WRAP_ALGORITHM, WRAP_KEY, nonce);
    const body = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      wrappedKey: Buffer.concat([nonce, body, tag]),
      keyId: FIXTURE_KEY_ID,
      keyVersion: FIXTURE_KEY_VERSION,
      algorithm: FIXTURE_ALGORITHM,
    };
  }

  async unwrapDataKey(wrappedKey: Buffer): Promise<Buffer> {
    if (this.failure === "access-denied") throw new KmsAccessError("simulated KMS access denied");
    if (this.failure === "unknown-key") throw new KmsKeyError("simulated unknown KMS key");
    let blob = wrappedKey;
    if (this.failure === "corrupt-unwrap") {
      if (blob.length === 0) throw new WrappedKeyCorruptionError("wrapped key is malformed");
      const flipped = Buffer.from(blob);
      const last = flipped[flipped.length - 1];
      if (last === undefined) throw new WrappedKeyCorruptionError("wrapped key is malformed");
      flipped[flipped.length - 1] = last ^ 0xff;
      blob = flipped;
    }
    if (blob.length < 12 + 16) throw new WrappedKeyCorruptionError("wrapped key is malformed");
    const nonce = blob.subarray(0, 12);
    const tag = blob.subarray(blob.length - 16);
    const body = blob.subarray(12, blob.length - 16);
    const decipher = createDecipheriv(WRAP_ALGORITHM, WRAP_KEY, nonce);
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([decipher.update(body), decipher.final()]);
    } catch {
      throw new WrappedKeyCorruptionError("wrapped key authentication failed");
    }
  }
}
