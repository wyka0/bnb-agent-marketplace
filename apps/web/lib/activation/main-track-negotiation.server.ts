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
import { createPublicClient, http, parseAbi } from "viem";
import {
  createMainTrackPublicClient,
  resolveHireChainConfig,
  isMainnetHireEnabled,
  chainIdFromAgentId,
  HIRE_CHAIN_TESTNET,
  type HireChainConfig,
} from "@bnb-marketplace/integrations/altana";
import { prepareMainTrackUserHire } from "./main-track-user-hire.ts";
import type {
  MainTrackLiveQuote,
  MainTrackUserHirePrepareOutcome,
} from "./main-track-user-hire.ts";

const REGISTRY_ABI = parseAbi(["function tokenURI(uint256) view returns (string)"]);
const COMMERCE_ABI = parseAbi(["function jobCounter() view returns (uint256)"]);

/**
 * X.234 — server-side Mainnet hire gate. Reads `process.env` explicitly
 * (server-only module); defaults to DISABLED. Nothing in the UI can enable it.
 */
export function isMainnetHireEnabledServer(env: Record<string, string | undefined> = {}): boolean {
  return isMainnetHireEnabled(env);
}

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
  // X.234 — the chain comes from the canonical registry identity (never a
  // display label). Both hire chains resolve here; anything else fails closed.
  const agentChain = chainIdFromAgentId(agentId);
  if (agentChain === null) {
    return { endpoint: null, reason: "agent is not on a supported hire chain (expected 56 or 97)" };
  }
  let cfg: HireChainConfig;
  try {
    cfg = resolveHireChainConfig(agentChain);
  } catch {
    return { endpoint: null, reason: "agent is not on a supported hire chain (expected 56 or 97)" };
  }
  if ((m[2] as string).toLowerCase() !== cfg.registry.toLowerCase()) {
    return agentChain === HIRE_CHAIN_TESTNET
      ? { endpoint: null, reason: "agent is not on the official chain-97 registry" }
      : { endpoint: null, reason: "agent is not on the official chain-56 registry" };
  }
  const tokenId = BigInt(m[3] as string);
  try {
    // Read-only client for the AGENT's own chain (testnet default preserved).
    const client =
      agentChain === HIRE_CHAIN_TESTNET
        ? createMainTrackPublicClient()
        : createPublicClient({ transport: http(cfg.rpcUrl) });
    const uri = await client.readContract({
      address: cfg.registry as `0x${string}`,
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

/**
 * X.197 — diagnostic variant of `negotiateSeller`. Same behavior and same
 * validation (nothing is loosened), but on failure it classifies the exact
 * failure class so the cause is diagnosable instead of a generic
 * "seller negotiation failed or endpoint unreachable":
 *
 *   - `dns`        seller host did not resolve
 *   - `timeout`    request exceeded the 15s timeout
 *   - `http`       seller returned a non-2xx HTTP status
 *   - `malformed`  response was not a well-formed, accepted quote envelope
 *   - `network`    any other transport failure
 *
 * Returns the quote on success and a human, secrets-free reason on failure.
 */
export type NegotiateFailureClass = "dns" | "timeout" | "http" | "malformed" | "network";

export interface NegotiateDiagnosedResult {
  ok: true;
  quote: MainTrackLiveQuote;
}

export interface NegotiateDiagnosedFailure {
  ok: false;
  reason: string;
  failure: NegotiateFailureClass;
  status?: number;
}

export type NegotiateDiagnosedOutcome = NegotiateDiagnosedResult | NegotiateDiagnosedFailure;

export async function negotiateSellerDiagnosed(
  endpoint: string,
  taskDescription: string,
  terms: Record<string, unknown>
): Promise<NegotiateDiagnosedOutcome> {
  const base = endpoint.endsWith("/negotiate")
    ? endpoint
    : `${endpoint.replace(/\/+$/, "")}/negotiate`;
  let response: Response;
  try {
    response = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_description: taskDescription, terms }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, failure: "timeout", reason: "seller negotiation timed out" };
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|not resolve/i.test(message)) {
      return {
        ok: false,
        failure: "dns",
        reason: "seller endpoint DNS resolution failed",
      };
    }
    return { ok: false, failure: "network", reason: "seller endpoint unreachable (network error)" };
  }
  if (!response.ok) {
    return {
      ok: false,
      failure: "http",
      status: response.status,
      reason: `seller endpoint returned HTTP ${response.status}`,
    };
  }
  let env: MainTrackLiveQuote;
  try {
    env = (await response.json()) as MainTrackLiveQuote;
  } catch {
    return {
      ok: false,
      failure: "malformed",
      reason: "seller negotiation returned a non-JSON response",
    };
  }
  if (env?.response?.accepted !== true) {
    return {
      ok: false,
      failure: "malformed",
      reason: "seller negotiation declined the request (accepted !== true)",
    };
  }
  if (
    typeof env.chain_id !== "number" ||
    typeof env.verifying_contract !== "string" ||
    !env.provider_sig ||
    !env.negotiation_hash
  ) {
    return {
      ok: false,
      failure: "malformed",
      reason: "seller negotiation returned a malformed quote envelope",
    };
  }
  return { ok: true, quote: env };
}

/** Read the live ERC-8183 job counter (read-only) to predict the next job id. */
export async function readNextJobId(): Promise<bigint | null> {
  return readNextJobIdForChain(HIRE_CHAIN_TESTNET);
}

/**
 * X.234 — chain-aware job-counter read (read-only). Used for the agent's own
 * chain once Mainnet hiring is explicitly enabled; today only the testnet
 * path is reachable because the Mainnet gate below stays closed.
 */
export async function readNextJobIdForChain(chainId: number): Promise<bigint | null> {
  let cfg: HireChainConfig;
  try {
    cfg = resolveHireChainConfig(chainId);
  } catch {
    return null;
  }
  try {
    const client =
      cfg.chainId === HIRE_CHAIN_TESTNET
        ? createMainTrackPublicClient()
        : createPublicClient({ transport: http(cfg.rpcUrl) });
    const counter = await client.readContract({
      address: cfg.commerce as `0x${string}`,
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
  owner: string,
  agentId?: string
): Promise<{ valid: boolean; signer: string; reason?: string }> {
  // X.234 — chain-aware provider validation:
  // 1. the quote must be for a supported hire chain (56/97);
  // 2. when the agent identity is known, the quote chain must match it;
  // 3. the agent's registry must match the chain configuration;
  // 4. the verifying contract must match the chain configuration.
  // A Testnet signature can never validate a Mainnet quote and vice versa.
  let cfg: HireChainConfig;
  try {
    cfg = resolveHireChainConfig(quote.chain_id);
  } catch {
    return {
      valid: false,
      signer: "",
      reason: "quote is not for a supported hire chain (expected chain 56 or 97)",
    };
  }
  if (agentId !== undefined) {
    const agentChain = chainIdFromAgentId(agentId);
    if (agentChain === null || agentChain !== quote.chain_id) {
      return {
        valid: false,
        signer: "",
        reason: "quote chain does not match the selected agent chain",
      };
    }
    const registry = /^(\d+):(0x[0-9a-fA-F]{40}):\d+$/.exec(agentId)?.[2] ?? "";
    if (registry.toLowerCase() !== cfg.registry.toLowerCase()) {
      return {
        valid: false,
        signer: "",
        reason: "quote registry does not match the chain configuration",
      };
    }
  }
  const client =
    cfg.chainId === HIRE_CHAIN_TESTNET
      ? createMainTrackPublicClient()
      : createPublicClient({ transport: http(cfg.rpcUrl) });
  const sig = await verifyQuoteSignature({
    envelope: quote as unknown as Record<string, unknown>,
    provider: owner.toLowerCase() as `0x${string}`,
    publicClient: client,
    expectedVerifyingContract: cfg.commerce,
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
  /**
   * X.234 — Mainnet hiring requires explicit enablement. Defaults to false
   * (fail closed): chain-56 agents stop with the unavailable message BEFORE
   * any negotiation. Chain-97 behavior is unchanged.
   */
  mainnetHireEnabled?: boolean;
}): Promise<MainTrackUserHirePrepareOutcome> {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const useDefaultNegotiate = input.ports?.negotiate === undefined;
  // The agent chain comes from the canonical registry identity (never a label).
  const agentChain = chainIdFromAgentId(input.agentId);
  const ports: LiveAgentHirePorts = {
    resolveEndpoint: resolveRegisteredEndpoint,
    negotiate: (endpoint) => negotiateSeller(endpoint, HIRE_TASK_DESCRIPTION, HIRE_TERMS),
    verifyQuote: (quote, owner) => defaultVerifyQuote(quote, owner, input.agentId),
    nextJobId: () => (agentChain === 56 ? readNextJobIdForChain(56) : readNextJobId()),
    ...input.ports,
  };
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.ownerAddress)) {
    return { ok: false, reason: "agent has no registered owner" };
  }
  const resolved = await ports.resolveEndpoint(input.agentId);
  if (!resolved.endpoint) {
    return { ok: false, reason: resolved.reason ?? "no registered seller endpoint" };
  }
  // X.234 — server-side Mainnet gate (no client bypass possible): a chain-56
  // agent stops here unless Mainnet hiring was explicitly enabled.
  if (agentChain === 56 && input.mainnetHireEnabled !== true) {
    return {
      ok: false,
      reason:
        "Mainnet hiring is unavailable (coming soon). Commercial hire is currently BSC Testnet (chain 97) only.",
    };
  }
  // X.197 — on the LIVE path, surface the exact negotiation failure class
  // (dns / timeout / http / malformed / network) instead of a generic reason,
  // so production reachability issues are diagnosable. Injected ports (tests)
  // keep the established generic reason contract.
  let quote: MainTrackLiveQuote | null;
  let negotiationReason = "seller negotiation failed or endpoint unreachable";
  if (useDefaultNegotiate) {
    const diagnosed = await negotiateSellerDiagnosed(
      resolved.endpoint,
      HIRE_TASK_DESCRIPTION,
      HIRE_TERMS
    );
    quote = diagnosed.ok ? diagnosed.quote : null;
    if (!diagnosed.ok) negotiationReason = diagnosed.reason;
  } else {
    quote = await ports.negotiate(resolved.endpoint);
  }
  if (!quote) {
    return { ok: false, reason: negotiationReason };
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
    mainnetHireEnabled: input.mainnetHireEnabled,
  });
}
