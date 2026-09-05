# MAIN TRACK P13 — Controlled Aave Action + x402 Inspection

Date: 2026-08-11

## 1. Objective

Inspect exactly one safe, read-only Aave MCP action to determine its real
response structure and any live x402 payment terms. No value-moving action,
payment, signature, wallet, retry, or transaction was permitted.

**LIVE DATA outcome:** the one call returned an MCP error from the underlying
BSC `eth_call`; it did not return an action result or x402 challenge.

## 2. Selected Safe Action

**VERIFIED:** `getReservesList`

- Description: "Get ordered list of underlying assets of all initialized
  reserves with their symbols and addresses."
- This is an explicitly read-only reserve query.
- It does not request supply, borrow, repay, withdraw, approval, transfer,
  collateral change, swap, or any mutation.
- BSC is explicitly supported by its `chainName` enum.
- No tool name was guessed; it came from the verified live manifest.

## 3. Tool Schema

**LIVE DATA / VERIFIED** from the already-approved manifest discovery:

```text
name: getReservesList
input:
  type: object
  properties:
    chainName: string enum
      ethereum | arbitrum | avalanche | optimism | polygon | metis |
      base | bsc | scroll | gnosis | plasma
  required: [chainName]
  additionalProperties: false
output success:
  project: string
  operation: string
  note?: string
  data: [{ symbol: string, address: string }]
output error:
  project: string
  operation: string
  error: string
```

The only request parameter was the schema-valid value `chainName: "bsc"`.

## 4. Live Request

**LIVE DATA:** exactly one request was sent by `lib/activation/p13-probe.ts`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "getReservesList",
    "arguments": { "chainName": "bsc" }
  }
}
```

The endpoint was the fixed verified Aave MCP endpoint. The probe contains one
`fetch`, a 15-second timeout, no loop, no retry, no authentication/payment
header, and no mechanism to follow returned actions.

## 5. Response

**LIVE DATA / BLOCKED**

- HTTP status: `201`
- content type: `application/json; charset=utf-8`
- JSON-RPC response: `error`
- error code: `-32603`
- sanitized type: underlying BSC read-call exception / missing revert data
- underlying request type: `eth_call` at `latest` (read-only)
- result data: absent
- `apiRequestActions`: absent
- `toSign`: absent
- transaction request: absent
- payment information: absent

The service attempted a read-only on-chain call, but its upstream BSC RPC
returned a remote error. No retry was attempted.

## 6. Transaction/Action Shape

**UNKNOWN / BLOCKED**

The response contained no successful result, transaction object,
`apiRequestActions`, calldata request for user execution, typed data, action
order, value, or user-signing destination. Therefore P13 did not verify a real
transaction/action shape.

The error included diagnostic data for the service's internal read-only
`eth_call`. That is not treated as a user transaction request and was never
executed by the marketplace.

## 7. x402 Terms

**LIVE DATA:** no HTTP 402 was returned.

- x402 status: `not-required-for-this-action` (the request reached the tool and
  failed inside its read-only BSC query).
- x402 version/network/token/amount/payTo/resource/expiry/scheme/facilitator:
  not returned.
- No conclusion is made about mutation tools or other Aave actions; they may
  still require x402.
- No payment was constructed, signed, sent, or retried.

## 8. toSign Shape

**UNKNOWN / BLOCKED**

No `toSign` field or `apiRequestActions` array was returned. No signing method,
typed-data domain, primary type, available fields, action order, destination,
chain, or value could be verified from live data.

No signature was produced and no signing instruction was followed.

## 9. Validation

**IMPLEMENTED / TEST FIXTURE VERIFIED** in `p13-review.ts`:

- chain must be explicitly supplied and equal numeric BSC chain ID 56;
- destination must be explicitly supplied;
- value must be explicitly supplied;
- calldata must be explicitly supplied as valid even-length hex;
- action must be the P13 safe action;
- no chain, destination, value, or payload default/substitution exists;
- payload is preserved exactly;
- any failure produces validation state `invalid-action`.

This validation is fixture-only because the live response supplied no action
object to validate.

## 10. Immutable Review

**IMPLEMENTED / TEST FIXTURE VERIFIED**

`ActivationReview` contains only:

- agent identity;
- action name;
- chain;
- destination;
- value;
- exact payload/calldata;
- payment requirement;
- warnings;
- validation state/errors.

The review object is frozen and informational. It exposes no execute, sign,
pay, submit, or broadcast method.

## 11. Wallet Boundary

**IMPLEMENTED / VERIFIED**

`requestUserApproval(review)` always returns:

```json
{ "state": "signing-not-enabled" }
```

No wallet library was added. No signer exists. No private key, seed phrase,
wallet connection, typed-data signature, or transaction signature exists.

## 12. Safety Proof

**VERIFIED from the one-shot execution path:**

- payment submitted: **NO**
- signature produced: **NO**
- transaction broadcast: **NO**
- funds moved: **NO**
- automatic retry: **NO**
- second tool call: **NO**
- returned action executed: **NO**

The selected tool attempted only a read-only `eth_call`, which failed upstream.

## 13. Fixtures

**TEST FIXTURE / VERIFIED:** 20 assertions passed, 0 failed.

- A read-only success;
- B 402 payment-required;
- C `toSign` response normalized but never signed;
- D missing destination -> `invalid-action`;
- E wrong chain -> `invalid-action`, original chain preserved;
- F missing value -> `invalid-action`;
- G malformed calldata -> `invalid-action`;
- H invalid action -> `invalid-action`;
- I immutable review + signing-disabled boundary;
- J payment boundary never fabricates success.

Assertions also prove no signing/submission/payment implementation, exactly one
probe fetch, exact safe tool selection, and no chain/destination/value/payload
substitution.

## 14. Security

**VERIFIED**

- no wallet, key, mnemonic, seed phrase, signer, payment fulfiller, or
  transaction submitter;
- no Authorization/Bearer or payment credential sent or logged;
- no cookie or signature output;
- endpoint remains in server/audit source only;
- `.next/static`: 58 files, zero matches for the MCP endpoint, `/mcp/aave`,
  secret-key markers, Authorization, or Bearer;
- source marker matches occurred only in deliberately split forbidden-term
  arrays inside offline verification files, not secret values/runtime reads.

## 15. Regression

**VERIFIED — all requested checks pass**

- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm build`: PASS
- P13 fixtures: 20/20
- marketplace: 83/83 fixture; 14/14 live
- discovery: 59/59 fixture; 12/12 live
- TermiX package/web: PASS
- PancakeSwap data/server/UI: PASS
- Altana base/ERC-8183/skills/x402/x402-testnet/x402-marketplace: PASS

No unrelated system was modified. The P13 live probe was not rerun during
regression.

## 16. P14 Requirements

**BLOCKED pending separate authorization and a reliable read surface:**

1. Resolve or confirm the HeyAnon BSC RPC/read-path error with the service
   operator; do not retry P13 automatically.
2. Select a separately approved read-only action after confirming upstream BSC
   liveness, or obtain an official captured action-response schema.
3. Verify a real `apiRequestActions` / `toSign` response shape without signing
   or following it.
4. If a live 402 appears, capture terms and stop; payment remains a separate
   explicit milestone.
5. Only after real action data exists, validate chain/destination/value/payload
   against approved Aave BSC contracts.
6. Keep wallet signing, payment, transaction submission, and P14 execution
   disabled until separately authorized.

## 17. Remaining Blockers

- The safe BSC reserve-list tool failed in its upstream read-only `eth_call`.
- No live action/transaction shape was returned.
- No live `toSign` structure was returned.
- No live x402 terms were returned.
- Signing readiness is not established.
- Financial execution remains intentionally unavailable.

---

## FINAL STATUS

MAIN TRACK P13 STATUS:
ACTION INSPECTION FAILED

The one permitted read-only action was valid and safe, but its upstream BSC
read reverted/errored. No action shape or x402 terms were exposed. No payment,
signature, transaction, retry, second tool call, or fund movement occurred.
