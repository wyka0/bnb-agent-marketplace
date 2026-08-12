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
const targets = [
  ["97", "1807"],
  ["97", "1806"],
  ["97", "1805"],
  ["97", "1804"],
  ["56", "117823"],
  ["56", "137"],
  ["56", "264136"],
  ["8453", "1199"],
  ["42220", "9197"],
  ["56", "264556"],
];
for (const [chainId, tokenId] of targets) {
  const res = await get(`/agents/${chainId}/${tokenId}`);
  const d = res.body?.data;
  if (!d) {
    console.log(
      `== ${chainId}:${tokenId} -> FAIL ${res.status} ${JSON.stringify(res.body).slice(0, 150)}`
    );
    continue;
  }
  const svc = {};
  for (const k of Object.keys(d.services ?? {})) {
    const s = d.services[k];
    svc[k] = {
      endpoint: s?.endpoint ?? null,
      version: s?.version ?? null,
      skills: (s?.skills ?? []).length,
    };
  }
  const health = d.health_status?.services
    ? Object.fromEntries(
        Object.entries(d.health_status.services).map(([k, v]) => [
          k,
          `${v.status}${v.message ? " :: " + v.message : ""}`,
        ])
      )
    : d.health_status;
  console.log(`== ${d.agent_id} | ${d.name}`);
  console.log(
    `   chain=${d.chain_id} protos=${(d.supported_protocols || []).join("/")} x402=${d.x402_supported} verified=${d.is_verified} active=${d.is_active} type=${d.agent_type}`
  );
  console.log(
    `   agent_url=${d.agent_url} mcp_server=${d.mcp_server} a2a_endpoint=${d.a2a_endpoint} a2a_ver=${d.a2a_version} mcp_ver=${d.mcp_version}`
  );
  console.log(`   services=${JSON.stringify(svc)}`);
  console.log(`   health=${JSON.stringify(health)}`);
  console.log(
    `   endpoint_verified=${d.is_endpoint_verified} domain=${d.endpoint_verified_domain} last_checked=${d.endpoint_last_checked_at}`
  );
  const rm = d.raw_metadata;
  if (rm) console.log(`   raw_metadata=${JSON.stringify(rm).slice(0, 600)}`);
  await new Promise((r) => setTimeout(r, 250));
}
