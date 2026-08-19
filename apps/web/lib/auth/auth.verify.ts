import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { SiweMessage } from "siwe";
import { createAuthChallenge, verifyAuthentication } from "./service.ts";
import { sha256 } from "./crypto.ts";
import { getAuthenticatedUserFromStore } from "./session-core.ts";
import type {
  AuthStore,
  ChallengeRecord,
  CompleteAuthenticationInput,
  CompleteAuthenticationResult,
  CreateChallengeInput,
  AuthenticatedIdentity,
} from "./types.ts";

const config = { domain: "localhost:3000", uri: "http://localhost:3000/login", sessionTtlMs: 86_400_000 };
const now = new Date("2026-08-15T12:00:00.000Z");
const account = privateKeyToAccount(generatePrivateKey());
const address = account.address.toLowerCase();

class MemoryAuthStore implements AuthStore {
  challenges: ChallengeRecord[] = [];
  sessions: Array<AuthenticatedIdentity & { tokenHash: string; csrfTokenHash: string; revokedAt: Date | null }> = [];
  audits: Array<{ eventType: string; result: string; safeMetadata?: Record<string, unknown> }> = [];
  conflict = false;

  countRecentChallenges(walletAddress: string | null, since: Date) {
    return Promise.resolve(this.challenges.filter((item) => (walletAddress === null || item.address === walletAddress) && item.createdAt.getTime() >= since.getTime()).length);
  }
  createChallenge(input: CreateChallengeInput) {
    const challenge = { ...input, id: `challenge-${this.challenges.length + 1}`, consumedAt: null, createdAt: input.issuedAt };
    this.challenges.push(challenge);
    return Promise.resolve(challenge);
  }
  findChallengeByAttemptHash(attemptHash: string) {
    return Promise.resolve(this.challenges.find((item) => item.attemptHash === attemptHash) ?? null);
  }
  completeAuthentication(input: CompleteAuthenticationInput): Promise<CompleteAuthenticationResult> {
    const challenge = this.challenges.find((item) => item.id === input.challengeId && item.attemptHash === input.attemptHash && !item.consumedAt && item.expiresAt > input.now);
    if (!challenge) return Promise.resolve({ ok: false, reason: "challenge-unavailable" });
    if (this.conflict) return Promise.resolve({ ok: false, reason: "ownership-conflict" });
    challenge.consumedAt = input.now;
    const identity: AuthenticatedIdentity = { sessionId: `session-${this.sessions.length + 1}`, sessionExpiresAt: input.expiresAt, lastUsedAt: input.now, userId: "user-1", walletId: "wallet-1", walletAddress: address as `0x${string}`, chainId: 97 };
    this.sessions.push({ ...identity, tokenHash: input.tokenHash, csrfTokenHash: input.csrfTokenHash, revokedAt: null });
    return Promise.resolve({ ok: true, identity });
  }
  findActiveSession(tokenHash: string, at: Date) {
    const session = this.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt && item.sessionExpiresAt > at);
    return Promise.resolve(session ? { sessionId: session.sessionId, sessionExpiresAt: session.sessionExpiresAt, lastUsedAt: session.lastUsedAt, userId: session.userId, walletId: session.walletId, walletAddress: session.walletAddress, chainId: 97 as const } : null);
  }
  touchSession(sessionId: string, at: Date) {
    const session = this.sessions.find((item) => item.sessionId === sessionId);
    if (session) session.lastUsedAt = at;
    return Promise.resolve();
  }
  revokeSession(tokenHash: string, csrfTokenHash: string, at: Date) {
    const session = this.sessions.find((item) => item.tokenHash === tokenHash && item.csrfTokenHash === csrfTokenHash && !item.revokedAt);
    if (session) session.revokedAt = at;
    return Promise.resolve(Boolean(session));
  }
  writeAudit(input: { eventType: string; result: "SUCCESS" | "FAILURE" | "DENIED"; safeMetadata?: Record<string, string | number | boolean | null> }) {
    this.audits.push(input);
    return Promise.resolve();
  }
}

function check(name: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL ${name}`);
  console.log(`PASS ${name}`);
}

const store = new MemoryAuthStore();
const challenge = await createAuthChallenge({ store, address, config, now });
check("nonce creation is persisted and audited", store.challenges.length === 1 && store.audits[0]?.eventType === "SIWE_NONCE_CREATED");
check("nonce has at least 128 bits of entropy", /^[a-f0-9]{32}$/.test(new SiweMessage(challenge.message).nonce));
check("nonce expires in five minutes", challenge.expiresAt.getTime() - now.getTime() === 300_000);
const parsed = new SiweMessage(challenge.message);
check("SIWE message is canonical", parsed.domain === config.domain && parsed.uri === config.uri && parsed.version === "1" && parsed.chainId === 97 && parsed.statement === "Sign in to BNB Agent Studio Marketplace.");
const signature = await account.signMessage({ message: challenge.message });

const success = await verifyAuthentication({ store, attemptToken: challenge.attemptToken, message: challenge.message, signature, config, now: new Date(now.getTime() + 1_000) });
check("successful authentication", success.ok);
if (!success.ok) throw new Error("success fixture failed");
check("wallet ownership created", success.identity.walletAddress === address && success.identity.chainId === 97);
check("session token is hashed before storage", store.sessions[0]?.tokenHash === sha256(success.sessionToken) && store.sessions[0]?.tokenHash !== success.sessionToken);
check("raw token never appears in audit records", !JSON.stringify(store.audits).includes(success.sessionToken));
const replay = await verifyAuthentication({ store, attemptToken: challenge.attemptToken, message: challenge.message, signature, config, now: new Date(now.getTime() + 2_000) });
check("nonce is single-use", !replay.ok && replay.reason === "consumed-challenge");

async function rejectedVariant(name: string, message: string, expected?: string) {
  const next = await createAuthChallenge({ store, address, config, now });
  const result = await verifyAuthentication({ store, attemptToken: next.attemptToken, message, signature, config, now: new Date(now.getTime() + 1_000) });
  check(name, !result.ok && (!expected || result.reason === expected));
}

const wrongDomain = new SiweMessage({ ...parsed, domain: "evil.example" }).prepareMessage();
await rejectedVariant("wrong domain rejection", wrongDomain, "invalid-domain");
const wrongUri = new SiweMessage({ ...parsed, uri: "https://evil.example/login" }).prepareMessage();
await rejectedVariant("wrong URI rejection", wrongUri, "invalid-uri");
const wrongChain = new SiweMessage({ ...parsed, chainId: 1 }).prepareMessage();
await rejectedVariant("wrong chain rejection", wrongChain, "invalid-chain");
const wrongNonce = new SiweMessage({ ...parsed, nonce: "00000000000000000000000000000000" }).prepareMessage();
await rejectedVariant("wrong nonce rejection", wrongNonce, "invalid-nonce");
const expired = await createAuthChallenge({ store, address, config, now });
const expiredSignature = await account.signMessage({ message: expired.message });
const expiredResult = await verifyAuthentication({ store, attemptToken: expired.attemptToken, message: expired.message, signature: expiredSignature, config, now: new Date(expired.expiresAt.getTime() + 1) });
check("expired message rejection", !expiredResult.ok && expiredResult.reason === "expired-challenge");
const invalidSignature = await verifyAuthentication({ store, attemptToken: expired.attemptToken, message: expired.message, signature: "0x1234", config, now });
check("invalid signature rejection", !invalidSignature.ok);
const otherAccount = privateKeyToAccount(generatePrivateKey());
const signerMismatchChallenge = await createAuthChallenge({ store, address, config, now });
const signerMismatchSignature = await otherAccount.signMessage({ message: signerMismatchChallenge.message });
const signerMismatch = await verifyAuthentication({ store, attemptToken: signerMismatchChallenge.attemptToken, message: signerMismatchChallenge.message, signature: signerMismatchSignature, config, now });
check("signer/address mismatch rejection", !signerMismatch.ok && signerMismatch.reason === "wrong-wallet");

const authUser = await getAuthenticatedUserFromStore(store, success.sessionToken, new Date(now.getTime() + 301_000));
check("authenticated-user lookup", authUser?.walletAddress === address);
check("last-used timestamp updates", authUser?.lastUsedAt.getTime() === now.getTime() + 301_000);
const expiredUser = await getAuthenticatedUserFromStore(store, success.sessionToken, new Date(success.expiresAt.getTime() + 1));
check("expired session rejection", expiredUser === null);
const session = store.sessions[0];
if (!session) throw new Error("missing session fixture");
session.revokedAt = new Date(now.getTime() + 3_000);
check("revoked session rejection", await getAuthenticatedUserFromStore(store, success.sessionToken, new Date(now.getTime() + 4_000)) === null);
session.revokedAt = null;
check("logout revokes session", await store.revokeSession(sha256(success.sessionToken), sha256(success.csrfToken), new Date(now.getTime() + 5_000)));
check("logout idempotency", !(await store.revokeSession(sha256(success.sessionToken), sha256(success.csrfToken), new Date(now.getTime() + 6_000))));

const conflictStore = new MemoryAuthStore();
conflictStore.conflict = true;
const conflictChallenge = await createAuthChallenge({ store: conflictStore, address, config, now });
const conflictSignature = await account.signMessage({ message: conflictChallenge.message });
const conflict = await verifyAuthentication({ store: conflictStore, attemptToken: conflictChallenge.attemptToken, message: conflictChallenge.message, signature: conflictSignature, config, now });
check("wallet ownership conflict", !conflict.ok && conflict.reason === "ownership-conflict");
check("ownership conflict preserves nonce", conflictStore.challenges[0]?.consumedAt === null);
console.log("X.42 auth offline verification: PASS");
