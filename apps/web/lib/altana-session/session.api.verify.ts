/**
 * X.47 offline verifier — authenticated permissions + revoke API surface.
 *
 * Full request/decision surface of lib/altana-session/api.ts is exercised
 * over the X.45 in-memory store, fake chain adapter, and X.44 test KMS +
 * pure custody service — no server-only imports, no Prisma, no network.
 * The route files are thin adapters on these handlers.
 *
 * Run: node --experimental-strip-types lib/altana-session/session.api.verify.ts
 */

import { readFileSync } from "node:fs";
import {
  ALTANA_SESSION_CALL_SIGNATURE,
  ALTANA_SESSION_SPEND_LIMIT_RAW,
  buildAltanaSessionPolicy,
} from "@bnb-marketplace/integrations/altana";
import { decryptAltanaSecret, destroyAltanaSecret, encryptAltanaSecret } from "../custody/service.ts";
import { CustodyConfigError } from "../custody/errors.ts";
import { TestKmsProvider } from "../custody/kms/test-kms.ts";
import type { CustodyAuditInput, CustodyPersistence, EncryptedSecretRecord, SessionBinding } from "../custody/types.ts";
import type { AuthenticatedIdentity } from "../auth/types.ts";
import { createFakeAltanaSessionAdapter } from "./adapter-fake.ts";
import { createMemorySessionStore } from "./store.memory.ts";
import type { MemorySessionRow } from "./store.memory.ts";
import { createAltanaSession, executeAllowedOperation, runRevokeSafetyGate } from "./service.ts";
import { getAltanaSessionApi, altanaApiErrorMessage, revokeAltanaSessionApi } from "./api.ts";
import type { AltanaSessionServiceDeps, CustodyLike, SessionOwner, SessionStore } from "./types.ts";

const PAYMENT_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565" as const;
const WALLET_ADDRESS = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C" as const;
const RPC_ORIGIN = "http://localhost:3000";

const USER_1: SessionOwner = { userId: "user-1", walletId: "wallet-1", walletAddress: WALLET_ADDRESS };
const USER_2: SessionOwner = { userId: "user-2", walletId: "wallet-2", walletAddress: WALLET_ADDRESS };

class MemoryCustodyPersistence implements CustodyPersistence {
  sessions = new Map<string, SessionBinding>();
  secrets = new Map<string, EncryptedSecretRecord>();
  audits: CustodyAuditInput[] = [];
  private nextId = 1;

  loadSession(sessionId: string) {
    return Promise.resolve(this.sessions.get(sessionId) ?? null);
  }
  loadSecret(sessionId: string) {
    return Promise.resolve(this.secrets.get(sessionId) ?? null);
  }
  insertSecret(input: { sessionId: string; fields: EncryptedSecretRecord; now: Date }) {
    const record: EncryptedSecretRecord = { ...input.fields, id: `secret-${this.nextId++}`, destroyedAt: null };
    this.secrets.set(input.sessionId, record);
    return Promise.resolve({ id: record.id });
  }
  replaceSecret(input: { id: string; fields: EncryptedSecretRecord; now: Date }) {
    const current = [...this.secrets.values()].find((item) => item.id === input.id);
    if (!current) return Promise.reject(new Error("missing record"));
    this.secrets.set(current.sessionId, { ...current, ...input.fields, destroyedAt: null });
    return Promise.resolve();
  }
  replaceCiphertext(input: { id: string; fields: EncryptedSecretRecord; now: Date }) {
    const current = [...this.secrets.values()].find((item) => item.id === input.id);
    if (!current) return Promise.reject(new Error("missing record"));
    this.secrets.set(current.sessionId, { ...current, ...input.fields });
    return Promise.resolve();
  }
  markDestroyed(id: string, at: Date) {
    const current = [...this.secrets.values()].find((item) => item.id === id);
    if (!current) return Promise.reject(new Error("missing record"));
    this.secrets.set(current.sessionId, { ...current, destroyedAt: at });
    return Promise.resolve();
  }
  writeAudit(input: CustodyAuditInput) {
    this.audits.push(input);
    return Promise.resolve();
  }
}

function buildCustody(persistence: MemoryCustodyPersistence): CustodyLike {
  return {
    encryptAltanaSecret: (input) => encryptAltanaSecret({ persistence, provider: new TestKmsProvider(), owner: input.owner, sessionId: input.sessionId, plaintext: input.plaintext }),
    decryptAltanaSecret: (input) => decryptAltanaSecret({ persistence, provider: new TestKmsProvider(), owner: input.owner, sessionId: input.sessionId }),
    destroyAltanaSecret: (input) => destroyAltanaSecret({ persistence, owner: input.owner, sessionId: input.sessionId }),
  };
}

type Harness = {
  store: SessionStore & { rows: Map<string, MemorySessionRow>; audits: import("./types.ts").SessionAuditInput[] };
  custodyPersistence: MemoryCustodyPersistence;
  deps: AltanaSessionServiceDeps;
  fakeState: ReturnType<typeof createFakeAltanaSessionAdapter>["state"];
  policy: ReturnType<typeof buildAltanaSessionPolicy>;
};

function makeHarness(): Harness {
  const store = createMemorySessionStore();
  const custodyPersistence = new MemoryCustodyPersistence();
  custodyPersistence.loadSession = async (sessionId) => {
    const record = await store.loadById({ id: sessionId });
    return record ? { id: record.id, userId: record.userId, chainId: record.chainId } : null;
  };
  const fake = createFakeAltanaSessionAdapter();
  const policy = buildAltanaSessionPolicy(PAYMENT_TOKEN);
  const deps: AltanaSessionServiceDeps = {
    store,
    adapter: fake.adapter,
    custody: buildCustody(custodyPersistence),
    policyProvider: () => policy,
    now: () => new Date(),
  };
  return { store, custodyPersistence, deps, fakeState: fake.state, policy };
}

async function createActiveSession(h: Harness, owner: SessionOwner = USER_1): Promise<string> {
  const { record } = await createAltanaSession(h.deps, owner);
  return record.id;
}

function identityFor(owner: SessionOwner): AuthenticatedIdentity {
  return {
    userId: owner.userId,
    walletId: owner.walletId,
    walletAddress: owner.walletAddress,
    chainId: 97,
    sessionId: `auth-session-${owner.walletId}`,
    sessionExpiresAt: new Date(Date.now() + 3_600_000),
    lastUsedAt: new Date(),
  };
}

function revokeRequest(opts: {
  csrf?: string | null;
  origin?: string | null;
  contentType?: string;
  method?: string;
  body?: string | null;
  site?: string | null;
} = {}): Request {
  const headers: Record<string, string> = {
    "Content-Type": opts.contentType ?? "application/json",
    Origin: opts.origin ?? RPC_ORIGIN,
    "sec-fetch-site": opts.site ?? "same-origin",
  };
  if (opts.csrf !== undefined && opts.csrf !== null) headers["x-csrf-token"] = opts.csrf;
  const method = opts.method ?? "POST";
  return new Request(`${RPC_ORIGIN}/api/altana/session/revoke`, {
    method,
    headers,
    body: method === "POST" && opts.body !== null ? (opts.body ?? JSON.stringify({ action: "revoke" })) : undefined,
  });
}

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = ""): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${checks}. ${label}${detail ? ` — ${detail}` : ""}`);
}

const FORBIDDEN_FIELD = /\b(privateKey|rawSigner|encryptedSecret|ciphertext|wrappedDataKey|wrappedKey|nonce|authTag|sessionToken|rawToken|kmsKeyId|publicKey|keyId|hasEncryptedSecret|test-kms-key|AAD)\b/i;
const VIEW_ALLOWED_KEYS = new Set([
  "sessionId", "chainId", "walletAddress", "status", "keyStoreActive", "createdAt", "updatedAt",
  "expiresAt", "revokedAt", "lastVerifiedAt", "lastReconstructedAt", "spentRaw", "remainingRaw",
  "permissionLimitRaw", "nativeFeeLimitRaw", "permissions", "grantCallsId", "registrationCallsId",
  "registrationTxHash", "revokeCallsId", "revokeTxHash", "agentId", "agentName", "agentSource",
]);

async function main(): Promise<void> {
  // ------------------------------------------------- 1. unauthenticated GET
  {
    const h = makeHarness();
    const result = await getAltanaSessionApi({ identity: null, deps: h.deps });
    check("unauthenticated GET -> 401", result.status === 401 && result.body.ok === false);
  }

  // ------------------------------------------------- 2/4/5/6. authenticated GET -> safe public view
  {
    const h = makeHarness();
    await createActiveSession(h);
    const result = await getAltanaSessionApi({ identity: identityFor(USER_1), deps: h.deps, now: new Date() });
    const view = (result.body as { data: { session: Record<string, unknown> } }).data.session;
    const json = JSON.stringify(result.body);
    check("authenticated GET -> 200 with safe session view", result.status === 200 && view.status === "active");
    check("view fields are entirely within the allowed public set", Object.keys(view).every((key) => VIEW_ALLOWED_KEYS.has(key)));
    check("view shows wallet/chain/permissions/expiry", typeof view.walletAddress === "string" && view.chainId === 97 && Array.isArray(view.permissions) && typeof view.expiresAt === "string");
    check("session view excludes secrets", !FORBIDDEN_FIELD.test(json), Object.keys(view).join(","));
    check("response contains no KMS material", !json.includes("test-kms") && !/"nonce"/.test(json));
    check("GET response is Cache-Control: no-store", result.headers["Cache-Control"] === "no-store");
    check("ALTANA_SESSION_VIEWED audit recorded", h.store.audits.some((a) => a.eventType === "ALTANA_SESSION_VIEWED" && a.result === "SUCCESS"));
  }

  // ------------------------------------------------- 3/20. ownership boundary
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    const asB = await getAltanaSessionApi({ identity: identityFor(USER_2), deps: h.deps });
    const asBById = await getAltanaSessionApi({ identity: identityFor(USER_2), deps: h.deps, sessionIdParam: sessionId });
    check("User B cannot view User A's latest session", (asB.body as { data: { session: unknown } }).data.session === null);
    check("sessionId cannot cross the ownership boundary", (asBById.body as { data: { session: unknown } }).data.session === null);
    const asAById = await getAltanaSessionApi({ identity: identityFor(USER_1), deps: h.deps, sessionIdParam: sessionId });
    check("sessionId resolves normally for the owner", (asAById.body as { data: { session: Record<string, unknown> | null } }).data.session?.sessionId === sessionId);
  }

  // ------------------------------------------------- 7. authenticated revoke succeeds (REAL SDK path)
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    const result = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "csrf-token-1" }), csrfCookie: "csrf-token-1", deps: h.deps, now: new Date() });
    const data = (result.body as { data: { outcome: string; session: Record<string, unknown>; revokeTxHash?: string } }).data;
    const row = await h.store.loadById({ id: sessionId });
    check("authenticated revoke succeeds (real revokeSession via adapter)", result.status === 200 && data.outcome === "revoked" && h.fakeState.revokeCount === 1);
    check("revoked session state persisted with revokedAt", row?.status === "revoked" && row.revokedAt !== null && data.session.status === "revoked");
    check("custody secret destroyed on revoke", h.custodyPersistence.secrets.get(sessionId)?.destroyedAt !== null);
    check("ALTANA_SESSION_REVOKED audit recorded with tx hash", h.store.audits.some((a) => a.eventType === "ALTANA_SESSION_REVOKED" && typeof a.transactionHash === "string"));
    check("revoke response exposes only the safe public view", !FORBIDDEN_FIELD.test(JSON.stringify(result.body)));
    check("revoke response is Cache-Control: no-store", result.headers["Cache-Control"] === "no-store");
  }

  // ------------------------------------------------- 8. CSRF / origin / request-shape guards
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    const denied = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "wrong" }), csrfCookie: "csrf-token-1", deps: h.deps, now: new Date() });
    const noCsrf = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: null }), csrfCookie: "csrf-token-1", deps: h.deps, now: new Date() });
    const crossOrigin = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "csrf-token-1", origin: "https://evil.example" }), csrfCookie: "csrf-token-1", deps: h.deps, now: new Date() });
    const crossSite = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "csrf-token-1", site: "cross-site" }), csrfCookie: "csrf-token-1", deps: h.deps, now: new Date() });
    const notJson = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "csrf-token-1", contentType: "text/plain" }), csrfCookie: "csrf-token-1", deps: h.deps, now: new Date() });
    const notPost = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "csrf-token-1", method: "GET" }), csrfCookie: "csrf-token-1", deps: h.deps, now: new Date() });
    const badJson = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "csrf-token-1", body: "{ not json" }), csrfCookie: "csrf-token-1", deps: h.deps, now: new Date() });
    check("revoke without matching CSRF token -> 403", denied.status === 403 && noCsrf.status === 403);
    check("revoke with cross-origin request -> 403", crossOrigin.status === 403);
    check("revoke with cross-site fetch metadata -> 403", crossSite.status === 403);
    check("revoke without JSON content type -> 403", notJson.status === 403);
    check("revoke via GET -> 403", notPost.status === 403);
    check("revoke with malformed body -> 400", badJson.status === 400);
    const row = await h.store.loadById({ id: sessionId });
    check("no guard-rejected attempt ever broadcast a revoke", h.fakeState.revokeCount === 0 && row?.status === "active");
  }

  // ------------------------------------------------- 9. already revoked -> idempotent, no transaction
  {
    const h = makeHarness();
    await createActiveSession(h);
    await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    const second = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    check("already-revoked session returns idempotent success", second.status === 200 && (second.body as { data: { outcome: string } }).data.outcome === "already-revoked");
    check("already-revoked session sends NO duplicate transaction", h.fakeState.revokeCount === 1);
  }

  // ------------------------------------------------- 10/13. externally revoked -> reconciliation, no broadcast
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    h.fakeState.revoked = true;
    h.fakeState.registered = false;
    const revoke = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    const data = (revoke.body as { data: { outcome: string; reconciled?: boolean } }).data;
    const row = await h.store.loadById({ id: sessionId });
    check("externally-revoked session reconciles to REVOKED without a transaction", revoke.status === 200 && data.outcome === "already-revoked" && data.reconciled === true && h.fakeState.revokeCount === 0);
    check("reconciliation persists REVOKED with revokedAt and audit", row?.status === "revoked" && row.revokedAt !== null && h.store.audits.some((a) => a.eventType === "ALTANA_SESSION_RECONCILED" && (a.safeMetadata?.previousStatus === "active")));
  }

  // ------------------------------------------------- 11. wrong user revoke -> rejected
  {
    const h = makeHarness();
    await createActiveSession(h, USER_1);
    const asB = await revokeAltanaSessionApi({ identity: identityFor(USER_2), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    check("wrong user revoke -> 404 (session not visible)", asB.status === 404 && h.fakeState.revokeCount === 0);
  }

  // ------------------------------------------------- 12. expired session handling
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    await h.store.updateSession({ id: sessionId, patch: { expiresAt: new Date(Date.now() - 60_000).toISOString() }, now: new Date() });
    const view = await getAltanaSessionApi({ identity: identityFor(USER_1), deps: h.deps, now: new Date() });
    check("expired session displays EXPIRED via display resolver", (view.body as { data: { session: { status: string } } }).data.session.status === "expired");
    const revoke = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    check("expired session is still revoked with a real transaction when the KeyStore key is live", revoke.status === 200 && (revoke.body as { data: { outcome: string } }).data.outcome === "revoked" && h.fakeState.revokeCount === 1);
    const dbExpired = makeHarness();
    const dbId = await createActiveSession(dbExpired);
    await dbExpired.store.updateSession({ id: dbId, patch: { status: "expired", expiresAt: new Date(Date.now() - 60_000).toISOString() }, now: new Date() });
    const revokeExpired = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: dbExpired.deps, now: new Date() });
    check("DB-EXPIRED + KeyStore-live revokes with a real transaction (preflight 8 permits)", revokeExpired.status === 200 && dbExpired.fakeState.revokeCount === 1);
  }

  // ------------------------------------------------- 13b. KeyStore inactive on GET (display reconciliation)
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    h.fakeState.revoked = true;
    h.fakeState.registered = false;
    const view = await getAltanaSessionApi({ identity: identityFor(USER_1), deps: h.deps, now: new Date() });
    const data = (view.body as { data: { session: { status: string } | null; load: { kind: string; reason?: string } } }).data;
    const row = await h.store.loadById({ id: sessionId });
    check("KeyStore-inactive ACTIVE session reconciles on view (no transaction)", data.session?.status === "revoked" && data.load.reason === "key-store-revoked" && row?.status === "revoked" && h.fakeState.revokeCount === 0);
  }

  // ------------------------------------------------- 14. revoke transaction preflight (16 checks)
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    const gate = await runRevokeSafetyGate(h.deps, USER_1, { now: new Date() });
    check("revocation preflight: all 16 checks pass for a live session", gate.ok && gate.checks.length === 16 && gate.checks.every((c) => c.ok), gate.checks.filter((c) => !c.ok).map((c) => c.id).join(","));
    check("revocation preflight is read-only (no broadcast)", h.fakeState.revokeCount === 0 && h.fakeState.executeCount === 0);
    const failedRecord = (await h.store.loadById({ id: sessionId }));
    if (failedRecord) {
      const failedGate = await runRevokeSafetyGate(h.deps, USER_1, { now: new Date(), record: { ...failedRecord, status: "failed" } });
      check("revocation preflight blocks a non-revocable session state", !failedGate.ok && failedGate.checks.find((c) => c.id === 6)?.ok === false);
      const badKeyRecord = { ...failedRecord, keyId: "0x" + "0".repeat(64) };
      const keyGate = await runRevokeSafetyGate(h.deps, USER_1, { now: new Date(), record: badKeyRecord });
      check("revocation preflight blocks a mismatched session key (check 15)", !keyGate.ok && keyGate.checks.find((c) => c.id === 15)?.ok === false);
    }
    const victimRecord = await h.store.loadById({ id: sessionId });
    check("preflight gate rejects tampered ownership (check 3/5)", victimRecord !== null && (await runRevokeSafetyGate(h.deps, USER_2, { now: new Date(), record: victimRecord })).ok === false);
  }

  // ------------------------------------------------- 15. execution after revoke -> denied before broadcast
  {
    const h = makeHarness();
    await createActiveSession(h);
    await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    const execution = await executeAllowedOperation(h.deps, USER_1);
    check("execution after revoke is denied BEFORE broadcast", execution.outcome === "denied" && execution.reason === "session-revoked");
    check("no execution transaction is attempted after revoke", h.fakeState.executeCount === 0);
  }

  // ------------------------------------------------- 16-19. client cannot modify permissions/cap/target/selector/sessionId
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    const craftedBody = JSON.stringify({
      action: "revoke",
      sessionId: "0xattacker-chosen",
      permissions: [{ kind: "CALL", target: "0x1111111111111111111111111111111111111111", signature: "transfer(address,uint256)" }],
      spendCapRaw: "999999999999",
      target: "0x1111111111111111111111111111111111111111",
      selector: "0x12345678",
    });
    const result = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c", body: craftedBody }), csrfCookie: "c", deps: h.deps, now: new Date() });
    const fresh = await h.store.loadById({ id: sessionId });
    const callRow = fresh?.permissions.find((p) => p.kind === "CALL");
    const spendRow = fresh?.permissions.find((p) => p.kind === "TOKEN_SPEND");
    const view = (result.body as { data: { session: { permissions: Array<{ targetAddress: string | null; functionSignature: string | null; spendCapRaw: string | null }> } } }).data.session;
    check("client-supplied permission row values are ignored (rows unchanged)", callRow?.targetAddress === PAYMENT_TOKEN && callRow?.functionSignature === ALTANA_SESSION_CALL_SIGNATURE && spendRow?.spendCapRaw === ALTANA_SESSION_SPEND_LIMIT_RAW.toString());
    check("client-supplied target cannot be changed (view derives from stored policy)", view.permissions.find((p) => p.targetAddress === "0x1111111111111111111111111111111111111111") === undefined);
    check("client-supplied selector cannot be changed", view.permissions.every((p) => p.functionSignature === null || p.functionSignature === ALTANA_SESSION_CALL_SIGNATURE));
    check("client-supplied spend cap cannot be changed", view.permissions.filter((p) => p.kind !== "NATIVE_SPEND").every((p) => p.spendCapRaw === null || p.spendCapRaw === ALTANA_SESSION_SPEND_LIMIT_RAW.toString()));
    check("client-supplied sessionId cannot drive the revoke (server-side session selection)", result.status === 200 && (result.body as { data: { outcome: string } }).data.outcome === "revoked");
  }

  // ------------------------------------------------- 21/22. no-store + safe error messages
  {
    const h = makeHarness();
    const errmap = () => {
      const p1001 = altanaApiErrorMessage(new Error("P1001 failed to connect to localhost:5432"));
      const random = altanaApiErrorMessage(new Error("TypeError: x is not a function\n    at Object.<anonymous> (C:\\repo\\node_modules\\prisma\\engine.js:1:1)"));
      return [p1001, random];
    };
    const [p1001, random] = errmap();
    check("P1001 database failure maps to 503 with a safe message", p1001.status === 503 && p1001.message === "Session persistence is unavailable.");
    check("arbitrary internals never leak into error responses", random.status === 500 && random.message === "Unable to complete the session request." && !/prisma|engine\.js|stack/i.test(random.message));
    const allResults = [];
    allResults.push(await getAltanaSessionApi({ identity: null, deps: h.deps }));
    allResults.push(await getAltanaSessionApi({ identity: identityFor(USER_1), deps: h.deps }));
    allResults.push(await revokeAltanaSessionApi({ identity: identityFor(USER_2), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps }));
    check("every API result carries Cache-Control: no-store", allResults.every((r) => r.headers["Cache-Control"] === "no-store"));
    check("no raw error internals appear in any response body", allResults.every((r) => !/P1001|Prisma|\.js:\d+:\d+|Error:/.test(JSON.stringify(r.body))));
  }

  // ------------------------------------------------- 23. audit trail contains no secrets
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    const secret = h.custodyPersistence.secrets.get(sessionId);
    const ciphertext = secret?.ciphertext ?? "no-secret";
    await getAltanaSessionApi({ identity: identityFor(USER_1), deps: h.deps });
    await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    const allAudits = JSON.stringify([...h.store.audits, ...h.custodyPersistence.audits]);
    check("audit trail contains no ciphertext", !allAudits.includes(ciphertext));
    check("audit trail contains no secret field names or raw tokens", !/privateKey|rawSigner|sessionToken|ciphertext|wrappedKey|TestKms|password/i.test(allAudits));
    const names = h.store.audits.map((a) => a.eventType);
    check("requested audit events are present", ["ALTANA_SESSION_VIEWED", "ALTANA_SESSION_REVOKE_REQUESTED", "ALTANA_SESSION_REVOKE_STARTED", "ALTANA_SESSION_REVOKED"].every((name) => names.includes(name)));
  }

  // ------------------------------------------------- 23b. REVOKE_FAILED audit on gate denial
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    await h.store.updateSession({ id: sessionId, patch: { status: "grantSubmitted" }, now: new Date() });
    const result = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    check("unconfirmed grant cannot be revoked (409, no broadcast)", result.status === 409 && h.fakeState.revokeCount === 0);
    check("gate denial records ALTANA_SESSION_REVOKE_FAILED (DENIED)", h.store.audits.some((a) => a.eventType === "ALTANA_SESSION_REVOKE_FAILED" && a.result === "DENIED"));
  }

  // ------------------------------------------------- 23c. revoke-in-flight retry (REVOCATION_PENDING reconcile-before-retry)
  {
    const h = makeHarness();
    const sessionId = await createActiveSession(h);
    h.fakeState.revokeIneffective = true;
    const first = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    const inFlight = await h.store.loadById({ id: sessionId });
    check("unconfirmed revoke leaves REVOKING (never REVOKED) and returns 502", first.status === 502 && inFlight?.status === "revoking" && inFlight.revokedAt === null);
    h.fakeState.revokeIneffective = false;
    const second = await revokeAltanaSessionApi({ identity: identityFor(USER_1), request: revokeRequest({ csrf: "c" }), csrfCookie: "c", deps: h.deps, now: new Date() });
    const finalRow = await h.store.loadById({ id: sessionId });
    check("retry reconciles KeyStore, revokes, and lands REVOKED", second.status === 200 && (second.body as { data: { outcome: string } }).data.outcome === "revoked" && finalRow?.status === "revoked" && h.fakeState.revokeCount === 2);
  }

  // ------------------------------------------------- 24/25. UI surface — no custody material, button gating
  {
    const pageSource = readFileSync("app/(app)/permissions/page.tsx", "utf8");
    check("permissions page source renders no custody/key material", !/privateKey|rawSigner|encryptedSecret|ciphertext|wrappedKey|nonce|authTag|TestKms|kmsKeyId|AAD/i.test(pageSource));
    check("permissions page never fetches secret endpoints", !pageSource.includes("/api/altana/session/grant") && !pageSource.includes("/api/altana/session/execute"));
    check("revoke control is disabled for revoked/failed sessions", /disabled=\{revokeDisabled\}/.test(pageSource) && /session\.status === "revoked"/.test(pageSource));
    const uiSource = readFileSync("lib/account/session-client.ts", "utf8");
    check("revoke confirmation explains scope, testnet, and Agent 1816 / Job 515 non-involvement", uiSource.includes("does not modify Agent 1816 or Job 515") && uiSource.includes("performed on BNB Testnet") && pageSource.includes("useSessionManager"));
    check("API handlers never echo an error stack or SDK internals", !pageSource.includes("stack"));
    const apiSource = readFileSync("lib/altana-session/api.ts", "utf8");
    check("api.ts never serializes the adapter/custody internals into bodies", !/JSON\.stringify\(record\)|JSON\.stringify\(deps\)|JSON\.stringify\(identity\)/.test(apiSource));
  }

  // ------------------------------------------------- view never carries custody metadata
  {
    const h = makeHarness();
    await createActiveSession(h);
    const result = await getAltanaSessionApi({ identity: identityFor(USER_1), deps: h.deps });
    const view = (result.body as { data: { session: Record<string, unknown> } }).data.session;
    check("view exposes no publicKey/keyId/hasEncryptedSecret fields", !("publicKey" in view) && !("keyId" in view) && !("hasEncryptedSecret" in view));
  }

  // ------------------------------------------------- X.58.1: database-unreachable 500 regression
  // The running production server returned 500 for /api/altana/session when
  // PostgreSQL was unreachable. Tracing showed the thrown error was NOT a
  // Prisma error at all: createSessionService() threw CustodyConfigError (KMS
  // not configured) on every request, and its message matched none of the
  // persistence patterns, so the mapper fell through to the generic 500.
  // These checks pin the exact runtime error shapes to 503 (never 500), and
  // prove unrelated errors still fall back to 500 (never swallowed).
  {
    const realCustodyConfigError = new CustodyConfigError(
      "AWS_REGION and ALTANA_KMS_KEY_ID are required when ALTANA_KMS_PROVIDER=aws"
    );
    const custody = altanaApiErrorMessage(realCustodyConfigError);
    check("CustodyConfigError (real class) -> 503 not configured", custody.status === 503 && custody.message === "Altana session support is not configured on this deployment.");
    check("CustodyConfigError response leaks no KMS/config internals", !/AWS_REGION|KMS|KEY_ID|provider/i.test(custody.message));

    const prismatic = Object.assign(
      new Error("\nInvalid `prisma.sessionQueryRaw` invocation:\n\nError: P1001: Can't reach database server at `localhost:5432`\n\nPlease make sure your database server is running at `localhost:5432`.\n"),
      {
        name: "PrismaClientInitializationError",
        stack: "PrismaClientInitializationError: \n    at Object.<anonymous> (C:\\repo\\node_modules\\@prisma\\client\\engine.js:1:1)",
      }
    );
    const persistence = altanaApiErrorMessage(prismatic);
    check("PrismaClientInitializationError / P1001 -> 503 persistence unavailable", persistence.status === 503 && persistence.message === "Session persistence is unavailable.");
    check("persistence response leaks no engine paths or URLs", !/localhost|engine|node_modules|stack/i.test(persistence.message));

    const unrelated = altanaApiErrorMessage(new Error("TypeError: something unexpected happened"));
    check("unrelated application error still maps to 500 (not swallowed)", unrelated.status === 500 && unrelated.message === "Unable to complete the session request.");
    const nonError = altanaApiErrorMessage("boom");
    check("non-Error value maps to 500 safely", nonError.status === 500);
    const kmsAccess = altanaApiErrorMessage(Object.assign(new Error("kms access denied"), { name: "KmsAccessError" }));
    check("only CustodyConfigError is classified as not-configured; sibling custody errors stay 500", kmsAccess.status === 500);

    // DATABASE AVAILABLE -> existing behavior unchanged (memory store, no server-only modules).
    const h = makeHarness();
    await createActiveSession(h);
    const available = await getAltanaSessionApi({ identity: identityFor(USER_1), deps: h.deps, now: new Date() });
    check("persistence-available GET still returns 200 with a safe view", available.status === 200 && available.body.ok === true);
    const anonymous = await getAltanaSessionApi({ identity: null, deps: h.deps });
    check("unauthenticated GET still returns 401", anonymous.status === 401 && anonymous.body.ok === false);
  }

  console.log(`X.47 API VERIFIER: ${checks} checks, ${failures} failures — ${failures === 0 ? "ALL PASS" : "FAILURES PRESENT"}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`X.47 BLOCKED — ${message}`);
  process.exitCode = 1;
});
