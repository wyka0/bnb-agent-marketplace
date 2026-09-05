import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session.server.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";
import { resolveDashboardHires } from "@/lib/dashboard/hired-agents.server.ts";
import { noWalletHiresDashboard } from "@/lib/dashboard/hired-agents.ts";

export const dynamic = "force-dynamic";

/**
 * X.168 — Dashboard hired-agents feed (read-only).
 *
 * Returns the connected wallet's FUNDED commercial hires resolved from public
 * on-chain state (chain-97 ERC-8183 commerce reads + 8004scan registry). With
 * no authenticated wallet the endpoint returns the existing empty dashboard
 * shape. No wallet key, no signing, no transaction is ever performed.
 */
export async function GET() {
  try {
    const identity = await getAuthenticatedUser();
    if (identity === null) {
      return NextResponse.json(
        { ok: true, data: noWalletHiresDashboard() },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    const limited = await enforceRateLimit("dashboard.hires", identity.userId);
    if (limited) return limited;
    const data = await resolveDashboardHires(identity.walletAddress);
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "dashboard-hires-unavailable", message: "Unable to read dashboard hires." },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
