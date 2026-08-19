import { getAddress, recoverMessageAddress } from "viem";
import { SiweMessage } from "siwe";
import {
  AUTH_CHAIN_ID,
  AUTH_GLOBAL_NONCE_RATE_LIMIT,
  AUTH_NONCE_RATE_LIMIT,
  AUTH_NONCE_RATE_WINDOW_MS,
  AUTH_NONCE_TTL_MS,
  AUTH_STATEMENT,
} from "./constants.ts";
import { randomNonce, randomToken, sha256 } from "./crypto.ts";
import type { AuthStore, PublicIdentity } from "./types.ts";

type AuthConfig = { domain: string; uri: string; sessionTtlMs: number };

export type AuthFailure =
  | "invalid-message"
  | "invalid-domain"
  | "invalid-uri"
  | "invalid-version"
  | "invalid-chain"
  | "invalid-nonce"
  | "invalid-issued-at"
  | "expired-message"
  | "invalid-signature"
  | "wrong-wallet"
  | "missing-challenge"
  | "expired-challenge"
  | "consumed-challenge"
  | "ownership-conflict"
  | "challenge-unavailable";

export async function createAuthChallenge(input: {
  store: AuthStore;
  address: string;
  config: AuthConfig;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const address = getAddress(input.address).toLowerCase() as `0x${string}`;
  const recentCount = await input.store.countRecentChallenges(
    address,
    new Date(now.getTime() - AUTH_NONCE_RATE_WINDOW_MS)
  );
  if (recentCount >= AUTH_NONCE_RATE_LIMIT) {
    try {
      await input.store.writeAudit({ eventType: "SIWE_NONCE_RATE_LIMITED", result: "DENIED", actorIdentifier: address, chainId: AUTH_CHAIN_ID, safeMetadata: { scope: "wallet" } });
    } catch {
      // Rate-limit audit failure must not change the denial behavior.
    }
    throw new Error("rate-limited");
  }
  const globalRecentCount = await input.store.countRecentChallenges(
    null,
    new Date(now.getTime() - AUTH_NONCE_RATE_WINDOW_MS)
  );
  if (globalRecentCount >= AUTH_GLOBAL_NONCE_RATE_LIMIT) {
    try {
      await input.store.writeAudit({ eventType: "SIWE_NONCE_RATE_LIMITED", result: "DENIED", actorIdentifier: address, chainId: AUTH_CHAIN_ID, safeMetadata: { scope: "global" } });
    } catch {
      // Rate-limit audit failure must not change the denial behavior.
    }
    throw new Error("rate-limited");
  }

  const nonce = randomNonce();
  const attemptToken = randomToken();
  const expiresAt = new Date(now.getTime() + AUTH_NONCE_TTL_MS);
  const message = new SiweMessage({
    domain: input.config.domain,
    address: getAddress(address),
    statement: AUTH_STATEMENT,
    uri: input.config.uri,
    version: "1",
    chainId: AUTH_CHAIN_ID,
    nonce,
    issuedAt: now.toISOString(),
    expirationTime: expiresAt.toISOString(),
  }).prepareMessage();

  await input.store.createChallenge({
    nonceHash: sha256(nonce),
    attemptHash: sha256(attemptToken),
    address,
    chainId: AUTH_CHAIN_ID,
    domain: input.config.domain,
    uri: input.config.uri,
    messageDigest: sha256(message),
    issuedAt: now,
    expiresAt,
  });
  await input.store.writeAudit({
    eventType: "SIWE_NONCE_CREATED",
    result: "SUCCESS",
    actorIdentifier: address,
    chainId: AUTH_CHAIN_ID,
  });

  return { message, attemptToken, expiresAt, address };
}

export async function verifyAuthentication(input: {
  store: AuthStore;
  attemptToken: string;
  message: string;
  signature: string;
  config: AuthConfig;
  now?: Date;
}): Promise<
  | { ok: true; identity: PublicIdentity; sessionToken: string; csrfToken: string; expiresAt: Date; previousSessionsRevoked: number }
  | { ok: false; reason: AuthFailure }
> {
  const now = input.now ?? new Date();
  const challenge = await input.store.findChallengeByAttemptHash(sha256(input.attemptToken));
  if (!challenge) return failure(input.store, "missing-challenge");
  if (challenge.consumedAt) return failure(input.store, "consumed-challenge", challenge.address);
  if (challenge.expiresAt.getTime() <= now.getTime()) {
    return failure(input.store, "expired-challenge", challenge.address);
  }

  let parsed: SiweMessage;
  try {
    parsed = new SiweMessage(input.message);
  } catch {
    return failure(input.store, "invalid-message", challenge.address);
  }

  const issuedAt = parsed.issuedAt ? new Date(parsed.issuedAt) : null;
  const expiration = parsed.expirationTime ? new Date(parsed.expirationTime) : null;
  const checks: Array<[boolean, AuthFailure]> = [
    [parsed.domain === input.config.domain && parsed.domain === challenge.domain, "invalid-domain"],
    [parsed.uri === input.config.uri && parsed.uri === challenge.uri, "invalid-uri"],
    [parsed.version === "1", "invalid-version"],
    [parsed.chainId === AUTH_CHAIN_ID && parsed.chainId === challenge.chainId, "invalid-chain"],
    [sha256(parsed.nonce) === challenge.nonceHash, "invalid-nonce"],
    [
      issuedAt !== null &&
        !Number.isNaN(issuedAt.getTime()) &&
        issuedAt.getTime() === challenge.issuedAt.getTime() &&
        issuedAt.getTime() <= now.getTime(),
      "invalid-issued-at",
    ],
    [
      expiration !== null &&
        !Number.isNaN(expiration.getTime()) &&
        expiration.getTime() === challenge.expiresAt.getTime() &&
        expiration.getTime() > now.getTime(),
      "expired-message",
    ],
    [sha256(input.message) === challenge.messageDigest, "invalid-message"],
  ];
  for (const [valid, reason] of checks) {
    if (!valid) return failure(input.store, reason, challenge.address);
  }

  let declaredAddress: `0x${string}`;
  try {
    declaredAddress = getAddress(parsed.address).toLowerCase() as `0x${string}`;
  } catch {
    return failure(input.store, "wrong-wallet", challenge.address);
  }
  if (declaredAddress !== challenge.address) {
    return failure(input.store, "wrong-wallet", challenge.address);
  }

  try {
    const signer = (await recoverMessageAddress({
      message: input.message,
      signature: input.signature as `0x${string}`,
    })).toLowerCase();
    if (signer !== declaredAddress) {
      return failure(input.store, "wrong-wallet", challenge.address);
    }
  } catch {
    return failure(input.store, "invalid-signature", challenge.address);
  }

  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const expiresAt = new Date(now.getTime() + input.config.sessionTtlMs);
  const completed = await input.store.completeAuthentication({
    challengeId: challenge.id,
    attemptHash: challenge.attemptHash,
    address: declaredAddress,
    now,
    tokenHash: sha256(sessionToken),
    csrfTokenHash: sha256(csrfToken),
    expiresAt,
  });
  if (!completed.ok) return failure(input.store, completed.reason, challenge.address);

  await input.store.writeAudit({
    eventType: "SIWE_AUTH_SUCCESS",
    result: "SUCCESS",
    userId: completed.identity.userId,
    walletId: completed.identity.walletId,
    actorIdentifier: declaredAddress,
    chainId: AUTH_CHAIN_ID,
    safeMetadata: { previousSessionsRevoked: completed.previousSessionsRevoked },
  });
  return { ok: true, identity: completed.identity, sessionToken, csrfToken, expiresAt, previousSessionsRevoked: completed.previousSessionsRevoked };
}

async function failure(store: AuthStore, reason: AuthFailure, address?: string) {
  await store.writeAudit({
    eventType: reason === "ownership-conflict" ? "WALLET_OWNERSHIP_CONFLICT" : "SIWE_AUTH_FAILURE",
    result: reason === "ownership-conflict" ? "DENIED" : "FAILURE",
    actorIdentifier: address,
    chainId: AUTH_CHAIN_ID,
    safeMetadata: { reason },
  });
  return { ok: false as const, reason };
}
