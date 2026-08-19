import { CustodyConfigError } from "../errors.ts";

export type ResolvedKmsConfig =
  | { kind: "test" }
  | { kind: "aws"; region: string; keyId: string };

/**
 * Resolve KMS provider configuration from environment. Fail-closed:
 * - missing AWS config -> CustodyConfigError
 * - unknown provider -> CustodyConfigError
 * - test provider requested in production -> CustodyConfigError
 */
export function resolveKmsConfig(env: Record<string, string | undefined>): ResolvedKmsConfig {
  const provider = env.ALTANA_KMS_PROVIDER ?? "aws";
  const nodeEnv = env.NODE_ENV ?? "development";

  if (provider === "test") {
    if (nodeEnv === "production") {
      throw new CustodyConfigError("the test KMS provider is forbidden in production");
    }
    return { kind: "test" };
  }
  if (provider !== "aws") {
    throw new CustodyConfigError(`unknown KMS provider: ${provider}`);
  }

  const region = env.AWS_REGION?.trim();
  const keyId = env.ALTANA_KMS_KEY_ID?.trim();
  if (!region || !keyId) {
    throw new CustodyConfigError("AWS_REGION and ALTANA_KMS_KEY_ID are required when ALTANA_KMS_PROVIDER=aws");
  }
  return { kind: "aws", region, keyId };
}
