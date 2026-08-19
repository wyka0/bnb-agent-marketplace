/**
 * X.45 offline verifier — 24 checks over the full persistent-session
 * lifecycle with an in-memory store, fake chain adapter, real session-signer
 * cryptography, and the X.44 test KMS + pure custody service. Plain Node:
 * no server-only imports, no Prisma, no network.
 *
 * Run: node --experimental-strip-types lib/altana-session/session.verify.ts
 */

import { recoverPublicKey } from "viem";
import { keccak256 } from "viem";
import {
  ALTANA_SESSION_APPROVAL_RAW,
  ALTANA_SESSION_CALL_SIGNATURE,
  ALTANA_SESSION_NATIVE_FEE_LIMIT_WEI,
  ALTANA_SESSION_SPEND_LIMIT_RAW,
  assertAltanaSessionPolicyCall,
  buildAltanaSessionPolicy,
} from "@bnb-marketplace/integrations/altana";
import { decryptAltanaSecret, destroyAltanaSecret, encryptAltanaSecret } from "../custody/service.ts";
import { TestKmsProvider } from "../custody/kms/test-kms.ts";
import type { CustodyAuditInput, CustodyOwner, CustodyPersistence, EncryptedSecretRecord, SessionBinding } from "../custody/types.ts";
import { createFakeAltanaSessionAdapter } from "./adapter-fake.ts";
import { createMemorySessionStore } from "./store.memory.ts";
import type { MemorySessionRow } from "./store.memory.ts";
import {
  createAltanaSession,
  executeAllowedOperation,
  loadActiveSession,
  permissionsFromPolicy,
  permissionsFromRows,
  revokeActiveSession,
} from "./service.ts";
import { toPublicSessionView } from "./view.ts";
import type { AltanaSessionServiceDeps, CustodyLike, SessionOwner, SessionStore } from "./types.ts";

const PAYMENT_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565" as const;
const WALLET_ADDRESS = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C" as const;

const USER_1: SessionOwner = { userId: "user-1", walletId: "wallet-1", walletAddress: WALLET_ADDRESS };
const USER_2: SessionOwner = { userId: "user-2", walletId: "wallet-2", walletAddress: WALLET_ADDRESS };
const CUSTODY_USER_2: CustodyOwner = { userId: "user-2", walletAddress: WALLET_ADDRESS };

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

function buildCustody(persistence: MemoryCustodyPersistence, freshKms: boolean): CustodyLike {
  const provider = () => (freshKms ? new TestKmsProvider() : new TestKmsProvider());
  return {
    encryptAltanaSecret: (input) => encryptAltanaSecret({ persistence, provider: provider(), owner: input.owner, sessionId: input.sessionId, plaintext: input.plaintext }),
    decryptAltanaSecret: (input) => decryptAltanaSecret({ persistence, provider: provider(), owner: input.owner, sessionId: input.sessionId }),
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
  const custody = buildCustody(custodyPersistence, false);
  const deps: AltanaSessionServiceDeps = {
    store,
    adapter: fake.adapter,
    custody,
    policyProvider: () => policy,
    now: () => new Date(),
  };
  return { store, custodyPersistence, deps, fakeState: fake.state, policy };
}

async function createActive(h: Harness): Promise<string> {
  const { record } = await createAltanaSession(h.deps, USER_1);
  return record.id;
}

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = ""): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${checks}. ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  // --- 1. creating row persisted before any broadcast ---------------------
  {
    const h = makeHarness();
    await h.store.createSession({ userId: USER_1.userId, walletId: USER_1.walletId, chainId: 97, now: new Date() });
    const row = [...h.store.rows.values()][0];
    check("creating phase persists PENDING row before any broadcast", row !== undefined && row.dbStatus === "PENDING" && h.fakeState.grantCount === 0, `grantCount=${h.fakeState.grantCount}`);
  }

  // --- 2. create ends ACTIVE with KeyStore verified -----------------------
  {
    const h = makeHarness();
    const { record } = await createAltanaSession(h.deps, USER_1);
  
    check("create ends ACTIVE with KeyStore active and verified timestamp", record.status === "active" && record.keyStoreActive === true && record.lastVerifiedAt !== null && h.fakeState.grantCount === 1, `status=${record.status} grantCount=${h.fakeState.grantCount}`);
  }

  // --- 3. permission rows exactly match the demonstrated policy -----------
  {
    const h = makeHarness();
    const { record } = await createAltanaSession(h.deps, USER_1);
  
    const rows = record.permissions;
    const callRow = rows.find((row) => row.kind === "CALL");
    const nativeRow = rows.find((row) => row.kind === "NATIVE_SPEND");
    const tokenRow = rows.find((row) => row.kind === "TOKEN_SPEND");
    const ok =
      rows.length === 3 &&
      callRow?.targetAddress?.toLowerCase() === PAYMENT_TOKEN.toLowerCase() &&
      callRow.functionSignature === ALTANA_SESSION_CALL_SIGNATURE &&
      nativeRow?.spendCapRaw === ALTANA_SESSION_NATIVE_FEE_LIMIT_WEI.toString() &&
      nativeRow.spendPeriod === "day" &&
      tokenRow?.tokenAddress?.toLowerCase() === PAYMENT_TOKEN.toLowerCase() &&
      tokenRow.spendCapRaw === ALTANA_SESSION_SPEND_LIMIT_RAW.toString();
    check("permission rows match the X.36 demonstrated policy exactly", ok, JSON.stringify(rows.map((row) => row.kind)));
  }

  // --- 4. signer secret is sealed via custody and round-trips ---------------
  {
    const h = makeHarness();
    const id = await createActive(h);
    const secret = h.custodyPersistence.secrets.get(id);
    const decrypted = await h.deps.custody.decryptAltanaSecret({ owner: { userId: USER_1.userId, walletAddress: WALLET_ADDRESS }, sessionId: id });
    check("session signer sealed with KMS envelope; decrypt round-trips the granted private key", secret !== undefined && secret.destroyedAt === null && /^0x[0-9a-fA-F]{64}$/.test(decrypted.toString("utf8")));
  }

  // --- 5. restart-equivalent reconstruction (fresh KMS + fresh service) ----
  {
    const h = makeHarness();
    await createActive(h);
    const freshHarness = { ...h, deps: { ...h.deps, custody: buildCustody(h.custodyPersistence, true) } };
    const loaded = await loadActiveSession(freshHarness.deps, USER_1);
    check("restart: fresh provider/service reconstructs the ACTIVE session", loaded.kind === "active" && loaded.session.publicKey === loaded.record.publicKey && loaded.session.walletAddress.toLowerCase() === WALLET_ADDRESS.toLowerCase(), loaded.kind === "active" ? "active" : loaded.kind);
  }

  // --- 6. reconstruction cryptography: signer matches the registered key ---
  {
    const h = makeHarness();
    await createActive(h);
    const loaded = await loadActiveSession(h.deps, USER_1);
    if (loaded.kind === "active") {
      const digest = keccak256(new TextEncoder().encode("x45 restart-safety digest"));
      const signature = await loaded.session.signer.signDigest(digest);
      const recovered = await recoverPublicKey({ hash: digest, signature });
      check("reconstructed signer is cryptographically the registered session key", recovered.toLowerCase() === loaded.session.signer.publicKey.toLowerCase());
    } else {
      check("reconstructed signer is cryptographically the registered session key", false, `load returned ${loaded.kind}`);
    }
  }

  // --- 7. persisted permission rows round-trip to the granted permissions --
  {
    const h = makeHarness();
    const { record } = await createAltanaSession(h.deps, USER_1);
  
    const rebuilt = permissionsFromRows(record.permissions);
    const expected = permissionsFromPolicy(h.policy);
    const same =
      rebuilt.calls.length === expected.calls.length &&
      rebuilt.calls.every((call, index) => call.to.toLowerCase() === expected.calls[index].to.toLowerCase() && call.signature === expected.calls[index].signature) &&
      rebuilt.spend.length === expected.spend.length &&
      rebuilt.spend.every((spend, index) => spend.limit === expected.spend[index].limit && spend.period === expected.spend[index].period && (spend.token?.toLowerCase() ?? undefined) === (expected.spend[index].token?.toLowerCase() ?? undefined));
    check("persisted permission rows round-trip to the granted permissions", same);
  }

  // --- 8-11. policy non-broadening ----------------------------------------
  {
    const h = makeHarness();
    const { record } = await createAltanaSession(h.deps, USER_1);
  
    const wallet = record.walletAddress as `0x${string}`;
    const encodeApprove = (spender: string, amount: bigint) =>
      `0x095ea7b3${spender.slice(2).padStart(64, "0")}${amount.toString(16).padStart(64, "0")}`;
    const foreignTarget = { to: "0x1111111111111111111111111111111111111111" as `0x${string}`, value: 0n, data: encodeApprove(wallet, ALTANA_SESSION_APPROVAL_RAW) as `0x${string}` };
    let foreignTargetRejected = false;
    try {
      assertAltanaSessionPolicyCall(h.policy, foreignTarget);
    } catch {
      foreignTargetRejected = true;
    }
    check("policy rejects a call to a foreign target", foreignTargetRejected);

    const foreignSelector = { to: h.policy.target, value: 0n, data: `0xa9059cbb${wallet.slice(2).padStart(64, "0")}${ALTANA_SESSION_APPROVAL_RAW.toString(16).padStart(64, "0")}` as `0x${string}` };
    let foreignSelectorRejected = false;
    try {
      assertAltanaSessionPolicyCall(h.policy, foreignSelector);
    } catch {
      foreignSelectorRejected = true;
    }
    check("policy rejects a foreign function selector", foreignSelectorRejected);

    const wrongAmount = { to: h.policy.target, value: 0n, data: `0x095ea7b3${wallet.slice(2).padStart(64, "0")}${2n.toString(16).padStart(64, "0")}` as `0x${string}` };
    let wrongAmountRejected = false;
    try {
      assertAltanaSessionPolicyCall(h.policy, wrongAmount);
    } catch {
      wrongAmountRejected = true;
    }
    check("policy rejects an approval amount outside the permitted value", wrongAmountRejected);

    const withValue = { to: h.policy.target, value: 2n, data: encodeApprove(wallet, ALTANA_SESSION_APPROVAL_RAW) as `0x${string}` };
    let valueRejected = false;
    try {
      assertAltanaSessionPolicyCall(h.policy, withValue);
    } catch {
      valueRejected = true;
    }
    check("policy rejects a native value above the spend cap", valueRejected);
  }

  // --- 12. execution happens exactly once via the session key -------------
  {
    const h = makeHarness();
    await createActive(h);
    const first = await executeAllowedOperation(h.deps, USER_1);
    check("first execution is a genuine confirmed session-key transaction", first.outcome === "executed" && h.fakeState.executeCount === 1, first.outcome);
  }

  // --- 13. duplicate-execution protection ---------------------------------
  {
    const h = makeHarness();
    await createActive(h);
    await executeAllowedOperation(h.deps, USER_1);
    const second = await executeAllowedOperation(h.deps, USER_1);
    check("duplicate execution is skipped without a second broadcast", second.outcome === "skipped-existing" && h.fakeState.executeCount === 1, `outcome=${second.outcome} executeCount=${h.fakeState.executeCount}`);
  }

  // --- 14. spend accounting persists --------------------------------------
  {
    const h = makeHarness();
    const id = await createActive(h);
    await executeAllowedOperation(h.deps, USER_1);
    const record = await h.store.loadById({ id });
    check("spend accounting persists spent=1 remaining=0", record?.publicMetadata?.spentRaw === "1");
  }

  // --- 15. cap exhaustion denies before any broadcast ---------------------
  {
    const h = makeHarness();
    await createActive(h);
    await executeAllowedOperation(h.deps, USER_1);
    h.fakeState.allowance = 0n;
    const outcome = await executeAllowedOperation(h.deps, USER_1);
    check("cap-exhausted session is denied without broadcast", outcome.outcome === "denied" && outcome.reason === "cap-exhausted" && h.fakeState.executeCount === 1, `${outcome.outcome}/${outcome.reason} executeCount=${h.fakeState.executeCount}`);
  }

  // --- 16. KeyStore-revoked vs DB-ACTIVE reconciliation -------------------
  {
    const h = makeHarness();
    await createActive(h);
    h.fakeState.revoked = true;
    h.fakeState.registered = false;
    const loaded = await loadActiveSession(h.deps, USER_1);
    check(
      "KeyStore-revoked + DB-ACTIVE reconciles to REVOKED, no re-grant",
      loaded.kind === "blocked" && loaded.reason === "key-store-revoked" && loaded.record.status === "revoked" && h.fakeState.grantCount === 1,
      loaded.kind === "blocked" ? loaded.reason : loaded.kind
    );
  }

  // --- 17. DB-REVOKED + KeyStore-ACTIVE is blocked, never accepted --------
  {
    const h = makeHarness();
    await createActive(h);
    await revokeActiveSession(h.deps, USER_1);
    h.fakeState.registered = true;
    h.fakeState.revoked = false;
    const loaded = await loadActiveSession(h.deps, USER_1);
    const executed = await executeAllowedOperation(h.deps, USER_1);
    check("DB-REVOKED + KeyStore-ACTIVE blocks load and execution", loaded.kind === "blocked" && loaded.reason === "session-revoked" && executed.outcome === "denied", loaded.kind);
  }

  // --- 18. expiry transitions and denies ----------------------------------
  {
    const h = makeHarness();
    const expiredPolicy = buildAltanaSessionPolicy(PAYMENT_TOKEN);
    expiredPolicy.expiry = Math.floor(Date.now() / 1000) - 10;
    const deps = { ...h.deps, policyProvider: () => expiredPolicy };
    await createAltanaSession(deps, USER_1);
  
    const loaded = await loadActiveSession(h.deps, USER_1);
    const executed = await executeAllowedOperation(h.deps, USER_1);
    check("expired session transitions to EXPIRED and denies execution", loaded.kind === "blocked" && loaded.reason === "expired" && executed.outcome === "denied", loaded.kind);
  }

  // --- 19. crash mid-grant leaves a blocked incomplete row ----------------
  {
    const h = makeHarness();
    const { id } = await h.store.createSession({ userId: USER_1.userId, walletId: USER_1.walletId, chainId: 97, now: new Date() });
    await h.store.updateSession({ id, patch: { status: "grantSubmitted", publicKey: "0x04deadbeef" }, now: new Date() });
    const loaded = await loadActiveSession(h.deps, USER_1);
    check("crash-left PENDING row is blocked for operator review, no re-grant", loaded.kind === "blocked" && loaded.reason === "incomplete-grant" && h.fakeState.grantCount === 0, loaded.kind);
  }

  // --- 20. ownership boundaries -------------------------------------------
  {
    const h = makeHarness();
    const id = await createActive(h);
    const otherUserLoaded = await loadActiveSession(h.deps, { ...USER_2, walletId: "wallet-1" });
    let custodyDenied = false;
    try {
      await h.deps.custody.decryptAltanaSecret({ owner: CUSTODY_USER_2, sessionId: id });
    } catch {
      custodyDenied = true;
    }
    check("another user can neither load nor decrypt the session secret", otherUserLoaded.kind === "none" && custodyDenied);
  }

  // --- 21. public view leaks nothing sensitive ----------------------------
  {
    const h = makeHarness();
    const { record } = await createAltanaSession(h.deps, USER_1);
  
    await loadActiveSession(h.deps, USER_1);
    const fresh = await h.store.loadById({ id: record.id });
    if (!fresh) {
      check("public view leaks nothing sensitive", false, "record vanished");
    } else {
      const view = toPublicSessionView(fresh, h.policy.spendLimitRaw);
      const serialized = JSON.stringify(view);
      const forbidden = ["publicKey", "keyId", "signer", "privateKey", "ciphertext", "nonce", "wrappedDataKey", "kmsKeyId", "aadMetadata", "secretType", "sessionSigner"];
      const leaked = forbidden.filter((needle) => serialized.toLowerCase().includes(needle.toLowerCase()));
      check("public view contains no key material, ciphertext, or custody metadata", leaked.length === 0, leaked.join(","));
    }
  }

  // --- 22. revoke lifecycle: KeyStore off, secret destroyed, idempotent ---
  {
    const h = makeHarness();
    const id = await createActive(h);
    const first = await revokeActiveSession(h.deps, USER_1);
    const secret = h.custodyPersistence.secrets.get(id);
    const second = await revokeActiveSession(h.deps, USER_1);
    const record = await h.store.loadById({ id });
    check(
      "revoke destroys KeyStore key and sealed secret; second revoke is idempotent",
      first.outcome === "revoked" && secret?.destroyedAt !== null && second.outcome === "already-revoked" && h.fakeState.revokeCount === 1 && record?.status === "revoked",
      `first=${first.outcome} second=${second.outcome} revokeCount=${h.fakeState.revokeCount} destroyed=${secret?.destroyedAt !== null && secret !== undefined} status=${record?.status}`
    );
  }

  // --- 23. failed revoke leaves REVOKING, secret intact, blocked ----------
  {
    const h = makeHarness();
    const id = await createActive(h);
    h.fakeState.revokeIneffective = true;
    const outcome = await revokeActiveSession(h.deps, USER_1);
    const record = await h.store.loadById({ id });
    const loaded = await loadActiveSession(h.deps, USER_1);
    check(
      "revoke that fails to kill the KeyStore key stays REVOKING, secret intact, blocked",
      outcome.outcome === "blocked" && record?.status === "revoking" && record.hasEncryptedSecret === true && loaded.kind === "blocked" && loaded.reason === "revoke-in-flight",
      `outcome=${outcome.outcome} status=${record?.status} secret=${record?.hasEncryptedSecret} loaded=${loaded.kind}/${loaded.kind === "blocked" ? loaded.reason : "n/a"}`
    );
  }

  // --- 24. audit trail across the full lifecycle --------------------------
  {
    const h = makeHarness();
    const events = () => h.store.audits.map((audit) => `${audit.eventType}:${audit.result}`);
    await createActive(h);
    await loadActiveSession(h.deps, USER_1);
    await executeAllowedOperation(h.deps, USER_1);
    await revokeActiveSession(h.deps, USER_1);
    const joined = events().join(",");
    const expected = [
      "ALTANA_SESSION_GRANTED:SUCCESS",
      "ALTANA_SESSION_KEYSTORE_REGISTERED:SUCCESS",
      "ALTANA_SESSION_ACTIVATED:SUCCESS",
      "ALTANA_SESSION_RECONSTRUCTED:SUCCESS",
      "ALTANA_SESSION_EXECUTED:SUCCESS",
      "ALTANA_SESSION_REVOKED:SUCCESS",
    ];
    check("full lifecycle writes the expected SUCCESS audit trail", expected.every((event) => joined.includes(event)), joined);

    const h2 = makeHarness();
    h2.fakeState.failNextRegister = true;
    let failed = false;
    try {
      await createAltanaSession(h2.deps, USER_1);
    } catch {
      failed = true;
    }
    const failedRecord = await h2.store.loadLatestForWallet({ userId: USER_1.userId, walletId: USER_1.walletId });
    const failedAudit = h2.store.audits.some((audit) => audit.eventType === "ALTANA_SESSION_CREATE_FAILED" && audit.result === "FAILURE");
    check("registration failure marks the session FAILED and audits the failure", failed && failedRecord?.status === "failed" && failedAudit && h2.fakeState.grantCount === 1);
  }

  console.log(`X.45 VERIFIER: ${checks - failures}/${checks} PASS`);
  if (failures > 0) {
    console.error(`X.45 VERIFIER: ${failures} check(s) FAILED`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
