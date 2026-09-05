/**
 * X.168 — Dashboard funded-hire visibility (server-side live ports).
 *
 * Binds the pure `resolveHiredAgents` resolver to the real read-only surfaces:
 *
 *   - ERC-8183 job counter + per-job reads → PublicNode public RPC
 *     (`createMainTrackPublicClient` / `@bnbagent/sdk` `getJob`)
 *   - provider → agent identity → 8004scan public registry (`listAgents`
 *     filtered by `ownerAddress` on chain 97)
 *
 * ZERO transactions: this module only performs public chain reads and the
 * public registry lookup. No signer, no private key, and no raw transaction
 * broadcast is ever issued.
 */

import {
  MAIN_TRACK_COMMERCE,
  createMainTrackNetworkConfig,
  createMainTrackPublicClient,
} from "@bnb-marketplace/integrations/altana";
import { ERC8183Client } from "@bnbagent/sdk/erc8183";
import { listAgents } from "../eight004scan/client.ts";
import { normalizeAgents } from "../eight004scan/normalize.ts";
import { HIRED_CHAIN_ID, HIRED_DEFAULT_MAX_SCAN, resolveHiredAgents } from "./hired-agents.ts";
import type {
  AgentResolution,
  HiredAgentsPorts,
  HiredJobRead,
  HiresDashboardResult,
} from "./hired-agents.ts";

/** ERC-8183 kernel `JobStatus` names (index = numeric status). */
const JOB_STATUS_NAMES = [
  "OPEN",
  "FUNDED",
  "SUBMITTED",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
] as const;

/** Read the pinned chain-97 commerce's job counter (read-only). */
export async function readHiredJobCount(): Promise<bigint | null> {
  try {
    const client = createMainTrackPublicClient();
    return (await client.readContract({
      address: MAIN_TRACK_COMMERCE,
      abi: [
        {
          type: "function",
          name: "jobCounter",
          stateMutability: "view",
          inputs: [],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "jobCounter",
    })) as bigint;
  } catch {
    return null;
  }
}

/** Read a batch of ERC-8183 jobs with bounded concurrency (read-only). */
export async function readHiredJobs(
  ids: readonly bigint[]
): Promise<ReadonlyArray<HiredJobRead | null>> {
  const results = new Array<HiredJobRead | null>(ids.length);
  if (ids.length === 0) return results;
  const concurrency = 8;
  let next = 0;
  const client = await ERC8183Client.create({ network: createMainTrackNetworkConfig() });

  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= ids.length) return;
      const id = ids[index] as bigint;
      try {
        const raw = await client.getJob(id);
        results[index] = {
          jobId: raw.id.toString(),
          client: raw.client,
          provider: raw.provider,
          budget: raw.budget.toString(),
          status: raw.status,
          statusName: JOB_STATUS_NAMES[raw.status] ?? String(raw.status),
          chainId: HIRED_CHAIN_ID,
          expiredAt: raw.expiredAt?.toString(),
          evaluator: raw.evaluator,
          submittedAt: raw.submittedAt?.toString(),
        };
      } catch {
        results[index] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** Resolve a provider (registered agent owner) to its chain-97 registry identity. */
export async function resolveHiredAgentIdentity(provider: string): Promise<AgentResolution | null> {
  try {
    const result = await listAgents({
      chainId: HIRED_CHAIN_ID,
      ownerAddress: provider,
      isTestnet: true,
      limit: 100,
    });
    if (!result.ok) {
      return { status: "unavailable", reason: result.reason };
    }
    const match = normalizeAgents(result.data).find(
      (a) =>
        a.chainId === HIRED_CHAIN_ID &&
        typeof a.ownerAddress === "string" &&
        a.ownerAddress.toLowerCase() === provider.toLowerCase()
    );
    if (!match) {
      return { status: "not-registered" };
    }
    return {
      status: "registered",
      agent: {
        agentId: match.agentId,
        agentName: match.name,
        tokenId: match.tokenId,
        chainId: match.chainId,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

/** Live read-only ports for the dashboard resolver. */
export function createLiveHiredAgentsPorts(): HiredAgentsPorts {
  return {
    readJobCount: readHiredJobCount,
    readJobs: readHiredJobs,
    resolveAgent: resolveHiredAgentIdentity,
  };
}

/** Resolve the connected wallet's FUNDED hires through the live read-only path. */
export async function resolveDashboardHires(
  walletAddress: string,
  options: { maxScan?: number } = {}
): Promise<HiresDashboardResult> {
  return resolveHiredAgents({
    walletAddress,
    maxScan: options.maxScan ?? HIRED_DEFAULT_MAX_SCAN,
    ports: createLiveHiredAgentsPorts(),
  });
}
