import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createAuthChallenge, verifyAuthentication } from "./service.ts";
import { constantTimeEqual, sha256 } from "./crypto.ts";
import { getAuthenticatedUserFromStore, toPublicSessionInfo, walletBelongsToUser } from "./session-core.ts";
import {
  hasSafeMutationRequest,
  isCanonicalRequestOrigin,
  isFetchMetadataSafe,
  isJsonRequest,
  isPostRequest,
  isSameOrigin,
  readJson,
} from "./request.ts";
import { attemptCookiePolicy, clearSessionCookies, csrfCookiePolicy, sessionCookiePolicy } from "./cookie-policy.ts";
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
const otherAccount = privateKeyToAccount(generatePrivateKey());
const otherAddress = otherAccount.address.toLowerCase();

class RotatingMemoryAuthStore implements AuthStore {
  challenges: ChallengeRecord[] = [];
  sessions: Array<AuthenticatedIdentity & { tokenHash: string; csrfTokenHash: string; revokedAt: Date | null }> = [];
  audits: Array<{ eventType: string; result: string; safeMetadata?: Record<string, unknown> }> = [];
  walletOwners = new Map<string, { userId: string; walletId: string }>();
  nextUserId = 1;
  nextWalletId = 1;
  nextSessionId = 1;

  countRecentChallenges(walletAddress: string | null, since: Date) {
    return Promise.resolve(
      this.challenges.filter(
        (item) => (walletAddress === null || item.address === walletAddress) && item.createdAt.getTime() >= since.getTime()
      ).length
    );
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
    const challenge = this.challenges.find(
      (item) => item.id === input.challengeId && item.attemptHash === input.attemptHash && !item.consumedAt && item.expiresAt > input.now
    );
    if (!challenge) return Promise.resolve({ ok: false, reason: "challenge-unavailable" });
    challenge.consumedAt = input.now;
    const key = `${input.chainId}:${input.address}`;
    const owner =
      this.walletOwners.get(key) ?? { userId: `user-${this.nextUserId++}`, walletId: `wallet-${this.nextWalletId++}` };
    if (!this.walletOwners.has(key)) this.walletOwners.set(key, owner);
    const identity: AuthenticatedIdentity = {
      sessionId: `session-${this.nextSessionId++}`,
      sessionExpiresAt: input.expiresAt,
      lastUsedAt: input.now,
      userId: owner.userId,
      walletId: owner.walletId,
      walletAddress: input.address,
      chainId: input.chainId,
    };
    const previousSessionsRevoked = this.sessions.filter(
      (session) => session.userId === owner.userId && !session.revokedAt
    ).length;
    for (const session of this.sessions) {
      if (session.userId === owner.userId && !session.revokedAt) session.revokedAt = input.now;
    }
    this.sessions.push({ ...identity, tokenHash: input.tokenHash, csrfTokenHash: input.csrfTokenHash, revokedAt: null });
    return Promise.resolve({ ok: true, identity, previousSessionsRevoked });
  }
  findActiveSession(tokenHash: string, at: Date) {
    const session = this.sessions.find(
      (item) => item.tokenHash === tokenHash && !item.revokedAt && item.sessionExpiresAt > at
    );
    return Promise.resolve(
      session
        ? {
            sessionId: session.sessionId,
            sessionExpiresAt: session.sessionExpiresAt,
            lastUsedAt: session.lastUsedAt,
            userId: session.userId,
            walletId: session.walletId,
            walletAddress: session.walletAddress,
            chainId: 97 as const,
          }
        : null
    );
  }
  touchSession(sessionId: string, at: Date) {
    const session = this.sessions.find((item) => item.sessionId === sessionId);
    if (session) session.lastUsedAt = at;
    return Promise.resolve();
  }
  revokeSession(tokenHash: string, csrfTokenHash: string, at: Date) {
    const session = this.sessions.find(
      (item) => item.tokenHash === tokenHash && item.csrfTokenHash === csrfTokenHash && !item.revokedAt
    );
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

const store = new RotatingMemoryAuthStore();

async function authenticate(accountFixture: typeof account, walletAddress: string, at: Date) {
  const challenge = await createAuthChallenge({ store, address: walletAddress, config, now: at });
  const signature = await accountFixture.signMessage({ message: challenge.message });
  const result = await verifyAuthentication({
    store,
    attemptToken: challenge.attemptToken,
    message: challenge.message,
    signature,
    config,
    now: new Date(at.getTime() + 1_000),
  });
  if (!result.ok) throw new Error("authentication fixture failed");
  return result;
}

const first = await authenticate(account, address, now);
const second = await authenticate(account, address, new Date(now.getTime() + 10_000));
check("rotation: fresh random token per login", first.sessionToken !== second.sessionToken && first.csrfToken !== second.csrfToken);
check("rotation: previous session revoked on new login", second.previousSessionsRevoked === 1);
check("rotation: old session token no longer resolves", (await getAuthenticatedUserFromStore(store, first.sessionToken, new Date(now.getTime() + 11_000))) === null);
const activeAfterRotation = await getAuthenticatedUserFromStore(store, second.sessionToken, new Date(now.getTime() + 11_000));
check("rotation: newest session remains active", activeAfterRotation?.walletAddress === address);
check("rotation: hash-only persistence", store.sessions[1]?.tokenHash === sha256(second.sessionToken) && !JSON.stringify(store.audits).includes(second.sessionToken) && !JSON.stringify(store.audits).includes(second.csrfToken));
const rotationAudit = [...store.audits].reverse().find((item) => item.eventType === "SIWE_AUTH_SUCCESS");
check("rotation: audit records revoked count", rotationAudit?.safeMetadata?.previousSessionsRevoked === 1);

const thirdParty = await authenticate(otherAccount, otherAddress, new Date(now.getTime() + 20_000));
check("concurrency: other user unaffected by rotation", thirdParty.previousSessionsRevoked === 0 && (await getAuthenticatedUserFromStore(store, second.sessionToken, new Date(now.getTime() + 21_000))) !== null);

const staleExpired = new Date(now.getTime() + 30_000);
store.sessions.push({
  sessionId: "session-stale",
  sessionExpiresAt: new Date(now.getTime() + 30_000),
  lastUsedAt: now,
  userId: "user-stale",
  walletId: "wallet-stale",
  walletAddress: address,
  chainId: 97,
  tokenHash: sha256("stale-token"),
  csrfTokenHash: sha256("stale-csrf"),
  revokedAt: null,
});
check("expiry: throttled touch does not revive expired session", (await getAuthenticatedUserFromStore(store, "stale-token", new Date(staleExpired.getTime() + 1))) === null);
check("expiry: lastUsedAt untouched for expired session", store.sessions[3]?.lastUsedAt.getTime() === now.getTime());

const activeUser = await getAuthenticatedUserFromStore(store, second.sessionToken, new Date(now.getTime() + 360_001));
check("throttle: lastUsedAt refreshed only after throttle window", activeUser?.lastUsedAt.getTime() === now.getTime() + 360_001);

check("revocation: wrong CSRF token cannot revoke session", !(await store.revokeSession(sha256(second.sessionToken), sha256("wrong"), new Date(now.getTime() + 400_000))));
check("revocation: paired token+CSRF revokes session", await store.revokeSession(sha256(second.sessionToken), sha256(second.csrfToken), new Date(now.getTime() + 400_001)));
check("revocation: idempotent on repeat", !(await store.revokeSession(sha256(second.sessionToken), sha256(second.csrfToken), new Date(now.getTime() + 400_002))));

const identity = activeUser;
if (!identity) throw new Error("missing identity fixture");
const publicInfo = toPublicSessionInfo(identity);
const publicJson = JSON.stringify(publicInfo);
check("redaction: public identity exposes no DB ids", !publicJson.includes("userId") && !publicJson.includes("walletId") && !publicJson.includes("sessionId"));
check("redaction: public identity keeps wallet and expiry", publicInfo.walletAddress === address && publicInfo.chainId === 97 && publicInfo.sessionExpiresAt === identity.sessionExpiresAt.toISOString());
check("ownership: wallet belongs to user", walletBelongsToUser(identity, identity.walletId));
check("ownership: foreign wallet rejected", !walletBelongsToUser(identity, "wallet-other"));

const sessionPolicy = sessionCookiePolicy(new Date(now.getTime() + 1_000));
check("cookie: session is HttpOnly host cookie", sessionPolicy.name === "__Host-bnb_session" && sessionPolicy.options.httpOnly === true);
const csrfPolicy = csrfCookiePolicy(new Date(now.getTime() + 1_000));
check("cookie: csrf token is readable client cookie", csrfPolicy.name === "__Host-bnb_csrf" && csrfPolicy.options.httpOnly === false);
const attemptPolicy = attemptCookiePolicy();
check("cookie: attempt cookie short-lived", attemptPolicy.name === "__Host-siwe_attempt" && attemptPolicy.options.maxAge === 300);
for (const policy of [sessionPolicy, csrfPolicy, attemptPolicy]) {
  check(`cookie: ${policy.name} host attributes`, policy.options.secure === true && policy.options.sameSite === "lax" && policy.options.path === "/" && policy.options.domain === undefined);
}
const clearPolicies = clearSessionCookies();
check("cookie: logout clears all three cookies", clearPolicies.map((policy) => policy.name).join(",") === "__Host-bnb_session,__Host-bnb_csrf,__Host-siwe_attempt");
check("cookie: cleared cookies expire immediately", clearPolicies.every((policy) => policy.options.maxAge === 0 && policy.options.secure === true));

const baseUrl = "http://localhost:3000/api/auth/logout";
const safeHeaders = { "Content-Type": "application/json", Origin: "http://localhost:3000", "sec-fetch-site": "same-origin" };
check("constant-time csrf: equal values match", constantTimeEqual("abc-def", "abc-def"));
check("constant-time csrf: unequal values mismatch", !constantTimeEqual("abc-def", "abc-deg"));
check("canonical: same-origin request URL", isCanonicalRequestOrigin(new Request(baseUrl, { method: "POST", headers: safeHeaders }), "http://localhost:3000"));
check("canonical: cross-origin request URL rejected", !isCanonicalRequestOrigin(new Request("https://evil.example/logout", { method: "POST", headers: { ...safeHeaders, Origin: "https://evil.example" } }), "http://localhost:3000"));
check("request: POST-only mutation guard", isPostRequest(new Request(baseUrl, { method: "POST" })) && !isPostRequest(new Request(baseUrl, { method: "GET" })));
check("request: origin header guard", isSameOrigin(new Request(baseUrl, { method: "POST", headers: safeHeaders }), "http://localhost:3000") && !isSameOrigin(new Request(baseUrl, { method: "POST", headers: { ...safeHeaders, Origin: "https://evil.example" } }), "http://localhost:3000"));
check("request: json content-type guard", isJsonRequest(new Request(baseUrl, { method: "POST", headers: safeHeaders })) && !isJsonRequest(new Request(baseUrl, { method: "POST", headers: { ...safeHeaders, "Content-Type": "text/plain" } })));
check("request: fetch-metadata guard", isFetchMetadataSafe(new Request(baseUrl, { method: "POST", headers: safeHeaders })) && !isFetchMetadataSafe(new Request(baseUrl, { method: "POST", headers: { ...safeHeaders, "sec-fetch-site": "cross-site" } })));
check("request: safe mutation request accepted", hasSafeMutationRequest(new Request(baseUrl, { method: "POST", headers: safeHeaders, body: "{}" }), "http://localhost:3000"));
check("request: GET cannot mutate", !hasSafeMutationRequest(new Request(baseUrl, { method: "GET", headers: safeHeaders }), "http://localhost:3000"));
check("request: cross-origin mutation rejected", !hasSafeMutationRequest(new Request(baseUrl, { method: "POST", headers: { ...safeHeaders, Origin: "https://evil.example" } }), "http://localhost:3000"));
check("request: oversized body rejected", !hasSafeMutationRequest(new Request(baseUrl, { method: "POST", headers: { ...safeHeaders, "content-length": "9000" }, body: "{}" }), "http://localhost:3000"));
const oversizeRead = await readJson<unknown>(new Request(baseUrl, { method: "POST", headers: safeHeaders, body: "x".repeat(9_000) }));
check("request: oversize guarded again on actual read", oversizeRead === null);

const smoke = await authenticate(account, address, new Date(now.getTime() + 500_000));
check("siwe: X.42 flow still intact after hardening", smoke.ok);
console.log("X.43 auth offline verification: PASS");
