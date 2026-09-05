/**
 * ALTANA — certified skills capability adapter (Phase 4).
 *
 * SCOPE — capability METADATA + VALIDATION only. This module:
 *   - lists the official Altana-certified skills as marketplace capabilities;
 *   - maps agents to skills through EXPLICIT, validated sets;
 *   - bridges the 8004scan agent model without fabricating mappings;
 *   - never executes, signs, creates sessions, or touches money.
 *
 * Mental model (three distinct surfaces — never conflated):
 *   1. AVAILABLE SKILL  — the certified registry (`listAltanaSkills`, etc.).
 *      A skill existing in the registry does NOT mean any agent has it.
 *   2. AGENT HAS SKILL  — an explicit `AgentCapabilitySet` per agent. Only a
 *      validated set claims possession; absent data yields `skills: []`.
 *   3. SKILL EXECUTION  — NOT available in this phase. Every attempt funnels
 *      through `assertAltanaSkillsNonExecutable` and always stops.
 *
 * INTENTIONALLY ABSENT: sessions, signers, transactions, x402, `get_skill` /
 * `search_skills` MCP consumers, ENV reads, and any live data (no APYs,
 * balances, prices, TVL, risk, history, or holdings are asserted anywhere).
 *
 * Canonical skill identifiers were verified against the official registry
 * (github.com/altananetwork/skills/tree/main/skills) and the Phase-1
 * discovery doc (`docs/review/Altana-Integration-Discovery.md` §1.8, §11.1).
 * Pursuant to scope, this registry carries the seven hackathon-certified
 * skills; the registry's other certified entries (`four-meme`,
 * `wallet-tracker`, `x402-payments`) are NOT registered here (x402-payments
 * is explicitly out of scope for the marketplace).
 */

/** Canonical, order-stable identifiers verified against the official registry. */
export const ALTANA_SKILL_IDS = [
  "aave-v3-lending",
  "venus-lending",
  "pancakeswap-trading",
  "pancakeswap-liquidity",
  "lista-staking",
  "dexscreener-token-radar",
  "copy-trade",
] as const;

export type AltanaSkillId = (typeof ALTANA_SKILL_IDS)[number];

/**
 * Adapter-level capability classification. This is NOT registry-provided
 * metadata; it is a conservative top-level grouping only (no claims beyond
 * the protocol each skill targets).
 */
export type AltanaSkillCategory = "lending" | "trading" | "liquidity" | "staking" | "research";

/** A certified Altana skill represented as a marketplace capability. */
export interface AltanaSkillCapability {
  id: AltanaSkillId;
  name: string;
  category: AltanaSkillCategory;
  description: string;
  source: "Altana certified skill";
  /** Phase 4 CANNOT execute skills; always false. Never claim otherwise. */
  executable: false;
}

/** The single static registry of the seven official certified skills. */
export const ALTANA_CERTIFIED_SKILLS: readonly AltanaSkillCapability[] = [
  {
    id: "aave-v3-lending",
    name: "Aave V3 Lending",
    category: "lending",
    description: "Supply and borrow assets on Aave V3 lending markets.",
    source: "Altana certified skill",
    executable: false,
  },
  {
    id: "venus-lending",
    name: "Venus Lending",
    category: "lending",
    description: "Supply and borrow assets on Venus Protocol markets.",
    source: "Altana certified skill",
    executable: false,
  },
  {
    id: "pancakeswap-trading",
    name: "PancakeSwap Trading",
    category: "trading",
    description: "Swap tokens through PancakeSwap routes.",
    source: "Altana certified skill",
    executable: false,
  },
  {
    id: "pancakeswap-liquidity",
    name: "PancakeSwap Liquidity",
    category: "liquidity",
    description: "Provide and manage liquidity in PancakeSwap pools.",
    source: "Altana certified skill",
    executable: false,
  },
  {
    id: "lista-staking",
    name: "Lista Staking",
    category: "staking",
    description: "Stake and manage collateral on Lista DAO.",
    source: "Altana certified skill",
    executable: false,
  },
  {
    id: "dexscreener-token-radar",
    name: "Token Radar",
    category: "research",
    description: "Scan token markets on DexScreener (read-only research).",
    source: "Altana certified skill",
    executable: false,
  },
  {
    id: "copy-trade",
    name: "Copy Trade",
    category: "trading",
    description: "Mirror trades of a tracked wallet (copy trading).",
    source: "Altana certified skill",
    executable: false,
  },
];

/** Id → capability index (immutable; mirrors the static registry order). */
export const ALTANA_SKILL_INDEX: Readonly<Record<AltanaSkillId, AltanaSkillCapability>> =
  Object.freeze(
    ALTANA_CERTIFIED_SKILLS.reduce<Record<AltanaSkillId, AltanaSkillCapability>>(
      (acc, skill) => {
        acc[skill.id] = skill;
        return acc;
      },
      {} as Record<AltanaSkillId, AltanaSkillCapability>
    )
  );

/** Error base for the capability layer. */
export class AltanaSkillsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaSkillsError";
  }
}

/** Thrown for malformed or unsupported capability data. */
export class AltanaSkillsValidationError extends AltanaSkillsError {
  constructor(message: string) {
    super(message);
    this.name = "AltanaSkillsValidationError";
  }
}

/** Required stop message when execution is attempted. */
export const ALTANA_SKILLS_EXECUTION_BOUNDARY =
  "Skill execution is not implemented; no session, signer, or transaction exists for skills." as const;

type SkillScope = Record<string, boolean>;

const SUPPORTED_SKILL_SCOPE: SkillScope = Object.freeze(
  ALTANA_SKILL_IDS.reduce<SkillScope>((acc, id) => {
    acc[id] = true;
    return acc;
  }, {})
);

/** Type guard: is `id` one of the seven canonical Altana skill ids? */
export function isSupportedAltanaSkill(id: unknown): id is AltanaSkillId {
  return typeof id === "string" && SUPPORTED_SKILL_SCOPE[id] === true;
}

/** Look up one certified skill. Returns `undefined` for unknown ids. */
export function getAltanaSkill(id: unknown): AltanaSkillCapability | undefined {
  if (!isSupportedAltanaSkill(id)) return undefined;
  return ALTANA_SKILL_INDEX[id];
}

/** All certified skills in canonical (deterministic) order. */
export function listAltanaSkills(): readonly AltanaSkillCapability[] {
  return ALTANA_CERTIFIED_SKILLS;
}

/** All certified skill ids in canonical (deterministic) order. */
export function listAltanaSkillIds(): readonly AltanaSkillId[] {
  return ALTANA_SKILL_IDS;
}

/**
 * Resolve an agent's explicit skill ids to full capability entries.
 * Throws if `set` references an id outside the registry (sets are expected
 * to come from `validateAgentCapabilities`).
 */
export function getAgentAvailableSkills(set: AgentCapabilitySet): readonly AltanaSkillCapability[] {
  return set.skills.map((id) => {
    const skill = ALTANA_SKILL_INDEX[id];
    if (skill === undefined) {
      throw new AltanaSkillsValidationError(
        `Unknown Altana skill id "${String(id)}" in capability set for agent "${set.agentId}".`
      );
    }
    return skill;
  });
}

// ---------------------------------------------------------------------------
// Agent → Skill mapping
// ---------------------------------------------------------------------------

/** Explicit, per-agent capability set. Never auto-populated. */
export interface AgentCapabilitySet {
  /** Stable agent identifier (e.g. the agent's marketplace slug or 8004scan agent_id). */
  agentId: string;
  /** Exactly the skills this agent is documented to hold. Empty means "none claimed". */
  skills: readonly AltanaSkillId[];
}

/** Honest empty capability set for an agent with no claimed skills. */
export function emptyAgentCapabilitySet(agentId: string): AgentCapabilitySet {
  return { agentId, skills: [] };
}

export type AgentCapabilitiesValidation =
  | { ok: true; set: AgentCapabilitySet; duplicatesRemoved: number }
  | { ok: false; errors: string[] };

/**
 * Validate raw capability data into a canonical `AgentCapabilitySet`.
 * - Unknown skill ids → error (unsupported identifiers are rejected).
 * - Duplicate ids → normalized (deduped, first occurrence kept; count returned).
 * - Missing agent id / non-array skills → error.
 * Pure — no network, no execution, no credentials.
 */
export function validateAgentCapabilities(input: unknown): AgentCapabilitiesValidation {
  const errors: string[] = [];

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Agent capability data must be an object."] };
  }
  const raw = input as Record<string, unknown>;

  const agentId = raw.agentId;
  if (typeof agentId !== "string" || agentId.trim().length === 0) {
    errors.push("agentId must be a non-empty string.");
  }

  const rawSkills = raw.skills;
  if (!Array.isArray(rawSkills)) {
    errors.push("skills must be an array of AltanaSkillId values.");
    return { ok: false, errors };
  }

  const seen = new Set<string>();
  const skills: AltanaSkillId[] = [];
  let duplicatesRemoved = 0;
  const unknownIds: string[] = [];

  for (const value of rawSkills as unknown[]) {
    if (!isSupportedAltanaSkill(value)) {
      unknownIds.push(typeof value === "string" ? value : String(value));
      continue;
    }
    if (seen.has(value)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(value);
    skills.push(value);
  }

  if (unknownIds.length > 0) {
    errors.push(`Unsupported Altana skill id(s): ${unknownIds.join(", ")}.`);
  }
  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    set: { agentId: agentId as string, skills },
    duplicatesRemoved,
  };
}

// ---------------------------------------------------------------------------
// 8004scan compatibility (honest, non-fabricating)
// ---------------------------------------------------------------------------

/**
 * Structural subset of what the 8004scan `GET /agents` response supplies that
 * could relate to capabilities. The LIVE types live in the frozen web app
 * (`apps/web/lib/eight004scan/types.ts`) and must not be imported here; this
 * local shape mirrors only the fields consumed for capability bridging.
 */
export interface Altana8004scanAgentCapabilityInput {
  /** 8004scan `agent_id` — stable composite identifier. */
  agentId: string;
  /**
   * 8004scan `supported_protocols` — the API's interaction-protocol taxonomy
   * (documented values: MCP / A2A / OASF / Web / Email). These are NOT Altana
   * skill ids; they describe how an agent is reachable, not what it can do.
   */
  supportedProtocols: readonly string[];
  /** 8004scan `x402_supported` — payment-rail flag; not a skill. */
  x402Supported?: boolean;
}

/** Result of bridging one 8004scan agent to Altana capabilities. */
export interface Altana8004scanAgentCapabilities {
  agentId: string;
  /** Altana capabilities 8004scan unambiguously claims (exact-id match only). */
  skills: readonly AltanaSkillCapability[];
  /** `supported_protocols` values that are NOT Altana skill ids. */
  unmapped: readonly string[];
  source: "8004scan";
}

/**
 * Map a single 8004scan agent to Altana capabilities.
 *
 * The ONLY safe mapping is an EXACT, case-sensitive equality between a
 * `supported_protocols` entry and a canonical AltanaSkillId. The current
 * 8004scan taxonomy (MCP/A2A/OASF/Web/Email) never equals a skill id, so
 * agents map to `skills: []` with every protocol reported as unmapped.
 * If 8004scan ever emits canonical Altana skill ids, they map automatically.
 * Nothing is fabricated.
 */
export function map8004scanAgentCapabilities(
  input: Altana8004scanAgentCapabilityInput
): Altana8004scanAgentCapabilities {
  const skills: AltanaSkillCapability[] = [];
  const unmapped: string[] = [];

  for (const protocol of input.supportedProtocols) {
    const skill = getAltanaSkill(protocol);
    if (skill !== undefined) {
      skills.push(skill);
    } else {
      unmapped.push(protocol);
    }
  }

  return {
    agentId: input.agentId,
    skills,
    unmapped,
    source: "8004scan",
  };
}

// ---------------------------------------------------------------------------
// Execution boundary
// ---------------------------------------------------------------------------

/**
 * THE EXECUTION BOUNDARY. Every skill-execution attempt stops here and
 * ALWAYS throws: this phase provides capability metadata and validation only.
 * Returns `never` — it cannot run a skill.
 */
export function assertAltanaSkillsNonExecutable(skillId: unknown): never {
  throw new AltanaSkillsError(
    `${ALTANA_SKILLS_EXECUTION_BOUNDARY} Refusing operation for skill "${String(skillId)}".`
  );
}
