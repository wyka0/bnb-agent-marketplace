# MAIN TRACK P12 — Aave by HeyAnon Activation Prototype

Date: 2026-08-11

## 1. Objective

**IMPLEMENTED:** A safe activation-preview pipeline for Aave by HeyAnon that
resolves the exact agent request, calls its verified MCP service server-side,
proves BSC support with the approved read-only tool, normalizes terminal
payment/transaction-request states, and stops before signing or execution.

**IMPORTANT LIMITATION:** Activation pipeline prepared; signing/execution
intentionally disabled. This report does not claim that activation works.

## 2. Aave Agent Identity

**VERIFIED / LIVE DATA**

- Name: Aave powered by HeyAnon
- agent identity: `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381`
- chain: BSC mainnet, chain ID 56
- ERC-8004 token ID: 45381
- request validation accepts only this exact identity, chain 56, and the
  action `inspect-supported-chains`.
- Extra request fields are rejected, including caller-supplied endpoints and
  calldata.

## 3. MCP Endpoint

**IMPLEMENTED / VERIFIED**

- Fixed server-only endpoint:
  `https://erc8004.heyanon.ai/mcp/aave`
- It exists in one source file only: `lib/activation/aave.server.ts`.
- No user-provided URL can reach `fetch`.
- No API key or authorization header is sent.
- Every HTTP request has an 8-second timeout, `no-store`, and a 1 MB response
  bound.
- HTTP and MCP errors are sanitized; production code does not log request or
  response bodies.

## 4. Architecture

**IMPLEMENTED**

```text
Agent Details (exact Aave agent route)
  -> local POST /api/activation/aave-preview
  -> fixed server-only MCP client
  -> GET manifest
  -> MCP initialize
  -> MCP tools/list
  -> one tools/call: getAaveV3SupportedChains
  -> typed ActivationResult
  -> preview UI
  -> STOP before wallet/signature/payment/transaction
```

The browser never calls HeyAnon directly. Existing Hire and Connect Wallet
controls remain unchanged and disabled.

## 5. Activation Contract

**IMPLEMENTED** in `lib/activation/contract.ts`:

- `ActivationRequest`: exact `agentId`, chain ID, and safe action.
- `ActivationResult`: `ready`, `transaction-required`, `payment-required`,
  `unsupported`, or `error`.
- Unsupported reasons: wrong agent, unsupported chain, unsupported action.
- Sanitized errors: timeout, MCP server error, malformed response.
- Missing payment/transaction fields remain `null`; values are never
  invented.

## 6. Transaction Boundary

**IMPLEMENTED / TEST FIXTURE VERIFIED / NOT LIVE-EXECUTED**

If a future response includes `apiRequestActions`, the normalizer retains only
fields actually supplied:

- action order;
- chain;
- destination;
- value;
- action type;
- human-readable description;
- exact calldata;
- typed-data domain, types, primary type, and message.

The UI renders an ordered preview with explicit `unknown` / `not supplied`
values. No calldata executor, transaction submitter, broadcast function, or
arbitrary input-calldata path exists.

## 7. Signing Boundary

**IMPLEMENTED / VERIFIED**

`requestUserSignature(...)` always returns:

```json
{ "state": "signing-not-enabled" }
```

Signing is intentionally disabled in P12. There is no signer implementation,
private-key input, wallet connector, typed-data signer, transaction signer, or
send-transaction call. The UI Continue button is disabled.

## 8. x402 Handling

**IMPLEMENTED / TEST FIXTURE VERIFIED / NOT PAID**

- HTTP 402 is a terminal `payment-required` result.
- No payment header is created, no payment signature is produced, and the
  request is never retried after 402.
- Public terms are normalized only when returned: protocol/version, network,
  token, amount, payTo, facilitator, expiry/timeout, resource, required
  headers, and payment-signature requirement.
- Missing terms remain `null` or an empty list.
- The approved live query returned 201 and required no x402 payment.

## 9. Safe Live Probe

**LIVE DATA / VERIFIED** via `pnpm activation:live:verify`:

- manifest: OK;
- MCP initialize: OK;
- tools/list: OK;
- sole tool call: `getAaveV3SupportedChains`: OK;
- BSC chain 56: supported;
- 11 supported chains returned;
- payment required: NO for this query;
- no financial mutation tool called;
- no retry, payment, signature, wallet, transaction, or returned action.

## 10. UI Boundary

**IMPLEMENTED**

- A minimal `Activation Preview` panel appears only on the exact Aave agent
  route.
- `Run safe preview` calls only the local API route.
- It displays ready/payment-required/transaction-required/unsupported/error
  states honestly.
- It states: "Signing is intentionally disabled in P12."
- Existing marketplace layout, global Hire behavior, and Connect Wallet
  Coming Soon behavior are unchanged.

## 11. Security

**VERIFIED**

- no private keys, mnemonic, seed phrase, wallet creation, wallet connection,
  server signer, payment signer, transaction broadcast, or financial tool;
- no environment private-key reads;
- no Authorization/Bearer header;
- no arbitrary external endpoint;
- no arbitrary input calldata;
- no automatic retry for financial/payment actions;
- exact agent/chain/action allowlist;
- source audit verifies no signer, payer, or transaction-submission surface.

No payment occurred. No signature occurred. No transaction occurred.

## 12. Fixtures

**TEST FIXTURE / VERIFIED:** 33 assertions, 0 failures.

Required cases covered:

- A BSC supported;
- B BSC unsupported;
- C normal read-only result;
- D transaction-required preview;
- E payment-required terminal result;
- F malformed action;
- G missing destination remains null;
- H missing chain remains null;
- I invalid agent, wrong chain, arbitrary action/endpoint/calldata rejected;
- J MCP timeout sanitized;
- K MCP server error sanitized;
- L signing boundary rejects execution;
- M no private-key, signer, payment retry, or transaction path exists.

Every synthetic payment/transaction value is explicitly labeled TEST FIXTURE
and is never submitted.

## 13. Verification

**VERIFIED**

- `pnpm activation:verify`: 33 passed, 0 failed.
- `pnpm activation:live:verify`: READY; BSC supported; no
  payment/signature/transaction.
- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS (Next.js production build; API route server-rendered).

The build emits an existing informational warning that the Next.js ESLint
plugin is not detected; lint itself passes.

## 14. Regression

**VERIFIED — all requested suites pass**

- marketplace fixture: 83/83; live: 14/14;
- discovery fixture: 59/59; live: 12/12;
- TermiX reputation package + web suites: PASS;
- PancakeSwap data + server + UI suites: PASS;
- Altana base, ERC-8183, skills, x402, x402 testnet, and x402 marketplace
  suites: PASS.

No unrelated system was modified to obtain these results. The forbidden
`altana:x402:e2e:testnet:verify` command was not requested or run.

## 15. Client Bundle Audit

**VERIFIED** after the final production rebuild.

Dedicated content search over all 58 files in `.next/static` returned zero
matches for:

- `erc8004.heyanon.ai`
- `/mcp/aave`
- `PRIVATE_KEY`
- `WALLET_PRIVATE_KEY`
- `MNEMONIC`
- `SEED_PHRASE`
- `Authorization`
- `Bearer`

The endpoint remains server-only. An initial shell audit attempt was discarded
because `rg` was unavailable; the reported result is from the successful
dedicated filesystem/content audit, not that failed command.

## 16. Current Limitations

**NOT IMPLEMENTED / BLOCKED BY DESIGN**

- real wallet connection;
- user signing or approval;
- financial MCP tool calls;
- live `apiRequestActions` response validation;
- live paid-tool 402 terms;
- x402 payment;
- Aave approvals, supply, borrow, repay, withdraw, collateral changes, swaps;
- blockchain submission, receipt polling, and independent confirmation;
- globally enabled Hire.

The live query proves infrastructure and BSC support only. It does not prove a
financial operation can execute.

## 17. P13 Requirements

Before any real activation claim, P13 must explicitly authorize and implement:

1. a reviewed wallet connector that keeps keys entirely in the wallet;
2. a single consented non-mutating or transaction-draft request to capture a
   real `apiRequestActions` shape and any live 402 terms;
3. schema validation and destination/chain/value/calldata decoding against
   approved Aave BSC contracts;
4. an immutable review-to-sign payload with explicit user rejection;
5. x402 consent/payment handling only if separately approved;
6. wallet-local signing only, never server-side;
7. broadcast and independent receipt confirmation only after a separate
   explicit transaction authorization milestone;
8. failure, rejection, timeout, revert, and confirmation-timeout states;
9. security review and client-bundle audit repeated after any wallet SDK.

---

## FINAL STATUS

MAIN TRACK P12 STATUS:
ACTIVATION PROTOTYPE READY

- MCP connection status: **VERIFIED READY** (manifest/initialize/tools/list).
- BSC support status: **VERIFIED YES** (chain 56 in live safe result).
- Transaction preview boundary: **IMPLEMENTED, fixture-verified, never
  executed**.
- Signing boundary: **IMPLEMENTED as `signing-not-enabled`; no signer exists**.
- x402 handling: **IMPLEMENTED as terminal 402 normalization; no payment or
  retry**.
- Live safe-probe result: **ready; no payment required for
  `getAaveV3SupportedChains`**.
- Tests: **33/33 P12 assertions; lint/typecheck/build pass**.
- Regression: **all requested suites pass**.
- Security result: **PASS; no key/wallet/payment/signing/transaction path and
  no endpoint/credential marker in `.next/static`**.
- Exact P13 requirements: wallet-local approval boundary, one separately
  consented real action-shape/402 inspection, strict Aave destination and
  payload validation, explicit review/reject, and only then separately
  authorized signing/broadcast/independent confirmation.

Activation pipeline prepared; signing/execution intentionally disabled.
