# Altana X.4A - Controlled Funded BNB Testnet End-to-End Verification

**Phase:** X.4A - determine whether the existing x402 + marketplace + ERC-8183 boundaries can perform a GENUINE funded BNB-testnet payment and safely transition into the ERC-8183 job lifecycle. Controlled verification only; not production, not mainnet, not UI.
**Status:** **BLOCKED** - `ALTANA X4A STATUS: BLOCKED`. The required externally-supplied dependencies (funded testnet signer, `FACILITATOR_KEY`, real `payTo`) are ABSENT from the secure environment. Per the strict safety rules the run STOPS before signing. **No transaction was submitted. No funds moved.**
**Date:** 2026-08-10
**Signer source:** EXTERNAL / ENVIRONMENT ONLY (none present).
**Runner:** `altana:x402:e2e:testnet:verify` -> `node dist/altana/x402.e2e.testnet.verify.js` (8 offline safety checks pass; live payment cleanly blocked).
**Tag legend:** IMPLEMENTED = shipped this phase - VERIFIED = proven by the offline harness/regression - BLOCKED = intentionally not done, with reason - NOT IMPLEMENTED = out of X.4A scope.

---

## 1. Prerequisites [BLOCKED]

A live funded payment requires three externally-supplied dependencies. All are read by PRESENCE only (never by value, never printed, never stored):

| Dependency                                        | Env name(s) checked                                                                                          | Present? |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Funded BNB-testnet signer / private key / session | `ALTANA_PRIVATE_KEY`, `X402_PRIVATE_KEY`, `WALLET_PRIVATE_KEY`, `PRIVATE_KEY`, `ALTANA_SIGNER`, `SIGNER_KEY` | **NO**   |
| x402 facilitator settler EOA key                  | `FACILITATOR_KEY` (official x402-server env name)                                                            | **NO**   |
| Real sell-side recipient (`payTo`)                | `ALTANA_PAYTO`, `X402_PAYTO`, `MERCHANT_PAYTO`                                                               | **NO**   |

Corroboration: `packages/config/src/env.ts` declares NO signer/facilitator/payTo variable (its comment states a private-key signer var "is NOT added yet; it arrives with the session phase"). No `.env`/`.env.local`/`.env.testnet` file exists; `.env.example` declares only the unrelated `8004SCAN_API_KEY`. Direct `process.env` presence probe: all ABSENT.

Because prerequisites are missing, the harness returns a clean BLOCKED result and never fabricates a signer, facilitator, payTo, wallet, or amount.

---

## 2. Network Verification [VERIFIED]

- `getX402Network("bnb-testnet")` resolves to `{ network: "bnb-testnet", chainId: 97 }`.
- Mainnet is refused two ways: `getX402Network("bsc")` and `getX402Network(56)` both throw `AltanaX402NetworkError`.
- SDK `BNB_TESTNET.chainId === 97`.
- The keyless read-only client pins `defaultChainId === 97` and `client.chains[0].chainId === 97` (RPC `https://bsc-testnet-rpc.publicnode.com`).
- **No code path can select chain 56.** There is no env switch and no mainnet branch reachable from this harness.

---

## 3. Signer Boundary [VERIFIED / BLOCKED]

`SIGNER SOURCE: EXTERNAL / ENVIRONMENT ONLY.` The harness:

- reads only the PRESENCE of signer env vars (boolean), never the value;
- never creates a private key, never generates a mnemonic, never writes a key to a file or TypeScript, never prints or commits a key.

Result: `signer available: NO`. With no signer, the harness STOPS before any signing (section 7). This is the honest, expected offline state - BLOCKED, not a failure.

---

## 4. Wallet Balance Check [BLOCKED]

`wallet available: NO` (no funded signer supplied). Because no wallet identity is supplied, no balance can be read for a signer, and the harness does not proceed to signing. `sufficient testnet balance: N/A` (no wallet). The harness never requests or acquires funds automatically. (The pre-existing Phase-2 read-only probe reads the zero-address native balance only; it implies no funds and is unrelated to a signer wallet.)

---

## 5. x402 Payment [BLOCKED]

No live x402 payment was attempted. The intended flow (buyer -> protected resource -> HTTP 402 -> requirements -> externally supplied signer -> authorization -> official facilitator verification -> verified -> resource) cannot start without the signer + facilitator + payTo. The harness stops at the "externally supplied signer" step.

Offline, the existing marketplace service (reused, not duplicated) is asserted to behave safely:

- `describe(agent)` with the configured TEST FIXTURE merchant -> `payment-required` (never `payment-verified`).
- A request carrying ONLY client claims (`paid:true`, `paymentVerified:true`, `transactionHash`) -> status is NOT `payment-verified`. Client-provided payment status is never accepted as proof.

---

## 6. Payment Verification [BLOCKED]

No genuine verification occurred because no payment was made. The verification authority remains the server-side x402 gate (`marketplaceVerdictFromX402Handle` over the official `HandleResult`), which only reports `ok` on a real `status:200` receipt. `paid` / `paymentVerified` / fake `txHash` are never treated as proof (asserted offline in section 6 of the harness and in the X.2/X.3 suites).

---

## 7. Marketplace Service Transition [VERIFIED - offline]

The `payment-required -> payment-verified` transition is exercised in `altana:x402:marketplace:verify` (X.3) using a server-side verifier verdict, and the negative paths (forged/invalid/wrong-chain/claims-only) never reach `payment-verified`. In X.4A, with no live payment, the service correctly stays at `payment-required` and `service.status = not-implemented`. The x402 gate is never bypassed.

---

## 8. ERC-8183 Boundary [VERIFIED - construction only]

Reusing the existing adapter (`erc8183.ts`, unmodified):

- `getErc8183Addresses(97)` resolves the testnet commerce/paymentToken addresses.
- `prepareErc8183Hire(BNB_TESTNET, input)` builds a valid multi-call hire draft on chain 97 (TEST FIXTURE inputs; nothing signed or submitted).
- `getErc8183Addresses(56)` is refused with `AltanaErc8183NetworkError`.
- `assertErc8183SigningBoundary("hire")` always throws `AltanaErc8183ExecutionError` - submission is blocked.

Call construction is proven; submission is impossible without the signing authority.

---

## 9. Whether an ERC-8183 Job Was Submitted [NOT IMPLEMENTED]

**No.** No ERC-8183 job was submitted. Submission requires an externally supplied testnet signer with authority - absent here - and the signing boundary always stops. Only call construction was verified.

---

## 10. Transaction Hashes [NOT IMPLEMENTED]

None. No transaction of any kind (payment or job) was broadcast, so there are no transaction hashes to record.

---

## 11. Post-Transaction Verification [NOT IMPLEMENTED]

Not applicable - no transaction was submitted, so there is no on-chain state to independently confirm. (When X.4B supplies a signer, the harness's live path must add independent on-chain confirmation of tx success, recipient == configured `payTo`, exact amount/token, and job id/ownership/status.)

---

## 12. Failure Handling [VERIFIED]

The harness and the reused adapters enforce the required failure safety:

- **Wrong network / mainnet:** refused by `getX402Network` (x402) and `getErc8183Addresses`/`assertErc8183TestnetNetwork` (ERC-8183). ABORT rather than switch.
- **Missing prerequisites:** clean BLOCKED, no fabrication, no signing.
- **Malformed / invalid / wrong-recipient / expired / forged payment:** rejected server-side by the x402 gate (proven exhaustively in `altana:x402:testnet:verify`, 16 checks) and normalized to non-verified marketplace states (`altana:x402:marketplace:verify`, 10 checks).
- **Client-claim spoofing:** ignored (verified here + X.3).
- **No blind retries / no duplicate payments or jobs:** the harness performs a single deterministic pass and submits nothing; the x402 merchant retains an in-process replay guard + on-chain nonce as the durable source of truth.

---

## 13. Security Scan [VERIFIED]

Scanned `packages/`, `apps/`, `docs/` (excluding `node_modules`, `dist`, `.next`, `.turbo`, `build`) for `PRIVATE_KEY`, `PRIVATEKEY`, `MNEMONIC`, `SEED_PHRASE`, `WALLET_PRIVATE_KEY`, `ALTANA_PRIVATE_KEY`, `X402_PRIVATE_KEY`, `FACILITATOR_KEY`, `FACILITATOR_SECRET`, `8004SCAN_API_KEY`, `NEXT_PUBLIC_`, `Bearer`, `Authorization`.

All matches are benign: env-variable **names** (zod schema / adapter constants), doc-comment prose, the EIP-3009 protocol `authorization` field, and env-guard lists that ASSERT secrets are unset. The new E2E harness specifically:

- contains **zero** `0x`+64-hex key literals;
- has a single `process.env[name]` access inside `envPresent()` that returns a boolean only - never the value;
- never logs, stores, or persists any secret value.

The only real `process.env` secret read in the repo remains the pre-existing server-only `8004SCAN_API_KEY` (never `NEXT_PUBLIC_`, never in a browser bundle). Confirmed: no secret committed, in source, in logs, in HTML, or in the browser bundle.

---

## 14. Regression Tests [VERIFIED]

All green (allowing >=120 s for cold viem/x402 startup):

- `pnpm lint` - 12/12
- `pnpm typecheck` - 12/12
- `pnpm build` - 7/7 (Next.js production build unchanged, 18 routes; frozen UI untouched)
- `altana:verify` - Phase 2 (incl. live chain-97 read probe)
- `altana:erc8183:verify` - Phase 3A
- `altana:skills:verify` - Phase 4 (metadata only)
- `altana:x402:verify` - X.1
- `altana:x402:testnet:verify` - X.2 (16 checks)
- `altana:x402:marketplace:verify` - X.3 (10 checks)
- `altana:x402:e2e:testnet:verify` - **X.4A (8 offline checks; live payment BLOCKED, exit 0)**

---

## 15. Exact Blockers [BLOCKED]

To perform a live funded testnet payment, supply via the secure environment ONLY (never source, never printed):

1. A **funded BNB-testnet signer** (one of `ALTANA_PRIVATE_KEY` / `X402_PRIVATE_KEY` / `WALLET_PRIVATE_KEY` / `PRIVATE_KEY` / `ALTANA_SIGNER` / `SIGNER_KEY`), with sufficient testnet gas + $U.
2. The **facilitator settler key** (`FACILITATOR_KEY`) - the gas-only settler EOA the official x402-server requires.
3. A **real sell-side `payTo`** recipient (one of `ALTANA_PAYTO` / `X402_PAYTO` / `MERCHANT_PAYTO`), replacing the TEST FIXTURE payTo.

Absent any one of these, X.4A remains BLOCKED by design.

---

## 16. X.4B Requirements [NOT IMPLEMENTED]

When the three blockers above are satisfied, X.4B would:

1. Load the signer/facilitator strictly from the secure environment (never source), and construct the officially-configured `createX402Merchant` (facilitator + rpcUrl) - no unverified endpoint substitution.
2. Perform the smallest safe $U payment on chain 97 through the existing marketplace service verifier: verify `recipient == configured payTo` BEFORE signing (client can never override), and confirm requested == authorized == verified amount/token exactly (no guessed decimals).
3. Independently confirm from chain state: tx success, payment state, recipient, amount, token, rail.
4. Only then, if all ERC-8183 job parameters + signer authority are confirmed, optionally submit ONE ERC-8183 testnet job (correct addresses, client/provider, budget, currency, deliverable, predicted job-id race handling), then independently confirm job id/ownership/status.
5. Enforce failure safety throughout (no blind retries, no duplicate payments/jobs).

Scope guards carried forward unchanged: testnet-only (chain 56 refused), server-side only, no UI, no Hire activation, no skill execution, no credentials in source, no git actions.

---

## Files Changed [IMPLEMENTED]

| File                                                          | Change                                                                                                                                                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/integrations/src/altana/x402.e2e.testnet.verify.ts` | New E2E verification harness (presence-only env probe, chain-97 gates, read-only client, marketplace safety, ERC-8183 construction-vs-submission boundary, clean BLOCKED). Reuses existing adapters; duplicates none. |
| `packages/integrations/package.json`                          | Added `altana:x402:e2e:testnet:verify` script.                                                                                                                                                                        |
| `docs/review/Altana-X4A-Testnet-E2E.md`                       | This document.                                                                                                                                                                                                        |

No UI files, no `x402.ts`, `marketplace.ts`, `erc8183.ts`, `skills.ts`, `client.ts`, or config/env files were modified. No credentials, no `NEXT_PUBLIC_*`, no git init/commit/push.

---

**ALTANA X4A STATUS: BLOCKED** - missing externally-supplied funded testnet signer, `FACILITATOR_KEY`, and real `payTo`. Everything verifiable offline is green (chain-97 pinning, mainnet refusal, read-only client, marketplace no-bypass, ERC-8183 construction boundary, security scan, full regression). No transaction was submitted; no funds moved; no signer was created. Next action: supply the three dependencies via the secure environment and re-run the E2E runner.
