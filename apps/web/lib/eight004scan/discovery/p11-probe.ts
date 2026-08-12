/**
 * P11 PROBE — read-only liveness + x402 probe for the Aave by HeyAnon agent
 * (BSC 56, agent 45381) real MCP endpoint from The Spawn API:
 *   https://erc8004.heyanon.ai/mcp/aave   (MCP, version 2025-06-18)
 *   https://heyanon.ai                    (web surface)
 *
 * NOT production code: nothing imports this file; a one-shot read-only audit
 * tool for Main Track P11.
 *
 * SAFETY CONTRACT (hard rules, enforced in code):
 *  - NO payment payload headers (no PAYMENT-SIGNATURE, no x402 retry).
 *  - NO Authorization / API key headers (none exist; never added).
 *  - NO tools/call of any kind — only MCP initialize + tools/list handshake
 *    (read-only discovery; tools/list lists, it does not execute).
 *  - If the server answers 402 with x402 payment terms, we print the terms
 *    and STOP that endpoint — we never fulfill them.
 *  - Bounded: 3 requests per endpoint (GET, initialize, tools/list), 15s
 *    timeout each.
 *
 * Run (audit only):  node --experimental-strip-types lib/eight004scan/discovery/p11-probe.ts
 */

type ProbeResult = {
  step: string;
  status: number | null;
  headers: Record<string, string>;
  body: string;
  ms: number;
};

const TARGETS = [
  { label: "MCP aave (erc8004)", url: "https://erc8004.heyanon.ai/mcp/aave", mcp: true },
  { label: "web (heyanon.ai)", url: "https://heyanon.ai", mcp: false },
] as const;

async function probe(step: string, url: string, init?: RequestInit): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const body = (await res.text()).slice(0, 2000);
    return { step, status: res.status, headers, body, ms: Date.now() - started };
  } catch (err) {
    return {
      step,
      status: null,
      headers: {},
      body: `probe error: ${err instanceof Error ? err.message : String(err)}`,
      ms: Date.now() - started,
    };
  }
}

function print(r: ProbeResult): void {
  console.log(`\n[${r.step}] ${r.status ?? "ERR"} in ${r.ms}ms`);
  const interesting = [
    "content-type",
    "www-authenticate",
    "payment",
    "x402",
    "x-ratelimit",
    "retry-after",
    "location",
  ];
  for (const [k, v] of Object.entries(r.headers)) {
    if (interesting.some((s) => k.toLowerCase().includes(s))) {
      console.log(`  h: ${k}: ${v.slice(0, 300)}`);
    }
  }
  console.log(`  body: ${r.body.length > 2000 ? r.body.length + " chars" : ""}`);
  console.log(r.body.slice(0, 1200).replace(/\n/g, "\n  "));
}

function classifyX402(r: ProbeResult): boolean {
  if (r.status !== 402) return false;
  try {
    const j = JSON.parse(r.body);
    const terms = {
      x402Version: j.x402Version ?? null,
      error: j.error ?? null,
      resource: j.resource?.url ?? null,
      accepts: (j.accepts ?? []).map(
        (a: Record<string, unknown>) =>
          `${a.scheme} network=${a.network} asset=${a.asset} amount=${a.amount} payTo=${a.payTo} timeout=${a.maxTimeoutSeconds}`
      ),
      demo: j.demo ?? null,
      getting_started: j.getting_started ?? null,
    };
    console.log("\n  X402 PAYMENT CHALLENGE RECEIVED — READ-ONLY, NOT PAID:");
    console.log(`    version:      ${String(terms.x402Version)}`);
    console.log(`    error:        ${String(terms.error)}`);
    console.log(`    resource:     ${String(terms.resource)}`);
    for (const a of terms.accepts) console.log(`    accepts[]:    ${a}`);
    console.log(`    demo:         ${JSON.stringify(terms.demo)}`);
    console.log(`    getting_go:   ${JSON.stringify(terms.getting_started)}`);
    return true;
  } catch {
    console.log("\n  402 WITHOUT parseable x402 JSON body (body above).");
    return true;
  }
}

for (const t of TARGETS) {
  console.log(`\n===== PROBE TARGET: ${t.label} — ${t.url}`);

  const get = await probe(`${t.label} GET`, t.url);
  print(get);

  if (!t.mcp) continue;

  const initBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "p11-readonly-probe", version: "1.0.0" },
    },
  });

  const init = await probe(`${t.label} MCP initialize`, t.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: initBody,
  });
  print(init);
  if (classifyX402(init)) continue;

  const sess = init.headers["mcp-session-id"] ?? "";
  const toolsBody = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const tools = await probe(`${t.label} MCP tools/list`, t.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sess ? { "Mcp-Session-Id": sess } : {}),
    },
    body: toolsBody,
  });
  print(tools);
  if (classifyX402(tools)) continue;

  if (tools.status === 200) {
    try {
      const j = JSON.parse(tools.body);
      const names = Array.isArray(j.result?.tools)
        ? j.result.tools.map((x: { name: string }) => x.name)
        : [];
      console.log(`\n  TOOLS LIST OK: ${names.length} tools: ${names.slice(0, 30).join(", ")}`);
    } catch {
      console.log("\n  200 tools/list: body above (not JSON-parseable here).");
    }
  }
}

console.log(
  "\n===== P11 PROBE COMPLETE — read-only; nothing paid, nothing signed, no tool executed ====="
);

export {};
