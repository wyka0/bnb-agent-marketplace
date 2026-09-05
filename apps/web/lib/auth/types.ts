export type ChallengeRecord = {
  id: string;
  nonceHash: string;
  attemptHash: string;
  address: string;
  chainId: number;
  domain: string;
  uri: string;
  messageDigest: string;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

export type PublicIdentity = {
  userId: string;
  walletId: string;
  walletAddress: `0x${string}`;
  chainId: 97;
};

export type AuthenticatedIdentity = PublicIdentity & {
  sessionId: string;
  sessionExpiresAt: Date;
  lastUsedAt: Date;
};

export type PublicSessionInfo = {
  walletAddress: `0x${string}`;
  chainId: 97;
  sessionExpiresAt: string;
};

export type CreateChallengeInput = Omit<ChallengeRecord, "id" | "consumedAt" | "createdAt">;

export type CompleteAuthenticationInput = {
  challengeId: string;
  attemptHash: string;
  address: `0x${string}`;
  now: Date;
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Date;
};

export type CompleteAuthenticationResult =
  | { ok: true; identity: PublicIdentity; previousSessionsRevoked: number }
  | { ok: false; reason: "challenge-unavailable" | "ownership-conflict" };

export interface AuthStore {
  countRecentChallenges(address: string | null, since: Date): Promise<number>;
  createChallenge(input: CreateChallengeInput): Promise<ChallengeRecord>;
  findChallengeByAttemptHash(attemptHash: string): Promise<ChallengeRecord | null>;
  completeAuthentication(input: CompleteAuthenticationInput): Promise<CompleteAuthenticationResult>;
  findActiveSession(tokenHash: string, now: Date): Promise<AuthenticatedIdentity | null>;
  touchSession(sessionId: string, now: Date): Promise<void>;
  revokeSession(tokenHash: string, csrfTokenHash: string, now: Date): Promise<boolean>;
  writeAudit(input: {
    eventType: string;
    result: "SUCCESS" | "FAILURE" | "DENIED";
    userId?: string;
    walletId?: string;
    actorIdentifier?: string;
    chainId?: number;
    safeMetadata?: Record<string, string | number | boolean | null>;
  }): Promise<void>;
}
