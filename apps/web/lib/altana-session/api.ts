/**
 * X.47 authenticated Altana session API — pure handlers over injected deps.
 *
 * The route files under app/api/altana/session/ are thin adapters onto these
 * handlers; everything here is offline-testable (memory store + fake adapter).
 *
 * Ownership model: the authenticated server identity is authoritative. The
 * browser never supplies userId/wallet/sessionId as an ownership claim; an
 * optional sessionId is used only as a SELECTOR after strict ownership
 * verification, so User A can never view or revoke User B's session.
 *
 * Every response:
 *   - is Cache-Control: no-store
 *   - carries ONLY the permissions-safe public session view (view.ts) —
 *     never the signer, private key, ciphertext, KMS material, AAD, raw
 *     session token, or internal custody metadata.
 */

import { constantTimeEqual } from "../auth/crypto.ts";
import { getAuthConfig } from "../auth/constants.ts";
import { hasSafeMutationRequest, readJson } from "../auth/request.ts";
import type { AuthenticatedIdentity } from "../auth/types.ts";
import {
  resolveSessionStatus,
  revokeActiveSession,
  runRevokeSafetyGate,
  safeAudit,
} from "./service.ts";
import type { AltanaSessionServiceDeps } from "./service.ts";
import type { RevokeOutcome, SessionOwner, SessionRecord } from "./types.ts";
import { toPublicSessionView } from "./view.ts";
import type { PublicSessionView } from "./view.ts";

export type SessionApiResult = {
  status: number;
  body: Record<string, unknown>;
  headers: { "Cache-Control": "no-store" };
};

const NO_STORE: SessionApiResult["headers"] = { "Cache-Control": "no-store" };

function publicViewOf(record: SessionRecord): PublicSessionView {
  const spendRow = record.permissions.find((permission) => permission.kind === "TOKEN_SPEND");
  return toPublicSessionView(record, BigInt(spendRow?.spendCapRaw ?? "0"));
}

function ownerOf(identity: AuthenticatedIdentity): SessionOwner {
  return { userId: identity.userId, walletId: identity.walletId, walletAddress: identity.walletAddress };
}

/**
 * Safe route-level error mapping. Never leaks Prisma internals, stack traces,
 * RPC internals, KMS errors, or private SDK error text to the browser.
 *
* X.55: server MISCONFIGURATION (a required env var absent, so the session
 * service cannot be constructed at all) is reported as 503 "unavailable"
 * rather than a generic 500. A 500 implies the request itself failed; 503
 * correctly says the capability is not configured on this deployment. The
 * message stays generic �?" variable names and values are never disclosed.
 *
 * X.58.1: CustodyConfigError (e.g. ALTANA_KMS_PROVIDER=aws without AWS_REGION
 * / ALTANA_KMS_KEY_ID) is thrown by createSessionService() on every request
 * when the capability is not configured, exactly like a missing required env
 * var. It is classified by error NAME only (the deliberate app error class,
 * same pattern as PrismaClientInitializationError) - never by message content,
 * so none of the config internals ever reach a response body and unrelated
 * errors are not swallowed.
 */
export function altanaApiErrorMessage(error: unknown): { message: string; status: number } {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  // X.58: broaden persistence detection. Prisma surfaces an unreachable database
  // in several shapes depending on where it fails (connection vs client init),
  // and only P1001 / "Can't reach database server" were matched before, so a
  // genuinely unavailable database was reported as a generic 500. Persistence
  // being unavailable is a 503 condition, not a request-level failure.
  const persistenceUnavailable =
    message.includes("P1001") ||
    message.includes("Can't reach database server") ||
    message.includes("P1017") ||
    message.includes("Server has closed the connection") ||
    name === "PrismaClientInitializationError" ||
    message.includes("PrismaClientInitializationError") ||
    message.includes("Query Engine") ||
    message.includes("ECONNREFUSED");
  if (persistenceUnavailable) {
    return { message: "Session persistence is unavailable.", status: 503 };
  }
  if (
    message.includes("missing required environment variable") ||
    name === "CustodyConfigError"
  ) {
    return { message: "Altana session support is not configured on this deployment.", status: 503 };
  }
  return { message: "Unable to complete the session request.", status: 500 };
}

// ---------------------------------------------------------------- GET session

export async function getAltanaSessionApi(input: {
  identity: AuthenticatedIdentity | null;
  deps: AltanaSessionServiceDeps;
  sessionIdParam?: string | null;
  now?: Date;
}): Promise<SessionApiResult> {
  if (input.identity === null) {
    return { status: 401, body: { ok: false, error: { message: "Authentication required." } }, headers: NO_STORE };
  }
  const owner = ownerOf(input.identity);
  const selectedId = typeof input.sessionIdParam === "string" && input.sessionIdParam.length > 0 ? input.sessionIdParam : null;
  const record = selectedId === null
    ? await input.deps.store.loadLatestForWallet({ userId: owner.userId, walletId: owner.walletId })
    : await input.deps.store.loadById({ id: selectedId });
  if (record === null) {
    return { status: 200, body: { ok: true, data: { session: null, load: { kind: "none" } } }, headers: NO_STORE };
  }
  if (selectedId !== null && (record.userId !== owner.userId || record.walletId !== owner.walletId)) {
    // Ownership boundary: an id outside the authenticated user's sessions is
    // indistinguishable from "no session" — we never reveal its existence.
    return { status: 200, body: { ok: true, data: { session: null, load: { kind: "none" } } }, headers: NO_STORE };
  }
  const resolved = await resolveSessionStatus(input.deps, owner, record, { now: input.now });
  await safeAudit(input.deps, {
    eventType: "ALTANA_SESSION_VIEWED",
    result: "SUCCESS",
    userId: owner.userId,
    walletId: owner.walletId,
    sessionId: record.id,
    chainId: record.chainId,
    safeMetadata: { state: resolved.state.kind === "active" ? "active" : resolved.state.reason },
  });
  return {
    status: 200,
    body: {
      ok: true,
      data: {
        session: publicViewOf(resolved.record),
        load: {
          kind: resolved.state.kind,
          reason: resolved.state.kind === "blocked" ? resolved.state.reason : undefined,
        },
      },
    },
    headers: NO_STORE,
  };
}

// ---------------------------------------------------------------- revoke session

const REVOKE_GATE_MESSAGES: Record<number, string> = {
  1: "The session is not on the expected BNB Testnet network.",
  2: "The request could not be tied to the authenticated account.",
  3: "The session does not belong to the authenticated wallet.",
  4: "The session identifier could not be resolved.",
  5: "The session does not belong to the authenticated account.",
  6: "The session is not in a revocable state yet; no transaction was sent.",
  7: "The session key is not active; it will be reconciled on the next refresh.",
  8: "The session cannot be revoked in its current expiry state.",
  9: "The revocation target is not the expected Altana testnet contract.",
  10: "The prepared operation is not a session revocation.",
  11: "The revocation cannot reference ERC-8183 Job 515.",
  12: "The revocation cannot reference Agent 1816.",
  13: "Mainnet configuration is not permitted for revocation.",
  14: "Only a single revocation operation may be scheduled.",
  15: "The registered session key could not be matched for revocation.",
  16: "The revocation schedules an unexpected native value.",
};

function safeRevocationGateMessage(failedIds: readonly number[]): string {
  const first = failedIds[0];
  return first !== undefined && REVOKE_GATE_MESSAGES[first] !== undefined
    ? REVOKE_GATE_MESSAGES[first]
    : "The session cannot be revoked right now; no transaction was sent.";
}

function revokedSessionResult(
  record: SessionRecord,
  outcome: "revoked" | "already-revoked",
  revokeTxHash: string | null,
  opts: { reconciled?: boolean } = {}
): SessionApiResult {
  return {
    status: 200,
    body: {
      ok: true,
      data: {
        outcome,
        session: publicViewOf(record),
        ...(revokeTxHash !== null && revokeTxHash.length > 0 ? { revokeTxHash } : {}),
        ...(opts.reconciled === true ? { reconciled: true } : {}),
      },
    },
    headers: NO_STORE,
  };
}

export async function revokeAltanaSessionApi(input: {
  identity: AuthenticatedIdentity | null;
  request: Request;
  deps: AltanaSessionServiceDeps;
  csrfCookie: string | null;
  now?: Date;
}): Promise<SessionApiResult> {
  const config = getAuthConfig();
  if (!hasSafeMutationRequest(input.request, config.origin)) {
    return { status: 403, body: { ok: false, error: { message: "Request rejected." } }, headers: NO_STORE };
  }
  const suppliedCsrf = input.request.headers.get("x-csrf-token");
  if (input.csrfCookie === null || suppliedCsrf === null || !constantTimeEqual(input.csrfCookie, suppliedCsrf)) {
    return { status: 403, body: { ok: false, error: { message: "Request rejected." } }, headers: NO_STORE };
  }
  if (input.identity === null) {
    return { status: 401, body: { ok: false, error: { message: "Authentication required." } }, headers: NO_STORE };
  }
  const action = await readJson<{ action?: unknown }>(input.request);
  if (action === null || action.action !== "revoke") {
    return { status: 400, body: { ok: false, error: { message: "Expected body { \"action\": \"revoke\" }." } }, headers: NO_STORE };
  }

  const owner = ownerOf(input.identity);
  const now = input.now ?? new Date();
  const record = await input.deps.store.loadLatestForWallet({ userId: owner.userId, walletId: owner.walletId });
  if (record === null) {
    return { status: 404, body: { ok: false, error: { message: "No Altana session found for this account." } }, headers: NO_STORE };
  }

  await safeAudit(input.deps, {
    eventType: "ALTANA_SESSION_REVOKE_REQUESTED",
    result: "SUCCESS",
    userId: owner.userId,
    walletId: owner.walletId,
    sessionId: record.id,
    chainId: record.chainId,
  });

  // Already terminal: idempotent success, no transaction.
  if (record.status === "revoked") {
    return revokedSessionResult(record, "already-revoked", record.revokeTxHash);
  }
  if (record.status === "failed") {
    return { status: 409, body: { ok: false, error: { message: "The session is in a failed state and cannot be revoked." } }, headers: NO_STORE };
  }

  // Never granted: nothing live on-chain to revoke; never broadcast.
  if (record.publicKey === "" || record.walletAddress === "") {
    return { status: 409, body: { ok: false, error: { message: "The session grant has not been confirmed yet; no revocation is possible." } }, headers: NO_STORE };
  }

  // Reconcile-first: verify against the live KeyStore (never the DB flag,
  // never the browser). KeyStore inactive => reconcile, no broadcast.
  let keyStoreActive: boolean;
  try {
    keyStoreActive = await input.deps.adapter.isKeyStoreActive({ walletAddress: record.walletAddress, publicKey: record.publicKey });
  } catch {
    return { status: 502, body: { ok: false, error: { message: "Unable to verify the session on the Altana network right now. Please try again." } }, headers: NO_STORE };
  }
  if (!keyStoreActive) {
    const revokedRecord: SessionRecord = { ...record, status: "revoked", keyStoreActive: false, revokedAt: now.toISOString() };
    await input.deps.store.updateSession({ id: record.id, patch: { status: "revoked", keyStoreActive: false, revokedAt: now.toISOString() }, now });
    await safeAudit(input.deps, {
      eventType: "ALTANA_SESSION_RECONCILED",
      result: "SUCCESS",
      userId: owner.userId,
      walletId: owner.walletId,
      sessionId: record.id,
      chainId: record.chainId,
      safeMetadata: { previousStatus: record.status, cause: "key-store-inactive" },
    });
    return revokedSessionResult(revokedRecord, "already-revoked", null, { reconciled: true });
  }

  // Read-only revocation preflight — every check must pass before any broadcast.
  const gate = await runRevokeSafetyGate(input.deps, owner, { now, record });
  if (!gate.ok) {
    await safeAudit(input.deps, {
      eventType: "ALTANA_SESSION_REVOKE_FAILED",
      result: "DENIED",
      userId: owner.userId,
      walletId: owner.walletId,
      sessionId: record.id,
      chainId: record.chainId,
      safeMetadata: { gateIds: gate.checks.filter((check) => !check.ok).map((check) => check.id).join(",") },
    });
    return { status: 409, body: { ok: false, error: { message: safeRevocationGateMessage(gate.checks.filter((check) => !check.ok).map((check) => check.id)) } }, headers: NO_STORE };
  }

  // Real SDK revocation (single revokeSession call; the SDK confirms the tx).
  let outcome: RevokeOutcome;
  try {
    outcome = await revokeActiveSession(input.deps, owner);
  } catch (error) {
    outcome = { outcome: "blocked", reason: error instanceof Error ? error.message : String(error) };
  }

  if (outcome.outcome === "revoked") {
    const fallbackRecord: SessionRecord = { ...record, status: "revoked", keyStoreActive: false, revokedAt: now.toISOString() };
    const fresh = await input.deps.store.loadById({ id: record.id });
    const revokedRecord: SessionRecord = fresh === null ? fallbackRecord : fresh;
    return revokedSessionResult(revokedRecord, "revoked", outcome.revokeTxHash);
  }
  if (outcome.outcome === "already-revoked") {
    return revokedSessionResult(record, "already-revoked", record.revokeTxHash);
  }

  // The revoke broadcast could not be confirmed. The session record stays in
  // REVOKING (never marked REVOKED on an unverified attempt); a retry is safe
  // and reconciles KeyStore state first.
  await safeAudit(input.deps, {
    eventType: "ALTANA_SESSION_REVOKE_FAILED",
    result: "FAILURE",
    userId: owner.userId,
    walletId: owner.walletId,
    sessionId: record.id,
    chainId: record.chainId,
    safeMetadata: { cause: "revocation-not-confirmed" },
  });
  return { status: 502, body: { ok: false, error: { message: "Revocation could not be confirmed on the network. The action is safe to retry." } }, headers: NO_STORE };
}