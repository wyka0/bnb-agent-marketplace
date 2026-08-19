import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { getAuthConfig } from "@/lib/auth/constants.ts";
import { attemptCookiePolicy } from "@/lib/auth/cookie-policy.ts";
import { createAuthChallenge } from "@/lib/auth/service.ts";
import { hasSafeMutationRequest, readJson } from "@/lib/auth/request.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!hasSafeMutationRequest(request, config.origin)) return safeError("Request rejected.", 403);
  const body = await readJson<{ address?: string }>(request);
  if (!body?.address) return safeError("Wallet address is required.", 400);
  let normalized: string;
  try {
    normalized = getAddress(body.address);
  } catch {
    return safeError("Wallet address is required.", 400);
  }
  // X.49: wallet-scoped limiter in front of challenge issuance (the DB-backed
  // limits inside createAuthChallenge remain the authoritative testnet rule).
  const limited = await enforceRateLimit("auth.nonce", normalized.toLowerCase());
  if (limited) return limited;
  try {
    const { prismaAuthStore } = await import("@/lib/auth/prisma-store.server.ts");
    const result = await createAuthChallenge({ store: prismaAuthStore, address: normalized, config });
    const response = NextResponse.json({ ok: true, data: { message: result.message, expiresAt: result.expiresAt.toISOString(), address: result.address } }, { headers: { "Cache-Control": "no-store" } });
    const attempt = attemptCookiePolicy();
    response.cookies.set(attempt.name, result.attemptToken, attempt.options);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "rate-limited") return safeError("Too many login attempts. Try again later.", 429);
    return safeError("Unable to start wallet authentication.", 400);
  }
}

function safeError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: { message } }, { status, headers: { "Cache-Control": "no-store" } });
}
