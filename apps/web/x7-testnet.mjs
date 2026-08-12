import { readFileSync } from "node:fs";
const line = readFileSync("../../.env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("8004SCAN_API_KEY="));
const key = line ? line.slice("8004SCAN_API_KEY=".length).trim().replace(/^"|"$/g, "") : undefined;
const BASE = "https://8004scan.io/api/v1/public";
async function get(path) {
  const headers = { Accept: "application/json" };
  if (key) headers["X-API-Key"] = key;
  const r = await fetch(BASE + path, { headers });
  return { status: r.status, body: await r.json() };
}
const tn = await get("/agents?isTestnet=true&limit=100");
const rows = tn.body?.data ?? [];
console.log("testnet rows:", rows.length);
for (const a of rows) {
  if (a.chain_id !== 97) continue;
  console.log(
    JSON.stringify({
      agent_id: a.agent_id,
      name: a.name,
      token_id: a.token_id,
      contract: a.contract_address,
      protos: a.supported_protocols,
      x402: a.x402_supported,
      verified: a.is_verified,
      score: a.total_score,
      health: a.health_score,
    })
  );
}
const ids = rows.filter((a) => a.chain_id === 97).map((a) => a.agent_id);
console.log("CHAIN-97 IDS:", ids.join(", "));
