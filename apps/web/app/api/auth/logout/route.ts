import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_CSRF_COOKIE, AUTH_SESSION_COOKIE, getAuthConfig } from "@/lib/auth/constants.ts";
import { clearSessionCookies } from "@/lib/auth/cookie-policy.ts";
import { constantTimeEqual, sha256 } from "@/lib/auth/crypto.ts";
import { hasSafeMutationRequest } from "@/lib/auth/request.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!hasSafeMutationRequest(request, config.origin)) {
    return NextResponse.json({ ok: false, error: { message: "Request rejected." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const jar = await cookies();
  const token = jar.get(AUTH_SESSION_COOKIE)?.value;
  const csrf = jar.get(AUTH_CSRF_COOKIE)?.value;
  const limited = await enforceRateLimit("auth.logout", token ? sha256(token) : "anonymous");
  if (limited) return limited;
  const suppliedCsrf = request.headers.get("x-csrf-token");
  if (token && (!csrf || !suppliedCsrf || !constantTimeEqual(csrf, suppliedCsrf))) {
    return NextResponse.json({ ok: false, error: { message: "Request rejected." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (token && csrf) {
    try {
      const { prismaAuthStore } = await import("@/lib/auth/prisma-store.server.ts");
      const revoked = await prismaAuthStore.revokeSession(sha256(token), sha256(csrf), new Date());
      await prismaAuthStore.writeAudit({
        eventType: "AUTH_LOGOUT",
        result: revoked ? "SUCCESS" : "DENIED",
        safeMetadata: { sessionFound: revoked },
      });
    } catch {
      return NextResponse.json(
        { ok: false, error: { message: "Unable to complete logout." } },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
  }
  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  for (const policy of clearSessionCookies()) {
    response.cookies.set(policy.name, policy.value, policy.options);
  }
  return response;
}
