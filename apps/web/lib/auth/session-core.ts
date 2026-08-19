import { AUTH_SESSION_LAST_USED_THROTTLE_MS } from "./constants.ts";
import { sha256 } from "./crypto.ts";
import type { AuthenticatedIdentity, AuthStore, PublicSessionInfo } from "./types.ts";

export async function getAuthenticatedUserFromStore(
  store: Pick<AuthStore, "findActiveSession" | "touchSession">,
  token: string,
  now: Date
): Promise<AuthenticatedIdentity | null> {
  const identity = await store.findActiveSession(sha256(token), now);
  if (!identity) return null;
  if (now.getTime() - identity.lastUsedAt.getTime() >= AUTH_SESSION_LAST_USED_THROTTLE_MS) {
    await store.touchSession(identity.sessionId, now);
    identity.lastUsedAt = now;
  }
  return identity;
}

export function toPublicSessionInfo(identity: AuthenticatedIdentity): PublicSessionInfo {
  return {
    walletAddress: identity.walletAddress,
    chainId: identity.chainId,
    sessionExpiresAt: identity.sessionExpiresAt.toISOString(),
  };
}

export function walletBelongsToUser(identity: AuthenticatedIdentity, walletId: string): boolean {
  return identity.walletId === walletId;
}
