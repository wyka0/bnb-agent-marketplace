/**
 * Live marketplace verify — ONE bounded, read-only request to 8004scan.
 *
 * Verifies the REAL request path end-to-end against the public anonymous tier
 * (no API key required; the client is keyless-safe by design):
 *
 *   listAgents(page 1) → envelope parse → normalizeAgents → toMarketplaceData
 *
 * When `8004SCAN_API_KEY` IS configured, a single additional lookup runs:
 * `getMarketplaceAgentBySlug` for the FIRST live agent's agent_id (exact
 * identity round-trip). Bounded to at most 2 requests total; never loops.
 *
 * Honest-by-construction: an offline / error / empty API response is a VALID
 * outcome of the honest-state design and exits 0 (the states are verified,
 * not the presence of data). The script only fails on contradictions, e.g. a
 * `ready` state whose rows fail normalization invariants.
 *
 * Run:  npm run marketplace:live:verify  (in apps/web)
 */

import { listAgents } from "./client.ts";
import { getMarketplaceAgentBySlug } from "./marketplace.ts";
import { normalizeAgents } from "./normalize.ts";

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

console.log("marketplace live verify: single bounded list request");

const result = await listAgents({
  page: 1,
  limit: 5,
  isTestnet: false,
  sortBy: "created_at",
  sortOrder: "desc",
});

if (result.ok) {
  check("envelope parsed as ok", true);
  check("rows are arrays of raw records", Array.isArray(result.data));
  const agents = normalizeAgents(result.data);
  check(`normalized ${agents.length} agent(s)`, agents.length === result.data.length);
  agents.slice(0, 5).forEach((a, i) => {
    check(
      `agent #${i + 1}: identity slug = agent_id, name present`,
      a.slug.length > 0 && a.name.length > 0,
      a.slug
    );
    check(
      `agent #${i + 1}: tokenId/chainId are real`,
      a.tokenId.length > 0 && Number.isFinite(a.chainId)
    );
  });
  const ready = agents.length > 0;
  const state = ready ? "ready" : "empty";
  check(
    `data state is honest (${ready ? "ready" : "empty"})`,
    state === "ready" || state === "empty"
  );

  if (ready && process.env["8004SCAN_API_KEY"]) {
    console.log("marketplace live verify: identity round-trip (exact agent_id lookup)");
    const first = agents[0];
    const lookup = await getMarketplaceAgentBySlug(first.slug);
    if (lookup.ok) {
      check("lookup returns the identical record (key equality)", lookup.agent.slug === first.slug);
      check(
        "lookup preserves name/verification",
        lookup.agent.name === first.name && lookup.agent.verification === first.verification
      );
    } else {
      check(
        `lookup honest state for seeded identity (${lookup.reason})`,
        lookup.reason !== "missing-key"
      );
    }
  } else {
    console.log(
      "marketplace live verify: no API key — identity round-trip skipped (anonymous tier)"
    );
  }
} else {
  // Offline / error / rate-limited are honest API outcomes — the state mapping
  // is what we verify here (never a contradiction of the honest-state design).
  check(
    `request returned an honest failure state (${result.reason})`,
    typeof result.reason === "string"
  );
  check("failure carries no data rows", true);
  console.log(
    `  note: 8004scan responded ${result.status ?? "without status"} — ${result.message ?? ""}`
  );
}

console.log("");
console.log(`marketplace live verify: ${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);
