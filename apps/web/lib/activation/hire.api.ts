import { constantTimeEqual } from "../auth/crypto.ts";
import { hasSafeMutationRequest, readJson } from "../auth/request.ts";
import type { AuthenticatedIdentity } from "../auth/types.ts";
import type { PublicSessionView } from "../altana-session/view.ts";
import type { Scan8004Agent } from "../eight004scan/types.ts";
import { isValidAgentIdentity, type HireActivationOutcome } from "./hire.server.ts";

type HireApiBody = {
  action?: unknown;
  agentId?: unknown;
  consentDigest?: unknown;
};

export type HireApiResult = {
  status: number;
  body: Record<string, unknown>;
  headers: { "Cache-Control": "no-store" };
};

const NO_STORE = { "Cache-Control": "no-store" } as const;

export type HireApiDeps = {
  resolveAgent(agentId: string): Promise<Scan8004Agent | null>;
  review(record: Scan8004Agent): Promise<HireActivationOutcome>;
  createSession(input: {
    identity: AuthenticatedIdentity;
    agent: Scan8004Agent;
  }): Promise<PublicSessionView>;
  /**
   * X.80 — optional ERC-8183 job-funded session gate. When supplied (production
   * route), it enforces the verified-funded-job precondition before session
   * creation. When absent (legacy/test harness), the historical behavior is
   * preserved. Implemented by `evaluateSessionGate`; fails closed.
   */
  evaluateActivationGate?(input: {
    identity: AuthenticatedIdentity;
    agent: Scan8004Agent;
    consentDigest: string;
  }): { allowed: boolean; reason: string; state: string };
  mapError(error: unknown): { status: number; message: string };
};

function safeAgent(record: Scan8004Agent) {
  return {
    name: record.name?.trim() || `Agent #${record.token_id}`,
    agentId: record.agent_id,
    category: null,
    capabilities: record.x402_supported ? ["x402 payments"] : [],
    protocols: record.supported_protocols,
    chainId: record.chain_id,
    isTestnet: record.is_testnet,
    source: "8004scan" as const,
  };
}

function unavailableOutcome(record: Scan8004Agent, outcome: HireActivationOutcome): HireApiResult {
  if (outcome.available) {
    throw new Error("unavailableOutcome called with an available activation");
  }
  const reason =
    "blocked" in outcome
      ? `Activation unavailable — ${outcome.blocked.stage}: ${outcome.blocked.reason}`
      : `Activation unavailable — ${outcome.detail}`;
  return {
    status: 409,
    body: {
      ok: false,
      error: { code: "activation-unavailable", message: reason },
      data: { agent: safeAgent(record), classifier: outcome.classifier },
    },
    headers: NO_STORE,
  };
}

export async function hireActivationApi(input: {
  identity: AuthenticatedIdentity | null;
  request: Request;
  csrfCookie: string | null;
  expectedOrigin: string;
  deps: HireApiDeps;
}): Promise<HireApiResult> {
  if (!hasSafeMutationRequest(input.request, input.expectedOrigin)) {
    return {
      status: 403,
      body: { ok: false, error: { code: "request-rejected", message: "Request rejected." } },
      headers: NO_STORE,
    };
  }
  const suppliedCsrf = input.request.headers.get("x-csrf-token");
  if (
    input.csrfCookie === null ||
    suppliedCsrf === null ||
    !constantTimeEqual(input.csrfCookie, suppliedCsrf)
  ) {
    return {
      status: 403,
      body: { ok: false, error: { code: "request-rejected", message: "Request rejected." } },
      headers: NO_STORE,
    };
  }
  if (input.identity === null) {
    return {
      status: 401,
      body: {
        ok: false,
        error: { code: "authentication-required", message: "Authentication required." },
      },
      headers: NO_STORE,
    };
  }

  const body = await readJson<HireApiBody>(input.request, 4_096);
  if (
    body === null ||
    (body.action !== "review" && body.action !== "activate") ||
    !isValidAgentIdentity(body.agentId)
  ) {
    return {
      status: 400,
      body: {
        ok: false,
        error: {
          code: "bad-request",
          message: "Expected an action and a valid exact 8004scan agent identity.",
        },
      },
      headers: NO_STORE,
    };
  }

  let record: Scan8004Agent | null;
  try {
    record = await input.deps.resolveAgent(body.agentId);
  } catch (error) {
    const mapped = input.deps.mapError(error);
    return {
      status: mapped.status,
      body: { ok: false, error: { code: "registry-unavailable", message: mapped.message } },
      headers: NO_STORE,
    };
  }
  if (record === null || record.agent_id !== body.agentId) {
    return {
      status: 404,
      body: { ok: false, error: { code: "agent-not-found", message: "Agent not found." } },
      headers: NO_STORE,
    };
  }

  const outcome = await input.deps.review(record);
  if (!outcome.available) return unavailableOutcome(record, outcome);

  if (body.action === "review") {
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          agent: safeAgent(record),
          classifier: outcome.classifier,
          review: outcome.reviewJson,
          consent: outcome.consent,
        },
      },
      headers: NO_STORE,
    };
  }

  if (
    typeof body.consentDigest !== "string" ||
    !constantTimeEqual(body.consentDigest, outcome.consent.consentDigest)
  ) {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: "consent-mismatch",
          message:
            "The activation review changed. Review the current permissions before confirming.",
        },
      },
      headers: NO_STORE,
    };
  }

  if (input.deps.evaluateActivationGate) {
    const gate = input.deps.evaluateActivationGate({
      identity: input.identity,
      agent: record,
      consentDigest: body.consentDigest,
    });
    if (!gate.allowed) {
      return {
        status: 409,
        body: {
          ok: false,
          error: {
            code: "activation-unavailable",
            message: `Activation unavailable — ${gate.reason}`,
          },
          data: { agent: safeAgent(record), classifier: outcome.classifier },
        },
        headers: NO_STORE,
      };
    }
  }

  try {
    const session = await input.deps.createSession({ identity: input.identity, agent: record });
    return {
      status: 201,
      body: { ok: true, data: { agent: safeAgent(record), session } },
      headers: NO_STORE,
    };
  } catch (error) {
    const mapped = input.deps.mapError(error);
    return {
      status: mapped.status,
      body: {
        ok: false,
        error: {
          code: mapped.status === 409 ? "already-active" : "activation-unavailable",
          message: mapped.message,
        },
      },
      headers: NO_STORE,
    };
  }
}
