/**
 * X.84 — ERC-8004 registration-file capability resolution (CANDIDATE, UNVERIFIED).
 *
 * The ERC-8004 registry stores only an `agentURI` pointer; the referenced
 * registration file (off-chain JSON) MAY declare `services[]` with endpoints,
 * skills, and capabilities. Per X.82/X.83 this metadata is SELF-ASSERTED,
 * mutable (via setAgentURI), off-chain, and NOT job-bound — it is DISCOVERY
 * data, never execution authority.
 *
 * This module normalizes a registration file into a `CandidateCapabilityBinding`
 * that is explicitly UNVERIFIED and NOT job-bound. It NEVER produces a
 * `VerifiedExecutionCapability` and NEVER promotes self-asserted metadata into
 * execution authority. The activation gate (X.80/X.81) stays fail-closed: the
 * composed `resolveCapabilityBinding` continues to return null for these.
 *
 * All I/O is injected (reader + URI resolver) so the resolution logic is
 * deterministic and testable without network access.
 */

import type { Erc8183Job } from "@altananetwork/sdk";

/** Canonical marketplace registration file (read-only, self-asserted). */
export const DEFAULT_REGISTRATION_FILE_URL =
  "https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json";

/** A single declared service endpoint in an ERC-8004 registration file. */
export interface Erc8004RegistrationService {
  id?: string;
  type?: string; // "mcp" | "a2a" | "oasf" | "web" | ...
  endpoint?: string;
  capabilities?: string[];
  skills?: string[];
  mcpTools?: string[];
  a2aSkills?: string[];
}

/** The normalized subset of an ERC-8004 registration file we read. */
export interface Erc8004RegistrationFile {
  version?: string;
  agent_id?: string;
  name?: string;
  description?: string;
  services?: Erc8004RegistrationService[];
  supportedTrust?: string[];
  [key: string]: unknown;
}

/** Reads a registration file by URI. Injected so tests stay deterministic. */
export interface RegistrationFileReader {
  readRegistrationFile(uri: string): Promise<unknown>;
}

/** Resolves the registration-file URI for an agent (injected; off-chain pointer). */
export type AgentUriResolver = (agentId: string) => Promise<string | null>;

/**
 * A SELF-ASSERTED capability candidate. Never authoritative. The gate MUST NOT
 * treat this as execution authority (see X.82/X.83).
 */
export interface CandidateCapabilityBinding {
  authority: "self-asserted-registration-file";
  agentId: string;
  /** Whether this candidate is bound to a specific funded job — always false here. */
  jobBound: false;
  /** Whether the file content is integrity-anchored on-chain — always false. */
  integrityVerified: false;
  resource: string;
  executionCapability: string;
  source: string;
  fetchedAt: string;
  caveats: string[];
}

function normalizeService(service: unknown): Erc8004RegistrationService | null {
  if (typeof service !== "object" || service === null) return null;
  return service as Erc8004RegistrationService;
}

/**
 * Normalize a parsed registration file into a single candidate binding.
 * `resource` = first declared service endpoint; `executionCapability` =
 * union of declared skills/capabilities. All values are taken verbatim from
 * the self-asserted file — never fabricated, never upgraded to "verified".
 */
export function normalizeRegistrationFileCandidate(
  agentId: string,
  uri: string,
  file: Erc8004RegistrationFile
): CandidateCapabilityBinding {
  const services = Array.isArray(file.services)
    ? file.services.map(normalizeService).filter((s): s is Erc8004RegistrationService => s !== null)
    : [];

  const endpoint =
    services.find((s) => typeof s.endpoint === "string" && s.endpoint.length > 0)?.endpoint ?? "";
  const resource = endpoint.length > 0 ? endpoint : `agent-registration:${agentId}`;

  const declared = new Set<string>();
  for (const s of services) {
    for (const key of ["capabilities", "skills", "mcpTools", "a2aSkills"] as const) {
      const list = s[key];
      if (Array.isArray(list)) {
        for (const v of list) if (typeof v === "string" && v.length > 0) declared.add(v);
      }
    }
  }
  const executionCapability =
    declared.size > 0 ? Array.from(declared).join(",") : "self-asserted:no-capability-declared";

  const caveats = [
    "self-asserted: mutable via setAgentURI, not anchored on-chain",
    "off-chain discovery metadata, not execution authority (X.82/X.83)",
    "not bound to a funded ERC-8183 job",
  ];

  return {
    authority: "self-asserted-registration-file",
    agentId,
    jobBound: false,
    integrityVerified: false,
    resource,
    executionCapability,
    source: uri,
    fetchedAt: new Date().toISOString(),
    caveats,
  };
}

/**
 * Resolve the registration-file candidate for an agent. Returns null on any
 * read/parse/validation failure (fail soft — never throws to the gate).
 */
export async function resolveRegistrationFileCandidate(
  agentId: string,
  options: {
    reader: RegistrationFileReader;
    resolveAgentUri: AgentUriResolver;
    now?: () => Date;
  }
): Promise<CandidateCapabilityBinding | null> {
  if (typeof agentId !== "string" || agentId.trim().length === 0) return null;
  const uri = await options.resolveAgentUri(agentId);
  if (typeof uri !== "string" || uri.trim().length === 0) return null;

  let raw: unknown;
  try {
    raw = await options.reader.readRegistrationFile(uri);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;

  return normalizeRegistrationFileCandidate(agentId, uri, raw as Erc8004RegistrationFile);
}

/** Re-export the job type for the composed resolver signature. */
export type { Erc8183Job };
