/**
 * Marketplace + card mapping verify harness (Node-only, no framework).
 *
 * Verifies the pure 8004scan pipeline that powers the Marketplace page, the
 * Leaderboards, and the Agent Details route:
 *
 *   normalizeAgent   → labeled raw fixtures (fixtures.ts)
 *   toMarketplaceData → discriminated state shaping (ready/empty/status map)
 *   pickAgentBySlug  → exact key-equality identity matching (never fuzzy)
 *   agentHrefFromId / toAgentCardData → shipped card data mapping
 *   applyMarketplaceFilters / sortMarketplaceAgents → honest search/filter/sort
 *
 * The same 13-item state space, identity rules, and honesty rules are asserted
 * here that the UI switches on. No network calls, no env vars required.
 *
 * Run:  npm run marketplace:verify  (in apps/web)
 */

import { normalizeAgent, normalizeAgents } from "./normalize.ts";
import {
  mapStatusToState,
  toMarketplaceData,
  pickAgentBySlug,
  applyMarketplaceFilters,
  sortMarketplaceAgents,
  categoryKeyFromLabel,
} from "./marketplace.ts";
import { toAgentCardData, agentHrefFromId, chainLabelForId } from "./card.ts";
import {
  EVM_VERIFIED_AGENT,
  SOLANA_AGENT,
  ZERO_SIGNALS_AGENT,
  TESTNET_X402_AGENT,
} from "./fixtures.ts";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

console.log("marketplace verify: base (fixture identity)");

/* ------------------------- normalizeAgent ------------------------- */

{
  const a = normalizeAgent(EVM_VERIFIED_AGENT);
  check("real name passes through", a.name === "Grid Hero");
  check(
    "slug IS the registry agent_id (deterministic identity)",
    a.slug === "56:0xCfFacE0003:1001"
  );
  check("tokenId passes through", a.tokenId === "1001");
  check("chainId passes through", a.chainId === 56);
  check("chainType passes through", a.chainType === "evm");
  check("isTestnet false", a.isTestnet === false);
  check("verification verified", a.verification === "verified");
  check("protocols copied", JSON.stringify(a.protocols) === JSON.stringify(["A2A", "MCP"]));
  check("x402Supported false", a.x402Supported === false);
  check("registryScore 89", a.registryScore === 89);
  check(
    "null upstream ranks stay null (never invented)",
    a.sourceRank === null && a.networkRank === null
  );
  check("healthScore 95", a.healthScore === 95);
  check("averageScore 4.6", a.averageScore === 4.6);
  check("totalFeedbacks 42", a.totalFeedbacks === 42);
  check("starCount 128", a.starCount === 128);
  check("ownerAddress copied", a.ownerAddress === "0xBb0Aaa9cEf");
  check("contractAddress copied", a.contractAddress === "0xCfFacE0003");
  check("category null (8004scan does not classify)", a.category === null);
  check("risk null (not provided)", a.risk === null);
  check("reputationLevel null (qualitative level not provided)", a.reputationLevel === null);
  check("activity null", a.activity === null);
  check("successRate null", a.successRate === null);
  check("source is 8004scan", a.source === "8004scan");
}

{
  const a = normalizeAgent(SOLANA_AGENT);
  check("null name falls back to Agent #token_id", a.name === "Agent #77");
  check("null description stays null", a.description === null);
  check("chainType solana", a.chainType === "solana");
  check("unverified", a.verification === "unverified");
  check("empty protocols list", a.protocols.length === 0);
  check("x402Supported true", a.x402Supported === true);
  check("healthScore null (absent upstream)", a.healthScore === null);
}

{
  const a = normalizeAgent(ZERO_SIGNALS_AGENT);
  check("genuine zero averageScore passes verbatim (never hidden)", a.averageScore === 0);
  check("genuine zero totalFeedbacks passes verbatim", a.totalFeedbacks === 0);
  check("genuine zero starCount passes verbatim", a.starCount === 0);
  check("genuine zero registryScore passes verbatim", a.registryScore === 0);
  check("zero-name still resolved", a.name === "First Steps");
}

{
  const a = normalizeAgent(TESTNET_X402_AGENT);
  check("testnet flag", a.isTestnet === true);
  check("x402Supported true", a.x402Supported === true);
  check("chainLabelForId 97 → BNB Testnet", chainLabelForId(a.chainId) === "BNB Testnet");
  check("chainLabelForId 56 → BNB Chain", chainLabelForId(56) === "BNB Chain");
  check("chainLabelForId 101 → honest 'Chain 101'", chainLabelForId(101) === "Chain 101");
}

console.log("marketplace verify: state shaping (toMarketplaceData)");

{
  const ok = {
    ok: true as const,
    data: [EVM_VERIFIED_AGENT, SOLANA_AGENT],
    meta: { pagination: { page: 1, limit: 2, total: 2, hasMore: false } },
  };
  const d = toMarketplaceData(ok);
  check("ready state", d.state === "ready");
  check("agents normalized", d.agents.length === 2 && d.agents[0].slug === "56:0xCfFacE0003:1001");
  check("pagination passthrough", d.pagination?.total === 2);
}

{
  const d0 = toMarketplaceData({
    ok: true as const,
    data: [],
    meta: { pagination: { page: 1, limit: 1, total: 0, hasMore: false } },
  });
  check("empty data → empty state (never placeholder rows)", d0.state === "empty");
}

{
  const err401 = { ok: false as const, reason: "unauthorized" as const, status: 401 };
  const err403 = { ok: false as const, reason: "unauthorized" as const, status: 403 };
  const err429 = { ok: false as const, reason: "rate-limited" as const, status: 429 };
  const err500 = { ok: false as const, reason: "error" as const, status: 500 };
  const errNet = { ok: false as const, reason: "error" as const };
  check("401 → unauthorized", toMarketplaceData(err401).state === "unauthorized");
  check("403 → forbidden", toMarketplaceData(err403).state === "forbidden");
  check("429 → rate-limited", toMarketplaceData(err429).state === "rate-limited");
  check("500 → server-error", toMarketplaceData(err500).state === "server-error");
  check("no status → network-error", toMarketplaceData(errNet).state === "network-error");
  check("error states carry zero agents", toMarketplaceData(err429).agents.length === 0);
  check("mapStatusToState 429 → rate-limited", mapStatusToState(429) === "rate-limited");
}

console.log("marketplace verify: identity lookup (exact key equality)");

{
  const agents = normalizeAgents([EVM_VERIFIED_AGENT, SOLANA_AGENT, TESTNET_X402_AGENT]);
  check(
    "exact agent_id matches",
    pickAgentBySlug(agents, "56:0xCfFacE0003:1001")?.slug === "56:0xCfFacE0003:1001"
  );
  check(
    "different agent_id never matches (prefix '13' ≠ '97:…:13')",
    pickAgentBySlug(agents, "13") === undefined
  );
  check("token_id-only never matches", pickAgentBySlug(agents, "1001") === undefined);
  check("name never matches the identity key", pickAgentBySlug(agents, "Grid Hero") === undefined);
  check(
    "slightly different id never matches",
    pickAgentBySlug(agents, "56:0xCfFacE0003:1002") === undefined
  );
  check(
    "case differs never matches (ids are exact)",
    pickAgentBySlug(agents, "56:0XcFEfAcE0003:1001") === undefined
  );
}

console.log("marketplace verify: card mapping (toAgentCardData)");

{
  const card = toAgentCardData(normalizeAgent(EVM_VERIFIED_AGENT));
  check("name mapped", card.name === "Grid Hero");
  check(
    "registry coordinates mapped",
    card.registry.chainId === 56 && card.registry.tokenId === "1001"
  );
  check(
    "href is determinisitic encoded agent_id route",
    card.href === agentHrefFromId("56:0xCfFacE0003:1001")
  );
  check(
    "agentHrefFromId encodes",
    agentHrefFromId("97:0xTe5tNeT:13") === "/agents/97%3A0xTe5tNeT%3A13"
  );
  check(
    "verified badge present",
    JSON.stringify(card.badges) === JSON.stringify([{ kind: "erc8004-verified" }])
  );
  check(
    "protocols mapped to id/label pairs",
    card.protocols.length === 2 && card.protocols[0].label === "A2A"
  );
  check("registryStatus live", card.registryStatus === "live");
  check("hireable always false (activation not implemented)", card.hireable === false);
  check(
    "reputation score/reviews mapped",
    card.reputation?.score === 4.6 && card.reputation?.reviews === 42
  );
}

{
  const card = toAgentCardData(normalizeAgent(ZERO_SIGNALS_AGENT));
  check(
    "genuine zero reputation passes to the card",
    card.reputation?.score === 0 && card.reputation?.reviews === 0
  );
}

{
  const card = toAgentCardData(normalizeAgent(SOLANA_AGENT));
  check("unverified → no verified badge", card.badges === undefined);
  check("null description → undefined (not a fake string)", card.description === undefined);
  check("category never set on the card", !("category" in card));
  check("risk never set on the card", !("risk" in card));
}

console.log("marketplace verify: filters + sort (honest rules)");

{
  const agents = normalizeAgents([
    EVM_VERIFIED_AGENT,
    SOLANA_AGENT,
    ZERO_SIGNALS_AGENT,
    TESTNET_X402_AGENT,
  ]);
  const base = {
    query: "",
    categories: new Set<string>(),
    verifications: new Set<string>(),
    risks: new Set<string>(),
    protocols: new Set<string>(),
    activities: new Set<string>(),
    statuses: new Set<string>(),
    registryStates: new Set<string>(),
    verifiedBuildersOnly: false,
  };
  const onlyVerified = applyMarketplaceFilters(agents, {
    ...base,
    verifications: new Set(["Verified"]),
  });
  check(
    "Verified facet keeps only verified",
    onlyVerified.every((a) => a.verification === "verified") && onlyVerified.length === 2
  );
  const onlyA2A = applyMarketplaceFilters(agents, { ...base, protocols: new Set(["A2A"]) });
  check(
    "protocol facet matches real protocols",
    onlyA2A.length === 2 && onlyA2A.every((a) => a.protocols.includes("A2A"))
  );
  const cats = applyMarketplaceFilters(agents, { ...base, categories: new Set(["Grid Trading"]) });
  check("category selection → zero matches (never a guess)", cats.length === 0);
  const risks = applyMarketplaceFilters(agents, { ...base, risks: new Set(["Low Risk"]) });
  check("risk selection → zero matches (no data)", risks.length === 0);
  const q = applyMarketplaceFilters(agents, { ...base, query: "grid" });
  check("query matches name surface", q.length === 1 && q[0].slug === "56:0xCfFacE0003:1001");
  check("categoryKeyFromLabel normalizes", categoryKeyFromLabel("Grid Trading") === "grid-trading");
}

{
  const agents = normalizeAgents([
    EVM_VERIFIED_AGENT,
    SOLANA_AGENT,
    ZERO_SIGNALS_AGENT,
    TESTNET_X402_AGENT,
  ]);
  const newest = sortMarketplaceAgents(agents, "newest");
  check("newest sort: ZERO(2026-01-20) first", newest[0].slug === "56:0xZeroScore:42");
  check(
    "newest sort: EVM(2025-11-02) before TESTNET(2025-09-01)",
    newest[2].slug === "56:0xCfFacE0003:1001" && newest[3].slug === "97:0xTe5tNeT:13"
  );
  const rep = sortMarketplaceAgents(agents, "reputation");
  check("reputation sort: 4.6 first", rep[0].slug === "56:0xCfFacE0003:1001");
  check("reputation sort: zero-score last (unknowns last)", rep[3].slug === "56:0xZeroScore:42");
  const def = sortMarketplaceAgents(agents, "default");
  check(
    "default keeps API order (stable, no invention)",
    JSON.stringify(def.map((a) => a.slug)) === JSON.stringify(agents.map((a) => a.slug))
  );
  const alpha = sortMarketplaceAgents(agents, "alphabetical");
  check("alphabetical: 'Agent #77' first", alpha[0].name === "Agent #77");
}

console.log("");
console.log(`marketplace verify: ${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);
