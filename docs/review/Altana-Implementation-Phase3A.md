# Altana — Implementation Report · Phase 3A (ERC-8183 Foundation + BNB Testnet Lifecycle Verify)

**Phase:** 3A — ERC-8183 integration foundation for the fetch-escrow agent-to-agent flow.
**Status:** COMPLETE — `ALTANA ERC8183 STATUS: READY FOR IMPLEMENTATION (testnet-only, no tx submitted)`
**Date:** 2026-08-09
**Precedes:** Phase 3B — signing/submission wiring (external signer or session), Hire UI, sessions, skills, x402, mainnet.
**Validated against:** `docs/review/Altana-Implementation-Phase2.md`, `docs/review/Altana-Integration-Discovery.md`, and `@altananetwork/sdk@0.7.0` (installed `dist/erc8183.{js,d.ts}`, `dist/client.d.ts`, `dist/config.d.ts`, `dist/execute.d.ts`, `dist/internal/relay.d.ts`).

---

## 1. SDK APIs Used (real `@altananetwork/sdk@0.7.0` surface)

No invented signatures; every call below was verified against the installed SDK type declarations and runtime.

**Construction + reads (used):**

| SDK export                                                        | Where it is used                              | Purpose                                                                                           |
| ----------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `erc8183Addresses(chainId)` / `ERC8183_ADDRESSES`                 | `getErc8183Addresses`, `resolveErc8183Config` | Address table resolution — no addresses hardcoded in the adapter (testnet-gated wrapper).         |
| `buildHireCalls(input)`                                           | `prepareErc8183Hire`                          | The atomic 5-call hire batch (`createJob` → `registerJob` → `setBudget` → `approve $U` → `fund`). |
| `buildClaimRefundCall(chainId, jobId)`                            | `buildErc8183ClaimRefundCall`                 | `claimRefund` call construction (after-expiry escrow reclaim), testnet-gated.                     |
| `getErc8183Job(network, jobId)`                                   | `getErc8183Job`                               | Read a job from the AgenticCommerce kernel.                                                       |
| `getErc8183DeliverableUrl(network, jobId, opts?)`                 | `getErc8183Deliverable`                       | Locate the deliverable URL via the policy's `JobInitialised` event + `optParams` JSON.            |
| `JOB_STATUS`                                                      | `KNOWN_JOB_STATUSES`                          | Status-name validation set (`OPEN/FUNDED/SUBMITTED/COMPLETED/REJECTED/EXPIRED`).                  |
| `BNB`, `BNB_TESTNET` (config), `NetworkConfig`, `Client`          | `erc8183NetworkFromClient`, builds            | Network config source for testnet (97).                                                           |
| `Call`, `Erc8183Addresses`, `Erc8183Job`, `JobStatusName` (types) | adapter/verify                                | SDK-native types re-exported + used in normalized results.                                        |

**Explicitly NOT called (documented boundary):** `hireErc8183Agent`, `settleErc8183Job`, `execute`, `signerFromPrivateKey` / `createPrivateKeySigner`, session helpers, x402 helpers. Every submission intent funnels through `assertErc8183SigningBoundary`, which **always throws**.

---

## 2. ERC-8183 Addresses + Source

Source: `@altananetwork/sdk@0.7.0` — `dist/erc8183.js` `ERC8183_ADDRESSES` (SDK comment: "Per-network deployment of the ERC-8183 stack (from the bnbagent registry)"). The adapter never hardcodes an address; it resolves through `erc8183Addresses(chainId)` behind a testnet-only gate. Values below are transcribed from the installed SDK and pinned by the verify harness.

**Testnet — BSC chain 97 (the only chain ERC-8183 is enabled on this phase):**

| Contract                                | Address                                      |
| --------------------------------------- | -------------------------------------------- |
| AgenticCommerce (`commerce`)            | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` |
| EvaluatorRouter (`router`)              | `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` |
| OptimisticPolicy (`policy`)             | `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6` |
| ERC-8004 identity registry (`registry`) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| $U payment token (`paymentToken`)       | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` |

**Mainnet — BSC chain 56 (REJECTED, never resolved by the adapter):**

| Contract       | Address                                      |
| -------------- | -------------------------------------------- |
| `commerce`     | `0xEa4DAa3100A767e86FDed867729ae7446476EBA6` |
| `router`       | `0x51895229E12F9876011789B04f8698af06cCD6DA` |
| `policy`       | `0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5` |
| `registry`     | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| `paymentToken` | `0xcE24439F2D9C6a2289F741120FE202248B666666` |

`assertErc8183TestnetChainOnly(chainId)` throws `AltanaErc8183NetworkError` for chain 56 and any unknown chain. Mainnet **cannot** be enabled via an env switch; there is no mainnet code path.

---

## 3. BNB Testnet Configuration

- Target: **BNB Smart Chain Testnet, chain id 97**, via the SDK's `BNB_TESTNET` config (documented: standalone testnet account stack; relay serves chain 97 only).
- Verified at runtime by the Phase-3A harness: `keyStore 0x6b8361C29d05D498b1a12B54A37310f94171E94A`, relay `https://testnet-relay.altana.network`, `$U` payment token `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`.
- **Live lifecycle read:** the testnet kernel already contains a funded job (job 1, `FUNDED`, client `0xe376F3E7Fb15B526152F0db6805F1002564cbC2B`, budget `1000000000000000000` raw $U = 1 $U) — a real prior testnet hire. The harness read it through the adapter's `getErc8183Job` and derived `settlement=none`, `deliverable=pre-submission` (FUNDED jobs have no deliverable). No transaction was submitted to reach this state; it was pre-existing on the shared testnet.

---

## 4. Files Changed

### Added

- `packages/integrations/src/altana/erc8183.ts` — typed ERC-8183 adapter (Phase 3A core; see §5).
- `packages/integrations/src/altana/erc8183.verify.ts` — ERC-8183 verify + BNB testnet lifecycle harness (QA gate, exit 0/1; see §10).
- (generated) `packages/integrations/dist/altana/erc8183.{js,d.ts}` and `dist/altana/erc8183.verify.js`.

### Modified

- `packages/integrations/src/altana/index.ts` — updated module header (Phase 2 → 3A) and re-exports `./erc8183.js` (public surface only; no duplicate wrappers).
- `packages/integrations/package.json` — added `"altana:erc8183:verify": "node dist/altana/erc8183.verify.js"`.

### Untouched (per constraints)

Frozen UI (`apps/web/app/(app)/agents/[slug]/`, `marketplace/`, `compare/`, `leaderboards/`), `apps/web`, `packages/ui`, worker logic, prisma, `.env`, config env schema. No new SDK dependencies (Phase 2 already installed `@altananetwork/sdk@0.7.0` + peers).

---

## 5. Adapter Architecture — `packages/integrations/src/altana/erc8183.ts`

Extends the existing `packages/integrations/src/altana/` extension point (no second package, no duplicated client init — it builds on the Phase-2 `client.ts` facade and the SDK's own `BNB_TESTNET`).

**Exported constants:** `ALTANA_ERC8183_CHAIN_ID = 97`, `ALTANA_ERC8183_NETWORK = "bnb-testnet"`, `ERC8183_MAX_DESCRIPTION_BYTES = 4096`, `ERC8183_EXECUTION_REQUIRES_SIGNER` (the required stop message).

**Exported errors** (all extend `AltanaErc8183Error`): `NetworkError`, `ConfigError`, `JobParamError`, `JobNotFoundError`, `JobStateError`, `DeliverableError`, `SettlementError`, `DisputeError`, `RefundError`, `ExecutionError`.

**Exported functions / normalized types:**

| Function                                                        | Behavior                                                                                                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getErc8183Addresses(chainId)`                                  | testnet-gated `erc8183Addresses(chainId)`.                                                                                                                                             |
| `resolveErc8183Config(chainId)`                                 | `{ chainId: 97, addresses, commerce, router, policy, registry, paymentToken }`.                                                                                                        |
| `erc8183NetworkFromClient(client)`                              | extract + validate a client's `NetworkConfig` snapshot (rejects non-97 clients).                                                                                                       |
| `validateErc8183HireInput(input)`                               | pure guard: non-zero checksummed `provider`, non-empty description ≤ 4096 bytes, `budget > 0`, future `expiredAt`, `jobId > 0`.                                                        |
| `prepareErc8183Hire(network, input)`                            | pure: validate + build the SDK's atomic 5-call hire batch → `Erc8183HireDraft { network, config, job, calls }`. Nothing submitted.                                                     |
| `getErc8183Job(network, jobId)`                                 | SDK `getErc8183Job` wrapper + shape validation (id match → kernel-zero = `JobNotFoundError`; unknown status → `JobStateError`; RPC/read failure → `ExecutionError`).                   |
| `parseErc8183Deliverable(optParamsJson)`                        | pure: accepts only `{"deliverable_url": "https?://…"}`; rejects malformed JSON / missing field / non-http(s).                                                                          |
| `getErc8183Deliverable(network, jobId, opts?)`                  | on-chain lookup; pre-submission → `pre-submission`; URL re-validated as http(s). Deliverables are **untrusted data**: only the URL is surfaced, nothing downloads or executes content. |
| `getErc8183SettlementStatus(job, now?)`                         | pure: `COMPLETED` + window elapsed → `approve`; `SUBMITTED` → `dispute`; else `none`.                                                                                                  |
| `buildErc8183ClaimRefundCall(chainId, jobId)`                   | testnet-gated `buildClaimRefundCall` wrapper.                                                                                                                                          |
| `assertErc8183TestnetChainOnly` / `assertErc8183TestnetNetwork` | hard chain-97 boundary.                                                                                                                                                                |
| `assertErc8183SigningBoundary(operation)`                       | returns `never`; **always** throws `AltanaErc8183ExecutionError` with the "No transaction was submitted" message.                                                                      |

**Marketplace metadata vs protocol data:** the adapter never conflates marketplace content with ERC-8183 protocol fields. Deliverable content is treated as untrusted (URL only).

---

## 6. Hire Boundary (construction only, no signing)

`prepareErc8183Hire` produces the SDK's five-call batch (`createJob` on commerce hooking the router, `registerJob` binding the policy, `setBudget`, `approve` $U to commerce, `fund`) — verified by the harness to be exactly 5 calls with correct targets. The batch is **constructed but never submitted**: `hireErc8183Agent` / `settleErc8183Job` / `execute` are not wired, and the adapter contains no signer, session, or wallet credential.

---

## 7. Job Lookup + Deliverable Handling

- Job read: `getErc8183Job(BNB_TESTNET, jobId)` → typed `Erc8183Job` (status + `statusName`). Shape validation catches a stolen/concurrent predicted id (kernel id mismatch) and unknown statuses.
- Deliverable: `getErc8183Deliverable` first confirms the job has `submittedAt > 0`; then wraps the SDK's bounded `getLogs` scan (`JobInitialised` event → `optParams` JSON). The returned URL is re-validated to `https?://`. Pre-submission and not-found are distinct, non-fatal outcomes.

---

## 8. Settlement / Dispute / Claim-Refund

- `getErc8183SettlementStatus`: COMPLETED + window elapsed → `approve` available (Router.settle); SUBMITTED → `dispute` available (Policy.dispute, client-only, inside window); OPEN/FUNDED/etc → `none`.
- `buildErc8183ClaimRefundCall(97, jobId)` → `claimRefund` call on commerce (after-expiry, seller never delivered). Chain 56 and non-positive job ids rejected.
- **None of these are submitted** — they only build typed calls / derive state; the signing boundary stops execution (see §6/§9).

---

## 9. Security Model

1. **Testnet-only, hard-gated** — chain 97 is the only ERC-8183 chain; 56/unknown rejected with no env switch to enable mainnet.
2. **No credentials** — no private keys, mnemonics, seed phrases, session keys, or API keys in source. Security scan for `PRIVATE_KEY | PRIVATEKEY | MNEMONIC | SEED_PHRASE | WALLET_PRIVATE_KEY | ALTANA_PRIVATE_KEY | 8004SCAN_API_KEY` and `0x…64-hex` literals: **clean** in `src/altana/` (the one 64-hex match is the documented 32-bytes-of-zero `deliverable` constant in a test fixture).
3. **No transaction submission** — the only execution path is `assertErc8183SigningBoundary` → `never` throw. If a future phase needs submission, it requires an externally supplied funded testnet wallet and must stop otherwise (per sprint requirement).
4. **Untrusted deliverables** — URL-only surfacing; no download/execute.
5. **Server-only** — adapter lives in `packages/integrations`; `apps/web` does not import it (Phase-2 invariant preserved).

---

## 10. Test Strategy + Results

`pnpm --filter @bnb-marketplace/integrations altana:erc8183:verify` (after `pnpm build`) runs `node dist/altana/erc8183.verify.js`. Fixtures are marked **TEST FIXTURE / NOT LIVE DATA**. Sections: (1) testnet-only address resolution; (2) client `NetworkConfig` extraction; (3) hire input validation; (4) 5-call hire construction; (5) deliverable parsing; (6) settlement derivation; (7) claimRefund construction; (8) signing boundary for every operation; (9) best-effort BNB testnet job lifecycle read (INFO when no job, SKIP when RPC unreachable — never a hard failure).

Executed result (exit 0):

```
ok   chain 97 resolves commerce/router/policy/registry/paymentToken from SDK table
ok   getErc8183Addresses rejects chain 56 (mainnet) -> AltanaErc8183NetworkError
ok   resolveErc8183Config rejects chain 56 (mainnet) -> AltanaErc8183NetworkError
ok   getErc8183Addresses rejects unknown chain 999 -> AltanaErc8183NetworkError
ok   client -> network=bnb-testnet chainId=97 keystore=0x6b8361C29d05D498b1a12B54A37310f94171E94A
ok   erc8183NetworkFromClient rejects a chain-56 client -> AltanaErc8183NetworkError
ok   valid hire input passes validation
ok   hire input rejects zero provider -> AltanaErc8183JobParamError
ok   hire input rejects malformed provider -> AltanaErc8183JobParamError
ok   hire input rejects empty description -> AltanaErc8183JobParamError
ok   hire input rejects description over 4096 bytes -> AltanaErc8183JobParamError
ok   hire input rejects non-positive budget -> AltanaErc8183JobParamError
ok   hire input rejects past expiredAt -> AltanaErc8183JobParamError
ok   hire input rejects non-positive predicted jobId -> AltanaErc8183JobParamError
ok   hire draft = 5-call atomic batch (createJob/registerJob/setBudget/approve/fund), chain 97
ok   prepareErc8183Hire rejects a mainnet (chain 56) NetworkConfig -> AltanaErc8183NetworkError
ok   prepareErc8183Hire propagates job-param validation -> AltanaErc8183JobParamError
ok   deliverable parse accepts http(s) URL, rejects garbage/missing/non-http
ok   settlement derivation rejects unknown status -> AltanaErc8183JobStateError
ok   settlement: COMPLETED->approve, SUBMITTED->dispute, OPEN->none
ok   buildErc8183ClaimRefundCall rejects chain 56 -> AltanaErc8183NetworkError
ok   buildErc8183ClaimRefundCall rejects non-positive jobId -> AltanaErc8183JobParamError
ok   claimRefund call builds on chain 97; chain 56 rejected
ok   signing boundary stops "hire" submission -> AltanaErc8183ExecutionError
ok   signing boundary stops "settle" submission -> AltanaErc8183ExecutionError
ok   signing boundary stops "dispute" submission -> AltanaErc8183ExecutionError
ok   signing boundary stops "claim-refund" submission -> AltanaErc8183ExecutionError
ok   signing boundary enforced for every submit operation ("Transaction execution requires an externally supplied testnet wallet/funding. No transaction was submitted.")
ok   testnet kernel read job 1: status=FUNDED client=0xe376F3E7Fb15B526152F0db6805F1002564cbC2B budget=1000000000000000000
ok   testnet job lifecycle: settlement=none(job is FUNDED; no settlement/dispute action is available.) deliverable=pre-submission
ALTANA ERC8183 STATUS: READY FOR IMPLEMENTATION (testnet-only, no tx submitted)
```

Repo-wide gates also run and pass (`pnpm lint` 12/12, `pnpm typecheck` 12/12, `pnpm build` 7/7 incl. Next.js production build). The Phase-2 runner (`altana:verify`) still exits 0 (no regression).

---

## 11. Real Transaction Submitted?

**NO.** No hiring, settling, disputing, refund, or funding transaction was submitted by any code in this phase. The live `FUNDED` job 1 observed on the testnet kernel is pre-existing (created by an out-of-band testnet hire), and the harness only read it. Any future submission requires an externally supplied funded testnet wallet/signer; absent that, execution stops with `ERC8183_EXECUTION_REQUIRES_SIGNER`.

---

## 12. Phase 3B — Required Inputs / Blocker

Phase 3B (signing/submission wiring) needs, explicitly:

1. **An externally supplied, funded BNB testnet wallet** (legitimate testnet $U + BNB for gas via the relay, which handles gas) and a decided signing authority:
   - **admin path:** `signerFromPrivateKey`/`createPrivateKeySigner` (credentials must come from a secret manager, never source), or
   - **session path:** `client.grantSession` + scoped session key (least-privilege `calls`/`spend` allowlists) in the future Altana session phase.
2. A **provider address** (an ERC-8183 seller, e.g., BNB Agent Studio's registered address on chain 97) to hire against.
3. Predicted-`jobId` handling (`jobCounter() + 1`) with retry on concurrent `createJob` (SDK behavior; batch reverts harmlessly, re-read and retry).
4. Post-submission verification reads (`getErc8183Job` → FUNDED; client-owns-job check) before surfacing a job.
5. Decision on **marketplace recording** of ERC-8183 jobs (currently no Prisma/DB job persistence — matches Phase 3A scope; metadata stays separate from protocol data).

Nothing in Phase 3A blocks compile-time work on the UI/session scaffolding for Phase 3B, but no transaction-level testing can proceed until item 1 is supplied.
