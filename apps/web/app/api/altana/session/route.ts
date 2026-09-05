import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session.server.ts";
import { altanaApiErrorMessage, getAltanaSessionApi } from "@/lib/altana-session/api.ts";
import { createSessionService } from "@/lib/altana-session/index.server.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await getAuthenticatedUser();
    if (identity !== null) {
      const limited = await enforceRateLimit("altana.session.read", identity.userId);
      if (limited) return limited;
    }
    const sessionIdParam = new URL(request.url).searchParams.get("sessionId");
    const service = createSessionService();
    const result = await getAltanaSessionApi({ identity, sessionIdParam, deps: service.deps, now: new Date() });
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (error) {
    const mapped = altanaApiErrorMessage(error);
    return NextResponse.json({ ok: false, error: { message: mapped.message } }, { status: mapped.status, headers: { "Cache-Control": "no-store" } });
  }
}
