# X.169 — Final Partner-Track Eligibility + Submission Audit

**Date:** 2026-08-30 · **Mode:** READ-ONLY AUDIT · **Transactions:** ZERO · **Wallet signing:** NONE · **Hire execution:** NONE · **Job 787:** UNTOUCHED

> All checks are read-only. No blockchain transaction, no Hire click, no Job 788/789, no Agent 2005/1906 modification, no registration, no approval/funding, no wallet creation, no AWS/KMS/VPS, no Model-B flow change. Evidence is cited to a file path or a live read-only probe; claims without evidence are marked NOT QUALIFIED.

---

## 0 · Official rubric — authoritative source (Phase 1)

**Retrieved 2026-08-30 (UTC) from the current official BNB Chain Tracks page `https://www.bnbchain.org/en/hackathons/smart-money-era` (and linked blog `https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace`) via `WebFetch` as authoritative. No old project notes were used as primary source.**

| Track           | Exact current requirement (verbatim summary from official page)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Source section                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Main**        | Build the best agent marketplace for BNB Chain. Four categories **all first-class**: Rebalancing (manages LP ranges), Grid Trading (grid orders), Yield Optimisation (routes to highest APR), Health Factor Monitoring (protects from liquidation). Judged on **Functionality** (land→find by category→understand→activate with minimal friction, zero Agent Studio knowledge), **Data Quality** (real-time accurate beyond basic counts, genuinely informed hire), **Agent Diversity** (all four equal depth). Must be functional + publicly accessible during judging; agents live on BSC. | Tracks → Main Track Prize + What You're Building + How You're Judged |
| **Altana**      | **Best Built with Altana** — 50,000 XP. To be considered: live onchain txs in Altana explorer (testnet counts, mainnet stronger) showing **agents on own Altana wallets + sessions with real limits (call allowlist, spend cap, expiry) registered in Keystore + real session-key tx + user-facing control (see permissions + revoke)**. Bonus: hire BNB Agent Studio agents via Altana ERC-8183 SDK + x402/B402 selling.                                                                                                                                                                    | Tracks → Best Built with Altana (5 bullets + Bonus)                  |
| **TermiX**      | **TermiX Challenge** — $10,000 (6k/3k/1k). Judged: Value of services 30% + Proven advantage 30% + High-stakes categories 20% + Marketplace quality 20%. **Required Agent Advantage Report: ≥3 real tasks both ways (agent hired via marketplace vs without), each with time/cost/output quality + actual outputs attached; ≥1 task must be trading/stock/security.** Trading agents need real record (win rate/window/risk). TermiX will hire from your marketplace.                                                                                                                         | Tracks → TermiX + Required Report                                    |
| **PancakeSwap** | **PancakeSwap Challenge** — 1,000 CAKE. **Agent must deliver real benefit to PancakeSwap traders or LPs**: e.g. smarter liquidity management, finding better yields, researching demand for new pools to improve liquidity efficiency, or safe automated swaps without risking user funds.                                                                                                                                                                                                                                                                                                   | Tracks → PancakeSwap                                                 |

> Do not rely solely on old notes — this table is the authoritative baseline for the audit below.

---

## 1 · Production read-only probe (this audit)

| Probe                                                     | Result                                                                                                                                                                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /` → `https://bnb-agent-marketplace-web.vercel.app/` | **200**                                                                                                                                                                                                                                       |
| `GET /marketplace`                                        | **200** len 598744 — contains `Rebalancing`, `Grid Trading`, `Yield`, `Health Factor`, `BNB Agent Studio`, `8004`; `Canned Range Keeper` not in unauthenticated marketplace HTML (expected — surfaced via search/detail, not hard-coded list) |
| `GET /api/dashboard/hires`                                | **200** `{ok:true,data:{hires:[],activeAgents:0,fundedHires:0,connected:false,state:"no-wallet"}}` — honest no-wallet contract                                                                                                                |
| `/dashboard` (X.168 verified build)                       | **200** — contains `Your hired agents`, `Funded hires`, `Active agents`, `Net P&L`                                                                                                                                                            |
| `/agents/97:0x8004A818...:2005` (Agent 2005 detail)       | **200** — `Canned Range Keeper`, Hire CTA, BSC Testnet                                                                                                                                                                                        |
| `HEAD origin/main`                                        | `feca55c` X.168 + `0666ff3`                                                                                                                                                                                                                   |

---

## 2 · PART A — Main Track Audit

**Judging:** Functionality · Data Quality · Agent Diversity. All four categories first-class (Rebalancing, Grid Trading, Yield Optimisation, Health Factor Monitoring). Must be publicly accessible + surfaced agents live on BSC.

### A1 — Production checklist

| Requirement                      | Evidence                                                                                                                                                                                                                                        | Status                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Publicly accessible              | Vercel prod `https://bnb-agent-marketplace-web.vercel.app` 200 (this audit + X.168 `x-vercel-id 1de9e76f66ae`)                                                                                                                                  | **PASS**                          |
| Four categories first-class      | `/marketplace` contains all four + `apps/web/app/(app)/categories/{rebalancing,grid-trading,yield,health-factor}` each served; `docs/SUBMISSION.md` category list                                                                               | **PASS**                          |
| Discovery                        | `apps/web/lib/eight004scan/discovery/*` + `marketplace/page.tsx` bounded discovery, 8004scan live                                                                                                                                               | **PASS**                          |
| Comparison                       | `/compare` route + matrix with explicit unavailable states                                                                                                                                                                                      | **PASS**                          |
| Agent detail                     | `/agents/[slug]` dynamic, source-attributed (registry, owner, chain, verification)                                                                                                                                                              | **PASS**                          |
| Live BSC agents                  | Agents 2005/2003/2001/2000 live on 8004scan chain 97 + chain-56 mainnet agents via leaderboards (404,853 indexed, see X.155C). Agent 2005 endpoint `https://range-keeper.../erc8183` health 200, `/negotiate` returns verifiable quote (X.155C) | **PASS**                          |
| Hire CTA                         | `MainTrackHireView` rendered when owner present on chain-97 detail pages                                                                                                                                                                        | **PASS**                          |
| Model-B 5-tx browser-wallet flow | `model-b-v2-commercial-agreement` — `prepare`/`receipt`/`verify` in `app/api/activation/main-track-hire` + client `eth_sendTransaction` only, never `eth_sendRawTransaction` for user path (see `README.md` A&S)                                | **PASS — implemented & deployed** |
| Dashboard FUNDED visibility      | `lib/dashboard/hired-agents.{ts,server.ts}` + `app/api/dashboard/hires` + `hired-agents-dashboard.tsx` — FUNDED never ACTIVE (X.168)                                                                                                            | **PASS**                          |
| Honest FUNDED != ACTIVE          | Dashboard shows `Active agents: 0` + `Funded hires: 1` for buyer wallet; Total `0.00 BNB` / Net `Not available` never fabricates P&L                                                                                                            | **PASS**                          |

### A2 — Job 787 (read-only, X.168 verified)

| Field    | Value                                                                  | Source                                                              |
| -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| chain    | **97**                                                                 | `getJob` via PublicNode                                             |
| status   | **1 = FUNDED**                                                         | X.168 probe                                                         |
| budget   | **1000000000000000 = 0.001 U**                                         | X.168 probe                                                         |
| client   | `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` (buyer wallet)            | X.168 probe                                                         |
| provider | `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a` (= Agent 2005 owner)      | X.168 probe → 8004scan `registered` agentId `97:0x8004a818...:2005` |
| Job 788  | Different client/provider, budget 0, pre-existed; NOT created by X.168 | X.168 note                                                          |

> X.157 real hire attempt against Agent 2005 was blocked at the first broadcast (`unmarshal transaction failed` on `data-seed-prebsc-2-s2` / `failed to decode signed transaction` on PublicNode) — X.148-class RPC infra, **not** a contract/wallet defect. No job created, nonce/explorer unchanged. The marketplace fails closed honestly; no successful production funded hire is claimed in `README.md`/`SUBMISSION.md`.

### A — Classification

```
MAIN TRACK: PASS (with honest limitation disclosed)

Functionality:  PASS — land → find (category) → understand (detail) → Hire CTA → Model-B prepare/receipt/verify
Data Quality:   PASS — source-attributed, no fabricated price/APY/TVL/volume/risk/performance; pending states explicit
Agent Diversity:PASS — four categories equal depth (dashboard, cards, detail, compare, Hire)
Public + Live:  PASS — Vercel live + 8004scan live agents (chain 97 + 56)
Limitation:     Real funded hire blocked by BSC testnet RPC infra (X.148/X.157) — documented, fail-closed, not hidden
```

---

## 3 · PART B — Altana Audit

> Rubric: agents on their own Altana wallets + sessions with call allowlist + spend cap + expiry, registered in Keystore, real session-key tx, user-facing control (see permissions + revoke). Bonus: ERC-8183 via Altana SDK + x402 selling. **Do NOT count generic ERC-8183 / normal browser wallet / Job 787 as an Altana session tx without evidence.**

### B1 — Evidence search

| Signal                                                      | Search result                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Altana wallet` / `agent-owned wallet`                      | `packages/integrations/src/altana/session.ts` — `client.createWallet({signer:adminSigner})` creates an Altana-managed wallet on chain 97; X.46 persisted snapshot `walletAddress 0x299Ce...`                                                                                                                                                                                                        |
| `session key`                                               | `client.grantSession` + `createPrivateKeySigner()` session signer in `session.ts:301`                                                                                                                                                                                                                                                                                                               |
| `call allowlist`                                            | `CallPermission {to: $U, signature: "approve(address,uint256)"}` + `assertAltanaSessionPolicyCall` (target + selector + calldata exact check)                                                                                                                                                                                                                                                       |
| `spend cap`                                                 | `spendLimitRaw 1n` (+ native fee `10_000_000_000_000_000n`), `remainingRaw` accounting, X.46 `spentRaw=1`                                                                                                                                                                                                                                                                                           |
| `expiry`                                                    | `ALTANA_SESSION_EXPIRY_SECONDS = 3600`, `policy.expiry = now+3600`, snapshot `expiry 2026-08-15T15:06:12.000Z`                                                                                                                                                                                                                                                                                      |
| `Keystore registration`                                     | `client.registerSessionKey` → `0xdb1864eb280c0732783a096a61e751e30484ae56f887a6baf0e93c28bfb0630d` + `isValidKey` live read                                                                                                                                                                                                                                                                         |
| `real session-key tx`                                       | `client.execute` → `0x3397cb958f753d1511467bc99e3d26b3fefe3bf25f63eb5acc58a3738b82cc85` block 125236512, `approve(...)` selector `0x095ea7b3`, receipt `Approval` event verified                                                                                                                                                                                                                    |
| `Altana explorer tx`                                        | All three hashes are chain-97 BscScan testnet (see X.46)                                                                                                                                                                                                                                                                                                                                            |
| `KeyStore active check`                                     | `isValidKey(wallet, keccak256(session.publicKey))` — authoritative on-chain read                                                                                                                                                                                                                                                                                                                    |
| `revocation`                                                | `client.revokeSession` → `0xda14cfc7b7dd4bcda5c6437296f334fae6413ba67b6587fd396fa880a70086fe` block 125236527 + `revoked` + `isValidKey false` after                                                                                                                                                                                                                                                |
| `user can see permissions`                                  | `app/(app)/permissions/page.tsx` + `lib/altana-session/api.ts` + `view.ts` — wallet, chain, status, KeyStore Active, sessionId, signature, spend cap/usage, expiry, tx hashes                                                                                                                                                                                                                       |
| `user can revoke`                                           | `POST app/api/altana/session/revoke` with CSRF `__Host-bnb_csrf` + 16-check `runRevokeSafetyGate` + idempotency + reconcile-first (X.47 63/63 PASS)                                                                                                                                                                                                                                                 |
| `ERC-8183 SDK buyer`                                        | `packages/integrations/src/altana/erc8183.ts` wraps `@altananetwork/sdk` (`sdkErc8183Addresses`, `sdkBuildHireCalls`, `sdkGetErc8183Job`); testnet-only gated; **signing boundary ALWAYS throws** (`assertErc8183SigningBoundary`) — no buyer session hire is wired to UI                                                                                                                           |
| `ERC-8183 SDK seller`                                       | Same file — read-only address/config + `buildClaimRefundCall`; seller execution not wired                                                                                                                                                                                                                                                                                                           |
| `x402`                                                      | `x402.ts` buyer parse+`selectPaymentRequirement`+ `requestWithX402` (requires Session, otherwise throws) + seller `validateX402MerchantConfig` / `assertX402SellSideBoundary` — **no live merchant, no facilitator EOA**                                                                                                                                                                            |
| `Altana explorer live session tx in PRODUCTION marketplace` | **ABSENT** — X.46 was an integration-runner lift (test KMS, in-memory store stand-in P1001, not committed as a prod route); X.47 revoke API is offline-verified; no Altana session grant/execute/revoke is reachable from `https://bnb-agent-marketplace-web.vercel.app` without a server-side signer/AWS KMS and a Postgres store (both BLOCKED: `REAL KMS: NOT CONFIGURED`, `P1001 no DB server`) |

### B2 — State separation

| Item                                                           |      IMPLEMENTED       |            PROVEN ONCHAIN            |    READ-ONLY ONLY    | DOCUMENTED ONLY |                     MISSING                      |
| -------------------------------------------------------------- | :--------------------: | :----------------------------------: | :------------------: | :-------------: | :----------------------------------------------: |
| Own Altana wallet                                              |           ✅           |       ✅ (X.46 wallet 0x299C…)       |          —           |        —        |                        —                         |
| Call allowlist `approve(address,uint256)` on $U `0xc70B...`    |           ✅           |       ✅ (policy + preflight)        |          —           |        —        |                        —                         |
| Spend cap (1 raw + native fee) + remaining accounting          |           ✅           |          ✅ (`spentRaw 1`)           |          —           |        —        |                        —                         |
| Expiry (1h, future-bounded)                                    |           ✅           |                  ✅                  |          —           |        —        |                        —                         |
| KeyStore registration `isValidKey`                             |           ✅           |        ✅ `0xdb1864...0630d`         |          —           |        —        |                        —                         |
| Real session-key transaction `approve(1)`                      |           ✅           |         ✅ `0x3397cb...cc85`         |          —           |        —        |                        —                         |
| Explorer-linkable testnet tx set                               |           ✅           |        ✅ (3 BscScan 97 txs)         |          —           |        —        |                        —                         |
| User can see permissions                                       |           ✅           | — (UI exists, offline-verified X.47) |          —           |       ✅        |                   prod deploy                    |
| User can revoke (KeyStore `revokeSession`)                     |           ✅           |         ✅ `0xda14cf...86fe`         |          —           |        —        |                   prod wiring                    |
| ERC-8183 via Altana SDK (buyer, hires BNB Agent Studio agents) |      ✅ (adapter)      |                  —                   | ✅ (read + boundary) |        —        | live buyer session hire in marketplace Hire flow |
| x402/B402 selling                                              | ✅ (config + boundary) |                  —                   |          —           |       ✅        |         live merchant + facilitator EOA          |
| **Altana session integrated into marketplace production Hire** |           —            |                  —                   |          —           |        —        |                  **✅ MISSING**                  |
| **Altana session live in production marketplace deployment**   |           —            |                  —                   |          —           |        —        |                  **✅ MISSING**                  |

> Do NOT treat generic ERC-8183 Job 787 (browser-wallet `eth_sendTransaction` via `@bnbagent/sdk`, `packages/integrations/src/altana/erc8183.ts` signing boundary) as an Altana session-key transaction. Job 787 is a **user-wallet** commercial hire, not a KeyStore session-key execution.

### B — Classification

```
ALTANA: PARTIAL / BONUS ONLY — NOT QUALIFIED for partner-track

Reason: The full Altana capability HAS BEEN PROVEN in a live, audited, transaction-backed
run (X.46 grant→register→execute→revoke + X.47 16-check revoke gate, 3 confirmed chain-97
txs with receipt verification, call allowlist + spend cap + expiry + KeyStore active proof,
user-permissions + revoke UI implemented and 63/63 offline-verified). But that run is an
integration-runner lift with test KMS + in-memory store stand-in; it is NOT integrated
into the production marketplace Hire path and NOT deployed to Vercel. Production still
runs the self-custodial browser-wallet hire (which is the Main Track design) and has no
live Altana session creation, no KeyStore session execution, and no Altana-managed wallet
visible to a judge clicking Hire. Bonus paths (ERC-8183 via Altana SDK + x402) remain
adapter-boundary only.

The existing evidence would support a strong "bonus / technical depth" narrative, but it
does NOT satisfy "agents on their own Altana wallets with scoped, Keystore-registered,
revocable sessions and a real session-key transaction THROUGH THE MARKETPLACE" as written.
```

---

## 4 · PART C — TermiX Audit

### C1 — Report located

`docs/termix/Agent-Advantage-Report.md` + `EXPERIMENT-PROTOCOL.md` + `REPRODUCIBILITY.md` + `evidence/{RUN-METADATA.json,QUALITY-SCORING.json,task-01..03/**}` — real runner `apps/web/lib/termix/advantage-harness.ts` (2026-08-16T02:10:12Z, Node v24.14.1, harness recorded in `RUN-METADATA.json`).

### C2 — Three tasks (verbatim, no invention)

| # | Task (from protocol) | Agent | Human baseline | Agent time | Human time | Agent cost | Human cost | Agent output | Human output | Quality (rubric 25) | Actual outputs attached | Evidence source |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Yield-agent discovery on BNB Chain (chain 56 non-testnet) — identify agents genuinely indicating yield-optimisation capability | Marketplace discovery agent (`lib/eight004scan/discovery/` + x402 screening) — `retrievedAt`, source `8004scan`, per-record slug/chain/verification/matched label/evidence excerpt | Scripted naive baseline: one direct 8004scan query + naive substring screening on name+description | **1426 ms** | **5513 ms** | 1 upstream request · monetary `NOT MEASURABLE` | 1 request · `NOT MEASURABLE` | `hits 131 / retrieved 100 / matched 58` with per-record slug, chain, verification, evidence excerpt, evidence source | `hits 131 / retrieved 100 / selected 62` names only, no justification/timestamp | B **22/25** vs A **9/25** — advantage is completeness/actionability/provenance (see `adjudication.json`) | ✅ `evidence/task-01/{input,arm-a-baseline,arm-b-marketplace,adjudication}.json` | `Agent-Advantage-Report.md` §Task 1 |
| 2 | Cross-category triage — count BNB Chain agents qualifying in each of the four Main Track categories | Same marketplace agent across 4 categories; distinguishes `ready/empty/failure` | Same scripted baseline across 4 direct queries | **4159 ms** | **4214 ms** | 4 requests · `NOT MEASURABLE` | 4 requests · `NOT MEASURABLE` | `rebal 30 / grid 3 / yield 58 / health 3` with per-category state+justification | `rebal 30 / grid 6 / yield 62 / health 10` | B **23/25** vs A **8/25** — correctness + provenance + failure-state handling | ✅ `evidence/task-02/{input,arm-a-baseline,arm-b-marketplace,adjudication}.json` | `Agent-Advantage-Report.md` §Task 2 |
| 3 | **Security** — screening an untrusted HTTP 402 challenge (structurally valid, payable, chain 97 only; mainnet 56 must be REFUSED) | Parse + chain-pinned selection (`chainEnforcement: ENFORCED`) | Unaided field inspection (`chainEnforcement: NOT PERFORMED`) | **2 ms** | **0 ms** | 0 · `NOT MEASURABLE` | 0 · `NOT MEASURABLE` | valid→accept (bnb-testnet 97) / mainnet→**REFUSE** / malformed→refuse; `signed:false submitted:false` | valid→accept (no chain) / mainnet→**ACCEPT ❌ security failure** / malformed→refuse | B **24/25** (3/3 criteria) vs A **7/25** (2/3) | ✅ `evidence/task-03/{input,arm-a-baseline,arm-b-marketplace}.json` (fixtures, no signing) | `Agent-Advantage-Report.md` §Task 3 |

### C3 — High-stakes category check

**PASS** — **Task 3 is SECURITY** (untrusted payment-challenge chain safety). The rubric requires at least one of `trading / stock/equities / security`; this satisfies `security` explicitly (`Agent-Advantage-Report.md` §Required-category check).

### C4 — What the report HONESTLY does not claim

- No cost advantage — billable requests identical (1v1, 4v4, 0v0); monetary cost `NOT MEASURABLE` (no published price).
- No reliable speed advantage — T2 tie (4159 vs 4214), T3 +2 ms slower, only T1 large gap un-averaged.
- No blanket correctness — T1 Arm B missed **3 genuine yield agents** (description-precedence classifier bug disclosed); T2 `health-factor 7/7` true false-positive suppression is the clearest win.
- Limitations frozen in advance: single run, unaveraged; baseline is scripted naive (not a skilled analyst); scorer is implementer (mitigated by frozen rubric + artifact scoring); fixtures for T3; local env only (X.52 infra).

### C — Classification

```
TERMIX: PARTIAL — report complete and artifact-backed, but NOT proven as a PAID marketplace hire

The Agent Advantage Report is REAL, measured, and reconstructible (frozen protocol before execution,
timings/requests/evidence per record, adjudication of every divergence, reproducibility steps).
It covers exactly 3 A/B tasks with time/cost/quality + attached outputs and includes the
required security task. Judged as a marketplace DISCOVERY/INTELLIGENCE capability, it is PASS.

Judged against the strictest rubric reading ("agent HIRED THROUGH THE MARKETPLACE vs without agent"
with that hired agent DOING the work), it is PARTIAL: README §TermiX and SUBMISSION.md §TermiX
already state the limitation — the report measures the marketplace's discovery + x402 screening
adapters, NOT a paid activation that ran through a funded Job 787 hire. TermiX judges
"service value / proven advantage / marketplace quality" — this qualifies as evidence, but a
judge expecting a live HIRED session delivering the task would mark it PARTIAL, not qualified.
```

---

## 5 · PART D — PancakeSwap Audit

### D1 — Implementation inspected

| Area                    | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data source             | **Two paths:** (A) legacy keyed `packages/integrations/src/pancakeswap/{client.ts,pools.ts}` via NodeReal MegaNode PancakeSwap V2 GraphQL (requires `PANCAKESWAP_API_KEY`, `PAIRS_QUERY {reserveUSD, volumeUSD, token0Price, token1Price, totalTransactions}`); (B) **Option B keyless** `apps/web/lib/pancakeswap/intelligence.ts` via public BSC RPC `eth_call` on factory `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` + official price API `explorer.pancakeswap.com/api/cached/tokens/price/list/56:0x…` (server-only, no key) |
| Pool/position info      | Real `Pair` rows → `normalizePair` → `{poolId, chainId 56, token0/1, tvlUsd=reserveUSD×price, volumeUsd (CUMULATIVE honest), apr/apy null, source, retrievedAt}`; invalid rows dropped never zeroed                                                                                                                                                                                                                                                                                                                                 |
| LP/trader use case      | LP-focused market intelligence (sourced TVL + token USD prices + fee tier `0.25%` + `CUMULATIVE` volume label + sample scope) — read-only, no swap/liquidity tx                                                                                                                                                                                                                                                                                                                                                                     |
| Concrete benefit        | **Market/demand research + liquidity discovery** — a user can identify which pools have real TVL and real token prices without trusting a fabricated APR/24h volume; done honestly (missing price → pair dropped)                                                                                                                                                                                                                                                                                                                   |
| Read-only vs executable | **READ-ONLY ONLY** — `PANCAKESWAP_READ_ONLY_BOUNDARY` verified (comment-stripped scan, `RPC {eth_call, eth_chainId}` + `GET` price only, zero forbidden tokens, no env reads)                                                                                                                                                                                                                                                                                                                                                       |
| Sourced vs fabricated   | Sourced — on-chain `eth_call` + official price API; nothing invented; empty → honest `not-found/timeout/server-error`, never `0`                                                                                                                                                                                                                                                                                                                                                                                                    |
| Agent 2005 relationship | Agent 2005 is a **Rebalancing** range-keeper; its intelligence relevance is inferred LP demand (rebalancing ↔ pool liquidity), but no agent claims to MANAGE PancakeSwap liquidity                                                                                                                                                                                                                                                                                                                                                  |
| Option-B report         | `docs/review/PancakeSwap-OptionB-Keyless-Read-Only-Intelligence.md` — live source probes (factory `allPairsLength ~2,690,351`, price API rows, `getPair` reverts, CREATE2 mismatch, bounded window `W=8`)                                                                                                                                                                                                                                                                                                                           |
| Real measurements       | Option B adapter harness `pancakeswap:intel:verify` 10/10 + UI harness 17/17 offline PASS with TVL math `Σ reserve×price` exact; legacy path live GraphQL is **BLOCKED `server-error` / HTTP 500** (P4)                                                                                                                                                                                                                                                                                                                             |

### D2 — Mapping to rubric benefits

| Rubric example                                                       | Evidence                                                                                                                                                              | Status                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1. Smarter liquidity management (automated rebalancing of LP ranges) | Marketplace does **not** manage LP positions; no transaction; Agent 2005's real capability is external to PancakeSwap                                                 | **NOT PROVEN**                        |
| 2. Better yield discovery                                            | Finds pools with real TVL/prices, but labels `apr/apy null` honestly; does not surface yield/APR itself                                                               | **PARTIAL — discovery, not yield**    |
| 3. Market/demand research                                            | ✅ **PROVEN** — read-only market intelligence from two official keyless sources (on-chain factory + official price API) with honest sample-scope labeling and ranking | **PASS**                              |
| 4. Improving liquidity efficiency                                    | No on-chain efficiency gain proven (sample window, not census)                                                                                                        | **NOT PROVEN**                        |
| 5. Safe automated swaps without putting user funds at risk           | **Not claimed** — read-only boundary, no swaps by design (safe)                                                                                                       | **PASS as safety, not as automation** |

### D — Classification

```
PANCAKESWAP: PARTIAL — real, read-only market intelligence is PASS; trader/LP AUTOMATION benefit is NOT QUALIFIED

Implemented and offline-verified keyless intelligence delivers genuine pool TVL + token-price
research (the rubric's "market/demand research" example). It is server-only, chain-56 explicit,
bounded, honest-null, and never invents volume/APR. That alone is defensible PancakeSwap
integration. But the rubric's higher-value examples — smarter ACTIVE liquidity management,
yield discovery returning APR/APY, improving efficiency, safe AUTOMATED swaps — are NOT proven
(and are intentionally not claimed). Live production as of the last authorized Vercel probe
(2026-08-19, X-OptionB §6a) still serves the LEGACY unavailable block ("PancakeSwap data is
temporarily unavailable"), i.e. PRODUCTION = NOT DEPLOYED for Option B. A judge requiring a
measurable trader/LP outcome would mark this PARTIAL.
```

---

## 6 · PART E — Submission Evidence Matrix

| Track       |                                                                                  Requirement | Evidence                                                                                                                                                               |                               Status                                |
| ----------- | -------------------------------------------------------------------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------------------------------------------------------------: |
| Main        | Functionality (land → find → understand → compare → negotiate → confirm → wallet → ERC-8183) | Vercel prod 200 + marketplace + categories + detail + compare + `/api/activation/main-track-hire` prepare/receipt/verify; Model-B browser-wallet flow deployed (X.156) |                              **PASS**                               |
| Main        |                              Data Quality (real-time, accurate, decide-able; no fabrication) | 8004scan live + official SDK quote verify + honest pending/unknown states; no fake price/APY/TVL/volume/risk/performance (README Trust)                                |                              **PASS**                               |
| Main        |                                                   Agent Diversity (4 categories equal depth) | `/categories/rebalancing`, `/grid-trading`, `/yield`, `/health-factor` + cards + detail + Hire per category; classifier deterministic                                  |                              **PASS**                               |
| Main        |                                                        Publicly accessible + live BSC agents | Vercel live + Agent 2005/2003/2001/2000 registered `0x8004A818…` chain 97 + mainnet via leaderboards                                                                   |                              **PASS**                               |
| Main        |                                             Honest FUNDED != ACTIVE + funded-hire visibility | `hired-agents.ts/server.ts` + `/api/dashboard/hires` + X.168 probe (Job 787 FUNDED 0.001 U)                                                                            |                              **PASS**                               |
| Main        |                                                   Real hire end-to-end (funded escrow mined) | X.157 real attempt failed at RPC gate (`unmarshal transaction failed`); fail-closed, documented, no retry; no funded hire claimed                                      |                             **PARTIAL**                             |
| Altana      |                                                                  Own Altana wallet per agent | `session.ts createWallet` + X.46 snapshot `wallet 0x299C…`                                                                                                             | **IMPLEMENTED · PROVEN (runner)** / **MISSING in prod marketplace** |
| Altana      |                                        Scoped sessions (call allowlist + spend cap + expiry) | `approve(address,uint256)` on `$U 0xc70B…`, `1n` + native fee, `3600s` — X.46 policy + preflight                                                                       |         **IMPLEMENTED · PROVEN** / **MISSING in prod Hire**         |
| Altana      |                                                                          Keystore registered | `registerSessionKey` `0xdb1864...0630d` + `isValidKey true`                                                                                                            |                    **PROVEN ONCHAIN (testnet)**                     |
| Altana      |                                                                 Real session-key transaction | `execute` `0x3397cb...cc85` b125236512 `Approval` event verified, `spentRaw 1`                                                                                         |                    **PROVEN ONCHAIN (testnet)**                     |
| Altana      |                                                                     User can see permissions | `permissions/page.tsx` + `api.ts` view (X.47) — exists, 63/63 offline PASS                                                                                             |               **IMPLEMENTED** / **NOT DEPLOYED live**               |
| Altana      |                                                                       User can revoke access | `revokeSession` `0xda14cf...86fe` + `POST /api/altana/session/revoke` CSRF+preflight (X.47)                                                                            |      **IMPLEMENTED · PROVEN (runner)** / **NOT DEPLOYED live**      |
| Altana      |                                         Hire BNB Agent Studio agents via Altana ERC-8183 SDK | `erc8183.ts` wraps SDK; **signing boundary ALWAYS throws**; no UI wiring                                                                                               |                         **READ-ONLY ONLY**                          |
| Altana      |                                                                   x402/B402 selling is bonus | `x402.ts` parse+selection + merchant config validation + boundary (no facilitator)                                                                                     |                         **DOCUMENTED ONLY**                         |
| Altana      |                                               **Eligibility via marketplace Altana session** | Requires live grant/register/execute/revoke THROUGH marketplace production                                                                                             |                          **NOT QUALIFIED**                          |
| TermiX      |                                             3 real tasks, both ways (agent hired vs without) | `Agent-Advantage-Report.md` + `evidence/task-01..03` (1 yield, 1 triage, 1 security)                                                                                   |                              **PASS**                               |
| TermiX      |                                                        time / cost / output quality per task | Timings 5513v1426, 4214v4159, 0v2; cost `NOT MEASURABLE`; rubric 24/25 vs 7-9/25; quality dimensioned                                                                  |                **PASS (with honest NOT MEASURABLE)**                |
| TermiX      |                                                                      Actual outputs attached | `arm-a-baseline.json` + `arm-b-marketplace.json` + `adjudication.json` per task                                                                                        |                              **PASS**                               |
| TermiX      |                                                          At least one trading/stock/security | Task 3 = **security** (chain-56 payment challenge refusal)                                                                                                             |                              **PASS**                               |
| TermiX      |                                                          **Proven as PAID hired-agent work** | Report measures adapters, not a funded Job 787 execution                                                                                                               |           **PARTIAL — NOT proven as hired-session work**            |
| PancakeSwap |                                                             Real data source (pool/position) | Public RPC `eth_call` factory `0xcA143…` + official price API `explorer.pancakeswap.com` (keyless, live-probed) + legacy NodeReal GraphQL (blocked 500)                |                       **PASS (keyless path)**                       |
| PancakeSwap |                                                Real trader/LP benefit — liquidity management | No LP management; read-only                                                                                                                                            |                          **NOT QUALIFIED**                          |
| PancakeSwap |                                                     Real trader/LP benefit — yield discovery | Finds TVL/price, but `apr/apy null`                                                                                                                                    |                             **PARTIAL**                             |
| PancakeSwap |                                              Real trader/LP benefit — market/demand research | ✅ Market intelligence (ranked TVL, sourced prices, bounded window, honest null)                                                                                       |                              **PASS**                               |
| PancakeSwap |                                                Real trader/LP benefit — liquidity efficiency | Sample only (`W=8` head/tail), not census                                                                                                                              |                          **NOT QUALIFIED**                          |
| PancakeSwap |                                                Real trader/LP benefit — safe automated swaps | Not claimed; read-only by design (safe)                                                                                                                                |                          **NOT QUALIFIED**                          |
| PancakeSwap |                                                    **Production-deployed LP/trader outcome** | Option B built+offline-verified, **PRODUCTION = NOT DEPLOYED** (legacy unavailable block still served)                                                                 |                             **PARTIAL**                             |

---

## 7 · PART F — Do-Not-Overclaim

| Never convert                 | Audit discipline                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `implemented → proven`        | Altana adapter exists ≠ Altana prod qualification; PancakeSwap client exists ≠ trader P&L                                                                                   |
| `read-only → live`            | `erc8183.ts` read+boundary is server-error/throw, not a session tx; Job 787 read does not imply a session hire                                                              |
| `integration → qualification` | Wrapped SDK (`@altananetwork/sdk`, `@bnbagent/sdk`) is packaging, not a track pass                                                                                          |
| `simulation → real tx`        | Fixtures/mocks in `*.verify.ts` are explicitly TEST FIXTURE; only `0xdb1864…0630d`/`0x3397...cc85`/`0xda14cf...86fe` are real txs and they are test-runner, not marketplace |
| `documentation → on-chain`    | `docs/review/` prose never substitutes for BscScan 97 `isValidKey` / receipt `Approval` / `jobCounter` reads                                                                |

---

## 8 · PART G — Only Safe Fixes (this audit)

- **Documentation-only corrections MAY be made:** link polish, evidence index, partner-track disclosure language.
- **MAY NOT be made:** invent measurements, invent transactions, invent Altana sessions, invent PancakeSwap benefits, fabricate TermiX outputs, modify blockchain state, change the core Hire flow.
- **Real code defect guidance:** if a defect is found, **REPORT first — do not modify production marketplace** in this audit. No defect requiring a code change was identified beyond the already-documented X.148 RPC-infra gate and the Option-B `PRODUCTION = NOT DEPLOYED` state (both are deployment/infra, not logic defects).

No files, deploys, or transactions were performed by this audit.

---

## 9 · PART H — Final Recommendation

```
MAIN TRACK:    READY  (with disclosed RPC-infra limitation; submission is honest and judgeable end-to-end)
ALTANA:        NOT QUALIFIED (PARTIAL / BONUS ONLY — deep technical evidence exists but not through production marketplace)
TERMIX:        PARTIAL (PASS as discovery/intelligence advantage; PARTIAL as paid hired-agent work)
PANCAKESWAP:   PARTIAL (PASS for market intelligence; NOT QUALIFIED for automated LP/trader benefit)
```

### Minimum remaining action per track

| Track           | Minimum remaining action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Rank          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Main**        | **P0 — REQUIRED:** no code change needed to submit. Optionally, one authorized read-only RPC remediation attempt for X.148 (alternate seed/PAS endpoint or fee) so that the already-verified Agent 2005 quote can mine a real Job `>788` — but DO NOT reconvert Job 787 and DO NOT claim a hire that did not mine. The current fail-closed submission IS the safe submission.                                                                                                                                                                                                                               | **P0**        |
| **Altana**      | **P1 — HIGHEST-VALUE:** to claim Altana, the Altana session would need to be **brought into the production marketplace Hire path** (session grant gated to an authenticated SIWE user, persisted to Postgres via KMS, then marketplace Hire executed through the session's `execute` rather than the browser wallet) AND deployed with real Postgres + real KMS (env `DATABASE_URL`/`ALTANA_KMS_*`) + live re-probe of `/permissions` and BscScan session tx. This is **separate authorized infra + product work** — existing X.46 evidence is strong bonus material but cannot be relabeled as production. | **P1**        |
| **TermiX**      | **P1 — IF TermiX judges demand a PAID hire:** run the 3 tasks again with a _funded_ Agent 2005/2003 session actually hired through the marketplace (same frozen protocol), then append a "Paid Hire Supplement" with new `task-0N/arm-b-paid-marketplace.json`. Current report remains valid for discovery; do not fabricate paid outputs.                                                                                                                                                                                                                                                                  | **P1**        |
| **PancakeSwap** | **P2 — OPTIONAL:** deploy the already-built Option B (`lib/pancakeswap/intelligence.ts` + UI section) to Vercel (no key needed) and do one authorized smoke probe of `/agents/[slug]` for `Market Intelligence` markers. Until then, production still shows the legacy unavailable state — the honest read-only research benefit is implemented but not judge-visible live.                                                                                                                                                                                                                                 | **P2**        |
| All tracks      | **DO NOT DO:** create Job 788/789, modify Agent 2005/1906, register agents, approve/fund, create a wallet, add AWS/KMS/VPS, change Model-B 5-tx flow, re-touch Job 787, fabricate Altana session/PancakeSwap benefit/TermiX output.                                                                                                                                                                                                                                                                                                                                                                         | **DO NOT DO** |

---

## 10 · Validation

```
No blockchain transactions.   ✅ ZERO (all probes are GET / eth_call / 8004scan read / verifyQuoteSignature)
No wallet signing.            ✅ NONE (signing boundaries in erc8183.ts / x402.ts were NOT crossed)
No Hire execution.            ✅ NO eth_sendTransaction / Session execute / createJob broadcast was attempted
No deploy.                    ✅ NONE — even Option B was left NOT DEPLOYED per prior authorization gate
Job 787.                      ✅ UNTOUCHED (read-only getJob only)
Report file.                  ✅ docs/review/X169-Partner-Track-Eligibility-Audit.md (this file)
HARD STOP.                    ⏹ This audit ends here. No further action without explicit authorization.
```

---

_Evidence files referenced: `docs/SUBMISSION.md`, `README.md`, `docs/termix/Agent-Advantage-Report.md` + `evidence/*`, `docs/review/X155C-8004Scan-Live-Agent-Audit.md`, `docs/review/Main-Track-X157-Real-Agent-2005-Hire.md`, `docs/review/Main-Track-X158-Browser-Wallet-RPC-Diagnosis.md`, `docs/review/X168-Dashboard-Funded-Hire-Visibility.md`, `packages/integrations/src/altana/{session.ts,erc8183.ts,x402.ts}`, `docs/review/Main-Track-Activation-X46-Live-Altana-E2E.md` + `X47`, `packages/integrations/src/pancakeswap/{client.ts,pools.ts}`, `apps/web/lib/pancakeswap/intelligence.ts`, `docs/review/PancakeSwap-OptionB-Keyless-Read-Only-Intelligence.md`._
