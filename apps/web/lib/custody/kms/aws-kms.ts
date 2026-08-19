import "server-only";
import {
  DecryptCommand,
  DescribeKeyCommand,
  EncryptCommand,
  KMSClient,
  type KeySpec,
} from "@aws-sdk/client-kms";
import { CustodyConfigError, KmsAccessError, KmsFailureError, KmsKeyError } from "../errors.ts";
import type { KmsProvider, WrappedDataKey } from "../types.ts";

type AwsKeyMetadata = { keyId: string; keyVersion: string; algorithm: string };

/**
 * AWS KMS provider. Consumes a customer-managed KMS key identifier from
 * server-only configuration (ALTANA_KMS_KEY_ID); the key itself is provisioned
 * out-of-band and never created from application code.
 */
export class AwsKmsProvider implements KmsProvider {
  readonly providerName = "aws" as const;
  private readonly client: KMSClient;
  private readonly keyId: string;
  private metadata: AwsKeyMetadata | null = null;

  constructor(config: { region: string; keyId: string }) {
    if (!config.region || !config.keyId) {
      throw new CustodyConfigError("AWS region and KMS key id are required for the AWS KMS provider");
    }
    this.client = new KMSClient({ region: config.region });
    this.keyId = config.keyId;
  }

  async getKeyMetadata(): Promise<AwsKeyMetadata> {
    if (this.metadata) return this.metadata;
    let result;
    try {
      result = await this.client.send(new DescribeKeyCommand({ KeyId: this.keyId }));
    } catch (error) {
      throw this.mapAwsError(error, "describe");
    }
    const meta = result.KeyMetadata;
    if (!meta?.Arn) throw new KmsKeyError("KMS key metadata is unavailable");
    this.metadata = {
      keyId: meta.Arn,
      keyVersion: meta.Arn,
      algorithm: meta.KeySpec === undefined ? "SYMMETRIC_DEFAULT" : (meta.KeySpec as KeySpec),
    };
    return this.metadata;
  }

  async wrapDataKey(dataKey: Buffer): Promise<WrappedDataKey> {
    const metadata = await this.getKeyMetadata();
    let result;
    try {
      result = await this.client.send(new EncryptCommand({ KeyId: this.keyId, Plaintext: dataKey }));
    } catch (error) {
      throw this.mapAwsError(error, "encrypt");
    }
    if (!result.CiphertextBlob) throw new KmsFailureError("KMS encrypt returned no ciphertext");
    return {
      wrappedKey: Buffer.from(result.CiphertextBlob),
      keyId: metadata.keyId,
      keyVersion: metadata.keyVersion,
      algorithm: metadata.algorithm,
    };
  }

  async unwrapDataKey(wrappedKey: Buffer): Promise<Buffer> {
    let result;
    try {
      result = await this.client.send(new DecryptCommand({ KeyId: this.keyId, CiphertextBlob: wrappedKey }));
    } catch (error) {
      throw this.mapAwsError(error, "decrypt");
    }
    if (!result.Plaintext) throw new KmsFailureError("KMS decrypt returned no plaintext");
    return Buffer.from(result.Plaintext);
  }

  private mapAwsError(error: unknown, operation: string): CustodyConfigError | KmsAccessError | KmsKeyError | KmsFailureError {
    const name =
      typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
    if (name === "AccessDeniedException") return new KmsAccessError("KMS access denied");
    if (
      name === "NotFoundException" ||
      name === "InvalidKeyIdException" ||
      name === "DisabledException" ||
      name === "KMSInvalidStateException"
    ) {
      return new KmsKeyError("KMS key is unavailable");
    }
    return new KmsFailureError(`KMS ${operation} failed`);
  }
}
