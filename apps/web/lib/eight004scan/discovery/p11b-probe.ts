/**
 * P11b: exactly one read-only execution-class MCP tools/call.
 * No auth, payment, retry, wallet, signing, or returned action invocation.
 */

const endpoint = "https://erc8004.heyanon.ai/mcp/aave";
const requestBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "getAaveV3SupportedChains",
    arguments: {},
  },
};

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  },
  body: JSON.stringify(requestBody),
  signal: AbortSignal.timeout(15_000),
});

const headers: Record<string, string> = {};
for (const name of [
  "content-type",
  "www-authenticate",
  "payment-required",
  "x-payment",
  "mcp-session-id",
  "location",
]) {
  const value = response.headers.get(name);
  if (value) headers[name] = value;
}

const raw = await response.text();
let parsed: unknown = null;
try {
  parsed = JSON.parse(raw);
} catch {
  parsed = { bodyType: "non-json", bodyLength: raw.length };
}

const record = (value: unknown): unknown => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(record);
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      [
        "authorization",
        "cookie",
        "set-cookie",
        "signature",
        "privatekey",
        "secret",
        "accesstoken",
        "refreshtoken",
        "paymentpayload",
      ].includes(normalizedKey)
    ) {
      output[key] = "[REDACTED]";
    } else if (key === "apiRequestActions" && Array.isArray(child)) {
      output[key] = {
        present: true,
        count: child.length,
        actions: child.map((item) => {
          if (!item || typeof item !== "object") return { type: typeof item };
          const action = item as Record<string, unknown>;
          const toSign = action.toSign;
          return {
            keys: Object.keys(action),
            toSign:
              toSign && typeof toSign === "object"
                ? { present: true, keys: Object.keys(toSign as object) }
                : { present: false },
          };
        }),
      };
    } else if (key === "toSign") {
      output[key] = {
        present: true,
        structure: child && typeof child === "object" ? Object.keys(child as object) : typeof child,
      };
    } else {
      output[key] = record(child);
    }
  }
  return output;
};

console.log(
  JSON.stringify(
    {
      endpoint,
      request: "tools/call:getAaveV3SupportedChains",
      status: response.status,
      headers,
      response: record(parsed),
      rawLength: raw.length,
    },
    null,
    2
  )
);

export {};
