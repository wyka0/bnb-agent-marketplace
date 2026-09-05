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
const d = (await get("/agents/97/1807")).body?.data;
const uri = d?.raw_metadata?.offchain_uri;
if (typeof uri === "string" && uri.startsWith("data:")) {
  const json = Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64").toString("utf8");
  console.log("OFFCHAIN METADATA (97:1807 LiqShield):");
  console.log(json);
}
const web = await fetch("https://mandate-bnb-agent.vercel.app/api/health", {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(8000),
});
console.log("HEALTH ENDPOINT:", web.status, (await web.text()).slice(0, 500));
const home = await fetch("https://mandate-bnb-agent.vercel.app/", {
  headers: { Accept: "text/html" },
  signal: AbortSignal.timeout(8000),
});
const html = await home.text();
console.log(
  "HOME:",
  home.status,
  "len=" + html.length,
  "title=" + (html.match(/<title>(.*?)<\/title>/i)?.[1] ?? "none")
);
const specHints = html.match(/(openapi|swagger|\.json|\/api\/[a-z0-9/_-]+)/gi);
console.log("SPEC HINTS in HTML:", [...new Set(specHints ?? [])].slice(0, 40).join(" "));
