# Altana x402 — Phase X.2 Implementation (Controlled BNB-Testnet Payment-Flow Verification)

**Phase:** X.2 — run the REAL HTTP 402 lifecycle (resource → 402 → requirements → authorization → server-side verification) as far as the confirmed official config allows, with a dedicated keyless in-process merchant and failure-test harness. No signing, no transaction, no settlement.
**Status:** COMPLETE — `ALTANA X402 X.2 STATUS: READY FOR X.3 (chain 97 flow verified keylessly; live signing BLOCKED — requires an externally supplied funded BNB Testnet wallet)`
**Date:** 2026-08-10
**Precedes:** X.3 — delivery integration: server route/worker wrapper with an operator-supplied facilitator + externally supplied funded signer/session (out of scope for X.2, frozen UI preserved).
**Validated against:** `@altananetwork/x402-server@0.2.0` installed source (`merchant.js`, `verify.js`, `decode.js`, `challenge.js`, `settle.d.ts`), `@altananetwork/sdk@0.7.0` (`x402.js` / `x402.d.ts`), and viem `2.55.11` (`verifyTypedData` pure EOA verifier).
**Tag legend:** IMPLEMENTED = shipped in this phase · VERIFIED = proven by an offline/regression check · BLOCKED = intentionally not done, with reason · NOT IMPLEMENTED = out of X.2 scope.

---

## 1. Testnet Configuration [IMPLEMENTED, VERIFIED]

`packages/integrations/src/altana/x402.testnet.ts` — `createX402TestnetMerchantConfig(opts)` builds the official `MerchantConfig` the confirmed X.1 configuration dictates:

| Field               | Value                                                                                                                                                      | Verified                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `chainId`           | `97` (BNB testnet)                                                                                                                                         | `createX402TestnetMerchantConfig` refuses anything but 97 |
| `payTo`             | `X402_TESTNET_FIXTURE_PAYTO = 0x9bEb61C2a40D3e8bF0fe0E98ecf9A8C6E4a76543` — a TEST FIXTURE 40-hex address, **not** a real wallet, no funds ever move to it | cross-checked against merchant config                     |
| `rails`             | exactly one: eip3009 / $U / `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` (official `U_TOKEN[97]`, same as ERC-8183 `paymentToken`)                         | match rail on verify path                                 |
| `price`             | `X402_TESTNET_FIXTURE_PRICE = 100_000_000_000_000_000n` ($U atomic units, 18 dec)                                                                          | challenge quote equals it                                 |
| `maxTimeoutSeconds` | `300` (≤ 480 Studio window rule)                                                                                                                           | asserted ≤ 480                                            |
| `resource`          | `https://x402.test.example/testnet/x402/protected-resource` (a TEST FIXTURE URL)                                                                           | echoed in the challenge                                   |
| `description`       | `X402_TESTNET_MARKER = "TEST FIXTURE / NOT LIVE PAYMENT"`                                                                                                  | carried on every fixture                                  |

Every fixture (config, payer, payTo, resource, header) carries the `TEST FIXTURE / NOT LIVE PAYMENT` marker so nothing can be mistaken for a live payment.

---

## 2. Protected Resource [IMPLEMENTED]

The keyless merchant exposes two serving contracts mirroring the official merchant (`merchant.js`):

- `challenge()` — the official `buildChallenge(cfg)` 402 body for this exact configuration (B402 v2: `x402Version: 2`, `error: "payment required"`, `resource`, `accepts[]` with `scheme:"exact"`, CAIP-2 `eip155:97`, `asset`, `payTo`, `amount`, `extra.assetTransferMethod: "eip3009"`).
- `requirePayment(header|null)` — the payment gate with the exact official verdict ordering.
- `guard({headers})` — Fetch-API sugar reading `X-PAYMENT` then `PAYMENT-SIGNATURE`, returning a 402 `Response` or `{response:null}`.

`x402TestnetPaidBody()` defines the content a genuinely paid request would return, always labeled with the fixture marker.

---

## 3. The 402 Flow [IMPLEMENTED, VERIFIED]

The lifecycle proved by the harness (`x402.testnet.verify.ts`):

1. Buyer asks for the protected resource with no payment → merchant answers `402` + the official challenge body (`error = "payment required"`).
2. Buyer sends an `X-PAYMENT` header → merchant decodes it with the official `decodeXPayment` and verifies it with the official `verifyPayment` against the same `MerchantConfig`.
3. Malformed header → 402 `invalid X-PAYMENT: …`; business/crypto failure → 402 `payment rejected: …`; success → 200 + receipt (`SettleResult`-shaped `{ txHash } & { payer, amount, token, rail }`).

The status-200 receipt uses the **real** `PaymentReceipt` shape read from `settle.d.ts` (`SettleResult = { txHash: Hex }` extended with `payer/amount/token/rail`) — this phase corrected the shape so it type-checks against the official `PaymentReceipt`.

The 200 branch is provably unreachable from any fixture: reaching it requires a genuine private-key signature over the EIP-3009 typed data, which X.2 never possesses (see §7).

---

## 4. Buyer Flow [IMPLEMENTED, VERIFIED]

`runX402TestnetBuyerFlow(merchant)` drives the buyer side with no signer:

1. First request → 402.
2. `parsePaymentRequired(challenge)` → normalized `X402Requirement[]` (exactly one option: eip3009/$U on chain 97).
3. `selectX402Requirement(reqs, { chainId: 97, preferRail: "eip3009" })` (official SDK) → selects the eip3009/$U option.
4. `requestWithX402(handle, { url, session: undefined })` → **must throw** `AltanaX402ExecutionError` with the mandated message `X402_EXECUTION_REQUIRES_SESSION` ("x402 payment requires an externally supplied Altana session (grantSession) … No payment was signed or submitted.").

No signature, no `X-PAYMENT` emission, no transaction is ever produced.

---

## 5. Seller Verification [IMPLEMENTED, VERIFIED]

The keyless merchant performs **server-side verification only via official primitives**:

```
decodeXPayment(header) → DecodedPayment
verifyPayment(decoded, cfg, { verifySignature, isContract }) → VerifyResult
```

- `verifySignature` is viem's pure EOA `verifyTypedData` (the documented `VerifyOptions.verifySignature` EOA path — "the pure `verifyTypedData` covers EOAs only"). Keyless, no RPC needed.
- `isContract: () => false` — smart-account payers are deferred to settlement (the facilitator boundary, out of X.2 scope).
- Business rules run first (cheap), then crypto — exact official order from `verify.js`: wrong chain → rail match → effective price clamp → payTo → expiry window → `verifyTypedData`.
- The harness cross-checks the merchant verdict against a **direct** official `verifyPayment` call with the same forged header and confirms they agree (both reject `signature verification failed`).

**No client claim is ever trusted.** Fixtures that carry `paid: true`, `paymentVerified: true`, and a plausible `txHash` in the payload are still rejected at crypto verification — the server only trusts the cryptographic proof.

---

## 6. Permit2 [VERIFIED — unchanged, out of the verified rail]

- The confirmed testnet rail is eip3009/$U (matches `U_TOKEN[97]`, the Studio buyer path). Permit2 rails are **not** configured on this merchant (no Permit2 `spender` settler exists without a facilitator).
- `ALTANA_X402_PERMIT2_ADDRESS = 0x000000000022D473030F116dDEE9F6B43aC78BA3` (canonical SDK constant) remains exported and asserted valid.
- Permit2 approval / `approveSignatureChecker` / `approveTokenForPermit2` still require an externally supplied wallet + signer + session — X.2 performs no approval, consistent with X.1's `X402_APPROVAL_REQUIRES_WALLET` boundary.

---

## 7. Signing Requirement [BLOCKED — no signer in this environment]

Signing the EIP-3009 `TransferWithAuthorization` typed data (built keylessly via the official `buildEip3009TypedData`) requires a private key / Altana session. X.2 is **forbidden from inventing or generating a wallet/key**, and no externally supplied funded BNB-testnet wallet or session exists here (all external-signer env names present are unset; see §13–§14).

Consequence (mandated stop message, asserted by the harness):

> Payment signing requires an externally supplied funded BNB Testnet wallet. No transaction/payment was submitted.

The harness proves the authorization typed-data construction is correct (`TransferWithAuthorization`, chain 97, verifying contract = $U) and stops at the boundary; it never signs.

---

## 8. Facilitator / Settlement [BLOCKED by design — not attempted]

`createX402Merchant` requires `{ facilitator: Account, rpcUrl }` and settles via `settlePayment` (gas-paid broadcast from the facilitator EOA). No facilitator, no RPC URL, and no `FACILITATOR_KEY` credential exist in this phase — the sell-side custody boundary from X.1 (`X402_SELL_SIDE_REQUIRES_FACILITATOR`) is preserved and re-asserted. The keyless merchant deliberately does not construct `createX402Merchant`; it mirrors `requirePayment`'s verify contract without the settlement leg. The X.2 receipt therefore carries a zero `txHash` placeholder that can only be reached by a genuine external signature (unreachable here), and is clearly documented as no-settlement.

---

## 9. Failure Tests [IMPLEMENTED, VERIFIED — all green]

The failure matrix from the mandated list, all constructed as **keyless** fixture headers (forged 65-byte signatures, no private key ever present) and all answered 402:

| Class             | Fixture                                         | Official reason asserted                                                                     |
| ----------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A no payment      | `null` header                                   | 402 + `error: "payment required"`                                                            |
| B malformed       | `"not-base64-json!!!"`                          | 402 `invalid X-PAYMENT` (decode throws)                                                      |
| C wrong network   | envelope `eip155:56`                            | 402 `wrong chain` (chain 56 refused)                                                         |
| D wrong recipient | `authorization.to` ≠ payTo                      | 402 `payTo mismatch`                                                                         |
| E insufficient    | value = price − 1                               | 402 `below the quoted price`                                                                 |
| F expired/invalid | `validBefore = "1"` / `validAfter = 4102444800` | 402 `validBefore in the past` / `validAfter in the future`                                   |
| G forged          | business-correct + forged signature             | 402 `signature verification failed` (merchant **and** direct official `verifyPayment` agree) |

No success is fabricated: every branch that "passes" does so only up to the crypto boundary and is reported BLOCKED (§12).

---

## 10. Replay / Duplicate Detection [IMPLEMENTED, VERIFIED]

- Mirror of `merchant.js`: an in-process `seen` Set keyed per rail — `3009:${payer}:${authorization.nonce}` / `p2:${payer}:${permit.nonce}` — so one authorization cannot settle twice in a race; merchant.js clears the entry only if settlement throws (an honest retry path).
- The **on-chain nonce is the durable source of truth** once a facilitator exists (documented, not re-implemented — no custom duplicate-scheme, no conflicting protocol).
- The harness asserts deterministic re-rejection: sending the identical invalid header twice yields `402` both times with byte-identical bodies.

---

## 11. CORS / Origin Boundary [VERIFIED — unchanged from X.1]

- `validateX402AllowedOrigins(["https://marketplace.example.com"])` passes exactly one bare https origin.
- `validateX402AllowedOrigins(["*"])` → rejected. No `Access-Control-Allow-Origin: *` anywhere.
- `guard()` responses carry `content-type: application/json` and status 402; the `X-PAYMENT`/`PAYMENT-SIGNATURE` headers remain server-side concerns (consistent with the X.1 discovery: x402 headers are not browser-CORS-clean).

---

## 12. Live Payment Result [BLOCKED — honestly reported]

A genuinely **valid** payment requires an EIP-3009 signature produced by a real private key. This environment has **no externally supplied funded BNB Testnet wallet** (every external-signer env name is unset; see §13–§14), and the phase constraint forbids generating one. Therefore:

- The valid-payment (G) 200 branch is never executed; it is provably unreachable from any fixture.
- The runner exits 0 with the mandated message, and the phase closes as `READY FOR X.3` (not "complete live payment"). **No transaction or payment was submitted.**

---

## 13. Why No Payment Was Submitted [BLOCKED]

1. **No signer:** signing demands a wallet/private-key/session-signed authorization — none is supplied, and inventing one is explicitly forbidden. All presence-only checks against `FACILITATOR_KEY`, `X402_FACILITATOR_KEY`, `PRIVATE_KEY`, `WALLET_PRIVATE_KEY`, `ALTANA_PRIVATE_KEY`, `X402_PRIVATE_KEY`, `ALTANA_SIGNER`, `SIGNER_KEY`, `MNEMONIC`, `SEED_PHRASE` report unset.
2. **No facilitator:** settlement needs `MerchantOptions.facilitator` + an RPC URL + gas funding — external inputs X.2 intentionally does not possess.
3. **Test-fixture-only headers:** every fixture is labeled `TEST FIXTURE / NOT LIVE PAYMENT` and carries a forged signature.
4. **No on-chain read or write:** the flow is fully offline; the only live call anywhere in this regression is the pre-existing Phase-2 read-only native-balance probe.

---

## 14. Security Boundary / Key Handling [VERIFIED]

- Repo-wide grep for `PRIVATE_KEY|PRIVATEKEY|MNEMONIC|SEED_PHRASE|WALLET_PRIVATE_KEY|ALTANA_PRIVATE_KEY|X402_PRIVATE_KEY|FACILITATOR_KEY|FACILITATOR_SECRET|X402_API_KEY|8004SCAN_API_KEY|NEXT_PUBLIC_X402|NEXT_PUBLIC_8004SCAN|Bearer|Authorization` over `packages/integrations/src/altana`, `packages/config`, `apps/web`:
  - Only matches are env-var **names** (`X402_FACILITATOR_KEY_ENV`, the zod schema `8004SCAN_API_KEY` at `packages/config/src/env.ts:40`), documentation comments, and the skills redaction guard (`skills.verify.ts:215`). **No credential values.**
  - The only literal `0x`+64-hex is a zero-address nonce constant in `erc8183.verify.ts:103`.
- The harness itself asserts (section K) that none of `PRIVATE_KEY`, `FACILITATOR_KEY`, `WALLET`, `MNEMONIC` is set during the run, and never prints an env value.
- Generated-key consideration: a throwaway in-tree tool produced one fixture header during development to confirm decode/verify plumbing; the tool was deleted immediately, its key was discard-only (never committed, never stored), and the decision was made **not** to embed that header — a generated key contradicting the "never invent a wallet/key" rule must not appear in source. G is therefore reported BLOCKED, not fixture-signed.
- Every execution gate throws an explicit stop-message before any signing, approval, or network write.

---

## 15. Regression [IMPLEMENTED — all green]

`packages/integrations/src/altana/x402.testnet.verify.ts` — 16 checks across the 14 sections above, exits 0 offline. Runner: `pnpm --filter @bnb-marketplace/integrations altana:x402:testnet:verify` (`node dist/altana/x402.testnet.verify.js`). Requires a ≥120 s timeout for the cold viem load (~26 s), it does not hang.

```
ALTANA PHASE X.2 — x402 testnet flow verify (chain 97, keyless, no signing, no tx)
ok   config pinned: chain 97, eip3009/$U, fixture payTo, timeout ≤480, marker labeled
ok   challenge shape: B402 v2 exact/eip155:97/$U/payTo/amount/resource
ok   A: missing payment header -> 402 + challenge
ok   A/B: buyer parse accepts[] -> select eip3009 -> session boundary stop
ok   C: authorization constructed keylessly (EIP-3009 typed data), never signed
ok   B: undecodable X-PAYMENT -> 402 invalid X-PAYMENT
ok   C: eip155:56 header -> 402 wrong chain (chain 56 refused)
ok   D: authorization pays a different recipient -> 402 payTo mismatch
ok   E: value < price -> 402 amount below the quoted price
ok   F: expired (validBefore past) and not-yet-valid (validAfter future) -> 402
ok   G: forged signature rejected by merchant AND official verifyPayment (no key matches)
ok   H: paid/paymentVerified/txHash claims ignored — server only trusts crypto
ok   G/BLOCKED: live valid payment requires externally supplied funded BNB Testnet wallet — not attempted
ok   I: replay guard mirrors merchant.js (in-process seen + on-chain nonce); deterministic
ok   J: CORS explicit-origins only — no Access-Control-Allow-Origin: *
ok   K: no env credentials read, printed, or persisted by the verify path
ALTANA X402 X.2 STATUS: READY FOR X.3 (chain 97 flow verified keylessly; live signing BLOCKED — requires an externally supplied funded BNB Testnet wallet)
X402 TESTNET VERIFY: 16 checks passed
```

**Repo-wide regression (all green):** `pnpm lint` 12/12 · `pnpm typecheck` 12/12 · `pnpm build` 7/7 (incl. Next.js 15.5.23 production build, 18 routes) · `altana:verify` (Phase 2 incl. live chain-97 probe) · `altana:erc8183:verify` (Phase 3A) · `altana:skills:verify` (Phase 4) · `altana:x402:verify` (X.1) · `altana:x402:testnet:verify` (X.2). Frozen UI dirs untouched.

---

## 16. X.3 Requirements (Roadmap — Out of X.2 Scope)

X.3 delivery integration is **not** implemented here. To land it, an operator must supply:

1. **A funded BNB-testnet signer (or Altana session)** — the buyer path (`grantSession`, `approveSignatureChecker`, `signX402Payment`, `fetchWithX402`) becomes executable only with an externally supplied wallet/session. Without one, signing stays BLOCKED with the mandated message.
2. **A facilitator EOA + `FACILITATOR_KEY` + RPC URL** — only then can `createX402Merchant`/`settlePayment` run, and the X.2 zero-`txHash` receipt placeholder becomes a real on-chain hash.
3. **A real `payTo` account** — the seller's actual payout address (X.2 uses a TEST FIXTURE address).
4. **A real protected resource URL** — X.2 uses `x402.test.example` (fixture); X.3 will mount a route behind a real 402 merchant.
5. **Product decision on rail/token** — eip3009/$U (verified on 97) vs. a Permit2 rail (needs a settler `spender`); testnet USDT does not exist in the official registry.

Boundaries carried into X.3 unchanged: testnet-only (chain 56 refused), server-side only, no `*` CORS, no credential values in source, UI frozen (no Hire / payment / checkout / wallet UI).

---

**ALTANA X402 X.2 STATUS: READY FOR X.3** (chain 97 flow verified keylessly; server-side verify authority + failure matrix + replay + CORS all green; live signing and settlement BLOCKED — no externally supplied funded BNB Testnet wallet exists, no transaction or payment was submitted).
