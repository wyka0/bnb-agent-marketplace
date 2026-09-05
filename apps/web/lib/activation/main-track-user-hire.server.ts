/**
 * X.167 — read-only Model-B final verification (server-only).
 *
 * After the user's browser wallet completes the 5-step ERC-8183 sequence, the
 * marketplace independently confirms the on-chain FUNDED state using ONLY public
 * chain reads. No signer, no private key, no KMS, no custody:
 *
 *   - chain == 97 (pinned MainTrackNetworkConfig)
 *   - exact jobId read via getErc8183Job (read-only)
 *   - client == connected buyer/user wallet
 *   - provider == negotiated registered seller owner
 *   - commerce == official ERC-8183 commerce
 *   - payment token == official $U
 *   - job state == FUNDED, budget == quoted amount (DYNAMIC, not hardcoded)
 *   - submittedAt == 0, deliverable == zero
 *
 * Result is always `activationState = "funded-commercial-hire"`, `active = false`.
 * Never returns ACTIVE. A best-effort cross-check against the seller's CURRENT
 * live quote fails closed on a mismatch, but accepts the on-chain FUNDED state
 * when the endpoint is unreachable (the on-chain record is authoritative).
 */

import {
  createMainTrackNetworkConfig,
  createMainTrackPublicClient,
  MAIN_TRACK_COMMERCE,
  MAIN_TRACK_PAYMENT_TOKEN,
} from "@bnb-marketplace/integrations/altana";
import { ERC8183Client } from "@bnbagent/sdk/erc8183";
import type { Scan8004Agent } from "../eight004scan/types.ts";
import { prepareLiveAgentHire } from "./main-track-negotiation.server.ts";
import type { MainTrackUserHirePrepareOutcome } from "./main-track-user-hire.ts";
import {
  type MainTrackUserHireJobRead,
  type MainTrackUserHireVerifyOutcome,
  verifyMainTrackUserHireFinalState,
} from "./main-track-user-hire.ts";

/** Minimal structural read of a Main Track ERC-8183 job (from `@bnbagent/sdk`). */
export interface MainTrackSdkJobRead {
  id: bigint;
  client: string;
  provider: string;
  budget: bigint;
  status: number;
  statusName: string;
  submittedAt: bigint;
  deliverable: string;
}

/** Status-name mapping mirrors the ERC-8183 kernel's numeric `JobStatus`. */
const JOB_STATUS_NAMES = [
  "OPEN",
  "FUNDED",
  "SUBMITTED",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
] as const;

/** Injectable ports — default to the real read-only path (used by tests). */
export interface MainTrackUserHireFundedVerifyPorts {
  network?: ReturnType<typeof createMainTrackNetworkConfig>;
  readPaymentToken?: () => Promise<string>;
  readJob?: (
    network: ReturnType<typeof createMainTrackNetworkConfig>,
    jobId: bigint
  ) => Promise<MainTrackSdkJobRead>;
  negotiate?: (agentId: string, ownerAddress: string) => Promise<MainTrackUserHirePrepareOutcome>;
}

export interface MainTrackUserHireFundedVerifyInput {
  jobId: string;
  walletAddress: string;
  agent: Scan8004Agent;
  /** Exact verified quoted amount (wei) used by the execution plan — dynamic. */
  expectedBudget: string;
}

/**
 * Read-only confirmation that a Model-B user-wallet hire reached FUNDED.
 * Performs only public chain reads; never broadcasts, signs, or touches custody.
 */
export async function verifyMainTrackUserHireFunded(
  input: MainTrackUserHireFundedVerifyInput,
  ports?: MainTrackUserHireFundedVerifyPorts
): Promise<MainTrackUserHireVerifyOutcome> {
  const jobId = input.jobId;
  if (!/^\d+$/.test(jobId)) {
    return { ok: false, reason: "invalid jobId" };
  }

  const network = ports?.network ?? createMainTrackNetworkConfig();
  // Official-contract guard (read-only config assertion).
  if (
    network.commerceContract.toLowerCase() !== MAIN_TRACK_COMMERCE.toLowerCase() ||
    network.paymentTokenContract.toLowerCase() !== MAIN_TRACK_PAYMENT_TOKEN.toLowerCase()
  ) {
    return {
      ok: false,
      reason: "verification is not configured for the official ERC-8183 commerce / $U token",
    };
  }

  const readPaymentToken =
    ports?.readPaymentToken ??
    (async () => {
      const client = createMainTrackPublicClient();
      return (await client.readContract({
        address: MAIN_TRACK_COMMERCE as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "paymentToken",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "address" }],
          },
        ],
        functionName: "paymentToken",
      })) as string;
    });
  const readJob =
    ports?.readJob ??
    (async (network, id) => {
      const client = await ERC8183Client.create({ network });
      const raw = await client.getJob(id);
      return {
        ...raw,
        statusName: JOB_STATUS_NAMES[raw.status] ?? String(raw.status),
      };
    });
  const negotiate =
    ports?.negotiate ??
    ((agentId, ownerAddress) =>
      prepareLiveAgentHire({ agentId, ownerAddress, nowSeconds: Math.floor(Date.now() / 1000) }));

  // Confirm the commerce's official payment token (read-only).
  try {
    const token = await readPaymentToken();
    if (token.toLowerCase() !== MAIN_TRACK_PAYMENT_TOKEN.toLowerCase()) {
      return {
        ok: false,
        reason: "job commerce payment token is not the official $U token",
      };
    }
  } catch (error) {
    return {
      ok: false,
      reason: `could not read commerce payment token (RPC unavailable): ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  let job: MainTrackSdkJobRead;
  try {
    job = await readJob(network, BigInt(jobId));
  } catch (error) {
    return {
      ok: false,
      reason: `could not read job ${jobId} on-chain (RPC unavailable): ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const read: MainTrackUserHireJobRead = {
    jobId: job.id.toString(),
    client: job.client,
    provider: job.provider,
    budget: job.budget.toString(),
    status: job.status,
    statusName: job.statusName,
    submittedAt: job.submittedAt.toString(),
    deliverable: job.deliverable,
  };

  const verified = verifyMainTrackUserHireFinalState({
    jobId,
    job: read,
    expectedClient: input.walletAddress,
    expectedProvider: input.agent.owner_address ?? "",
    expectedToken: MAIN_TRACK_PAYMENT_TOKEN,
    expectedBudget: input.expectedBudget,
  });
  if (!verified.ok) return verified;

  // Best-effort cross-check against the seller's CURRENT live quote. If the
  // endpoint is reachable and quotes a different amount, fail closed. If the
  // endpoint is down/expired, the on-chain FUNDED state above is authoritative.
  try {
    const quote = await negotiate(input.agent.agent_id, input.agent.owner_address ?? "");
    if (quote.ok && quote.price !== input.expectedBudget) {
      return {
        ok: false,
        reason: `executed amount ${input.expectedBudget} does not match the seller's quoted price ${quote.price}`,
      };
    }
  } catch {
    // Endpoint unreachable/expired — accept the on-chain FUNDED verification.
  }

  return verified;
}
