import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_CSRF_COOKIE } from "@/lib/auth/constants.ts";
import { getAuthenticatedUser } from "@/lib/auth/session.server.ts";
import { altanaApiErrorMessage, revokeAltanaSessionApi } from "@/lib/altana-session/api.ts";
import { createSessionService } from "@/lib/altana-session/index.server.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const [identity, jar] = await Promise.all([getAuthenticatedUser(), cookies()]);
    if (identity !== null) {
      const limited = await enforceRateLimit("altana.session.revoke", identity.userId);
      if (limited) return limited;
    }
    const csrfCookie = jar.get(AUTH_CSRF_COOKIE)?.value ?? null;
    const service = createSessionService();
    const result = await revokeAltanaSessionApi({ identity, request, csrfCookie, deps: service.deps, now: new Date() });
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (error) {
    const mapped = altanaApiErrorMessage(error);
    return NextResponse.json({ ok: false, error: { message: mapped.message } }, { status: mapped.status, headers: { "Cache-Control": "no-store" } });
  }
}
