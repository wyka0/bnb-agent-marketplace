# X.149 Production Hire Path + Submission Hardening

**Mode:** Production hardening only. **ZERO blockchain transactions** — no wallet signing, no createJob/registerJob/setBudget/approve/fund, no deployment, no commit, no push. No AWS/KMS, no new wallet, no new testnet job, no experimental transaction.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0` (unchanged; no commit/push/deploy; no `.env` modified).

---

## 1. Production Hire architecture (Model B — browser-wallet)

`apps/web/lib/activation/main-track-user-hire.ts` (framework-free, pure) implements the real flow:

```
USER → Marketplace → verified seller/quote → explicit confirmation →
user's EIP-1193 wallet → ERC-8183 sequence → marketplace-owned receipt
verification → independent on-chain verification → funded-commercial-hire
```

- Policy explicitly `model-b-v2-commercial-agreement` (`MAIN_TRACK_MODEL_B`). The Model-A/X.76 path (`/api/activation/hire`, `capability-source`, `main-track-v2.ts` MODEL A) is **untouched** and still fail-closed.
- The existing marketplace-client `/api/activation/main-track-hire` `review`/`activate` actions and the X.131 custody gate are **preserved** (all X.131 checks still pass).

## 2. Browser wallet custody

- `runMainTrackUserHireFromWallet` drives `createMainTrackUserWallet` (EIP-1193): `eth_requestAccounts`, `eth_chainId`, `eth_sendTransaction`. The wallet owns **nonce, gas, signing, submission**. Send params omit `nonce`/`gas` (verified in tests).
- The server NEVER receives a private key/mnemonic/seed/password and never signs. `prepare`/`receipt`/`verify` route actions are read-only and do **not** require server custody (the custody gate applies only to the marketplace-client path). No `eth_sendRawTransaction` is used for browser user transactions (enforced by the harness regex invariant).

## 3. ERC-8183 sequence

`createJob → registerJob → setBudget → approve → fund`, each: explicit per-step confirmation → `eth_sendTransaction` → marketplace-owned receipt verification (`/api/activation/main-track-hire` `action=receipt`, PublicNode reliable reader, bounded polling) → only then continue. A reverted/unconfirmable receipt **STOPS**; nothing is rebroadcast.

## 4. Fail-closed behavior

Explicit state machine: `idle → pending → negotiating → quote-verified → confirmation-required → creating-job → registering → setting-budget → approving → funding → verifying → funded-commercial-hire`; any failure → `failed`; user rejection → `cancelled`. No silent retry, no rebroadcast, no continuation after a failed step. FUNDED is never ACTIVE (all success paths return `active:false`, `activationState.state:"funded-commercial-hire"`).

## 5. Quote verification

`prepareMainTrackUserHire` requires: chain 97, seller == registry owner, verified quote signature with signer == seller, non-expired quote, price exactly `1 U`, official commerce / authoritative token / authoritative router, policy `0xd6a42175…` (decoded from registerJob calldata — never the stale `0x4f4678d4…`), allowlisted targets.

## 6. Target allowlisting

`USER_HIRE_ALLOWLIST` = pinned `MAIN_TRACK_COMMERCE/ROUTER/POLICY/PAYMENT_TOKEN/REGISTRY`; the plan builder rejects any non-allowlisted target and the wallet-time validation re-checks every call.

## 7. Historical-job protection

History `{622, 641, 646, 648, 649, 650, 651, 652, 653}`; a predicted job id colliding with history is rejected; the returned job id must be freshly created (verified on-chain in `verifyMainTrackUserHireFinalState`).

## 8. Error UX (mandated copy, encoded + tested)

- Wallet rejected → `Hire cancelled — no further transaction was submitted.`
- Transaction failed → `Hire stopped safely. No later Hire step was submitted.`
- Receipt unavailable → `Hire stopped while verifying the transaction. No rebroadcast was attempted.`
- Insufficient funds → `Insufficient testnet funds to complete this Hire.`
- RPC failure → `Network verification failed. Your transaction was not retried.`
- createJob succeeded but later verification failed → `Job created, but Hire could not be safely completed. No additional transaction was submitted.`

## 9. Judge journey

- Routes verified present via `next build`: `/`, `/marketplace`, `/agents`, `/compare`, `/categories/rebalancing`, `/categories/grid-trading`, `/categories/yield`, `/categories/health-factor`, agent detail pages.
- Agent detail page exposes a real **Hire** CTA (`MainTrackHireView` for chain-97 agents with an owner; the existing panel otherwise). Confirmation review shows Agent / Seller / Price (1 U) / Payment token / Chain / What will happen / user-controlled wallet / Expiry / cancellation behavior, then opens the wallet.
- Funded state displays as **funded commercial hire (escrow)** with `active:false` — never ACTIVE.

## 10. Four-category coverage

`/categories/rebalancing`, `/categories/grid-trading`, `/categories/yield`, `/categories/health-factor` all present in the build route map. Marketplace UI freeze preserved (no regressions to the existing badges/registry copy/search bar/divider styling — only additive Hire wiring).

## 11. Security audit

No stale claims found in the app (`guaranteed hiring`, `active scoped sessions`, `live agent monitoring`, `production execution`, `completed marketplace transactions` all absent). README updated to document the browser-wallet Main Track Hire path and keep it aligned (still fail-closed, never ACTIVE without evidence). No AWS/KMS/private-key requirements added.

## 12. Tests

New harness `apps/web/lib/activation/main-track-user-hire.verify.ts` (mocked EIP-1193, no tx) — **ALL CHECKS PASSED**: prepare success + all rejections (wrong chain, seller≠owner, invalid signature, wrong signer, expired quote, historical id), plan validation (wrong policy/target/calldata/price/commerce/token), wallet success sequence (5 sends, no nonce/gas, wallet-owned), wrong chain, wallet rejection at each step (cancelled), confirm-reject (0 sends), per-step failure (failed, no rebroadcast), per-step receipt failure (STOP), receipt timeout (STOP), final verification (success + all mismatches), mandated error copy, explicit state machine, and the invariants: no `eth_sendRawTransaction` invocation, no ACTIVE fabrication, no private-key handling in production code.

Regression (all pass): `main-track-user-hire` (X.149) · `activation:main-track` (X.131) · `activation` (33) · `hire` (23/23) · `hire-api` (14) · `capability-source` · `main-track-hire` (X.130) · `main-track-user-wallet` (X.139/X.137/X.134/X.142/X.144/X.146) · `hire-adapter` (X.127).

## 13. Build results

- Web: `typecheck` PASS · `lint` PASS · `next build` PASS (full production build emits all routes).
- Integrations: `typecheck` PASS · `lint` PASS · `build` PASS.
- Prettier formatted all changed files.

## 14. Git state

`HEAD` = `origin/main` = `850454da8f49f48285c31b8322215e55d37967a0`. New untracked files: `main-track-user-hire.ts`, `main-track-user-hire.verify.ts`, `main-track-receipt.server.ts`, `main-track-hire-view.tsx`; modified tracked files: `main-track-hire.api.ts`, `main-track-hire/route.ts`, `agent-detail-view.tsx`, `apps/web/package.json`, `README.md`. **No commit, no push, no deploy, no `.env` change.**

## 15. Remaining blockers (not hidden)

1. **Live funded hire in this deployment is fail-closed by design:** the production route's `prepare`/`verify` return an honest `main-track-prepare-blocked` / `main-track-verify-blocked` because live seller negotiation + job-counter prediction require the testnet seller service to be reachable from the deployment (not provisioned here). The flow is production-wired and proven end-to-end by the mocked EIP-1193 harness, but a live funded hire needs the seller endpoint reachable by the marketplace.
2. **X.148-class broadcast infrastructure behavior (E):** the viem-canonical ERC-8183 `createJob` was rejected at `eth_sendRawTransaction` by PublicNode and the current SDK seed node while a near-identical tx mined previously. This is unresolved RPC infrastructure behavior, outside the code/UX surface hardened here, and remains the second gate on a live funded hire.
3. No code defect, no UX/honesty gap, and no safety-model weakness were found in this audit.

## Classification

**B — MINOR SUBMISSION BLOCKER.**

The production Hire path is now complete, honest, user-controlled, fail-closed, tested, and judgeable (browser-wallet custody, explicit state machine, server-owned receipt/final verification, mandated error UX, allowlist + history protection, no ACTIVE fabrication, full build green). A **live funded hire** remains blocked by two external/infrastructure gates — the live seller endpoint reachability from the deployment and the X.148-class `eth_sendRawTransaction` infrastructure behavior — not by any code/UX/safety gap. These blockers are reported, not hidden. **STOP** after the report (no transaction, no deployment, no commit, no push).
