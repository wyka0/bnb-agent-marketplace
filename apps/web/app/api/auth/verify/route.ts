import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthConfig, AUTH_ATTEMPT_COOKIE } from "@/lib/auth/constants.ts";
import { attemptCookiePolicy, csrfCookiePolicy, sessionCookiePolicy } from "@/lib/auth/cookie-policy.ts";
import { hasSafeMutationRequest, readJson } from "@/lib/auth/request.ts";
import { verifyAuthentication } from "@/lib/auth/service.ts";
import type { PublicSessionInfo } from "@/lib/auth/types.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";
import { globalKeyOf } from "@/lib/security/rate-limiter.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!hasSafeMutationRequest(request, config.origin)) return safeError("Request rejected.", 403);
  // X.49: pre-authentication route — bucket is deliberately global, not
  // identity-scoped (identity is unknown until recovery succeeds).
  const limited = await enforceRateLimit("auth.verify", globalKeyOf("auth.verify"));
  if (limited) return limited;
  const body = await readJson<{ message?: string; signature?: string }>(request);
  const attemptToken = (await cookies()).get(AUTH_ATTEMPT_COOKIE)?.value;
  if (!body?.message || !body.signature || !attemptToken) return safeError("Authentication request is incomplete.", 400);
  try {
    const { prismaAuthStore } = await import("@/lib/auth/prisma-store.server.ts");
    const result = await verifyAuthentication({ store: prismaAuthStore, attemptToken, message: body.message, signature: body.signature, config });
    if (!result.ok) return safeError("Wallet authentication failed.", 401);

    const data: PublicSessionInfo = {
      walletAddress: result.identity.walletAddress,
      chainId: result.identity.chainId,
      sessionExpiresAt: result.expiresAt.toISOString(),
    };
    const response = NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
    const session = sessionCookiePolicy(result.expiresAt);
    const csrf = csrfCookiePolicy(result.expiresAt);
    const attempt = attemptCookiePolicy();
    response.cookies.set(session.name, result.sessionToken, session.options);
    response.cookies.set(csrf.name, result.csrfToken, csrf.options);
    response.cookies.set(attempt.name, "", { ...attempt.options, maxAge: 0 });
    return response;
  } catch {
    return safeError("Unable to complete wallet authentication.", 503);
  }
}

function safeError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: { message } }, { status, headers: { "Cache-Control": "no-store" } });
}
