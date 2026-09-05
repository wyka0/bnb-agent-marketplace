import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_CSRF_COOKIE, getAuthConfig } from "@/lib/auth/constants.ts";
import { getAuthenticatedUser } from "@/lib/auth/session.server.ts";
import { hireActivationApi } from "@/lib/activation/hire.api.ts";
import { ACTIVATION_CHAIN_ID } from "@/lib/activation/capability.ts";
import {
  fetchAgentRows,
  findAgentByIdentity,
  runHireActivation,
} from "@/lib/activation/hire.server.ts";
import { commitmentFromAgent } from "@/lib/activation/consent.commitment.ts";
import { evaluateSessionGate } from "@/lib/activation/session-gate.ts";
import { altanaApiErrorMessage } from "@/lib/altana-session/api.ts";
import { createSessionService, toPublicSessionView } from "@/lib/altana-session/index.server.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const [identity, jar] = await Promise.all([getAuthenticatedUser(), cookies()]);
    if (identity !== null) {
      const limited = await enforceRateLimit("activation.hire", identity.userId);
      if (limited) return limited;
    }

    const result = await hireActivationApi({
      identity,
      request,
      csrfCookie: jar.get(AUTH_CSRF_COOKIE)?.value ?? null,
      expectedOrigin: getAuthConfig().origin,
      deps: {
        async resolveAgent(agentId) {
          const rows = await fetchAgentRows(agentId);
          return findAgentByIdentity(rows, agentId);
        },
        review: (record) => runHireActivation(record, { env: process.env }),
        async createSession({ identity: authenticated, agent }) {
          // Service construction happens only after exact identity, capability,
          // review, and consent validation have all succeeded.
          const service = createSessionService();
          const { record } = await service.createAltanaSession(
            {
              userId: authenticated.userId,
              walletId: authenticated.walletId,
              walletAddress: authenticated.walletAddress,
            },
            {
              publicMetadata: {
                agentId: agent.agent_id,
                agentName: agent.name?.trim() || `Agent #${agent.token_id}`,
                agentSource: "8004scan",
              },
            }
          );
          const spend = record.permissions.find((permission) => permission.kind === "TOKEN_SPEND");
          return toPublicSessionView(record, BigInt(spend?.spendCapRaw ?? "0"));
        },
        evaluateActivationGate({ identity, agent, consentDigest }) {
          // X.80 — fail-closed gate wiring. No verified funded ERC-8183 job
          // exists in this phase and custody is intentionally NOT provisioned,
          // so the gate always denies. The wiring is in place for the future
          // provider integration; it never fabricates capability.
          const gateCtx = {
            expectedAgentOwner: agent.owner_address ?? "",
            expectedClient: process.env.ALTANA_ERC8183_CLIENT ?? "",
            expectedChainId: ACTIVATION_CHAIN_ID,
          };
          const commitment = commitmentFromAgent(agent, null);
          const result = evaluateSessionGate({
            identity,
            agentIdentity: agent.agent_id,
            consent: { commitment, digest: consentDigest },
            verifiedJob: null,
            custodyAvailable: false,
            gateCtx,
          });
          return { allowed: result.allowed, reason: result.reason, state: result.state };
        },
        mapError(error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("live Altana session already exists")) {
            return {
              status: 409,
              message: "An active Altana session already exists for this wallet.",
            };
          }
          return altanaApiErrorMessage(error);
        },
      },
    });

    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  } catch (error) {
    const mapped = process.env.DATABASE_URL
      ? altanaApiErrorMessage(error)
      : { status: 503, message: "Session persistence is unavailable." };
    return NextResponse.json(
      { ok: false, error: { code: "activation-unavailable", message: mapped.message } },
      { status: mapped.status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
