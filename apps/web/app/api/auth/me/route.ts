import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session.server.ts";
import { toPublicSessionInfo } from "@/lib/auth/session-core.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await getAuthenticatedUser();
    const limited = await enforceRateLimit("auth.me", identity?.userId ?? "anonymous");
    if (limited) return limited;
    return NextResponse.json(
      { ok: true, data: identity ? toPublicSessionInfo(identity) : null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "Unable to read authentication state." } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
