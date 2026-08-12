/**
 * P12 deterministic activation verification.
 * Every synthetic response below is a TEST FIXTURE. No network is used.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { activateAavePreview } from "./aave.server.ts";
import {
  AAVE_AGENT_ID,
  AAVE_CHAIN_ID,
  AAVE_SAFE_ACTION,
  normalizePaymentRequired,
  normalizeToolResult,
  requestUserSignature,
  validateActivationRequest,
} from "./contract.ts";

let passed = 0;
let failed = 0;
let lastRequestLog: Array<{ method: string; body: string }> = [];
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const VALID_REQUEST = { agentId: AAVE_AGENT_ID, chainId: AAVE_CHAIN_ID, action: AAVE_SAFE_ACTION };

// TEST FIXTURE A/C — normal read-only result with BSC supported.
const CHAINS_WITH_BSC = mcp({
  project: "aave",
  operation: "getAaveV3SupportedChains",
  data: [
    { chainId: 1, chainName: "ethereum" },
    { chainId: 56, chainName: "bsc" },
  ],
});
// TEST FIXTURE B — a valid chain list without BSC.
const CHAINS_WITHOUT_BSC = mcp({
  project: "aave",
  operation: "getAaveV3SupportedChains",
  data: [{ chainId: 1, chainName: "ethereum" }],
});
// TEST FIXTURE D — transaction request, preview only; never a real transaction.
const TRANSACTION_REQUIRED = mcp({
  apiRequestActions: [
    {
      type: "typed-request",
      description: "TEST FIXTURE — do not sign or execute",
      request: {
        chainId: 56,
        to: "0xTEST_FIXTURE_DESTINATION",
        value: "0",
        data: "0xTEST_FIXTURE_CALLDATA",
      },
      toSign: {
        domain: { chainId: 56 },
        types: { TEST_FIXTURE: [] },
        primaryType: "TEST_FIXTURE",
        message: { fixture: true },
      },
    },
  ],
});
// TEST FIXTURE E — public payment challenge, never paid.
const PAYMENT_REQUIRED = {
  x402Version: 2,
  resource: { url: "https://fixture.invalid/resource" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:56",
      asset: "0xTEST_FIXTURE_TOKEN",
      amount: "10",
      payTo: "0xTEST_FIXTURE_PAYTO",
      maxTimeoutSeconds: 300,
    },
  ],
};
// TEST FIXTURE F — malformed action.
const MALFORMED_ACTION = mcp({ apiRequestActions: ["TEST FIXTURE — malformed"] });
// TEST FIXTURE G — missing destination remains null.
const MISSING_DESTINATION = mcp({
  apiRequestActions: [{ type: "fixture", request: { chainId: 56, value: "0" } }],
});
// TEST FIXTURE H — missing chain remains null.
const MISSING_CHAIN = mcp({
  apiRequestActions: [
    { type: "fixture", request: { to: "0xTEST_FIXTURE_DESTINATION", value: "0" } },
  ],
});

console.log("P12 activation verify — TEST FIXTURES only (offline, no payment/signing/transaction)");

{
  const normalized = normalizeToolResult(CHAINS_WITH_BSC);
  check(
    "A BSC supported: normalizer recognizes chain 56",
    normalized.kind === "chains" && normalized.chains.some((x) => x.chainId === 56)
  );
  const result = await activateAavePreview(VALID_REQUEST, sequenceFetch(CHAINS_WITH_BSC));
  check("C normal read-only result: pipeline ready", result.state === "ready");
  check(
    "C normal read-only result: no payment required",
    result.state === "ready" && result.paymentRequired === false
  );
  check(
    "C pipeline executes exactly manifest + initialize + tools/list + one safe probe",
    lastRequestLog.length === 4 &&
      lastRequestLog.filter((x) => x.body.includes('"method":"tools/call"')).length === 1
  );
  check(
    "C sole tools/call is getAaveV3SupportedChains",
    lastRequestLog.at(-1)?.body.includes("getAaveV3SupportedChains") === true
  );
  check(
    "C no financial mutation tool is called",
    !lastRequestLog.some((x) =>
      /\b(supply|borrow|repay|withdraw|approve|swapBorrowRateMode|setUsageAsCollateral)\b/.test(
        x.body
      )
    )
  );
}

{
  const result = await activateAavePreview(VALID_REQUEST, sequenceFetch(CHAINS_WITHOUT_BSC));
  check(
    "B BSC unsupported: activation rejected",
    result.state === "unsupported" && result.reason === "unsupported-chain"
  );
}

{
  const normalized = normalizeToolResult(TRANSACTION_REQUIRED);
  check(
    "D transaction-required: action is previewed",
    normalized.kind === "transaction" && normalized.actions.length === 1
  );
  check(
    "D transaction-required: calldata preserved exactly",
    normalized.kind === "transaction" &&
      normalized.actions[0]?.calldata === "0xTEST_FIXTURE_CALLDATA"
  );
  check(
    "D transaction-required: typed-data structure preserved",
    normalized.kind === "transaction" &&
      normalized.actions[0]?.typedData?.primaryType === "TEST_FIXTURE"
  );
  check(
    "D transaction-required: signing boundary rejects execution",
    normalized.kind === "transaction" &&
      requestUserSignature(normalized.actions).state === "signing-not-enabled"
  );
}

{
  const result = normalizePaymentRequired(PAYMENT_REQUIRED);
  check("E payment-required: challenge classified", result.state === "payment-required");
  check(
    "E payment-required: public terms preserved",
    result.state === "payment-required" &&
      result.terms.network === "eip155:56" &&
      result.terms.amount === "10" &&
      result.terms.payTo === "0xTEST_FIXTURE_PAYTO"
  );
  check(
    "E payment-required: missing facilitator remains null",
    result.state === "payment-required" && result.terms.facilitator === null
  );
  const livePath = await activateAavePreview(
    VALID_REQUEST,
    responseSequence([
      ok({ manifest: true }),
      ok(initialize()),
      ok(tools()),
      status(402, PAYMENT_REQUIRED),
    ])
  );
  check(
    "E 402 is terminal and never bypassed",
    livePath.state === "payment-required" && lastRequestLog.length === 4
  );
}

check("F malformed action is rejected", normalizeToolResult(MALFORMED_ACTION).kind === "malformed");
{
  const normalized = normalizeToolResult(MISSING_DESTINATION);
  check(
    "G missing destination remains null",
    normalized.kind === "transaction" && normalized.actions[0]?.destination === null
  );
}
{
  const normalized = normalizeToolResult(MISSING_CHAIN);
  check(
    "H missing chain remains null",
    normalized.kind === "transaction" && normalized.actions[0]?.chain === null
  );
}

check(
  "I invalid agent is rejected",
  state(validateActivationRequest({ ...VALID_REQUEST, agentId: "56:wrong:1" })) === "unsupported"
);
check(
  "I wrong chain is rejected",
  state(validateActivationRequest({ ...VALID_REQUEST, chainId: 1 })) === "unsupported"
);
check(
  "I arbitrary action is rejected",
  state(validateActivationRequest({ ...VALID_REQUEST, action: "borrow" })) === "unsupported"
);
check(
  "I arbitrary endpoint is rejected",
  state(validateActivationRequest({ ...VALID_REQUEST, endpoint: "https://evil.invalid" })) ===
    "unsupported"
);
check(
  "I arbitrary calldata is rejected",
  state(validateActivationRequest({ ...VALID_REQUEST, calldata: "0xdeadbeef" })) === "unsupported"
);

{
  const timeout = await activateAavePreview(VALID_REQUEST, (async () => {
    throw Object.assign(new Error("TEST FIXTURE timeout"), { name: "TimeoutError" });
  }) as typeof fetch);
  check(
    "J MCP timeout is sanitized",
    timeout.state === "error" &&
      timeout.code === "timeout" &&
      !timeout.message.includes("TEST FIXTURE")
  );
}
{
  const serverError = await activateAavePreview(
    VALID_REQUEST,
    responseSequence([status(500, { private: "TEST FIXTURE secret" })])
  );
  check(
    "K MCP server error is sanitized",
    serverError.state === "error" &&
      serverError.code === "mcp-server-error" &&
      !serverError.message.includes("secret")
  );
}

check(
  "L signing boundary always returns signing-not-enabled",
  requestUserSignature([]).state === "signing-not-enabled"
);

{
  const files = [
    "lib/activation/contract.ts",
    "lib/activation/aave.server.ts",
    "app/api/activation/aave-preview/route.ts",
    "app/(app)/agents/[slug]/aave-activation-preview.tsx",
  ];
  const sources = files.map((file) => readFileSync(resolve(process.cwd(), file), "utf8"));
  const joined = sources.join("\n");
  const forbidden = [
    "PRIVATE" + "_KEY",
    "WALLET" + "_PRIVATE_KEY",
    "MNEMONIC",
    "SEED" + "_PHRASE",
    "FACILITATOR" + "_KEY",
    "ALTANA" + "_PRIVATE_KEY",
    "X402" + "_PRIVATE_KEY",
  ];
  check(
    "M no private-key path exists",
    forbidden.every((term) => !joined.includes(term))
  );
  check(
    "M no signer implementation exists",
    !/signTransaction|signTypedData|sendTransaction|eth_sendTransaction/.test(joined)
  );
  check(
    "M no payment retry implementation exists",
    !/PAYMENT-SIGNATURE|X-PAYMENT|paymentPayload/.test(joined)
  );
  check(
    "M endpoint exists only in server module",
    sources[1]?.includes("erc8004.heyanon.ai/mcp/aave") === true &&
      sources.filter((source) => source.includes("erc8004.heyanon.ai/mcp/aave")).length === 1
  );
  check(
    "M client calls local API only",
    sources[3]?.includes("/api/activation/aave-preview") === true &&
      !sources[3]?.includes("erc8004.heyanon.ai")
  );
  check(
    "M no arbitrary endpoint reaches fetch",
    /transport\(AAVE_MCP_ENDPOINT/.test(sources[1] ?? "")
  );
  check(
    "M no transaction submission function exists",
    !/broadcast|submitTransaction|executeTransaction/.test(joined)
  );
}

console.log(`\nP12 activation verify: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

function sequenceFetch(finalBody: unknown): typeof fetch {
  return responseSequence([ok({ manifest: true }), ok(initialize()), ok(tools()), ok(finalBody)]);
}

function responseSequence(responses: Response[]): typeof fetch {
  lastRequestLog = [];
  let index = 0;
  return (async (_input: URL | RequestInfo, init?: RequestInit) => {
    lastRequestLog.push({
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : "",
    });
    const response = responses[index];
    index += 1;
    if (!response) throw new Error("TEST FIXTURE requested an unexpected retry");
    return response;
  }) as typeof fetch;
}

function ok(body: unknown): Response {
  return status(201, body);
}
function status(code: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: code,
    headers: { "Content-Type": "application/json" },
  });
}
function initialize() {
  return {
    jsonrpc: "2.0",
    result: { protocolVersion: "2025-06-18", capabilities: { tools: {} } },
    id: 1,
  };
}
function tools() {
  return { jsonrpc: "2.0", result: { tools: [{ name: "getAaveV3SupportedChains" }] }, id: 2 };
}
function mcp(structuredContent: unknown) {
  return { jsonrpc: "2.0", result: { structuredContent }, id: 3 };
}
function state(value: unknown): unknown {
  return typeof value === "object" && value !== null ? (value as { state?: unknown }).state : null;
}
