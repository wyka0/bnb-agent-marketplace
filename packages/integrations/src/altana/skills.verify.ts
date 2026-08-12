/**
 * ALTANA Phase 4 — certified skills capability adapter verification.
 *
 * Safe by construction (matches Phases 2/3A): NO credentials, NO signing,
 * NO wallet, NO session, NO transaction, NO x402, NO network calls. Pure
 * in-memory capability metadata + validation only.
 *
 * Fixtures are synthetic and always labeled TEST FIXTURE / NOT LIVE DATA.
 *
 * Exit policy:
 *   - 1  any capability assertion fails (the integration gate).
 *   - 0  otherwise.
 *
 * Run after `pnpm build`:  node dist/altana/skills.verify.js
 */

import {
  ALTANA_CERTIFIED_SKILLS,
  ALTANA_SKILL_IDS,
  ALTANA_SKILL_INDEX,
  ALTANA_SKILLS_EXECUTION_BOUNDARY,
  AltanaSkillsError,
  AltanaSkillsValidationError,
  assertAltanaSkillsNonExecutable,
  emptyAgentCapabilitySet,
  getAgentAvailableSkills,
  getAltanaSkill,
  isSupportedAltanaSkill,
  listAltanaSkillIds,
  listAltanaSkills,
  map8004scanAgentCapabilities,
  validateAgentCapabilities,
} from "./skills.js";
import type { AgentCapabilitySet, AltanaSkillId } from "./skills.js";

function fail(message: string): never {
  console.error(`SKILLS VERIFY FAILED: ${message}`);
  process.exit(1);
}

function expectThrows(label: string, fn: () => void, ctor: new (message: string) => Error): void {
  try {
    fn();
    fail(`${label}: expected ${ctor.name} to be thrown`);
  } catch (error) {
    if (error instanceof ctor) {
      console.log(`ok   ${label} -> ${ctor.name}`);
      return;
    }
    fail(`${label}: expected ${ctor.name}, got ${String(error)}`);
  }
}

const REGISTRY_ORDER: readonly string[] = [
  "aave-v3-lending",
  "venus-lending",
  "pancakeswap-trading",
  "pancakeswap-liquidity",
  "lista-staking",
  "dexscreener-token-radar",
  "copy-trade",
];

function main(): void {
  console.log("ALTANA PHASE 4 — certified skills capability verify (metadata only, no execution)");

  // 1. All official skill IDs resolve; registry matches the canonical list; deterministic.
  if (ALTANA_SKILL_IDS.length !== 7) fail("registry must contain exactly the 7 official skills");
  for (const id of ALTANA_SKILL_IDS) {
    if (!isSupportedAltanaSkill(id)) fail(`isSupportedAltanaSkill("${id}") must be true`);
    const skill = getAltanaSkill(id);
    if (skill === undefined) fail(`getAltanaSkill("${id}") must resolve`);
    if (skill.id !== id) fail(`getAltanaSkill("${id}") returned the wrong entry`);
    if (ALTANA_SKILL_INDEX[id]?.id !== id) fail(`ALTANA_SKILL_INDEX["${id}"] must resolve`);
  }
  const ids = listAltanaSkillIds();
  const idsAgain = listAltanaSkillIds();
  if (ids.join(",") !== idsAgain.join(",")) fail("skill id list must be deterministic");
  for (let i = 0; i < REGISTRY_ORDER.length; i += 1) {
    if (ALTANA_SKILL_IDS[i] !== REGISTRY_ORDER[i]) {
      fail(`registry order mismatch at index ${i}`);
    }
  }
  const listed = listAltanaSkills();
  const listedAgain = listAltanaSkills();
  if (listed !== listedAgain) fail("skill list must be the same frozen instance (deterministic)");
  if (listed.length !== ALTANA_SKILL_IDS.length) fail("listAltanaSkills count mismatch");
  console.log("ok   all 7 official skill ids resolve; registry is canonical + deterministic");

  // 2. Unknown skill IDs rejected; no auto-assignment.
  if (isSupportedAltanaSkill("definitely-not-a-skill")) {
    fail("unknown skill id must not be supported");
  }
  if (isSupportedAltanaSkill(["aave-v3-lending"])) {
    fail("non-string payload must not be supported");
  }
  if (getAltanaSkill("definitely-not-a-skill") !== undefined) {
    fail("getAltanaSkill on an unknown id must return undefined");
  }
  let unknown = 0;
  for (const id of ["", "4-meme", "Aave", "copy trading", "x402-payments"] as const) {
    if (isSupportedAltanaSkill(id)) unknown += 1;
  }
  if (unknown !== 0) fail("look-alike/out-of-scope ids must be rejected");
  console.log("ok   unknown + out-of-scope skill ids rejected");

  // 3. Empty agent capability set is valid (honest pending state).
  const empty = emptyAgentCapabilitySet("TEST FIXTURE agent-8004scan-id");
  if (!Array.isArray(empty.skills) || empty.skills.length !== 0) {
    fail("empty capability set must have skills: []");
  }
  const validatedEmpty = validateAgentCapabilities({
    agentId: "TEST FIXTURE agent-8004scan-id",
    skills: [],
  });
  if (!validatedEmpty.ok || validatedEmpty.set.skills.length !== 0) {
    fail("an explicit empty skills list must validate ok");
  }
  const resolvedEmpty = getAgentAvailableSkills(empty);
  if (resolvedEmpty.length !== 0) fail("an empty set must resolve to zero capabilities");
  console.log("ok   empty agent capability set valid (skills: [], never invented)");

  // 4. Explicit capability mapping works.
  const fixtureSetInput = {
    agentId: "TEST FIXTURE altana-grid-trader",
    skills: ["pancakeswap-trading", "dexscreener-token-radar", "copy-trade"],
  };
  const mapping = validateAgentCapabilities(fixtureSetInput);
  if (!mapping.ok) fail(`valid mapping rejected: ${mapping.errors.join(" | ")}`);
  if (mapping.duplicatesRemoved !== 0) fail("no duplicates in the fixture mapping");
  const claimed: AgentCapabilitySet = mapping.set;
  const resolved = getAgentAvailableSkills(claimed);
  if (resolved.length !== 3) fail("explicit mapping must resolve to 3 capabilities");
  for (const cap of resolved) {
    if (cap.executable !== false) fail("every resolved capability must be non-executable");
    if (cap.source !== "Altana certified skill") fail("capability source must be official");
  }
  console.log("ok   explicit agent→skill mapping + resolution works");

  // 5. Duplicates normalized (deduped, first-occurrence kept, count surfaced).
  const dupInput = {
    agentId: "TEST FIXTURE dup-agent",
    skills: ["copy-trade", "copy-trade", "lista-staking", "copy-trade"],
  };
  const dup = validateAgentCapabilities(dupInput);
  if (!dup.ok) fail("duplicate-skills input must normalize, not fail");
  if (dup.duplicatesRemoved !== 2) fail("expected 2 duplicate entries removed");
  if (dup.set.skills.join(",") !== "copy-trade,lista-staking") {
    fail("dedupe must keep first occurrence and relative order");
  }
  // The static registry itself must be free of duplicate ids.
  const seen = new Set<string>();
  let dupIds = 0;
  for (const skill of ALTANA_CERTIFIED_SKILLS) {
    if (seen.has(skill.id)) dupIds += 1;
    seen.add(skill.id);
  }
  if (dupIds !== 0) fail("static registry must not contain duplicate skill ids");
  console.log("ok   duplicate skills normalized; static registry has zero duplicates");

  // 6. Unknown ids inside a validation input → rejected with errors.
  const bad = validateAgentCapabilities({
    agentId: "TEST FIXTURE bad-agent",
    skills: ["copy-trade", "not-a-real-skill", "venus-lending"],
  });
  if (bad.ok) fail("unknown skill id inside the set must be rejected");
  if (!bad.errors.some((e) => String(e).includes("not-a-real-skill"))) {
    fail("errors must name the unsupported id");
  }
  const malformed = validateAgentCapabilities({ agentId: "", skills: "copy-trade" });
  if (malformed.ok) fail("non-array skills must be rejected");
  const nonObject = validateAgentCapabilities("just-a-string");
  if (nonObject.ok) fail("non-object input must be rejected");
  expectThrows(
    "getAgentAvailableSkills rejects an unknown id in a hand-built set",
    () =>
      getAgentAvailableSkills({
        agentId: "TEST FIXTURE hand-built",
        skills: ["copy-trade", "not-a-real-skill" as AltanaSkillId],
      }),
    AltanaSkillsValidationError
  );
  console.log("ok   unsupported ids rejected with explicit errors");

  // 7. No execution occurs; the boundary always stops.
  for (const skill of ALTANA_CERTIFIED_SKILLS) {
    if (skill.executable) fail("no capability may claim executability in Phase 4");
    if (skill.executable !== false) fail("executable must be literally false");
  }
  for (const id of ALTANA_SKILL_IDS) {
    expectThrows(
      `execution boundary stops skill "${id}"`,
      () => assertAltanaSkillsNonExecutable(id),
      AltanaSkillsError
    );
  }
  try {
    assertAltanaSkillsNonExecutable("aave-v3-lending");
  } catch (error) {
    if (!(error instanceof AltanaSkillsError)) fail("boundary must throw AltanaSkillsError");
    if (!error.message.startsWith(ALTANA_SKILLS_EXECUTION_BOUNDARY)) {
      fail("boundary message must carry the required stop message");
    }
  }
  console.log("ok   no execution; every attempt funnels through the stop boundary");

  // 8. No credentials are required (pure functions; zero env/secret surface).
  for (const skill of ALTANA_CERTIFIED_SKILLS) {
    for (const key of Object.keys(skill)) {
      const value = (skill as unknown as Record<string, unknown>)[key];
      if (typeof value === "string" && /(key|secret|token|password|mnemonic|seed)/i.test(key)) {
        fail(`capability must not expose credential-like field "${key}"`);
      }
    }
  }
  console.log("ok   capability entries carry metadata only — no credential surface");

  // 9. 8004scan compatibility — honest, non-fabricating.
  const raw = map8004scanAgentCapabilities({
    agentId: "TEST FIXTURE 8004scan.agent_id.abc",
    supportedProtocols: ["MCP", "A2A", "OASF"],
    x402Supported: true,
  });
  if (raw.source !== "8004scan") fail("8004scan bridge must label its source");
  if (raw.skills.length !== 0) {
    fail("8004scan protocol taxonomy (MCP/A2A/OASF) must NOT map to Altana skills");
  }
  if (raw.unmapped.join(",") !== "MCP,A2A,OASF") {
    fail("all 8004scan protocol strings must be reported as unmapped");
  }
  // Rule demonstration (exact canonical id would map): TEST FIXTURE only.
  const hypothetical = map8004scanAgentCapabilities({
    agentId: "TEST FIXTURE hypothetical",
    supportedProtocols: ["MCP", "copy-trade", "A2A"],
  });
  if (hypothetical.skills.length !== 1 || hypothetical.skills[0]?.id !== "copy-trade") {
    fail("an exact canonical Altana skill id in supported_protocols must map (rule demo)");
  }
  if (hypothetical.unmapped.join(",") !== "MCP,A2A") {
    fail("non-skill entries must stay unmapped alongside an exact match");
  }
  console.log("ok   8004scan bridge: taxonomy never fabricated into skills; exact-id rule demoed");

  console.log("ALTANA SKILLS STATUS: READY FOR IMPLEMENTATION (capability metadata only)");
  process.exitCode = 0;
}

main();
