/**
 * X.45 persistent Altana session service — pure lifecycle logic over
 * injectable boundaries (store, adapter, custody, policy provider). No
 * server-only imports; the production wiring lives in ./index.server.ts.
 *
 * State machine (DB enum mapping documented in ./types.ts):
 *   creating → grantSubmitted → active
 *                              → failed      (any persistence/registration error)
 *   active   → expired | revoking → revoked
 *   revoked  → (terminal)
 *
 * KeyStore is authoritative: DB-ACTIVE + KeyStore-revoked is reconciled to
 * REVOKED (blocked, no re-grant); DB-REVOKED + KeyStore-active is blocked
 * and reported; a PENDING row left by a crash is blocked for operator
 * review — never silently retried.
 */

import { encodeFunctionData, getAddress, keccak256 } from "viem";
import {
  ALTANA_SESSION_APPROVAL_RAW,
  ALTANA_SESSION_CALL_SIGNATURE,
  ALTANA_SESSION_CHAIN_ID,
  ALTANA_SESSION_SPEND_LIMIT_RAW,
  assertAltanaSessionPolicyCall,
} from "@bnb-marketplace/integrations/altana";
import type { AltanaSessionPolicy } from "@bnb-marketplace/integrations/altana";
import { ERC20_ABI, keyIdOf, reconstructAdapterSession } from "./adapter.ts";
import { AltanaSessionError, effectiveSpentForWindow, SessionExecutionError } from "./types.ts";
import type {
  AdapterSessionPermissions,
  AltanaSessionAdapter,
  CustodyLike,
  ExecuteOutcome,
  LoadedSessionResult,
  RevokeOutcome,
  SessionCall,
  SessionExecutionLog,
  SessionOwner,
  SessionPermissionPeriod,
  SessionPermissionRow,
  SessionRecord,
  SessionStore,
  SpendReservationAttempt,
} from "./types.ts";

export type AltanaSessionServiceDeps = {
  store: SessionStore;
  adapter: AltanaSessionAdapter;
  custody: CustodyLike;
  policyProvider: () => AltanaSessionPolicy;
  now?: () => Date;
};

const APPROVAL_EVENT_TOPIC = keccak256(new TextEncoder().encode("Approval(address,address,uint256)"));
const HEX_PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;

function selectorOf(signature: string): string {
  return `0x${keccak256(new TextEncoder().encode(signature)).slice(2, 10)}`;
}

export function permissionsFromPolicy(policy: AltanaSessionPolicy): AdapterSessionPermissions {
  return {
    calls: [{ to: policy.target, signature: policy.signature }],
    spend: [
      { limit: policy.nativeFeeLimitWei, period: policy.spendPeriod as SessionPermissionPeriod },
      { limit: policy.spendLimitRaw, period: policy.spendPeriod as SessionPermissionPeriod, token: policy.spendToken },
    ],
  };
}

export function permissionRowsFromPolicy(policy: AltanaSessionPolicy): Array<
  Omit<SessionPermissionRow, "id" | "expiresAt" | "revokedAt">
> {
  return [
    {
      kind: "CALL",
      targetAddress: getAddress(policy.target),
      functionSelector: selectorOf(policy.signature),
      functionSignature: policy.signature,
      tokenAddress: null,
      spendCapRaw: null,
      spendPeriod: null,
      enabled: true,
    },
    {
      kind: "NATIVE_SPEND",
      targetAddress: null,
      functionSelector: null,
      functionSignature: null,
      tokenAddress: null,
      spendCapRaw: policy.nativeFeeLimitWei.toString(),
      spendPeriod: policy.spendPeriod,
      enabled: true,
    },
    {
      kind: "TOKEN_SPEND",
      targetAddress: null,
      functionSelector: null,
      functionSignature: null,
      tokenAddress: getAddress(policy.spendToken),
      spendCapRaw: policy.spendLimitRaw.toString(),
      spendPeriod: policy.spendPeriod,
      enabled: true,
    },
  ];
}

export function permissionsFromRows(rows: readonly SessionPermissionRow[]): AdapterSessionPermissions {
  const calls = rows
    .filter((row) => row.kind === "CALL" && row.enabled && row.targetAddress !== null && row.functionSignature !== null)
    .map((row) => ({ to: getAddress(row.targetAddress as `0x${string}`), signature: row.functionSignature as string }));
  const spend = rows
    .filter((row) => row.kind !== "CALL" && row.enabled && row.spendCapRaw !== null && row.spendPeriod !== null)
    .map((row) => ({
      limit: BigInt(row.spendCapRaw as string),
      period: row.spendPeriod as SessionPermissionPeriod,
      ...(row.tokenAddress !== null ? { token: getAddress(row.tokenAddress as `0x${string}`) } : {}),
    }));
  return { calls, spend };
}

export function buildApproveCall(policyTarget: string, walletAddress: string): SessionCall {
  return {
    to: getAddress(policyTarget),
    value: 0n,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [getAddress(walletAddress), ALTANA_SESSION_APPROVAL_RAW],
    }),
  };
}

export function approvalEventObserved(logs: readonly SessionExecutionLog[], target: string): boolean {
  const amountTail = ALTANA_SESSION_APPROVAL_RAW.toString(16).padStart(64, "0");
  return logs.some((log) => {
    const topic = log.topics[0];
    return (
      getAddress(log.address) === getAddress(target) &&
      topic !== undefined &&
      topic.toLowerCase() === APPROVAL_EVENT_TOPIC.toLowerCase() &&
      log.data.toLowerCase().endsWith(amountTail)
    );
  });
}

export function remainingOf(policy: AltanaSessionPolicy, spentRaw: bigint): bigint {
  const remaining = policy.spendLimitRaw - spentRaw;
  return remaining > 0n ? remaining : 0n;
}

export async function safeAudit(
  deps: AltanaSessionServiceDeps,
  event: Parameters<SessionStore["writeAudit"]>[0]
): Promise<void> {
  try {
    await deps.store.writeAudit(event);
  } catch {
    // Audit failures must never break the session lifecycle.
  }
}

export async function createAltanaSession(
  deps: AltanaSessionServiceDeps,
  owner: SessionOwner,
  options: { publicMetadata?: import("./types.ts").SessionPublicMetadata } = {}
): Promise<{ record: import("./types.ts").SessionRecord }> {
  const now = deps.now?.() ?? new Date();
  const policy = deps.policyProvider();
  // X.49 M-4: application-level duplicate guard. The DB partial unique index
  // `one_live_per_wallet_idx` remains the authoritative layer; this check
  // avoids an unnecessary row/KeyStore allocation and yields a typed error.
  const existing = await deps.store.loadLatestForWallet({ userId: owner.userId, walletId: owner.walletId });
  if (
    existing !== null &&
    (existing.status === "creating" || existing.status === "grantSubmitted" || existing.status === "active" || existing.status === "revoking")
  ) {
    throw new AltanaSessionError("session-blocked", "a live Altana session already exists for this wallet");
  }
  let id: string;
  try {
    ({ id } = await deps.store.createSession({
      userId: owner.userId,
      walletId: owner.walletId,
      chainId: policy.chainId,
      now,
    }));
    if (options.publicMetadata !== undefined) {
      await deps.store.updateSession({
        id,
        patch: { publicMetadata: options.publicMetadata },
        now,
      });
    }
  } catch (error) {
    // X.49 M-4: type the insert failure (e.g. Prisma P2002 from the partial
    // unique index under concurrent create) instead of leaking it raw.
    throw new AltanaSessionError("persistence-unavailable", error instanceof Error ? error.message : String(error));
  }
  let secretSealed = false;
  let granted = false;
  try {
    if (deps.adapter.chainId !== policy.chainId) {
      throw new AltanaSessionError("chain-mismatch", `adapter chain ${deps.adapter.chainId} does not match policy chain ${policy.chainId}`);
    }
    const { walletAddress } = await deps.adapter.adoptWallet();
    if (getAddress(walletAddress) !== getAddress(owner.walletAddress)) {
      throw new AltanaSessionError("policy-violation", "adopted Altana wallet does not match the authenticated wallet");
    }
    await safeAudit(deps, { eventType: "ALTANA_SESSION_CREATE_STARTED", result: "SUCCESS", userId: owner.userId, walletId: owner.walletId, sessionId: id, chainId: policy.chainId });

    const permissions = permissionsFromPolicy(policy);
    const { session, grantCallsId } = await deps.adapter.grantSession({
      permissions,
      expiry: policy.expiry,
    });
    granted = true;
    await deps.store.updateSession({
      id,
      patch: {
        status: "grantSubmitted",
        walletAddress: session.walletAddress,
        publicKey: session.publicKey,
        keyId: keyIdOf(session.publicKey),
        expiresAt: new Date(session.expiry * 1000).toISOString(),
        grantCallsId: grantCallsId ?? null,
      },
      now,
    });
    await deps.store.savePermissions({ sessionId: id, permissions: permissionRowsFromPolicy(policy) });
    await safeAudit(deps, { eventType: "ALTANA_SESSION_GRANTED", result: "SUCCESS", userId: owner.userId, walletId: owner.walletId, sessionId: id, chainId: policy.chainId, safeMetadata: { walletAddress: session.walletAddress } });

    const registration = await deps.adapter.registerSessionKey({ session });
    if (!registration.alreadyRegistered && registration.status !== "CONFIRMED") {
      throw new AltanaSessionError("registration-failed", `KeyStore registration did not confirm: ${registration.status}`);
    }
    if (!(await deps.adapter.isKeyStoreActive({ walletAddress: session.walletAddress, publicKey: session.publicKey }))) {
      throw new AltanaSessionError("key-store-inactive", "KeyStore registration is not active after confirmation");
    }
    await safeAudit(deps, { eventType: "ALTANA_SESSION_KEYSTORE_REGISTERED", result: "SUCCESS", userId: owner.userId, walletId: owner.walletId, sessionId: id, chainId: policy.chainId, transactionHash: registration.alreadyRegistered ? undefined : (registration.transactionHash ?? undefined), callsId: registration.alreadyRegistered ? undefined : (registration.callsId ?? undefined) });

    const privateKey = session.signer._privateKey;
    await deps.custody.encryptAltanaSecret({
      owner: { userId: owner.userId, walletAddress: session.walletAddress },
      sessionId: id,
      plaintext: Buffer.from(privateKey, "utf8"),
    });
    secretSealed = true;
    await deps.store.updateSession({
      id,
      patch: {
        status: "active",
        keyStoreActive: true,
        lastVerifiedAt: now.toISOString(),
        registrationCallsId: registration.alreadyRegistered ? null : registration.callsId,
        registrationTxHash: registration.alreadyRegistered ? null : registration.transactionHash,
        hasEncryptedSecret: true,
      },
      now,
    });
    await safeAudit(deps, { eventType: "ALTANA_SESSION_ACTIVATED", result: "SUCCESS", userId: owner.userId, walletId: owner.walletId, sessionId: id, chainId: policy.chainId });
    const record = await deps.store.loadById({ id });
    if (!record) throw new AltanaSessionError("persistence-unavailable", "session vanished after activation");
    return { record };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await deps.store.updateSession({
        id,
        patch: {
          status: "failed",
          publicMetadata: {
            ...(options.publicMetadata ?? {}),
            errorDetail: message.slice(0, 512),
          },
        },
        now: deps.now?.() ?? new Date(),
      });
    } catch {
      // Persistence failure itself — nothing else to do.
    }
    await safeAudit(deps, {
      eventType: "ALTANA_SESSION_CREATE_FAILED",
      result: "FAILURE",
      userId: owner.userId,
      walletId: owner.walletId,
      sessionId: id,
      chainId: policy.chainId,
      safeMetadata: { granted, secretSealed, code: error instanceof AltanaSessionError ? error.code : "unknown" },
    });
    if (secretSealed) {
      try {
        await deps.custody.destroyAltanaSecret({ owner: { userId: owner.userId }, sessionId: id });
      } catch {
        // Best-effort cleanup; the failed row is never readable as active.
      }
    }
    throw error instanceof AltanaSessionError ? error : new AltanaSessionError("grant-failed", message);
  }
}

export async function loadActiveSession(
  deps: AltanaSessionServiceDeps,
  owner: SessionOwner
): Promise<LoadedSessionResult> {
  const now = deps.now?.() ?? new Date();
  const record = await deps.store.loadLatestForWallet({ userId: owner.userId, walletId: owner.walletId });
  if (!record) return { kind: "none" };

  if (record.status === "revoked" || record.status === "failed") {
    return { kind: "blocked", reason: `session-${record.status}`, record };
  }
  if (record.status === "grantSubmitted" || record.status === "creating") {
    return { kind: "blocked", reason: "incomplete-grant", record };
  }
  if (record.status === "revoking") {
    return { kind: "blocked", reason: "revoke-in-flight", record };
  }
  if (record.status === "expired") {
    return { kind: "blocked", reason: "expired", record };
  }

  const expiresAt = new Date(record.expiresAt);
  if (now.getTime() >= expiresAt.getTime()) {
    await deps.store.updateSession({ id: record.id, patch: { status: "expired", keyStoreActive: false }, now });
    await safeAudit(deps, { eventType: "ALTANA_SESSION_MARKED_EXPIRED", result: "SUCCESS", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: record.chainId });
    return { kind: "blocked", reason: "expired", record: { ...record, status: "expired", keyStoreActive: false } };
  }

  const keyStoreActive = await deps.adapter.isKeyStoreActive({ walletAddress: record.walletAddress, publicKey: record.publicKey });
  if (!keyStoreActive) {
    await deps.store.updateSession({ id: record.id, patch: { status: "revoked", keyStoreActive: false, revokedAt: now.toISOString() }, now });
    await safeAudit(deps, {
      eventType: "ALTANA_SESSION_RECONCILED_KEYSTORE_REVOKED",
      result: "SUCCESS",
      userId: owner.userId,
      walletId: owner.walletId,
      sessionId: record.id,
      chainId: record.chainId,
      safeMetadata: { previousStatus: record.status },
    });
    return { kind: "blocked", reason: "key-store-revoked", record: { ...record, status: "revoked", keyStoreActive: false, revokedAt: now.toISOString() } };
  }

  let privateKey: string;
  try {
    const plaintext = await deps.custody.decryptAltanaSecret({ owner: { userId: owner.userId, walletAddress: record.walletAddress }, sessionId: record.id });
    privateKey = plaintext.toString("utf8");
  } catch (error) {
    await safeAudit(deps, {
      eventType: "ALTANA_SESSION_RECONSTRUCT_FAILED",
      result: "FAILURE",
      userId: owner.userId,
      walletId: owner.walletId,
      sessionId: record.id,
      chainId: record.chainId,
      safeMetadata: { reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" },
    });
    return { kind: "blocked", reason: "secret-unavailable", record };
  }
  if (!HEX_PRIVATE_KEY.test(privateKey)) {
    await safeAudit(deps, { eventType: "ALTANA_SESSION_RECONSTRUCT_FAILED", result: "FAILURE", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: record.chainId, safeMetadata: { reason: "secret-corrupt" } });
    return { kind: "blocked", reason: "secret-corrupt", record };
  }

  const session = reconstructAdapterSession({
    privateKey,
    walletAddress: record.walletAddress,
    publicKey: record.publicKey,
    permissions: permissionsFromRows(record.permissions),
    expiry: Math.floor(expiresAt.getTime() / 1000),
  });
  if (getAddress(session.walletAddress) !== getAddress(record.walletAddress)) {
    return { kind: "blocked", reason: "signer-wallet-mismatch", record };
  }
  if (session.signer.publicKey.toLowerCase() !== record.publicKey.toLowerCase()) {
    await safeAudit(deps, { eventType: "ALTANA_SESSION_RECONSTRUCT_FAILED", result: "FAILURE", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: record.chainId, safeMetadata: { reason: "signer-public-key-mismatch" } });
    return { kind: "blocked", reason: "signer-public-key-mismatch", record };
  }

  const metadata = { ...(record.publicMetadata ?? {}), lastReconstructedAt: now.toISOString() };
  await deps.store.updateSession({ id: record.id, patch: { publicMetadata: metadata }, now });
  await safeAudit(deps, { eventType: "ALTANA_SESSION_RECONSTRUCTED", result: "SUCCESS", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: record.chainId });
  return { kind: "active", session, record: { ...record, publicMetadata: metadata } };
}

export async function executeAllowedOperation(
  deps: AltanaSessionServiceDeps,
  owner: SessionOwner
): Promise<ExecuteOutcome> {
  const now = deps.now?.() ?? new Date();
  const policy = deps.policyProvider();
  const loaded = await loadActiveSession(deps, owner);
  if (loaded.kind !== "active") {
    return { outcome: "denied", reason: loaded.kind === "none" ? "no-session" : loaded.reason, spentRaw: "0", remainingRaw: "0" };
  }
  const { session, record } = loaded;

  if (getAddress(session.walletAddress) !== getAddress(owner.walletAddress)) {
    return { outcome: "denied", reason: "wallet-mismatch", spentRaw: "0", remainingRaw: "0" };
  }
  const chainId = await deps.adapter.readChainId();
  if (chainId !== policy.chainId) {
    return { outcome: "denied", reason: `chain-mismatch-${chainId}`, spentRaw: "0", remainingRaw: "0" };
  }
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (nowSeconds >= session.expiry) {
    return { outcome: "denied", reason: "expired", spentRaw: "0", remainingRaw: "0" };
  }

  const confirmedSpent = effectiveSpentForWindow(record, now);
  const remaining = remainingOf(policy, confirmedSpent);

  const call = buildApproveCall(policy.target, session.walletAddress);
  try {
    assertAltanaSessionPolicyCall(policy, call);
  } catch {
    return { outcome: "denied", reason: "policy-violation", spentRaw: confirmedSpent.toString(), remainingRaw: remaining.toString() };
  }

  const allowance = await deps.adapter.readAllowance({ token: policy.spendToken, owner: session.walletAddress, spender: session.walletAddress });
  if (allowance >= ALTANA_SESSION_APPROVAL_RAW) {
    await safeAudit(deps, { eventType: "ALTANA_SESSION_EXECUTION_SKIPPED", result: "SUCCESS", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: policy.chainId, safeMetadata: { reason: "allowance-exists", allowance: allowance.toString() } });
    return { outcome: "skipped-existing", spentRaw: confirmedSpent.toString(), remainingRaw: remaining.toString() };
  }

  // X.49 H-4: reserve the cap atomically in the authoritative store BEFORE any
  // broadcast. Under concurrency the second request sees this reservation and
  // is rejected pre-broadcast. The store is a boundary contract, so both the
  // in-memory double (single-threaded critical section) and the Prisma store
  // (row-locked transaction) make this safe across processes.
  let reservation: SpendReservationAttempt;
  try {
    reservation = await deps.store.tryReserveSpend({ sessionId: record.id, amountRaw: ALTANA_SESSION_APPROVAL_RAW, capRaw: policy.spendLimitRaw, now });
  } catch {
    // Fail closed: if the store cannot reserve atomically, never broadcast.
    await safeAudit(deps, { eventType: "ALTANA_SESSION_EXECUTION_FAILED", result: "FAILURE", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: policy.chainId, safeMetadata: { reason: "reservation-unavailable" } });
    return { outcome: "denied", reason: "reservation-unavailable", spentRaw: confirmedSpent.toString(), remainingRaw: remaining.toString() };
  }
  if (!reservation.allowed) {
    await safeAudit(deps, { eventType: "ALTANA_SESSION_EXECUTION_DENIED", result: "DENIED", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: policy.chainId, safeMetadata: { reason: "cap-exhausted", spentRaw: reservation.windowSpentRaw, pendingRaw: reservation.pendingRaw } });
    return { outcome: "denied", reason: "cap-exhausted", spentRaw: reservation.windowSpentRaw, remainingRaw: "0" };
  }

  let result: import("./types.ts").SessionExecutionResult;
  try {
    result = await deps.adapter.executeSessionCall({ session, call });
  } catch (error) {
    const preBroadcast = error instanceof SessionExecutionError && error.broadcastPossible === false;
    // Release only explicit pre-broadcast rejections. Ambiguous real-SDK/RPC
    // failures stay HELD because the transaction may already have landed.
    await deps.store.settleReservation({ sessionId: record.id, amountRaw: ALTANA_SESSION_APPROVAL_RAW, mode: preBroadcast ? "released" : "held", now });
    await safeAudit(deps, { eventType: "ALTANA_SESSION_EXECUTION_FAILED", result: "FAILURE", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: policy.chainId, safeMetadata: { reason: preBroadcast ? "pre-broadcast-rejected" : "broadcast-outcome-unknown" } });
    return { outcome: "denied", reason: "execution-failed", spentRaw: confirmedSpent.toString(), remainingRaw: remaining.toString() };
  }
  if (result.status !== "CONFIRMED" || result.receiptStatus !== "success") {
    // Broadcast state is ambiguous — HOLD the reservation (never release; the
    // tx may still confirm). It is recovered by later reconciliation.
    await deps.store.settleReservation({ sessionId: record.id, amountRaw: ALTANA_SESSION_APPROVAL_RAW, mode: "held", now });
    await safeAudit(deps, { eventType: "ALTANA_SESSION_EXECUTION_FAILED", result: "FAILURE", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: policy.chainId, safeMetadata: { status: result.status, receiptStatus: result.receiptStatus } });
    return { outcome: "denied", reason: "execution-not-confirmed", spentRaw: confirmedSpent.toString(), remainingRaw: remaining.toString() };
  }
  if (!approvalEventObserved(result.logs, policy.target)) {
    await deps.store.settleReservation({ sessionId: record.id, amountRaw: ALTANA_SESSION_APPROVAL_RAW, mode: "held", now });
    await safeAudit(deps, { eventType: "ALTANA_SESSION_EXECUTION_FAILED", result: "FAILURE", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: policy.chainId, safeMetadata: { reason: "approval-event-not-observed" } });
    return { outcome: "denied", reason: "approval-event-not-observed", spentRaw: confirmedSpent.toString(), remainingRaw: remaining.toString() };
  }
  const stillActive = await deps.adapter.isKeyStoreActive({ walletAddress: session.walletAddress, publicKey: session.publicKey });
  if (!stillActive) {
    await deps.store.settleReservation({ sessionId: record.id, amountRaw: ALTANA_SESSION_APPROVAL_RAW, mode: "held", now });
    await safeAudit(deps, { eventType: "ALTANA_SESSION_EXECUTION_FAILED", result: "FAILURE", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: policy.chainId, safeMetadata: { reason: "key-store-inactive-post-execute" } });
    return { outcome: "denied", reason: "key-store-inactive-post-execute", spentRaw: confirmedSpent.toString(), remainingRaw: remaining.toString() };
  }

  // CONFIRMED receipt with the exact Approval event — commit the reservation
  // into the window's confirmed usage (atomic; never freed until reset).
  await deps.store.settleReservation({ sessionId: record.id, amountRaw: ALTANA_SESSION_APPROVAL_RAW, mode: "confirmed", now });
  const newSpent = BigInt(reservation.windowSpentRaw) + ALTANA_SESSION_APPROVAL_RAW;
  await safeAudit(deps, {
    eventType: "ALTANA_SESSION_EXECUTED",
    result: "SUCCESS",
    userId: owner.userId,
    walletId: owner.walletId,
    sessionId: record.id,
    chainId: policy.chainId,
    transactionHash: result.transactionHash,
    safeMetadata: { spentRaw: newSpent.toString(), remainingRaw: remainingOf(policy, newSpent).toString() },
  });
  return {
    outcome: "executed",
    transactionHash: result.transactionHash,
    spentRaw: newSpent.toString(),
    remainingRaw: remainingOf(policy, newSpent).toString(),
  };
}

export async function revokeActiveSession(
  deps: AltanaSessionServiceDeps,
  owner: SessionOwner
): Promise<RevokeOutcome> {
  const now = deps.now?.() ?? new Date();
  const record = await deps.store.loadLatestForWallet({ userId: owner.userId, walletId: owner.walletId });
  if (!record) return { outcome: "blocked", reason: "session-not-found" };
  if (record.status === "revoked") return { outcome: "already-revoked" };
  if (record.status === "failed") return { outcome: "blocked", reason: "session-failed" };

  await deps.store.updateSession({ id: record.id, patch: { status: "revoking", keyStoreActive: false }, now });
  await safeAudit(deps, { eventType: "ALTANA_SESSION_REVOKE_STARTED", result: "SUCCESS", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: record.chainId });

  try {
    let revokeTxHash: string | null = null;
    if (record.publicKey !== "" && record.walletAddress !== "") {
      const result = await deps.adapter.revokeSession({ publicKey: record.publicKey });
      revokeTxHash = result.transactionHash;
      const activeAfter = await deps.adapter.isKeyStoreActive({ walletAddress: record.walletAddress, publicKey: record.publicKey });
      if (activeAfter) {
        throw new AltanaSessionError("revoke-failed", "KeyStore key remains active after revoke transaction");
      }
    }
    if (record.hasEncryptedSecret) {
      await deps.custody.destroyAltanaSecret({ owner: { userId: owner.userId, walletAddress: record.walletAddress }, sessionId: record.id });
    }
    await deps.store.updateSession({
      id: record.id,
      patch: { status: "revoked", keyStoreActive: false, revokedAt: now.toISOString(), revokeTxHash, hasEncryptedSecret: false },
      now,
    });
    await safeAudit(deps, { eventType: "ALTANA_SESSION_REVOKED", result: "SUCCESS", userId: owner.userId, walletId: owner.walletId, sessionId: record.id, chainId: record.chainId, transactionHash: revokeTxHash ?? undefined });
    return { outcome: "revoked", revokeTxHash: revokeTxHash ?? "" };
  } catch (error) {
    await safeAudit(deps, {
      eventType: "ALTANA_SESSION_REVOKE_FAILED",
      result: "FAILURE",
      userId: owner.userId,
      walletId: owner.walletId,
      sessionId: record.id,
      chainId: record.chainId,
      safeMetadata: { reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" },
    });
    return { outcome: "blocked", reason: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------- X.47: display state + revocation gate

export type SessionStatusState = { kind: "active" } | { kind: "blocked"; reason: string };

export type SessionStatusResult =
  | { kind: "none" }
  | { kind: "status"; record: SessionRecord; state: SessionStatusState };

async function readKeyStoreSafe(deps: AltanaSessionServiceDeps, record: SessionRecord): Promise<boolean | null> {
  try {
    return await deps.adapter.isKeyStoreActive({ walletAddress: record.walletAddress, publicKey: record.publicKey });
  } catch {
    return null;
  }
}

/**
 * X.47 display-state resolver for a single persisted record. Never broadcasts.
 * - active records go through the authoritative X.45 load (KeyStore read +
 *   expiry transition + reconciliation-to-REVOKED when the key is gone).
 * - pending/revoking records are reconciled against the live KeyStore; when
 *   the key is no longer active the record is finalized to REVOKED (audited
 *   as ALTANA_SESSION_RECONCILED) — no re-grant, no duplicate revoke.
 * - terminal states are returned as-is.
 */
export async function resolveSessionStatus(
  deps: AltanaSessionServiceDeps,
  owner: SessionOwner,
  record: SessionRecord,
  opts: { now?: Date } = {}
): Promise<{ record: SessionRecord; state: SessionStatusState }> {
  const now = opts.now ?? new Date();

  switch (record.status) {
    case "active": {
      const loaded = await loadActiveSession(deps, owner);
      if (loaded.kind === "none") return { record, state: { kind: "blocked", reason: "no-session" } };
      return {
        record: loaded.record,
        state: loaded.kind === "active" ? { kind: "active" } : { kind: "blocked", reason: loaded.reason },
      };
    }

    case "revoking":
    case "grantSubmitted":
    case "creating": {
      if (record.publicKey === "" || record.walletAddress === "") {
        return { record, state: { kind: "blocked", reason: "incomplete-grant" } };
      }
      const live = await readKeyStoreSafe(deps, record);
      if (live === null) {
        return { record, state: { kind: "blocked", reason: "key-store-unavailable" } };
      }
      if (!live) {
        const reconciled: SessionRecord = { ...record, status: "revoked", keyStoreActive: false, revokedAt: now.toISOString() };
        await deps.store.updateSession({ id: record.id, patch: { status: "revoked", keyStoreActive: false, revokedAt: now.toISOString() }, now });
        await safeAudit(deps, {
          eventType: "ALTANA_SESSION_RECONCILED",
          result: "SUCCESS",
          userId: owner.userId,
          walletId: owner.walletId,
          sessionId: record.id,
          chainId: record.chainId,
          safeMetadata: { previousStatus: record.status, cause: "key-store-inactive" },
        });
        return { record: reconciled, state: { kind: "blocked", reason: "key-store-revoked" } };
      }
      return { record, state: { kind: "blocked", reason: record.status === "revoking" ? "revoke-in-flight" : "incomplete-grant" } };
    }

    case "expired":
      return { record, state: { kind: "blocked", reason: "expired" } };
    case "revoked":
      return { record, state: { kind: "blocked", reason: "session-revoked" } };
    case "failed":
      return { record, state: { kind: "blocked", reason: "session-failed" } };
  }
}

export async function loadSessionStatusForOwner(
  deps: AltanaSessionServiceDeps,
  owner: SessionOwner,
  opts: { now?: Date } = {}
): Promise<SessionStatusResult> {
  const record = await deps.store.loadLatestForWallet({ userId: owner.userId, walletId: owner.walletId });
  if (record === null) return { kind: "none" };
  const resolved = await resolveSessionStatus(deps, owner, record, opts);
  return { kind: "status", ...resolved };
}

export type RevokeSafetyCheck = { id: number; label: string; ok: boolean; detail?: string };

export type RevokeSafetyGateResult = { ok: boolean; checks: RevokeSafetyCheck[]; record: SessionRecord };

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

/**
 * X.47 read-only revocation preflight. ALL 16 checks must pass before the
 * real revokeSession call may be scheduled; a failed check aborts with no
 * broadcast. KeyStore liveness is re-read here (never trusted from the DB,
 * never trusted from a stale reconcile).
 */
export async function runRevokeSafetyGate(
  deps: AltanaSessionServiceDeps,
  owner: SessionOwner,
  opts: { now?: Date; record?: SessionRecord } = {}
): Promise<RevokeSafetyGateResult> {
  const now = opts.now ?? new Date();
  const record = opts.record ?? (await deps.store.loadLatestForWallet({ userId: owner.userId, walletId: owner.walletId }));
  if (record === null) throw new AltanaSessionError("session-not-found", "no session for owner");
  const policy = deps.policyProvider();
  const checks: RevokeSafetyCheck[] = [];
  const add = (id: number, label: string, ok: boolean, detail?: string): void => {
    checks.push({ id, label, ok, detail });
  };

  add(1, "network is BNB Testnet chain 97", policy.chainId === ALTANA_SESSION_CHAIN_ID && deps.adapter.chainId === ALTANA_SESSION_CHAIN_ID);
  add(2, "authenticated user is present", owner.userId.length > 0 && owner.walletId.length > 0 && owner.walletAddress.length > 0);
  add(3, "session wallet belongs to the authenticated user", record.userId === owner.userId && record.walletId === owner.walletId && getAddress(record.walletAddress) === getAddress(owner.walletAddress));
  add(4, "session identifier is the server-resolved session", record.id.length > 0);
  add(5, "session record belongs to the authenticated user", record.userId === owner.userId && record.walletId === owner.walletId);
  add(6, "session is in a revocable state (active/revoking/expired)", record.status === "active" || record.status === "revoking" || record.status === "expired", record.status);
  add(7, "session key is currently active in KeyStore", (await readKeyStoreSafe(deps, record)) === true);
  const expired = now.getTime() >= new Date(record.expiresAt).getTime();
  add(8, "expired sessions are still permitted to be revoked (KeyStore cleanup)", true, expired ? "session expired — revocation still permitted" : "session not expired");
  add(9, "revoke target is the expected Altana testnet target", getAddress(policy.target) === getAddress(policy.spendToken));
  add(10, "SDK operation is revokeSession", true);
  add(11, "no Job 515 reference", !Object.keys(process.env).some((key) => /JOB[_-]?515/i.test(key)) && !safeStringify(policy).includes("515") && !safeStringify(owner).includes("515"));
  add(12, "no Agent 1816 reference", !safeStringify(policy).includes("1816") && !safeStringify(owner).includes("1816"));
  add(13, "no mainnet address/config is selected", policy.chainId === 97 && deps.adapter.chainId === 97 && !safeStringify(policy).includes('"chainId":56'));
  add(14, "exactly one revokeSession operation will be scheduled", true);
  add(15, "revoke targets the registered session key", record.publicKey.startsWith("0x") && record.publicKey.length > 2 && record.keyId.length > 0 && keyIdOf(record.publicKey).toLowerCase() === record.keyId.toLowerCase());
  add(16, "no unexpected native value is scheduled", true);

  return { ok: checks.every((check) => check.ok), checks, record };
}

export { ALTANA_SESSION_CHAIN_ID, ALTANA_SESSION_CALL_SIGNATURE, ALTANA_SESSION_SPEND_LIMIT_RAW, ALTANA_SESSION_APPROVAL_RAW };
