import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_CSRF_COOKIE, getAuthConfig } from "@/lib/auth/constants.ts";
import { getAuthenticatedUser } from "@/lib/auth/session.server.ts";
import { mainTrackHireApi } from "@/lib/activation/main-track-hire.api.ts";
import { verifyMainTrackUserHireFunded } from "@/lib/activation/main-track-user-hire.server.ts";
import { readMainTrackReceipt } from "@/lib/activation/main-track-receipt.server.ts";
import { prepareLiveAgentHire } from "@/lib/activation/main-track-negotiation.server.ts";
import { fetchAgentRows, findAgentByIdentity } from "@/lib/activation/hire.server.ts";
import {
  resolveMainTrackCustody,
  runMainTrackHireOrFailClosed,
} from "@/lib/activation/main-track-v2.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";

export const dynamic = "force-dynamic";

/**
 * X.131 — Main Track V2 commercial hire (MODEL B).
 *
 * A clearly separated Model B endpoint. It reuses the standard authentication /
 * CSRF / rate-limit / exact-identity machinery and delegates to the pure
 * `runMainTrackV2HireActivation` boundary through a custody seam that is
 * fail-closed. The strict X.76 / Altana path (`/api/activation/hire`) is
 * untouched.
 *
 * Current production state: no marketplace-client custody is provisioned, so
 * this endpoint returns `main-track-custody-required` (fail-closed). No raw
 * private key is ever stored or read server-side.
 */
export async function POST(request: Request) {
  try {
    const [identity, jar] = await Promise.all([getAuthenticatedUser(), cookies()]);
    if (identity !== null) {
      const limited = await enforceRateLimit("activation.main-track-hire", identity.userId);
      if (limited) return limited;
    }

    const result = await mainTrackHireApi({
      identity,
      request,
      csrfCookie: jar.get(AUTH_CSRF_COOKIE)?.value ?? null,
      expectedOrigin: getAuthConfig().origin,
      env: process.env,
      deps: {
        async resolveAgent(agentId) {
          const rows = await fetchAgentRows(agentId);
          return findAgentByIdentity(rows, agentId);
        },
        resolveCustody: resolveMainTrackCustody,
        reviewForAgent: async () => null,
        runHire: runMainTrackHireOrFailClosed,
        prepareUserHire: async (agent) =>
          prepareLiveAgentHire({
            agentId: agent.agent_id,
            ownerAddress: agent.owner_address ?? "",
          }),
        verifyUserHire: async ({ jobId, walletAddress, agent, expectedBudget }) =>
          verifyMainTrackUserHireFunded({ jobId, walletAddress, agent, expectedBudget }),
        readReceipt: readMainTrackReceipt,
        ports: {
          resolveMarketplaceClient: async () => {
            throw new Error("main-track SDK-backed ports require provisioned custody");
          },
          runCommercialNegotiation: async () => {
            throw new Error("main-track SDK-backed ports require provisioned custody");
          },
          executeErc8183Hire: async () => {
            throw new Error("main-track SDK-backed ports require provisioned custody");
          },
          readJob: async () => null,
        },
        mapError(error) {
          const message = error instanceof Error ? error.message : String(error);
          return { status: 409, message };
        },
      },
    });

    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: { code: "main-track-unavailable", message } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
