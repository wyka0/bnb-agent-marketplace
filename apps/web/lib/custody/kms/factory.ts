import "server-only";
import { resolveKmsConfig } from "./config.ts";
import { AwsKmsProvider } from "./aws-kms.ts";
import { TestKmsProvider } from "./test-kms.ts";
import type { KmsProvider } from "../types.ts";

/**
 * Single entry point for KMS provider construction. Providers are
 * interchangeable behind KmsProvider; Altana session logic never touches the
 * provider SDK directly. Selection is fail-closed: the test adapter can never
 * be selected in production (see resolveKmsConfig and TestKmsProvider).
 */
export function createKmsProvider(env: Record<string, string | undefined> = process.env): KmsProvider {
  const resolved = resolveKmsConfig(env);
  if (resolved.kind === "test") return new TestKmsProvider();
  return new AwsKmsProvider({ region: resolved.region, keyId: resolved.keyId });
}
