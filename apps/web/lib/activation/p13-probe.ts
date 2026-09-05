/**
 * P13 one-shot live probe: exactly one tools/call to the verified read-only
 * getReservesList action for BSC. No retry, auth, payment, signing, wallet,
 * returned-action following, or transaction path exists here.
 */

const response = await fetch("https://erc8004.heyanon.ai/mcp/aave", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "getReservesList", arguments: { chainName: "bsc" } },
  }),
  signal: AbortSignal.timeout(15_000),
});

const publicHeaders: Record<string, string> = {};
for (const name of ["content-type", "www-authenticate", "payment-required", "location"]) {
  const value = response.headers.get(name);
  if (value) publicHeaders[name] = value;
}

const raw = await response.text();
let body: unknown;
try {
  body = JSON.parse(raw);
} catch {
  body = { kind: "non-json", length: raw.length };
}

console.log(
  JSON.stringify(
    {
      endpoint: "fixed verified Aave MCP endpoint",
      request: { method: "tools/call", name: "getReservesList", arguments: { chainName: "bsc" } },
      status: response.status,
      headers: publicHeaders,
      response: sanitize(body),
      responseBytes: raw.length,
    },
    null,
    2
  )
);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (
      [
        "authorization",
        "cookie",
        "set-cookie",
        "signature",
        "secret",
        "accesstoken",
        "refreshtoken",
        "paymentpayload",
      ].includes(lower)
    ) {
      output[key] = "[REDACTED]";
    } else if (key === "apiRequestActions" && Array.isArray(child)) {
      output[key] = {
        present: true,
        count: child.length,
        actions: child.map((action) =>
          action && typeof action === "object" ? Object.keys(action) : []
        ),
      };
    } else if (key === "toSign") {
      output[key] = {
        present: true,
        fields: child && typeof child === "object" ? Object.keys(child as object) : [],
      };
    } else {
      output[key] = sanitize(child);
    }
  }
  return output;
}

export {};
