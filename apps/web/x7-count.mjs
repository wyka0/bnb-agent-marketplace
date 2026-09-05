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
const stats = await get("/stats");
console.log("STATS:", JSON.stringify(stats.body).slice(0, 800));
const c97 = await get("/agents?chainId=97&limit=100");
const rows = c97.body?.data ?? [];
console.log(
  "chainId=97 rows:",
  rows.length,
  "meta:",
  JSON.stringify(c97.body?.meta ?? {}).slice(0, 300)
);
for (const a of rows.slice(0, 60))
  console.log(
    `${a.agent_id} | ${a.name} | ${(a.supported_protocols || []).join("/")} | x402=${a.x402_supported} | verified=${a.is_verified} | score=${a.total_score}`
  );
const t2 = await get("/agents?isTestnet=true&limit=100&page=2");
const t2rows = t2.body?.data ?? [];
console.log(
  "testnet page2 rows:",
  t2rows.length,
  "meta:",
  JSON.stringify(t2.body?.meta ?? {}).slice(0, 300)
);
for (const a of t2rows)
  if (String(a.chain_id) === "97") console.log(`P2 97: ${a.agent_id} | ${a.name}`);
const s = await get("/agents/search?q=mandate&limit=20");
console.log("search mandate:", JSON.stringify(s.body?.meta ?? {}).slice(0, 300));
for (const a of (s.body?.data ?? []).slice(0, 20))
  console.log(
    `S ${a.agent_id} | ${a.name} | chain=${a.chain_id} | ${(a.supported_protocols || []).join("/")}`
  );
for (const p of ["/api/openapi.json", "/api/docs", "/docs", "/api/schema"]) {
  try {
    const r = await fetch("https://mandate-bnb-agent.vercel.app" + p, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json,text/html" },
    });
    const ct = r.headers.get("content-type") ?? "";
    const txt = await r.text();
    console.log(
      "VERCEL" + p + " ->",
      r.status,
      ct.slice(0, 40),
      "len=" + txt.length,
      ct.includes("json") ? txt.slice(0, 400) : (txt.match(/<title>(.*?)<\/title>/i)?.[1] ?? "")
    );
  } catch (e) {
    console.log("VERCEL" + p + " -> ERR " + e.message);
  }
}
