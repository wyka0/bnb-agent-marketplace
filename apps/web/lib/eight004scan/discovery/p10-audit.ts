/**
 * P10 AUDIT — full live record dump for the Aave by HeyAnon candidate.
 *
 * NOT production code: nothing imports this file; a one-shot read-only audit
 * tool for Main Track P10. Uses ONLY the approved `listAgents` surface
 * (keyless-safe anonymous tier); no transactions, no credentials, no env
 * changes. Bounded: one request (limit 20, exact agent_id search).
 *
 * Run (audit only):  node --experimental-strip-types lib/eight004scan/discovery/p10-audit.ts
 */

import { listAgents } from "../client.ts";
import { pickAgentBySlug } from "../marketplace.ts";
import { normalizeAgents } from "../normalize.ts";

const ID = "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381";

const result = await listAgents({ search: ID, page: 1, limit: 20, chainId: 56, isTestnet: false });

if (!result.ok) {
  console.log(
    `lookup failed: ${result.reason}${result.status != null ? ` (${result.status})` : ""}`
  );
  process.exit(0);
}

const exact = pickAgentBySlug(normalizeAgents(result.data), ID);
const record = result.data.find((r) => r.agent_id === ID);

if (!record || !exact) {
  console.log(
    "exact agent_id not returned by search. IDs seen:",
    result.data.map((r) => r.agent_id).join(", ")
  );
  process.exit(0);
}

console.log("P10 audit: Aave by HeyAnon — full raw record (every Scan8004Agent field)");
console.log("exact identity round-trip:", exact.slug === ID);

const keys = [
  "id",
  "agent_id",
  "token_id",
  "chain_id",
  "chain_type",
  "contract_address",
  "is_testnet",
  "owner_id",
  "owner_address",
  "owner_ens",
  "owner_username",
  "owner_avatar_url",
  "owner_publisher_tier",
  "owner_certified_name",
  "name",
  "description",
  "image_url",
  "is_verified",
  "star_count",
  "supported_protocols",
  "x402_supported",
  "total_score",
  "rank",
  "network_rank",
  "health_score",
  "total_feedbacks",
  "average_score",
  "cross_chain_versions",
  "created_at",
  "updated_at",
] as const;

for (const k of keys) {
  const v = (record as unknown as Record<string, unknown>)[k];
  const pretty =
    v === null ? "null" : typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v, null, 2);
  console.log(`  ${k.padEnd(22)} ${pretty}`);
}
