import "server-only";
import { prisma } from "@/lib/prisma/client.server";
import { AUTH_CHAIN_ID } from "./constants.ts";
import type {
  AuthStore,
  CompleteAuthenticationInput,
  CompleteAuthenticationResult,
  CreateChallengeInput,
} from "./types.ts";

export const prismaAuthStore: AuthStore = {
  countRecentChallenges(address, since) {
    return prisma.siweChallenge.count({
      where: { ...(address === null ? {} : { address }), createdAt: { gte: since } },
    });
  },

  createChallenge(input: CreateChallengeInput) {
    return prisma.siweChallenge.create({ data: input });
  },

  findChallengeByAttemptHash(attemptHash) {
    return prisma.siweChallenge.findUnique({ where: { attemptHash } });
  },

  async completeAuthentication(input: CompleteAuthenticationInput): Promise<CompleteAuthenticationResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        let wallet = await tx.wallet.findUnique({
          where: { chainId_address: { chainId: AUTH_CHAIN_ID, address: input.address } },
          include: { user: true },
        });
        if (wallet && (wallet.user.deletedAt || wallet.deletedAt || wallet.status !== "ACTIVE")) {
          return { ok: false, reason: "ownership-conflict" } as const;
        }

        const consumed = await tx.siweChallenge.updateMany({
          where: {
            id: input.challengeId,
            attemptHash: input.attemptHash,
            consumedAt: null,
            expiresAt: { gt: input.now },
          },
          data: { consumedAt: input.now },
        });
        if (consumed.count !== 1) return { ok: false, reason: "challenge-unavailable" } as const;

        if (!wallet) {
          const user = await tx.user.create({ data: {} });
          wallet = await tx.wallet.create({
            data: {
              userId: user.id,
              chainId: AUTH_CHAIN_ID,
              address: input.address,
              verifiedAt: input.now,
            },
            include: { user: true },
          });
        } else {
          wallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { verifiedAt: input.now },
            include: { user: true },
          });
        }

        const newSession = await tx.authSession.create({
          data: {
            userId: wallet.userId,
            walletId: wallet.id,
            tokenHash: input.tokenHash,
            csrfTokenHash: input.csrfTokenHash,
            chainId: AUTH_CHAIN_ID,
            createdAt: input.now,
            lastUsedAt: input.now,
            expiresAt: input.expiresAt,
            absoluteExpiresAt: input.expiresAt,
          },
        });
        const previousSessionsRevoked = await tx.authSession.updateMany({
          where: { userId: wallet.userId, revokedAt: null, id: { not: newSession.id } },
          data: { revokedAt: input.now },
        }).then((result) => result.count);
        return {
          ok: true,
          identity: {
            userId: wallet.userId,
            walletId: wallet.id,
            walletAddress: wallet.address as `0x${string}`,
            chainId: AUTH_CHAIN_ID,
          },
          previousSessionsRevoked,
        } as const;
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error.code === "P2002" || error.code === "P2034")) {
        return { ok: false, reason: "ownership-conflict" };
      }
      throw error;
    }
  },

  async writeAudit(input) {
    await prisma.auditEvent.create({
      data: {
        eventType: input.eventType,
        result: input.result,
        actorType: "WALLET",
        actorIdentifier: input.actorIdentifier,
        userId: input.userId,
        walletId: input.walletId,
        chainId: input.chainId,
        safeMetadata: input.safeMetadata,
      },
    });
  },

  async findActiveSession(tokenHash, now) {
    const session = await prisma.authSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      include: { user: true, wallet: true },
    });
    if (!session || session.user.deletedAt || session.wallet.status !== "ACTIVE" || session.wallet.deletedAt) return null;
    return {
      sessionId: session.id,
      sessionExpiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
      userId: session.userId,
      walletId: session.walletId,
      walletAddress: session.wallet.address as `0x${string}`,
      chainId: AUTH_CHAIN_ID,
    };
  },

  async touchSession(sessionId, now) {
    await prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: now } },
      data: { lastUsedAt: now },
    });
  },

  async revokeSession(tokenHash, csrfTokenHash, now) {
    const result = await prisma.authSession.updateMany({
      where: { tokenHash, csrfTokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
    return result.count > 0;
  },
};
