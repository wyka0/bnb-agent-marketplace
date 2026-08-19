import type { AadMetadata } from "./types.ts";

/**
 * Canonical, deterministic AAD encoding.
 *
 * The encoding embeds the AAD version so that any change to the format or the
 * bound context invalidates every previously sealed ciphertext (fail closed).
 * Field order is fixed; no user-controlled formatting is involved.
 */
export function encodeAad(version: number, metadata: AadMetadata): Buffer {
  const lines = [
    `aadVersion=${version}`,
    `secretType=${metadata.secretType}`,
    `userId=${metadata.userId}`,
    `sessionId=${metadata.sessionId}`,
    `chainId=${metadata.chainId}`,
  ];
  return Buffer.from(lines.join("\n"), "utf8");
}

export function aadMetadataMatches(record: AadMetadata, expected: AadMetadata): boolean {
  return (
    record.secretType === expected.secretType &&
    record.userId === expected.userId &&
    record.sessionId === expected.sessionId &&
    record.chainId === expected.chainId
  );
}
