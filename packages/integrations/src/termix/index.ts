/**
 * TERMIX AACP integration — READ-ONLY reputation surface.
 *
 * This module exposes a server-side, read-only adapter over the TermiX
 * Autonomous Agent Capital Protocol (AACP) reputation API on BSC Testnet
 * (chain 97). It can ONLY read: no wallet, no signer, no private key, no
 * transaction, no staking, no hiring, no settlement.
 *
 * TermiX job execution (create/fund/execute/evaluate/settle/dispute) is
 * INTENTIONALLY DEFERRED to a later phase and is NOT implemented here. The
 * legacy "Agent Advantage Report" contract below is retained as an explicit,
 * not-implemented placeholder for that future work.
 */

// Read-only reputation surface (implemented this phase).
export {
  createTermixClient,
  termixBaseUrl,
  isRawReputation,
  type TermixClient,
  type TermixClientOptions,
  type TermixHttpResult,
  type FetchFn,
} from "./client.js";

export {
  decodeAnomalyFlags,
  isValidAgentId,
  mapErc8004ToTermixAgentId,
  normalizeReputation,
  getTermixReputationByAgentId,
  getTermixReputationForAgent,
} from "./reputation.js";

export {
  TERMIX_AACP_CHAIN_ID,
  TERMIX_AACP_DEFAULT_BASE_URL,
  TERMIX_AGENT_NFT_ADDRESS,
  TERMIX_REPUTATION_SOURCE,
  type Erc8004AgentIdentity,
  type TermixAnomaly,
  type TermixIdentityMapping,
  type TermixReputation,
  type TermixReputationFailure,
  type TermixReputationResult,
  type TermixReputationSource,
  type TermiXRawAgent,
  type TermiXRawAgentReputation,
  type TermiXRawEvaluatorMetrics,
  type TermiXRawReputation,
  type TermiXEnvelope,
  type TermiXSuccessEnvelope,
  type TermiXErrorEnvelope,
} from "./types.js";

/* --------------------------------------------------------------------------
 * DEFERRED (NOT IMPLEMENTED) — TermiX job/advantage execution surface.
 * Retained as an interface-only placeholder. No execution occurs this phase.
 * ------------------------------------------------------------------------ */

/** Dimension axes a future report compares across. */
export type ReportMetricKey = "time" | "cost" | "quality";

export interface ComparisonMetric {
  metric: ReportMetricKey;
  /** Human baseline value. */
  human: number;
  /** Agent value. */
  agent: number;
  /** Unit, e.g. "min", "usd", "score". */
  unit: string;
}

export interface AdvantageReport {
  id: string;
  agentSlug: string;
  /** ISO creation timestamp. */
  createdAt: string;
  summary: string;
  metrics: ComparisonMetric[];
}

export interface GenerateReportInput {
  agentSlug: string;
  /** Human baseline definition, e.g. task + expected effort. */
  baseline: { task: string; expectedTimeMs: number; expectedCostUsd: number };
}

/** Contract a future TERMIX execution adapter must satisfy (NOT implemented). */
export interface TermixAdapter {
  readonly providerName: "termix";

  generateReport(input: GenerateReportInput): Promise<AdvantageReport>;
  getReport(reportId: string): Promise<AdvantageReport>;
}

export const TERMIX_ADAPTER_NOT_IMPLEMENTED =
  "TERMIX job/advantage execution adapter is not implemented yet (read-only reputation only)." as const;
