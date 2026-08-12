# Altana x402 — Phase X.1 Implementation (Buyer Adapter + Sell-Side Boundary + Verification)

**Phase:** X.1 — x402 foundation: offline BNB-testnet buyer adapter, official seller-package install + config/sell-side boundary, and a dependency-free verify harness.
**Status:** COMPLETE — `X402 X.1 STATUS: READY FOR X.2 (testnet-only, buyer adapter + seller boundary verified)`
**Date:** 2026-08-10
**Precedes:** X.2 — live buyer harness on chain 97 against a real 402 endpoint (sign + header + retry, assert 200).
**Validated against:** `docs/review/Altana-x402-Discovery.md`, `@altananetwork/sdk@0.7.0` (installed `dist/x402.{js,d.ts}`, `dist/client.d.ts`), and `@altananetwork/x402-server@0.2.0` (installed `dist/{index.d.ts,tokens.js,merchant.js,challenge.js,verify.d.ts,settle.d.ts,decode.d.ts}`).
**Tag legend:** IMPLEMENTED = shipped in this phase · VERIFIED = proven by an offline/regression check · BLOCKED = intentionally not done, with reason · NOT IMPLEMENTED = out of X.1 scope.

---

## 1. Exact Package + Version Installed [IMPLEMENTED]

Exactly one new dependency was added, from the official npm registry `latest` tag:

| Package                      | Version            | Source                                                                                         |
| ---------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `@altananetwork/x402-server` | `0.2.0` (`^0.2.0`) | npm registry `latest`; official `altananetwork/sdk` monorepo, `packages/x402-server` (GPL-3.0) |

Buyer-side rail reuses the already-pinned `@altananetwork/sdk@0.7.0` — no SDK upgrade, no other dependency touched. `packages/integrations/package.json` now declares `"@altananetwork/x402-server": "^0.2.0"`.

The package is **pure ESM with no Bun runtime import**. `Bun.serve` appears only in the official README example (caller-side), not in the distributed code — it can run under plain Node. Verified by executing `import("@altananetwork/x402-server")` under node and observing exports load.

---

## 2. Buyer Adapter — `packages/integrations/src/altana/x402.ts` [IMPLEMENTED]

New adapter following the established Phase-3A/4 container pattern (`altana/xxx.ts` + `xxx.verify.ts` + `altana/index.ts` re-export + `altana:xxx:verify` package script).

**Constants:**

- `ALTANA_X402_NETWORK = "bnb-testnet"` · `ALTANA_X402_CHAIN_ID = 97`
- `ALTANA_X402_SERVER_PACKAGE = "@altananetwork/x402-server"` · `ALTANA_X402_SERVER_VERSION = "0.2.0"`
- `X402_FACILITATOR_KEY_ENV = "FACILITATOR_KEY"` (official README env name; documented only, never read this phase)
- `ALTANA_X402_PERMIT2_ADDRESS = PERMIT2_ADDRESS` (from SDK)
- Stop-messages: `X402_EXECUTION_REQUIRES_SESSION`, `X402_APPROVAL_REQUIRES_WALLET`, `X402_SELL_SIDE_REQUIRES_FACILITATOR`

**Error classes:** `AltanaX402Error` (base) · `AltanaX402NetworkError` · `AltanaX402ConfigError` · `AltanaX402ExecutionError`.

**Buyer functions:**

- `getX402Network(input)` — resolves `bnb-testnet`/`bsc-testnet`/`eip155:97`/`97`/`97-number` → chain 97; **rejects** `bnb`/`bsc`/`binance`/`eip155:56`/`56`/`eth`/unknown with `AltanaX402NetworkError`.
- `createX402Client()` — `client.network === "bnb-testnet"` (never mainnet), client's default chain is 97; exposes the SDK `PERMIT2_ADDRESS`.
- `parsePaymentRequired(body)` — parses the `accepts[]` requirement array (the B402 v2 shape emitted by `buildChallenge`), tolerates the bare-requirement dialect, runs each URI through the SDK `normalizeResource`, carries `x402Version` when present, and prefers the **permit2-exact** rail when multiple are offered.
- `requestWithX402(...)` — the boundary gate: **throws** `AltanaX402ExecutionError` when no session is supplied (`X402_EXECUTION_REQUIRES_SESSION`) and refuses mainnet first. No signing, no `X-PAYMENT` emission, no network I/O in this phase.

`ALTANA_SDK_PACKAGE` / `ALTANA_SDK_VERSION` are intentionally **not** exported from `x402.ts` (they already come from `./client.ts` via the index star-export — exporting again would collide).

---

## 3. BNB Testnet Enforcement (Chain 97 Only) [IMPLEMENTED]

- `getX402Network` is a single-source gate: chain 97 is the only accepted value; mainnet 56 and every unknown chain raise `AltanaX402NetworkError` with the offending input named.
- `createX402Client` pins `bnb-testnet`; the client carries `chainId 97`.
- `requestWithX402` refuses mainnet **before** the session check (defense-in-depth: a future caller cannot even pass a 56 requirement into the sign path).
- There is **no env switch** that can enable mainnet; there is no mainnet code path.

---

## 4. Permit2 Rail [VERIFIED]

- `PERMIT2_ADDRESS = 0x000000000022D473030F116dDEE9F6B43aC78BA3` (canonical, from `@altananetwork/sdk`).
- SDK typed-data builders confirmed loadable: `buildPermit2TypedData`, `buildPermit2WitnessTypedData`, `buildEip3009TypedData`, plus `signX402Payment`, `selectX402Requirement`, `encodeXPaymentHeader`, `networkToChainId`, `normalizeResource`.
- `selectX402Requirement` prefers **permit2-exact** when the requirement set offers it (the Studio-recommended reliable rail).
- Approval surface (`approveSignatureChecker`, `approveTokenForPermit2`) requires `wallet + signer + session` — X.1 therefore performs **no approval** and no `approve`/`permit2` message construction. Boundary message: `X402_APPROVAL_REQUIRES_WALLET`.

---

## 5. Seller Package Availability + API Surface [VERIFIED]

`@altananetwork/x402-server@0.2.0` installed; the following exports are confirmed present:

- `createX402Merchant` → `{ challengeBody, requirePayment, guard }`
- `buildChallenge`, `effectivePrice`, `decodeXPayment`, `verifyPayment`, `settlePayment`, `witnessHash`
- `U_TOKEN` (`Record<56|97, TokenConfig>`), `USDT_BSC`
- Types: `MerchantOptions` (`= MerchantConfig & { facilitator: Account; rpcUrl: string; chain? }`), `HandleResult`, `MerchantConfig`, `RailConfig`, `VerifyResult`, `PaymentReceipt`, `DecodedPayment`, `ChallengeAccept`, `ChallengeBody`

Behavior notes (from installed source):

- `guard(request)` / `requirePayment(header)` — request- vs header-style challenge/verification.
- `verifyPayment` uses `publicClient.verifyTypedData` (ERC-1271/ERC-6492 capable) with an `isContract` defer-to-settlement path.
- `buildChallenge` emits B402 v2 wire: `scheme: "exact"`, `eip155:N`, `extra.assetTransferMethod`, default `maxTimeoutSeconds: 300` (≤ 480 for Studio compatibility), `spenderAddress` for permit2-exact.
- `merchant.js` constructs viem public+wallet clients at merchant build time (no import-time side effects).

---

## 6. Token Result — Sell-Side Pricing Token on 97 [RESOLVED, VERIFIED]

**The Phase-1 discovery blocker (§15.1) is resolved using the official package registry as the source of truth.**

| Network      | Token                                         | Address                                      | Source                                                                                                                    |
| ------------ | --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 97 (testnet) | $U (United Stables, "U", version "1", 18 dec) | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` | `U_TOKEN[97]` — cross-confirmed **identical** to the ERC-8183 `paymentToken` from Phase 3A (§2) and the SDK address table |
| 56 (mainnet) | $U                                            | `0xcE24439F2D9C6a2289F741120FE202248B666666` | `U_TOKEN[56]` (rejected by the adapter — never used)                                                                      |
| 56 (mainnet) | USDT (BSC)                                    | `0x55d398326f99059fF775485246999027B3197955` | `USDT_BSC` — **MAINNET ONLY**                                                                                             |

The installed registry's source comment states both $U addresses were verified against the live `DOMAIN_SEPARATOR()` of the respective deployments. **No testnet USDT address exists** in the official registry; `USDT_BSC` is explicitly mainnet-only. Any testnet USDT merchant price would be fabricated — so this phase documents **no testnet USDT** and keeps sell-side pricing to $U/97.

---

## 7. Facilitator Result — Sell-Side Custody Boundary [BLOCKED by design, VERIFIED]

- The merchant **settler is a viem `Account`** (an EOA whose role is gas-only settlement; the actual recipient is bound into the buyer's signature). It is supplied via `MerchantOptions.facilitator`.
- The official README reads it from the **`FACILITATOR_KEY`** env var. This phase does **not** fabricate or inject any credential:
  - `checkX402Facilitator()` always returns `{ configured: false, env: "FACILITATOR_KEY", reason }` — custody is not held by the marketplace.
  - `assertX402SellSideBoundary()` **always throws** `AltanaX402ExecutionError` (`X402_SELL_SIDE_REQUIRES_FACILITATOR`) — `createX402Merchant` is never constructed.
- X.2 sell-side would require: an externally supplied facilitator EOA key, a real `payTo` account, a funded wallet, and an https-capable server — none fabricated here.

---

## 8. CORS / Origin Boundary [IMPLEMENTED]

- `validateX402AllowedOrigins(origins)` rejects `"*"`, rejects non-`http(s)` origins, and requires explicit origin entries. No wildcard is ever accepted.
- Consistent with the discovery finding that `fetchWithX402` must run **server-side** (the `X-PAYMENT` header is not browser-CORS-clean). No browser exposure of any x402 header or key.

---

## 9. Environment Variables [IMPLEMENTED — none added]

- `packages/config/src/env.ts` is **unchanged**: no x402 env vars were introduced.
- `FACILITATOR_KEY` is referenced only as a documented constant (`X402_FACILITATOR_KEY_ENV`) — it is never read, typed, or defaulted in this phase, so no invented env schema exists.
- No `NEXT_PUBLIC_X402_*` anything.

---

## 10. Security Boundary / Key Handling [VERIFIED]

- Security grep over `packages/integrations/src/altana`, `packages/config`, `apps/web` for `PRIVATE_KEY|PRIVATEKEY|MNEMONIC|SEED_PHRASE|WALLET_PRIVATE_KEY|ALTANA_PRIVATE_KEY|X402_PRIVATE_KEY|FACILITATOR_SECRET|X402_API_KEY|8004SCAN_API_KEY|NEXT_PUBLIC_X402|NEXT_PUBLIC_8004SCAN|Bearer|Authorization`:
  - **Zero** matches in `packages/integrations/src` (the only 64-hex string is a zero-address constant in `erc8183.verify.ts`).
  - `8004SCAN_API_KEY` appears only as a pre-existing **env-var name** in the zod schema (`packages/config/src/env.ts:40`) and its existing server-side reader — no value anywhere.
  - `.next/` build artifacts contain only Next.js-internal false positives.
- No `process.env` reads exist in the altana adapter source.
- All execution gates throw explicit stop-messages before any signing, approval, or network write.

---

## 11. Relationship to ERC-8183 [VERIFIED — kept separate]

- x402 and ERC-8183 remain **separate protocols** (per-call paid API vs hire-and-escrow). Shared future layer is the Altana session/ERC-1271 signing, which X.1 does not wire.
- The $U on 97 is confirmed to be the **same token** for both (`0xc70B8741...E5565` = ERC-8183 `paymentToken` = `U_TOKEN[97]`) — one price token on testnet.
- `skills.ts` / `ALTANA_CERTIFIED_SKILLS` are **unchanged**: `x402-payments` stays out of the certified registry (Phase-4 rule preserved; `altana:skills:verify` still exits 0).
- Frozen UI dirs untouched; no Hire, no payment UI, no x402 entry point.

---

## 12. Tests [IMPLEMENTED — all green]

`packages/integrations/src/altana/x402.verify.ts` — dependency-free, offline harness (no RPC, no signing, no tx). Runs under `pnpm --filter @bnb-marketplace/integrations altana:x402:verify` → `node dist/altana/x402.verify.js`. 27 checks across 14 sections:

```
ok   network resolution: bsc-testnet|bnb-testnet|eip155:97|97 -> chain 97
ok   network "bnb"/"bsc"/"binance"/"eip155:56"/56/"56"/"eth"/999/null rejected -> AltanaX402NetworkError
ok   parse B402 accepts[]: requirements + resource + version carried; permit2 preferred
ok   parse bare dialect; empty/non-object bodies fail
ok   createX402Client -> bnb-testnet chain 97 permit2=0x0000...BA3
ok   Permit2 surface resolves: PERMIT2_ADDRESS + typed-data builders loaded
ok   requestWithX402 stops without a session -> AltanaX402ExecutionError
ok   requestWithX402 rejects mainnet before session checks -> AltanaX402NetworkError
ok   requestWithX402 boundary stops (no session, no auto-submit; mainnet refused)
ok   seller package @altananetwork/x402-server@0.2.0 + createX402Merchant available (not constructed)
ok   valid MerchantConfig (chain 97, eip3009/$U) passes validation
ok   merchant config rejects zero payTo/price, bad timeout, bad spender, empty rails, mainnet
ok   facilitator boundary: configured=false, env=FACILITATOR_KEY (no credential fabricated)
ok   tokens: chain 97 $U=0xc70B8741...E5565 (cross-confirms ERC-8183 paymentToken)
ok   CORS boundary: explicit origins only, no wildcard, bare http(s) origins
ok   missing handling: unknown chain -> no token, no facilitator credential present
ok   merchant creation refused -> AltanaX402ExecutionError
ok   sell-side boundary enforced ("createX402Merchant requires an externally supplied facilitator EOA ... No merchant was created, no settlement was broadcast.")
ALTANA X402 STATUS: READY FOR X.2 (testnet-only, buyer adapter + seller boundary verified)
```

**Repo-wide regression (all green):** `pnpm lint` 12/12 · `pnpm typecheck` 12/12 · `pnpm build` 7/7 (incl. Next.js production build, 18 routes) · `altana:verify` (Phase 2, incl. live chain-97 probe) · `altana:erc8183:verify` (Phase 3A) · `altana:skills:verify` (Phase 4) — no regression from the new package or adapter.

Note on harness runtime: cold-loading `@altananetwork/x402-server` (viem) on this machine takes ~26 s; the verify run needs a ≥120 s timeout, it does not hang — it exits 0.

---

## 13. Real Transaction Submitted? [VERIFIED — NONE]

**NO.** No signature was produced, no approval, no `X-PAYMENT` header, no settlement, no network write. The only live call in this phase's regression was the pre-existing Phase-2 read-only native-balance probe. Every action path ends in an explicit stop-message throw.

---

## 14. Blockers / Open for X.2 [BLOCKED by design]

1. **No live 402 endpoint identified for the X.2 integration test** — a real 402 source (or a repo-owned local merchant on a test RPC) is required to prove sign → `X-PAYMENT` → retry → 200.
2. **No session key / signer decision yet** — `fetchWithX402` needs `{ wallet, signer, session }` (the Phase-3A open question remains open; X.2 needs an externally supplied funded BNB-testnet wallet or the future session path).
3. **Sell-side custody stays external** — facilitator EOA (env `FACILITATOR_KEY`), `payTo`, funded wallet, and an https server are all X.2/X.3 inputs; the marketplace does not hold them.
4. **No testnet USDT** in the official registry — if a $U-only price is unacceptable for a given seller, that is a product decision, not an adapter fix.

---

## 15. Phase X.2 Plan

| Step | Content                                                                                                                                                                                    | Gate                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| X.2a | Live buyer harness on 97: session-provided wallet/signer → `fetchWithX402` against a real 402 endpoint (or repo-owned local merchant on test RPC) → assert 200 and correct final resource. | testnet wallet/session + a live 402 source      |
| X.2b | Provisioning flow: `approveTokenForPermit2` + `approveSignatureChecker` for the $U/97 rail (first-use approval, testnet only).                                                             | testnet wallet/session                          |
| X.2c | Optional local seller smoke: `createX402Merchant` on 97 with the facilitator EOA supplied by the operator (no credentials in source).                                                      | external facilitator key + https-capable server |
| X.3  | Delivery integration: server route/worker wrapper, spend-limit surfacing, audit trail of paid requests.                                                                                    | UI still frozen                                 |

---

## 16. Decision

- x402 ships as a **peer adapter** (like ERC-8183), **testnet-only**, **server-side**, **permit2-exact-preferred**, with an explicit **sell-side custody boundary** until an operator supplies the facilitator.
- The Phase-1 seller-token blocker is cleared using the official package registry (chain-97 $U cross-confirmed with ERC-8183); testnet USDT is honestly reported as unavailable.
- No code, env, or package change enables spending or mainnet; repo stays green and keyless.

**X402 X.1 STATUS: READY FOR X.2** (testnet-only, buyer adapter + seller boundary verified; live harness requires a session/wallet and a 402 source).
