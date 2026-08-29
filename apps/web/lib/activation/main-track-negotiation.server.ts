/**
 * X.156 — live discovered-agent negotiation (server-only, read-only).
 *
 * Resolves a marketplace-discovered ERC-8004 agent's ON-CHAIN AgentEndpoint,
 * negotiates with the live seller (`POST /negotiate`), verifies the provider
 * signature with the official SDK, and builds the browser-wallet Hire plan
 * from the REAL quote (provider, price, expiry, terms — never hardcoded).
 *
 * The browser wallet remains user-controlled (`eth_sendTransaction`); the
 * server never receives a private key and never signs. No transaction is
 * broadcast anywhere in this module.
 */

import { verifyQuoteSignature, buildJobDescription } from "@bnbagent/sdk/erc8183";
import { parseAbi } from "viem";
import {
  createMainTrackPublicClient,
  MAIN_TRACK_COMMERCE,
  MAIN_TRACK_PAYMENT_TOKEN,
  MAIN_TRACK_REGISTRY,
} from "@bnb-marketplace/integrations/altana";
import { prepareMainTrackUserHire } from "./main-track-user-hire.ts";
import type {
  MainTrackLiveQuote,
  MainTrackUserHirePrepareOutcome,
} from "./main-track-user-hire.ts";

const REGISTRY_ABI = parseAbi(["function tokenURI(uint256) view returns (string)"]);
const COMMERCE_ABI = parseAbi(["function jobCounter() view returns (uint256)"]);

/** Standard marketplace hire task/terms sent to any live seller. */
export const HIRE_TASK_DESCRIPTION =
  "Produce a deterministic BSC testnet grid-strategy report; no trading or transaction execution.";
export const HIRE_TERMS = {
  deliverables: "JSON analysis report",
  quality_standards: "Deterministic output with explicit assumptions and no execution claims",
  success_criteria: ["valid JSON", "chain 97 only"],
};

/** Decode an EIP-8004 data-URI agent card to JSON (base64 or percent-encoded). */
export function decodeAgentCard(
  uri: string
): { name?: string; services?: Array<{ name?: string; endpoint?: string }> } | null {
  if (!uri.startsWith("data:")) return null;
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const payload = uri.slice(comma + 1);
  try {
    return JSON.parse(decodeURIComponent(payload));
  } catch {
    /* fall through to base64 */
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/** A registered service entry on an EIP-8004 agent card. */
export interface AgentCardService {
  name?: string;
  endpoint?: string;
  version?: string;
}

export interface AgentCardLike {
  services?: AgentCardService[];
}

/**
 * X.162 — resolve the registered HTTPS ERC-8183/A2A negotiation endpoint from an
 * agent card. An "ERC-8183" service is a legitimate seller negotiation endpoint
 * (not just "A2A"). Only a registered card service with an HTTPS endpoint is
 * ever used — never an arbitrary URL. Returns null (fail closed) otherwise.
 */
export function resolveServiceEndpointFromCard(card: AgentCardLike | null): {
  endpoint: string | null;
} {
  const services = card?.services ?? [];
  const service =
    services.find(
      (s) =>
        s &&
        typeof s.endpoint === "string" &&
        /^https:\/\//.test(s.endpoint) &&
        /erc-?8183|a2a/i.test(s.name ?? "")
    ) ??
    services.find((s) => s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint));
  return { endpoint: service?.endpoint ?? null };
}

/** Resolve the agent's registered HTTPS ERC-8183/A2A endpoint from its on-chain card. */
export async function resolveRegisteredEndpoint(
  agentId: string
): Promise<{ endpoint: string | null; reason?: string }> {
  const m = /^(\d+):(0x[0-9a-fA-F]{40}):(\d+)$/.exec(agentId);
  if (!m) return { endpoint: null, reason: "invalid agent identity" };
  if (Number(m[1]) !== 97) {
    return { endpoint: null, reason: "agent is not on BSC Testnet (chain 97)" };
  }
  if ((m[2] as string).toLowerCase() !== MAIN_TRACK_REGISTRY.toLowerCase()) {
    return { endpoint: null, reason: "agent is not on the official chain-97 registry" };
  }
  const tokenId = BigInt(m[3] as string);
  try {
    const client = createMainTrackPublicClient();
    const uri = await client.readContract({
      address: MAIN_TRACK_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "tokenURI",
      args: [tokenId],
    });
    const card = decodeAgentCard(uri);
    const { endpoint } = resolveServiceEndpointFromCard(card);
    if (!endpoint) {
      return {
        endpoint: null,
        reason: "agent card has no registered HTTPS ERC-8183/A2A endpoint",
      };
    }
    return { endpoint };
  } catch {
    return { endpoint: null, reason: "could not read the agent card" };
  }
}

/** POST /negotiate against a live seller and return the quote envelope. */
export async function negotiateSeller(
  endpoint: string,
  taskDescription: string,
  terms: Record<string, unknown>
): Promise<MainTrackLiveQuote | null> {
  const base = endpoint.endsWith("/negotiate")
    ? endpoint
    : `${endpoint.replace(/\/+$/, "")}/negotiate`;
  try {
    const response = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_description: taskDescription, terms }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const env = (await response.json()) as MainTrackLiveQuote;
    if (env?.response?.accepted !== true) return null;
    if (
      typeof env.chain_id !== "number" ||
      typeof env.verifying_contract !== "string" ||
      !env.provider_sig ||
      !env.negotiation_hash
    ) {
      return null;
    }
    return env;
  } catch {
    return null;
  }
}

/** Read the live ERC-8183 job counter (read-only) to predict the next job id. */
export async function readNextJobId(): Promise<bigint | null> {
  try {
    const client = createMainTrackPublicClient();
    const counter = await client.readContract({
      address: MAIN_TRACK_COMMERCE,
      abi: COMMERCE_ABI,
      functionName: "jobCounter",
    });
    return (counter as bigint) + 1n;
  } catch {
    return null;
  }
}

/** Historical/stranded job ids that must never be reused as a new hire. */
export const MAIN_TRACK_HISTORY_JOB_IDS = [
  "622",
  "641",
  "646",
  "648",
  "649",
  "650",
  "651",
  "652",
  "653",
];

/** Injectable ports (deterministic tests); default to the live read-only path. */
export interface LiveAgentHirePorts {
  resolveEndpoint(agentId: string): Promise<{ endpoint: string | null; reason?: string }>;
  negotiate(endpoint: string): Promise<MainTrackLiveQuote | null>;
  verifyQuote(
    quote: MainTrackLiveQuote,
    owner: string
  ): Promise<{ valid: boolean; signer: string; reason?: string }>;
  nextJobId(): Promise<bigint | null>;
}

async function defaultVerifyQuote(
  quote: MainTrackLiveQuote,
  owner: string
): Promise<{ valid: boolean; signer: string; reason?: string }> {
  const client = createMainTrackPublicClient();
  const sig = await verifyQuoteSignature({
    envelope: quote as unknown as Record<string, unknown>,
    provider: owner.toLowerCase() as `0x${string}`,
    publicClient: client,
    expectedVerifyingContract: MAIN_TRACK_COMMERCE,
  });
  if (sig.valid) return { valid: true, signer: sig.signer };
  return { valid: false, signer: "", reason: sig.reason ?? "provider signature is not valid" };
}

/**
 * Prepare a Hire against a LIVE discovered seller (server-side, read-only, no
 * signing). Resolves the registered endpoint, negotiates, verifies the provider
 * signature against the registered owner, builds the canonical description, and
 * constructs the plan from the real quote. Fails closed at every step.
 */
export async function prepareLiveAgentHire(input: {
  agentId: string;
  ownerAddress: string;
  historyJobIds?: string[];
  nowSeconds?: number;
  ports?: Partial<LiveAgentHirePorts>;
}): Promise<MainTrackUserHirePrepareOutcome> {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ports: LiveAgentHirePorts = {
    resolveEndpoint: resolveRegisteredEndpoint,
    negotiate: (endpoint) => negotiateSeller(endpoint, HIRE_TASK_DESCRIPTION, HIRE_TERMS),
    verifyQuote: defaultVerifyQuote,
    nextJobId: readNextJobId,
    ...input.ports,
  };
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.ownerAddress)) {
    return { ok: false, reason: "agent has no registered owner" };
  }
  const resolved = await ports.resolveEndpoint(input.agentId);
  if (!resolved.endpoint) {
    return { ok: false, reason: resolved.reason ?? "no registered seller endpoint" };
  }
  const quote = await ports.negotiate(resolved.endpoint);
  if (!quote) {
    return { ok: false, reason: "seller negotiation failed or endpoint unreachable" };
  }
  const sig = await ports.verifyQuote(quote, input.ownerAddress);
  if (!sig.valid || sig.signer.toLowerCase() !== input.ownerAddress.toLowerCase()) {
    return {
      ok: false,
      reason: sig.reason ?? "provider signature is not valid for the registered owner",
    };
  }
  let description: string;
  try {
    description = buildJobDescription(quote as unknown as Record<string, unknown>);
  } catch {
    return { ok: false, reason: "could not build the job description from the quote" };
  }
  const nextJobId = await ports.nextJobId();
  if (nextJobId === null) {
    return { ok: false, reason: "could not predict the next job id" };
  }
  return prepareMainTrackUserHire({
    agentId: input.agentId,
    quote,
    description,
    verifiedSigner: sig.signer,
    nextJobId,
    historyJobIds: input.historyJobIds ?? MAIN_TRACK_HISTORY_JOB_IDS,
    nowSeconds,
  });
}

void MAIN_TRACK_PAYMENT_TOKEN;
