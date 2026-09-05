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
  const body = await r.json();
  return { status: r.status, body };
}
function summarize(label, res) {
  if (!res.body?.success) {
    console.log(label, "-> FAIL", res.status, JSON.stringify(res.body).slice(0, 200));
    return;
  }
  const rows = res.body.data ?? [];
  console.log(`=== ${label}: ${rows.length} rows`);
  const byChain = {};
  for (const a of rows) {
    const ck = a.chain_id + (a.is_testnet ? "-T" : "");
    byChain[ck] = (byChain[ck] || 0) + 1;
  }
  console.log("  chains:", JSON.stringify(byChain));
  const interesting = rows.filter(
    (a) =>
      a.is_testnet || a.x402_supported || a.is_verified || (a.supported_protocols || []).length > 0
  );
  for (const a of interesting.slice(0, 60)) {
    console.log(
      `  ${a.agent_id} | ${a.name} | protos=${(a.supported_protocols || []).join("/")} | x402=${a.x402_supported} | verified=${a.is_verified} | score=${a.total_score} | health=${a.health_score}`
    );
  }
}
const a2a = await get("/agents?protocol=A2A&limit=100");
summarize("A2A (key)", a2a);
await new Promise((r) => setTimeout(r, 2200));
const mcp = await get("/agents?protocol=MCP&limit=100");
summarize("MCP (key)", mcp);
await new Promise((r) => setTimeout(r, 2200));
const tn = await get("/agents?isTestnet=true&limit=100");
summarize("TESTNET (key)", tn);
await new Promise((r) => setTimeout(r, 2200));
const stars = await get("/agents?sortBy=stars&sortOrder=desc&limit=100");
summarize("TOP STARS (key)", stars);
