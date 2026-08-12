/** P13 offline validation harness. Every synthetic value is a TEST FIXTURE. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizePaymentRequired,
  normalizeToolResult,
  type TransactionActionPreview,
} from "./contract.ts";
import { createActivationReview, requestUserApproval } from "./p13-review.ts";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`);
  }
}

const BASE_ACTION: TransactionActionPreview = {
  order: 1,
  chain: 56,
  destination: "0xTEST_FIXTURE_DESTINATION",
  value: "0",
  actionType: "TEST FIXTURE read-only",
  description: "TEST FIXTURE — never execute",
  calldata: "0x1234",
  typedData: null,
};

console.log("P13 review verify — TEST FIXTURES only; no network/payment/signature/transaction");

// TEST FIXTURE A — read-only success.
{
  const result = normalizeToolResult({
    jsonrpc: "2.0",
    result: { structuredContent: { project: "aave", operation: "getReservesList", data: [] } },
    id: 1,
  });
  check(
    "A read-only success contains no transaction actions",
    result.kind === "chains" || result.kind === "malformed"
  );
}

// TEST FIXTURE B — 402 payment required, terminal and informational.
const payment = normalizePaymentRequired({
  x402Version: 2,
  resource: { url: "https://fixture.invalid/read" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:56",
      asset: "0xTEST_FIXTURE_TOKEN",
      amount: "1",
      payTo: "0xTEST_FIXTURE_PAYTO",
      maxTimeoutSeconds: 60,
    },
  ],
});
check(
  "B payment-required normalized without payment",
  payment.state === "payment-required" && payment.terms.amount === "1"
);

// TEST FIXTURE C — toSign shape is retained by the P12 transaction normalizer.
{
  const result = normalizeToolResult({
    jsonrpc: "2.0",
    result: {
      structuredContent: {
        apiRequestActions: [
          {
            type: "TEST FIXTURE",
            request: { chainId: 56, to: "0xTEST_FIXTURE_DESTINATION", value: "0", data: "0x1234" },
            toSign: {
              domain: { chainId: 56 },
              types: { Fixture: [] },
              primaryType: "Fixture",
              message: { fixture: true },
            },
          },
        ],
      },
    },
    id: 1,
  });
  check(
    "C toSign response normalized but never signed",
    result.kind === "transaction" && result.actions[0]?.typedData?.primaryType === "Fixture"
  );
}

// TEST FIXTURE D — missing destination.
check(
  "D missing destination -> invalid-action",
  createActivationReview({
    actionName: "getReservesList",
    action: { ...BASE_ACTION, destination: null },
  }).validation.errors.includes("missing-destination")
);
// TEST FIXTURE E — wrong chain (never substituted with 56).
{
  const review = createActivationReview({
    actionName: "getReservesList",
    action: { ...BASE_ACTION, chain: 1 },
  });
  check("E wrong chain -> invalid-action", review.validation.errors.includes("wrong-chain"));
  check("E wrong chain preserved, never substituted", review.chain === 1);
}
// TEST FIXTURE F — missing value.
check(
  "F missing value -> invalid-action",
  createActivationReview({
    actionName: "getReservesList",
    action: { ...BASE_ACTION, value: null },
  }).validation.errors.includes("missing-value")
);
// TEST FIXTURE G — malformed calldata.
check(
  "G malformed calldata -> invalid-action",
  createActivationReview({
    actionName: "getReservesList",
    action: { ...BASE_ACTION, calldata: "TEST FIXTURE malformed" },
  }).validation.errors.includes("malformed-calldata")
);
// TEST FIXTURE H — invalid action.
check(
  "H invalid action -> invalid-action",
  createActivationReview({ actionName: "borrow", action: BASE_ACTION }).validation.errors.includes(
    "invalid-action"
  )
);
// TEST FIXTURE I — signing boundary.
{
  const review = createActivationReview({ actionName: "getReservesList", action: BASE_ACTION });
  check("I valid fixture passes strict review", review.validation.state === "valid");
  check("I payload preserved exactly", review.payload === BASE_ACTION.calldata);
  check(
    "I destination and value preserved exactly",
    review.destination === BASE_ACTION.destination && review.value === BASE_ACTION.value
  );
  check(
    "I immutable review has no execute/sign method",
    !("execute" in review) && !("sign" in review) && Object.isFrozen(review)
  );
  check(
    "I signing boundary returns signing-not-enabled",
    requestUserApproval(review).state === "signing-not-enabled"
  );
}
// TEST FIXTURE J — payment boundary.
check(
  "J payment boundary never fabricates success",
  payment.state === "payment-required" && !("paid" in payment)
);

{
  const files = ["lib/activation/p13-probe.ts", "lib/activation/p13-review.ts"];
  const source = files.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");
  const forbidden = [
    "PRIVATE" + "_KEY",
    "WALLET" + "_PRIVATE_KEY",
    "MNEMONIC",
    "SEED" + "_PHRASE",
    "ALTANA" + "_PRIVATE_KEY",
    "X402" + "_PRIVATE_KEY",
    "FACILITATOR" + "_KEY",
  ];
  check(
    "security: no secret-key path",
    forbidden.every((term) => !source.includes(term))
  );
  check(
    "security: no signing or transaction submission implementation",
    !/signTypedData|signTransaction|sendTransaction|eth_sendTransaction|broadcastTransaction/.test(
      source
    )
  );
  check(
    "security: no payment fulfillment implementation",
    !/PAYMENT-SIGNATURE|X-PAYMENT|paymentPayload/.test(source)
  );
  check(
    "security: probe contains exactly one fetch call",
    (source.match(/await fetch\(/g) ?? []).length === 1
  );
  check(
    "security: probe fixes the safe action",
    source.includes('name: "getReservesList"') &&
      !/name: "(?:supply|borrow|repay|withdraw|approve)"/.test(source)
  );
}

console.log(`\nP13 review verify: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
