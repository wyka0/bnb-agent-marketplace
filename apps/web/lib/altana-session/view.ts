/**
 * X.45 public session view — the ONLY shape a session is ever rendered as.
 *
 * Strictly permissions-safe: never includes the session signer, the private
 * key, the ciphertext, the KMS material, the AAD metadata, or the KeyStore
 * key id. Only on-chain-public facts plus spend accounting are exposed.
 */

import type { SessionPermissionRow, SessionRecord } from "./types.ts";

export type PublicSessionPermissionView = {
  kind: "CALL" | "TOKEN_SPEND" | "NATIVE_SPEND";
  targetAddress: string | null;
  functionSignature: string | null;
  functionSelector: string | null;
  tokenAddress: string | null;
  spendCapRaw: string | null;
  spendPeriod: string | null;
};

export type PublicSessionView = {
  sessionId: string;
  chainId: number;
  walletAddress: string;
  status: string;
  keyStoreActive: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastVerifiedAt: string | null;
  lastReconstructedAt: string | null;
  spentRaw: string;
  remainingRaw: string;
  permissionLimitRaw: string;
  nativeFeeLimitRaw: string | null;
  permissions: PublicSessionPermissionView[];
  grantCallsId: string | null;
  registrationCallsId: string | null;
  registrationTxHash: string | null;
  revokeCallsId: string | null;
  revokeTxHash: string | null;
  agentId: string | null;
  agentName: string | null;
  agentSource: "8004scan" | null;
};

export function toPublicSessionView(record: SessionRecord, spendLimitRaw: bigint): PublicSessionView {
  const spentRaw = BigInt(record.publicMetadata?.spentRaw ?? "0");
  const remaining = spendLimitRaw - spentRaw;
  const permissions: PublicSessionPermissionView[] = record.permissions.map((permission: SessionPermissionRow) => ({
    kind: permission.kind,
    targetAddress: permission.targetAddress,
    functionSignature: permission.functionSignature,
    functionSelector: permission.functionSelector,
    tokenAddress: permission.tokenAddress,
    spendCapRaw: permission.spendCapRaw,
    spendPeriod: permission.spendPeriod,
  }));
  const nativeRow = record.permissions.find((permission: SessionPermissionRow) => permission.kind === "NATIVE_SPEND");
  return {
    sessionId: record.id,
    chainId: record.chainId,
    walletAddress: record.walletAddress,
    status: record.status,
    keyStoreActive: record.keyStoreActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    lastVerifiedAt: record.lastVerifiedAt,
    lastReconstructedAt: record.publicMetadata?.lastReconstructedAt ?? null,
    spentRaw: spentRaw.toString(),
    remainingRaw: (remaining > 0n ? remaining : 0n).toString(),
    permissionLimitRaw: spendLimitRaw.toString(),
    nativeFeeLimitRaw: nativeRow?.spendCapRaw ?? null,
    permissions,
    grantCallsId: record.grantCallsId,
    registrationCallsId: record.registrationCallsId,
    registrationTxHash: record.registrationTxHash,
    revokeCallsId: record.revokeCallsId,
    revokeTxHash: record.revokeTxHash,
    agentId: record.publicMetadata?.agentId ?? null,
    agentName: record.publicMetadata?.agentName ?? null,
    agentSource: record.publicMetadata?.agentSource ?? null,
  };
}
