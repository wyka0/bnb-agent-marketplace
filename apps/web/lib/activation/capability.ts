/**
 * X.6 — agent activation capability classification (PURE, framework-free).
 *
 * Honest, derived-only activation state for a registry agent. Nothing here
 * invents pricing, calldata, capabilities, or recipients: the classifier reads
 * ONLY the fields the 8004scan API actually returns, and the capability
 * resolver (the extension point where REAL capability metadata will arrive)
 * currently returns `null` — the API contract exposes no action/pricing
 * surface. Every real agent therefore classifies NOT_ACTIVATABLE (mainnet /
 * unsupported chain) or CAPABILITY_UNKNOWN — never a fabricated "hireable".
 *
 * This module performs NO network calls and reads NO environment: the server
 * route (hire.server.ts) and the framework-free card mapping share it.
 */

/** The ONLY chain the sell-side activation path runs on (BNB testnet). */
export const ACTIVATION_CHAIN_ID = 97 as const;

export type AgentActivationState = "ACTIVATABLE" | "NOT_ACTIVATABLE" | "CAPABILITY_UNKNOWN";

export type AgentActivationReason = "unsupported-chain" | "no-actionable-capability";

export interface AgentActivationClassification {
  state: AgentActivationState;
  reason: AgentActivationReason | null;
  /** Human-readable, honest detail — never elaborates a capability. */
  detail: string;
}

/**
 * The registry identity surface the classifier may read. A strict subset of
 * what 8004scan actually returns — the classifier never receives anything it
 * cannot source from the real `GET /agents` record.
 */
export interface RegistryAgentIdentity {
  agentId?: string;
  chainId: number;
  isTestnet: boolean;
  name?: string | null;
  description?: string | null;
  ownerAddress?: string | null;
}

/**
 * A REAL actionable capability, as it would be resolved from verified
 * platform data (not from the 8004scan envelope — it carries none). Every
 * field is mandatory and currency-valued; nothing here has a default.
 */
export interface AgentActivationCapability {
  /** The only action kind the activation pipeline can review. */
  kind: "erc8183-hire";
  /** Atomic $U units (chain-97 verified token) — REAL pricing, never quoted. */
  amount: bigint;
  /** Absolute unix seconds for the ERC-8183 job expiry (must exceed now). */
  expiresAt: bigint;
  /** Predicted ERC-8183 job id (`jobCounter() + 1`) — REAL, never guessed. */
  jobId: bigint;
  /** Protected resource advertised in the sell-side x402 requirement. */
  resourceUrl: string;
}

/**
 * Resolve the agent's REAL activation capability from the registry record.
 *
 * The documented 8004scan contract (types.ts) exposes NO action/pricing fields,
 * so this resolves `null` for every real record. This function is the single
 * extension point where a verified capability source may be plugged in later —
 * it is a pure read; it fabricates nothing.
 */
export function resolveAgentActivationCapability(
  record: RegistryAgentIdentity
): AgentActivationCapability | null {
  if (record.chainId !== ACTIVATION_CHAIN_ID) return null;
  // No documented 8004scan field carries action/pricing metadata today.
  return null;
}

/**
 * Classify an agent using ONLY real record fields (plus any capability that an
 * explicit verified source supplied — the same capability the pipeline acts
 * on, never fabricated here):
 *   - chainId !== 97            -> NOT_ACTIVATABLE (unsupported-chain)
 *   - chain 97, no capability   -> CAPABILITY_UNKNOWN
 *   - chain 97, capability      -> ACTIVATABLE
 */
export function classifyAgentActivation(
  record: RegistryAgentIdentity,
  capability?: AgentActivationCapability
): AgentActivationClassification {
  if (record.chainId !== ACTIVATION_CHAIN_ID) {
    return {
      state: "NOT_ACTIVATABLE",
      reason: "unsupported-chain",
      detail: `Chain ${record.chainId} is not the supported activation chain (BNB testnet, ${ACTIVATION_CHAIN_ID}); mainnet is never used for activation.`,
    };
  }
  const resolved = capability ?? resolveAgentActivationCapability(record);
  if (resolved === null) {
    return {
      state: "CAPABILITY_UNKNOWN",
      reason: "no-actionable-capability",
      detail:
        "The agent does not expose a verified actionable endpoint: no pricing or action metadata exists in its registry record.",
    };
  }
  return {
    state: "ACTIVATABLE",
    reason: null,
    detail: "The agent exposes a verified actionable activation capability.",
  };
}
