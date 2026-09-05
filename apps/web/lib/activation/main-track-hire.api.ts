/**
 * X.131 — Main Track V2 hire API handler (framework-free, testable).
 *
 * A clearly separated Model B endpoint. It enforces authentication, CSRF,
 * exact agent identity, chain-aware resolution (X.241: chain 97 always;
 * chain 56 only behind MAINNET_HIRE_ENABLED), custody availability, and an
 * explicit user confirmation before any transaction. It NEVER fabricates
 * ACTIVE; FUNDED is returned as `state:"funded"` with `active:false`.
 *
 * Production wiring: `apps/web/app/api/activation/main-track-hire/route.ts`.
 */

import { constantTimeEqual } from "../auth/crypto.ts";
import { hasSafeMutationRequest, readJson } from "../auth/request.ts";
import type { AuthenticatedIdentity } from "../auth/types.ts";
import type { Scan8004Agent } from "../eight004scan/types.ts";
import { isValidAgentIdentity } from "./hire.server.ts";
import { MAIN_TRACK_MODEL_B } from "./main-track-v2.ts";
import {
  HIRE_CHAIN_MAINNET,
  HIRE_CHAIN_TESTNET,
  chainIdFromAgentId,
  isMainnetHireEnabled,
  resolveHireChainConfig,
} from "@bnb-marketplace/integrations/altana";
import type {
  MainTrackCustodyResult,
  MainTrackHireReviewView,
  MainTrackHireRunResult,
} from "./main-track-v2.ts";
import type {
  MainTrackUserHirePrepareOutcome,
  MainTrackUserHireVerifyOutcome,
} from "./main-track-user-hire.ts";
import type { MainTrackReceiptRead } from "./main-track-receipt.server.ts";
import type {
  MainTrackV2HireInput,
  MainTrackV2HirePorts,
} from "@bnb-marketplace/integrations/altana";

type MainTrackHireApiBody = {
  action?: unknown;
  agentId?: unknown;
  confirmed?: unknown;
  jobId?: unknown;
  walletAddress?: unknown;
  txHash?: unknown;
  expectedBudget?: unknown;
};

export type MainTrackHireApiResult = {
  status: number;
  body: Record<string, unknown>;
  headers: { "Cache-Control": "no-store" };
};

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Public, secret-free agent view. */
function safeAgent(record: Scan8004Agent) {
  return {
    name: record.name?.trim() || `Agent #${record.token_id}`,
    agentId: record.agent_id,
    chainId: record.chain_id,
    ownerAddress: record.owner_address,
    source: "8004scan" as const,
  };
}

export interface MainTrackHireApiDeps {
  resolveAgent(agentId: string): Promise<Scan8004Agent | null>;
  resolveCustody(env: Record<string, string | undefined>): MainTrackCustodyResult;
  reviewForAgent(agent: Scan8004Agent): Promise<MainTrackHireReviewView | null>;
  runHire(input: {
    env: Record<string, string | undefined>;
    ports: MainTrackV2HirePorts;
    hire: MainTrackV2HireInput;
  }): Promise<MainTrackHireRunResult>;
  ports: MainTrackV2HirePorts;
  mapError(error: unknown): { status: number; message: string };
  /** X.149 — browser-wallet flow: build the verified user-Hire plan (no signing). */
  prepareUserHire?(agent: Scan8004Agent): Promise<MainTrackUserHirePrepareOutcome>;
  /** X.149 — browser-wallet flow: independently verify the funded job on-chain. */
  verifyUserHire?(input: {
    jobId: string;
    walletAddress: string;
    agent: Scan8004Agent;
    /** Exact verified quoted amount (wei) used by the execution plan — dynamic. */
    expectedBudget: string;
  }): Promise<MainTrackUserHireVerifyOutcome>;
  /** X.149 — marketplace-owned receipt read (PublicNode) for per-step verification. */
  readReceipt?(txHash: string): Promise<MainTrackReceiptRead>;
}

export async function mainTrackHireApi(input: {
  identity: AuthenticatedIdentity | null;
  request: Request;
  csrfCookie: string | null;
  expectedOrigin: string;
  env: Record<string, string | undefined>;
  deps: MainTrackHireApiDeps;
}): Promise<MainTrackHireApiResult> {
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

  const body = await readJson<MainTrackHireApiBody>(input.request, 4_096);
  if (
    body === null ||
    (body.action !== "review" &&
      body.action !== "activate" &&
      body.action !== "prepare" &&
      body.action !== "verify" &&
      body.action !== "receipt") ||
    !isValidAgentIdentity(body.agentId)
  ) {
    return {
      status: 400,
      body: {
        ok: false,
        error: {
          code: "bad-request",
          message: "Expected an action and a valid exact ERC-8004 agent identity.",
        },
      },
      headers: NO_STORE,
    };
  }

  const agent = await input.deps.resolveAgent(body.agentId);
  if (agent === null || agent.agent_id !== body.agentId) {
    return {
      status: 404,
      body: { ok: false, error: { code: "agent-not-found", message: "Agent not found." } },
      headers: NO_STORE,
    };
  }
  // X.241 — chain-aware resolution (replaces the X.131 chain-97 hard pin).
  // The agent's OWN identity determines the chain: chain 97 (testnet) and
  // chain 56 (mainnet, only when MAINNET_HIRE_ENABLED=true). Ambiguity or an
  // unknown chain FAILS CLOSED. Never a silent 56↔97 fallback.
  const hireChain = chainIdFromAgentId(agent.agent_id);
  if (hireChain === null || !Number.isInteger(agent.chain_id) || agent.chain_id !== hireChain) {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: "unsupported-chain",
          message:
            "Main Track V2 hire requires a resolvable chain-56 or chain-97 ERC-8004 agent identity.",
        },
        data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
      },
      headers: NO_STORE,
    };
  }
  const chainConfig = resolveHireChainConfig(hireChain); // throws only for non-56/97 — unreachable here
  if (hireChain === HIRE_CHAIN_MAINNET && !isMainnetHireEnabled(input.env)) {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: "mainnet-hire-disabled",
          message:
            "Mainnet hiring is unavailable (coming soon). Commercial hire is currently BSC Testnet (chain 97) only.",
        },
        data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
      },
      headers: NO_STORE,
    };
  }
  if (hireChain !== HIRE_CHAIN_TESTNET && hireChain !== HIRE_CHAIN_MAINNET) {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: "unsupported-chain",
          message: `Main Track V2 hire does not support chain ${hireChain}.`,
        },
        data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
      },
      headers: NO_STORE,
    };
  }
  // chainConfig pins the agent's registry — an agent record from a foreign
  // registry for the same chain is rejected before preparation.
  if (
    chainConfig.registry &&
    agent.contract_address &&
    agent.contract_address.toLowerCase() !== chainConfig.registry.toLowerCase()
  ) {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: "registry-mismatch",
          message: "Agent registry does not match the authoritative chain configuration.",
        },
        data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
      },
      headers: NO_STORE,
    };
  }
  if (!agent.owner_address) {
    return {
      status: 409,
      body: {
        ok: false,
        error: { code: "missing-owner", message: "Agent record has no registry owner." },
        data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
      },
      headers: NO_STORE,
    };
  }

  // X.149 — browser-wallet flow: prepare / receipt / verify are READ-ONLY
  // (no server signing) and therefore NEVER require server-side custody. The
  // custody gate below applies ONLY to the marketplace-client `review`/
  // `activate` path.

  // X.149 — browser-wallet flow: prepare (no signing) and verify (read-only).
  if (body.action === "prepare") {
    if (!input.deps.prepareUserHire) {
      return {
        status: 409,
        body: {
          ok: false,
          error: {
            code: "main-track-prepare-unavailable",
            message: "Main Track user Hire preparation is not wired.",
          },
          data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
        },
        headers: NO_STORE,
      };
    }
    const prepared = await input.deps.prepareUserHire(agent);
    if (!prepared.ok) {
      return {
        status: 409,
        body: {
          ok: false,
          error: { code: "main-track-prepare-blocked", message: prepared.reason },
          data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
        },
        headers: NO_STORE,
      };
    }
    return {
      status: 200,
      body: { ok: true, data: prepared },
      headers: NO_STORE,
    };
  }

  if (body.action === "verify") {
    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : "";
    const expectedBudget = typeof body.expectedBudget === "string" ? body.expectedBudget : "";
    if (
      !/^\d+$/.test(jobId) ||
      !/^0x[0-9a-fA-F]{40}$/.test(walletAddress) ||
      !/^\d+$/.test(expectedBudget)
    ) {
      return {
        status: 400,
        body: {
          ok: false,
          error: {
            code: "bad-request",
            message: "Expected a numeric jobId, a valid wallet address, and the executed amount.",
          },
          data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
        },
        headers: NO_STORE,
      };
    }
    if (!input.deps.verifyUserHire) {
      return {
        status: 409,
        body: {
          ok: false,
          error: {
            code: "main-track-verify-unavailable",
            message: "Main Track user Hire verification is not wired.",
          },
          data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
        },
        headers: NO_STORE,
      };
    }
    const verified = await input.deps.verifyUserHire({
      jobId,
      walletAddress,
      agent,
      expectedBudget,
    });
    if (!verified.ok) {
      return {
        status: 409,
        body: {
          ok: false,
          error: { code: "main-track-verify-blocked", message: verified.reason },
          data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
        },
        headers: NO_STORE,
      };
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          policy: MAIN_TRACK_MODEL_B,
          state: "funded-commercial-hire",
          jobId: verified.jobId,
          client: verified.client,
          provider: verified.provider,
          budget: verified.budget,
          active: false,
          activationState: verified.activationState,
        },
      },
      headers: NO_STORE,
    };
  }

  if (body.action === "receipt") {
    const txHash = typeof body.txHash === "string" ? body.txHash : "";
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return {
        status: 400,
        body: {
          ok: false,
          error: { code: "bad-request", message: "Expected a valid transaction hash." },
          data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
        },
        headers: NO_STORE,
      };
    }
    if (!input.deps.readReceipt) {
      return {
        status: 409,
        body: {
          ok: false,
          error: {
            code: "main-track-receipt-unavailable",
            message: "Main Track receipt verification is not wired.",
          },
          data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
        },
        headers: NO_STORE,
      };
    }
    const receipt = await input.deps.readReceipt(txHash);
    return {
      status: 200,
      body: { ok: true, data: { policy: MAIN_TRACK_MODEL_B, receipt } },
      headers: NO_STORE,
    };
  }

  // The marketplace-client path (review / activate) requires server custody.
  const custody = input.deps.resolveCustody(input.env);
  if (!custody.available) {
    return {
      status: 409,
      body: {
        ok: false,
        error: { code: "main-track-custody-required", message: custody.reason },
        data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
      },
      headers: NO_STORE,
    };
  }

  if (body.action === "review") {
    const view = await input.deps.reviewForAgent(agent);
    if (view === null) {
      return {
        status: 409,
        body: {
          ok: false,
          error: { code: "review-unavailable", message: "Main Track negotiation is not wired." },
          data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
        },
        headers: NO_STORE,
      };
    }
    return {
      status: 200,
      body: { ok: true, data: { policy: MAIN_TRACK_MODEL_B, view } },
      headers: NO_STORE,
    };
  }

  // activate: explicit user confirmation is mandatory before any spend.
  if (body.confirmed !== true) {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: "confirmation-required",
          message: "Explicit confirmation is required before funding a hire.",
        },
        data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
      },
      headers: NO_STORE,
    };
  }

  const hire: MainTrackV2HireInput = {
    agentId: body.agentId,
    sellerAddress: agent.owner_address,
    forbiddenClientAddress: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
    expectedChainId: 97,
    expectedCommerce: "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE",
    expectedPaymentToken: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
    expectedPrice: "1000000000000000000",
    request: {
      taskDescription:
        "Produce a deterministic BSC testnet grid-strategy report; no trading or transaction execution.",
      terms: {
        deliverables: "JSON analysis report",
        qualityStandards: "Deterministic output with explicit assumptions and no execution claims",
        successCriteria: ["valid JSON", "chain 97 only"],
      },
    },
  };

  let result: MainTrackHireRunResult;
  try {
    result = await input.deps.runHire({ env: input.env, ports: input.deps.ports, hire });
  } catch (error) {
    const mapped = input.deps.mapError(error);
    return {
      status: mapped.status,
      body: {
        ok: false,
        error: { code: "main-track-hire-failed", message: mapped.message },
        data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
      },
      headers: NO_STORE,
    };
  }

  if (!result.ok) {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: result.custodyRequired ? "main-track-custody-required" : "main-track-hire-blocked",
          message: `${result.blocked.stage}: ${result.blocked.reason}`,
        },
        data: { agent: safeAgent(agent), policy: MAIN_TRACK_MODEL_B },
      },
      headers: NO_STORE,
    };
  }

  return {
    status: 201,
    body: {
      ok: true,
      data: {
        policy: MAIN_TRACK_MODEL_B,
        state: "funded",
        jobId: result.jobId,
        txHashes: result.txHashes,
        blockNumbers: result.blockNumbers,
        job: result.job,
        active: false,
        activationState: result.activationState,
        nextRequiredAction: result.nextRequiredAction,
      },
    },
    headers: NO_STORE,
  };
}
