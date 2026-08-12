# Altana Integration — Discovery Report

**Phase:** 1 — Discovery only (no implementation).
**Version:** 1.0
**Date:** 2026-08-09
**Scope:** Determine how BNB Agent Marketplace should integrate Altana (`@altananetwork/sdk`, MCP server, x402, ERC-8183, Skills Registry). All findings trace to official sources: `docs.altana.network`, `github.com/altananetwork/altana-sdk`, `github.com/altananetwork/skills`.
**Status:** `ALTANA STATUS: READY FOR IMPLEMENTATION` (see §13).

---

## 1. Capabilities Discovered (verified against official docs)

Every capability below was read from the linked official page. Nothing is invented; anything unverified is marked **[UNKNOWN]**.

### 1.1 Wallets (non-custodial)

| Capability                                                                                                                                        | Source                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `client.createWallet({ signer })` — smart-account wallet around a private-key signer; key lives in env/OS keychain/hardware, Altana never sees it | `docs.altana.network/sdk/create-wallet`         |
| `client.createPasskeyWallet({ name, rpId })` — browser wallet secured by Face ID/TouchID/Windows Hello; key never leaves device secure hardware   | `docs.altana.network/sdk/create-passkey-wallet` |
| `client.recoverFromPasskey()` — **browser only**                                                                                                  | `docs.altana.network/sdk/recover-from-passkey`  |
| `signerFromPrivateKey(process.env.PRIVATE_KEY)` — private-key signer for agents/scripts                                                           | altana-sdk README                               |
| Same smart-account address works on every configured chain                                                                                        | altana-sdk README                               |

### 1.2 Sessions (scoped, time-bounded delegation — the operative security layer)

| Capability                                                                                                                                                                                      | Source                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `client.grantSession({ wallet, signer, permissions, expiry })` — admin authorizes a session key onchain; `register: true` by default (key written to public KeyStore in the same userOp)        | `docs.altana.network/sdk/grant-session`                 |
| Permission shape: `permissions = { calls?: [{ to }                                                                                                                                              | { signature }                                           | { signature, to }], spend?: [{ limit, period, token }] }`+`expiry`(unix seconds).`calls` omitted = unrestricted | `docs.altana.network/concepts/sessions` |
| Spend `limit` is raw token smallest units; **decimals differ by chain** — USDT/USDC are **18 decimals on BNB Chain, 6 on Ethereum**                                                             | `docs.altana.network/sdk/grant-session`                 |
| `register: false` grants an unlisted (ephemeral) session; register later via `client.registerSessionKey`                                                                                        | `docs.altana.network/sdk/grant-session`                 |
| `client.revokeSession` — one transaction, takes effect before the next execute attempt, monotonic (cannot reactivate)                                                                           | `docs.altana.network/sdk/revoke-session`                |
| **Byte-exact persistence requirement:** `Session` object (`permissions + expiry + publicKey`) must be persisted verbatim; sloppy JSON round-trips (bigint→number, key reordering) break execute | `docs.altana.network/sdk/execute`, `/concepts/sessions` |

### 1.3 On-chain execution

| Capability                                                                                                                                                                                 | Source                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `client.execute` — admin path (`{ wallet, signer, calls }`) or session path (`{ session, calls }`); `Call = { to, data?, value? }`                                                         | `docs.altana.network/sdk/execute`                                          |
| Returns `ExecuteResult = { callsId, status: "CONFIRMED"                                                                                                                                    | "FAILED"                                                                   | "PENDING", transactionHash? }`; **failed executes return `status: "FAILED"`, they don't throw** | `docs.altana.network/sdk/execute` |
| `noWait: true` → `status: "PENDING"` + `callsId` to poll; first admin execute on a fresh wallet auto-registers the admin key                                                               | `docs.altana.network/sdk/execute`                                          |
| Gas handled by the Altana **intent relay** (`relay.altana.network`): an approved intent is turned into a real transaction with gas handled for you; `feeToken` selectable (default native) | altana-sdk README; `docs.altana.network/sdk/grant-session`, `/sdk/execute` |

### 1.4 KeyStore — public, vendor-free verification

| Capability                                                                                                                                                                        | Source                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| KeyStore is a **public onchain registry** of authorized keys per wallet; anyone can read it from any RPC; reads are free/unlimited                                                | `docs.altana.network/concepts/keystore`                  |
| `isValidKey(wallet, keccak256(publicKey))` — plain `eth_call` answering "is this key authorized for this wallet right now?" — needs no admin key, no session, nothing from Altana | `docs.altana.network/use-cases/4-verify-agent-authority` |
| `getKeys(wallet)` — list key ids; revocation drops from `getKeys` immediately, expiry does not                                                                                    | same                                                     |
| MCP `verify_authorization` tool / `wallet_verification` tool expose the same reads                                                                                                | `docs.altana.network/mcp/tools`                          |
| KeyStore contracts audited by **CertiK, completed 2026-07-15**; full report on CertiK Skynet                                                                                      | `docs.altana.network/security/audits`, altana-sdk README |

### 1.5 x402 payments (buyer side)

| Capability                                                                                                                                                                                                    | Source                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `client.fetchWithX402({ session, url, init?, chainId?, preferRail? })` — transparently pays an HTTP 402 challenge from a session key                                                                          | `docs.altana.network/sdk/x402` |
| Rails: **`permit2-exact`** (any token approved to Permit2; includes Binance **B402**, recipient bound via Permit2 witness) and **`exact`/EIP-3009** (`TransferWithAuthorization`, only ERC-1271-aware tokens) | same                           |
| One-time provisioning: `approveTokenForPermit2` + `approveSignatureChecker` (checker = `PERMIT2_ADDRESS` or the token)                                                                                        | same                           |
| **Browser limitation:** third-party x402 endpoints often omit `X-PAYMENT` from CORS allow-headers → **run `fetchWithX402` server-side**                                                                       | same                           |
| Envelope emitted under both `X-PAYMENT` and `PAYMENT-SIGNATURE`; b402 merchants require a `resource` field                                                                                                    | same                           |

### 1.6 x402 payments (seller side)

| Capability                                                                                                                                                                                           | Source                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `@altananetwork/x402-server` — `createX402Merchant({ chainId, payTo, price, minPrice, maxPrice, rails, facilitator, rpcUrl, chain })`; `merchant.guard(req)` → `{ response, receipt }`               | `docs.altana.network/sdk/x402-server` |
| Rails `eip3009` ($U, Studio buyers via `bag x402 trust`/`bag x402 buy`) and `permit2-exact`; challenge header `X-PAYMENT` (fallback `PAYMENT-SIGNATURE`); window ≤600s, https required in production | same                                  |

### 1.7 ERC-8183 — hiring BNB agents (job escrow) **[resolves TIS OQ-7]**

| Capability                                                                                                                                                                                                                                           | Source                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `hireErc8183Agent(wallet, signer, { provider, task, budget }, { network })` — **one atomic relay intent** running `createJob` → `registerJob` (bind dispute policy) → `setBudget` → `approve $U` → `fund`                                            | `docs.altana.network/sdk/erc8183` |
| **Session-key path supported:** `hireErc8183Agent(session, params, opts)` — a scoped key with an on-chain spend cap limits what an autonomous agent can escrow                                                                                       | same                              |
| Job lifecycle: `OPEN → FUNDED → SUBMITTED → COMPLETED`; `getErc8183Job(BNB, jobId)`; `getErc8183DeliverableUrl(BNB, jobId)` fetches the deliverable manifest (`manifest.response.content`); `job.deliverable` is keccak256 of the canonical manifest | same                              |
| `settleErc8183Job(wallet, signer, { jobId }, { network })` — releases escrow after optimistic dispute window; action `"dispute"` contests inside the window; `buildClaimRefundCall(56, jobId)` — full refund after expiry                            | same                              |
| `ERC8183_ADDRESSES` exports kernel (AgenticCommerce), EvaluatorRouter, OptimisticPolicy, ERC-8004 registry, $U token for BSC mainnet (**56**) and testnet (**97**)                                                                                   | same                              |
| MCP tools `erc8183_create_job`, `erc8183_job_status`, `erc8183_settle`                                                                                                                                                                               | `docs.altana.network/mcp/tools`   |

### 1.8 Skills Registry (composable protocol competence)

| Capability                                                                                                                                                                                                                                                                                                                                           | Source                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A **skill** is a single certified `SKILL.md` teaching an agent how one protocol works (contracts, quirks, plays, guards). "A session gives your agent authority. A skill gives it competence." Skills are public text and **carry no authority**; authority lives in the session                                                                     | `docs.altana.network/skills`                       |
| Every catalog entry publishes scope (may / may-not) + suggested spend cap; scope maps to the session's `calls` allowlist + `spend` cap                                                                                                                                                                                                               | same                                               |
| Certification: real agents exercise each skill on a private mainnet fork; a single out-of-scope attempt disqualifies                                                                                                                                                                                                                                 | `docs.altana.network/skills/submit`                |
| Catalog browsing: `https://skills.altana.network`. **Official skills include exactly the six protocols relevant to this hackathon:** `aave-v3-lending`, `venus-lending`, `pancakeswap-trading`, `pancakeswap-liquidity`, `lista-staking`, `dexscreener-token-radar` (Token Radar), `copy-trade`, plus `wallet-tracker`, `x402-payments`, `four-meme` | `github.com/altananetwork/skills/tree/main/skills` |
| MCP tools `search_skills` / `get_skill`; `get_skill` integrity-checks the playbook against the registry `sha256`; registry URL overridable via `ALTANA_SKILLS_INDEX_URL`                                                                                                                                                                             | `docs.altana.network/mcp/tools`, `/skills`         |
| "Research" skills (e.g. `dexscreener-token-radar`, `wallet-tracker`) are read-only → zero-scope (no `calls`) session is a genuinely safe look-around                                                                                                                                                                                                 | `docs.altana.network/skills`                       |

> **Correction to earlier sprint finding:** the six-protocol hackathon list (Aave, Venus, PancakeSwap, Lista, Token Radar, Copy Trade) is **NOT** a set of SDK-native integrations and **NOT** a random search hint — every one of them is a **documented, certified entry in the official Altana Skills Registry**. This is the correct mental model: Altana provides the wallet/session/execution rail, and the six protocols arrive as registry skills the hired agent consumes.

### 1.9 Networks & addresses

| Network                            | Chain ID | Export                     | KeyStore / note                                                                                                                                                                                                                     | Source                                                              |
| ---------------------------------- | -------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| BNB Smart Chain (mainnet, default) | 56       | `BNB`                      | `0x6572427ED530BadcF7375Cf9A4709D8d2b0E7E0a`; public RPC `https://bsc-rpc.publicnode.com`; relay `https://relay.altana.network`                                                                                                     | `docs.altana.network/concepts/networks`                             |
| BNB Smart Chain Testnet            | 97       | `BNB_TESTNET` (ready-made) | KeyStore `0x6b8361C29d05D498b1a12B54A37310f94171E94A`; full stack deployed (account contracts, relay `https://testnet-relay.altana.network`); faucet `https://testnet.bnbchain.org/faucet-smart`; explorer `testnet.altana.network` | `docs.altana.network/concepts/networks/testnet`, `/sdk/bnb-testnet` |
| Ethereum                           | 1        | `ETHEREUM`                 | KeyStore `0xb70fDa90C1d576Ba8399946a0c10ECD9d9Ea923b`; L1 source of truth for cross-chain                                                                                                                                           | `docs.altana.network/concepts/networks`                             |
| Base                               | 8453     | `BASE`                     | KeyStore cache for cross-chain verification only; **not** an execution chain; cannot be passed to `createClient` for execution                                                                                                      | same                                                                |

### 1.10 MCP Server

| Capability                                                                                                                                                                                                                                                                                                                                             | Source                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `@altananetwork/mcp` — 17 tools: `about_altana`, `create_wallet`, `list_wallets`, `wallet_balance`, `wallet_execute`, `wallet_verification`, `verify_authorization`, `grant_session`, `list_sessions`, `session_execute`, `revoke_session`, `x402_request`, `erc8183_create_job`, `erc8183_job_status`, `erc8183_settle`, `search_skills`, `get_skill` | `docs.altana.network/mcp/tools`                 |
| **Bun-only runtime** (`@altananetwork/mcp` ships as TypeScript; `npx` fails); 11 tools have slash commands                                                                                                                                                                                                                                             | `docs.altana.network/mcp/install`, `/mcp/tools` |
| `@altananetwork/hypersigner-keystore-mcp` — non-custodial KeyStore authorization MCP; verifies/registers/timeboxes/revokes without ever holding a key                                                                                                                                                                                                  | altana-sdk README                               |

### 1.11 Headline facts

- No API key, no hosted backend: "It runs anywhere JavaScript runs … with no API key and no hosted backend." — `docs.altana.network/sdk`
- Packages: `@altananetwork/sdk` · `@altananetwork/mcp` · `@altananetwork/x402-server` · `@altananetwork/hypersigner-keystore-mcp`. Install: `npm install @altananetwork/sdk viem`. License Apache-2.0. Current docs describe **sdk 0.7.0 / mcp 0.7.0**. — altana-sdk README, `docs.altana.network/changelog`

---

## 2. Existing Integration Points in This Repo

Nothing Altana-related is implemented. Existing artifacts that define where the integration lands:

| Artifact                                                                                    | State                                                                                                                                                                                                                                | Role for Altana                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/integrations/src/altana/index.ts`                                                 | Interface-only `AltanaAdapter` (providerName `"altana"`): `createSession`, `revokeSession`, `getSession`, `listSessions`, types `SpendCap`/`SessionKey`/`SessionStatus`, `ALTANA_ADAPTER_NOT_IMPLEMENTED`                            | **Extension point.** Real adapter wraps `@altananetwork/sdk` here. Surface maps ~1:1 onto `grantSession`/`revokeSession`/sessions. Must be broadened to `execute`, `verifyKey`, `getBalance`, `fetchWithX402`, `hireErc8183Agent`, `getJob`                                                                                                       |
| `packages/integrations/src/pancakeswap/index.ts`                                            | Sibling interface-only adapter                                                                                                                                                                                                       | Pattern to mirror for the "PancakeSwap is a registry skill, not an SDK feature" distinction                                                                                                                                                                                                                                                       |
| `docs/TIS.md`                                                                               | v1.0 draft integration spec; §3.3 Altana facts; §15 OQ-7 / OQ-8                                                                                                                                                                      | OQ-7 **now resolved** by `docs.altana.network/sdk/erc8183` (§1.7). OQ-8 partially resolved: relay exists (`relay.altana.network` / testnet relay), atomic relay intents documented; a KeyStore event-stream API remains undocumented → treat as on-demand reads only                                                                              |
| `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` (lines 144–155, 236–249, 477, 647) | **Frozen.** `PERMISSION_ROWS` render as "pending" with copy "Scopes resolve with the Altana integration; all rows are pending until then."; Hire card disabled ("Hire · Soon", title "Hire arrives with the live ERC-8004 Registry") | Do **not** modify UI. The Altana session's `calls` allowlist maps onto these `PERMISSION_ROWS` (Transfer assets / Swap tokens → approved routers / Bridge / Call contracts → whitelisted / Manage allowances → per-protocol); authority status is verifiable onchain via `isValidKey` (§1.4) and surfaced into these rows later without UI rework |
| `packages/config/src/env.ts`                                                                | Zod env schema; precedent: `8004SCAN_API_KEY` is **server-only** (no `NEXT_PUBLIC_`), optional, graceful when absent                                                                                                                 | New Altana vars (server-only) belong here — see §6                                                                                                                                                                                                                                                                                                |
| `apps/worker/src/index.ts`                                                                  | Placeholder boot; "will own scheduled jobs (ticker ingestion, snapshotting, notifications)"                                                                                                                                          | Future home of scheduled Keystore verification + ERC-8183 job polling + deliverable fetch                                                                                                                                                                                                                                                         |
| `packages/data-api/src/index.ts`                                                            | Typed HTTP client + envelope + errors; no business endpoints yet                                                                                                                                                                     | Foundation for the hire/session/verify REST endpoints Altana backs                                                                                                                                                                                                                                                                                |
| `README.md`                                                                                 | Altana listed as interface-only provider; **Phase 2 = Auth & Wallet** (wallet connect, ALTANA session keys/spend caps)                                                                                                               | Confirms Altana is a planned Phase 2 surface; this discovery shapes it                                                                                                                                                                                                                                                                            |

---

## 3. Recommended Use Case

**Hire a listed BNB agent with a scoped, spend-capped, revocable Altana session, then let the hired agent execute inside that scope (testnet) — with on-chain-verifiable authority and ESR-8183 job settlement for paid tasks.**

Concretely, in priority order:

1. **Hire + scoped session (core):** the marketplace orchestrates `createWallet` (server admin signer) → `grantSession` with a concrete `calls` allowlist + `spend` cap + `expiry` derived from the listing's `permission_blueprint`, stores the `Session` byte-exact (never the admin key), and lets the agent `execute` within scope. Replaces the "pending" permission rows honestly when live.
2. **ERC-8183 paid jobs:** `hireErc8183Agent` to escrow `$U` against a hired agent, poll `getErc8183Job`, fetch the deliverable, settle/dispute/refund. This is the exact "hire BNB agents" rail (§1.7) and matches the frozen Hire card's promise ("live ERC-8004 Registry") without touching UI.
3. **On-chain authority display:** read `isValidKey`/`getKeys` from the public KeyStore to show a session's real status (active/expired/revoked) — zero trust in Altana's UI, free reads, perfect for the frozen permission/trust rows.
4. **Skills-driven competency (hackathon differentiator):** hired agents consume the certified registry skills (`aave-v3-lending`, `venus-lending`, `pancakeswap-trading/liquidity`, `lista-staking`, `dexscreener-token-radar`, `copy-trade`) that already cover the six hackathon protocols — marketplace provides authority (session scoped to each skill's address table), skills provide competence.
5. **Per-call payment (x402, later):** either the buyer path (`fetchWithX402` server-side) or the seller path (`x402-server` merchant guard) if the marketplace ever sells agent output.

**Not recommended for the hackathon phase:** the seller-side `x402-server` merchant, cross-chain (Ethereum/Base), and autonomous DeFi strategies beyond a single skill per hire. These add attack surface without sub-prize value.

---

## 4. Architecture

```
Browser (apps/web, UI-only, frozen surfaces untouched)
   │  REST (packages/data-api client → v1 API envelope)
   ▼
API + worker (Node)
   │
   ├── HireOrchestrator ── createWallet / grantSession / execute / revokeSession   (@altananetwork/sdk, server-side)
   ├── Erc8183Service  ── hireErc8183Agent / getErc8183Job / getDeliverable / settle / claimRefund
   ├── VerifyService   ── isValidKey / getKeys  (public KeyStore reads — free, no Altana, no key)
   ├── X402Buyer       ── fetchWithX402 (server-side only; CORS limitation)
   └── Worker jobs ──── session-status polling, ERC-8183 job status, deliverable fetch
   │
   ▼
packages/integrations/src/altana/  (real AltanaAdapter — implements/extents §2 contract, wraps SDK)
   │
   ▼
Altana infrastructure (non-custodial):
   BNB Chain KeyStore (0x6572…)  ·  account stack  ·  intent relay (relay.altana.network)
   x402 facilitators / B402  ·  ERC-8183 escrow + $U  ·  Skills Registry (skills.altana.network)
```

**Layering rules (all documented facts):**

- **Admin signer & session keys live server-side only** (env / OS keychain / hardware via `signerFromPrivateKey`); never in the browser, never in source. Passkey path (`createPasskeyWallet`) is the documented browser alternative when a human owns the wallet.
- **Execution flows through the session**, enforced onchain; the marketplace additionally enforces caps server-side as a second layer (consistent with TIS A-3).
- **Authority is verifiable without Altana** — any dashboard, DEX, or counterparty call `isValidKey` from any RPC (§1.4). Our UI's permission status is derived from these public reads, not from an Altana API.

---

## 5. Required Packages

| Package                                   | Where                                       | Purpose                                                                                                      |
| ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@altananetwork/sdk` (+ `viem`)           | `packages/integrations` (workspace dep)     | Wallets, sessions, execute, x402 buyer, ERC-8183, balances, `BNB`/`BNB_TESTNET` configs, `ERC8183_ADDRESSES` |
| `@altananetwork/x402-server`              | `packages/integrations` (optional, Phase 3) | Seller side, if the marketplace sells agent output                                                           |
| `@altananetwork/mcp`                      | none (use SDK directly)                     | Skip — Bun-only runtime and our server already speaks plain TS; documented as optional via Claude/Cursor     |
| `@altananetwork/hypersigner-keystore-mcp` | none (use SDK reads)                        | Optional; `isValidKey`/`getKeys` via SDK/viem is sufficient                                                  |

**No Altana package may be installed during discovery.** This section becomes the approved dependency set for the implementation phase.

---

## 6. Required Environment Variables (all server-only)

Precedent: `packages/config/src/env.ts:40` — `"8004SCAN_API_KEY"` is server-only (never `NEXT_PUBLIC_`), optional, graceful-absent. Altana needs no API key; the only secrets are signers.

| Variable                                                        | Server-only | Required?                         | Notes                                                                                                                                                    |
| --------------------------------------------------------------- | ----------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALTANA_NETWORK`                                                | yes         | optional (default `bnb-testnet`)  | `bnb` (56) or `bnb-testnet` (97); testnet is the integration target                                                                                      |
| `ALTANA_RPC_URL`                                                | yes         | optional                          | Override for `BNB`/`BNB_TESTNET` public RPC when a private RPC is preferred                                                                              |
| `ALTANA_ADMIN_PRIVATE_KEY` (or existing secret-management path) | yes         | **only for server-admin wallets** | Feed to `signerFromPrivateKey`; implies a funded wallet on the chosen network. Prefer OS keychain/hardware + env reference over a raw env value per docs |
| `ALTANA_SKILLS_INDEX_URL`                                       | yes         | optional                          | Only if `search_skills`/`get_skill` are consumed server-side (overrides the public registry default)                                                     |
| `ALTANA_RELAY_URL`                                              | yes         | optional                          | Override relay endpoint (defaults shipped per network config)                                                                                            |

Never introduce `NEXT_PUBLIC_ALTANA_*`. Session keys are runtime data, not env config; they must be persisted to encrypted storage (e.g. DB `sessions` row), not env.

---

## 7. Server / Client Boundaries

| Concern                                               | Boundary                                     | Rationale (documented)                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchWithX402` (buyer payments)                      | **Server only**                              | Explicitly documented browser limitation: x402 endpoints often omit `X-PAYMENT` from CORS allow-headers (`docs.altana.network/sdk/x402`) |
| Admin private-key signer                              | **Server only** (env/keychain/hardware)      | `createWallet` docs: "The signer's key lives wherever you keep it (env var, OS keychain, hardware wallet). Altana never sees it."        |
| Session keys                                          | Server-owned secrets (DB), encrypted at rest | `grantSession` docs: persist the full `Session` byte-exact; losing the session signer kills the session                                  |
| Passkey wallet creation                               | **Browser only** (user-facing human wallets) | `createPasskeyWallet` needs device biometrics; `recoverFromPasskey` is explicitly "Browser only"                                         |
| Public KeyStore verification (`isValidKey`/`getKeys`) | Either — public reads, free, unlimited       | `use-cases/4-verify-agent-authority`: "needs no admin key, no session, and nothing from Altana"                                          |
| `execute` with a session                              | Server (the agent runtime)                   | Engineered for agent runtimes; not exposed to browser clients                                                                            |
| `hireErc8183Agent`                                    | Server                                       | Buyer flow escrows funds; the browser only confirms job id/status                                                                        |
| UI (frozen)                                           | Read-only consumer                           | Permission rows + Hire card must not change; new data attaches to existing slots                                                         |

---

## 8. Wallet / Security Requirements

1. **Zero server-held secrets in source.** Keys via `signerFromPrivateKey` reading env/OS-keychain/hardware only; Altana never sees the admin key, and the SDK needs no API key.
2. **Least privilege, default deny.** Every hire grants an explicit `calls` allowlist + `spend` cap + `expiry`; `calls` omitted = unrestricted (must not happen accidentally). Map a skill's address table → the session scope. No wildcard capability.
3. **Byte-exact session persistence.** Store the `Session` object with bigint-safe serialization (JSON bigint hazards documented). Sloppy round-trips silently break execute.
4. **Decimals discipline.** BNB-Chain stablecoins are 18 decimals; Ethereum 6. A "100 USDT/day" mistake on BNB (`100_000_000n`) is a 0.0000000001 USDT cap per docs.
5. **Instant revocation.** `revokeSession` is one transaction effective before the next action; deployments become `terminated` (matches TIS §8 step 7 and frozen PRD §22 intent).
6. **ERC-8183 escrow integrity.** Buyer/seller settle strictly through the escrow: settle after the dispute window, dispute inside it, refund via `buildClaimRefundCall` after expiry. `job.deliverable` = keccak256 of manifest (verify before trusting content).
7. **x402 rules.** Server-side only; require the `resource` envelope for b402 merchants; window ≤600s and https in production as seller.
8. **Trust anchors.** CertiK audit (2026-07-15) of KeyStore; independent address verification against explorer-verified sources linked from the audit page.
9. **Never leak to browser:** session signers, admin keys, `ALTANA_*` env, RPC/relay secrets. Server-side API returns status/addresses only.
10. **SSRF hygiene** applies to any skill-provided or deliverable URLs the server fetches (consistent with TIS §13.6).

---

## 9. Testnet Requirements

Everything needed is public and self-serve — **no gate**.

- **Network:** BNB Smart Chain Testnet, chain **97**, SDK ships `BNB_TESTNET` config (`docs.altana.network/concepts/networks/testnet`, `/sdk/bnb-testnet`).
- **Funds:** test tBNB from `https://testnet.bnbchain.org/faucet-smart`; likely also test `$U` for ERC-8183 escrow (testnet `$U` address in `ERC8183_ADDRESSES` for 97).
- **Relay:** `https://testnet-relay.altana.network` (full account stack deployed: Orchestrator, Delegation proxy, account impl, Simulator, Funder, Escrow — addresses in the docs).
- **KeyStore (testnet):** `0x6b8361C29d05D498b1a12B54A37310f94171E94A`; EXP/EXP2 fee tokens for paying relay fees in non-native.
- **Verification:** `testnet.altana.network` explorer; testnet `ERC-8004` registry via `ERC8183_ADDRESSES` (97).

The integration harness therefore requires: a funded testnet admin wallet, a testnet agent listing/hired agent with an ERC-8183-addressable seller, and test `$U`. All are obtainable without Altana approval or credentials.

---

## 10. Hackathon Sub-Prize Relevance

The Altana integration is the **shortest genuine path to the six-protocol hackathon scope**, because the protocols arrive pre-certified:

| Hackathon protocol | Official Altana skill (certified, `github.com/altananetwork/skills`) |
| ------------------ | -------------------------------------------------------------------- |
| Aave               | `aave-v3-lending`                                                    |
| Venus              | `venus-lending`                                                      |
| PancakeSwap        | `pancakeswap-trading` + `pancakeswap-liquidity`                      |
| Lista              | `lista-staking`                                                      |
| Token Radar        | `dexscreener-token-radar` (research, read-only)                      |
| Copy Trade         | `copy-trade`                                                         |

**Why this is the minimal-genuine-value play (no feature inflation):**

- Marketplace's job = **authority** (grant a session scoped to a skill's address table); Altana registry = **competence** (the certified `SKILL.md`). We don't build DeFi integrations at all — sessions + skills compose them.
- "Research" skills (Token Radar, wallet-tracker) pair with a **zero-scope session** — a genuinely safe look-around, which is a strong, honest demo of the authority/competence split.
- ERC-8183 makes **hire** real: escrow `$U`, deliverable manifest, settle/dispute/refund — matching the frozen Hire card's promise without a UI change.
- x402 is a natural second rail ("agent pays per call"), kept as a later phase.

---

## 11. Risks / Blockers

| #   | Risk                                                                                                  | Severity             | Mitigation                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | **No event-stream API for KeyStore** (testnet/mainnet) — grant/revoke state read on-demand only       | Low                  | Poll `isValidKey`/`getKeys` on schedule (worker); documented reads are free/unlimited                     |
| 2   | SDK version drift (docs describe 0.7.0)                                                               | Low                  | Pin `@altananetwork/sdk` + `viem` versions at implementation start                                        |
| 3   | `Session` byte-exactness / bigint serialization                                                       | Medium               | Bigint-safe storage schema + serialization tests in the adapter                                           |
| 4   | Decimals confusion (18 vs 6) silently under-caps spend                                                | Medium               | Canonical per-chain token decimals registry captured from skill address tables                            |
| 5   | ERC-8183/$U escrow requires funded testnet `$U` and a seller agent with an escrow-addressable address | Low                  | Testnet faucet + test seller agent; scope MVP to testnet (97)                                             |
| 6   | Browser CORS forbids browser-side x402                                                                | Low                  | Server-only `fetchWithX402` (documented)                                                                  |
| 7   | Skills shipped "as-is" from a third-party registry could reference mainnet V1 addresses               | Low                  | Always scope sessions from the **current** `SKILL.md` address table; verify `sha256` if using `get_skill` |
| 8   | Mainnet funds risk once live                                                                          | High (only post-MVP) | Keep mainnet behind explicit wallet-connect + admin confirm; testnet-only in hackathon phase              |
| 9   | `@altananetwork/mcp` is Bun-only                                                                      | None                 | We use the SDK directly; MCP is optional                                                                  |

**No credential, access, or documentation gap blocks implementation.** Altana requires no API key, testnet is public, faucets exist, and every SDK surface used is documented.

---

## 12. Implementation Phases (for the later implementation sprint)

| Phase                  | Scope                                                                                                                                                                                                                                                                                                                                                    | Depends on |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 0 — Setup              | Pin deps in `packages/integrations`; `ALTANA_NETWORK`/RPC/relay env in `packages/config` (server-only); funded testnet admin wallet ($tBNB + test `$U`)                                                                                                                                                                                                  | —          |
| 1 — Adapter            | Implement `AltanaAdapter` in `packages/integrations/src/altana/` wrapping `@altananetwork/sdk`: `createWallet`, `grantSession` (calls+spend+expiry), `execute`, `revokeSession`, `getSession`/`listSessions` (KeyStore reads `isValidKey`/`getKeys`), `getBalance`; bigint-safe `Session` persistence + decimals registry; unit tests with `BNB_TESTNET` | 0          |
| 2 — Verify surface     | `data-api`: session status + permission endpoints backed by public KeyStore reads; surface into frozen permission rows (read-only additions, no UI rework)                                                                                                                                                                                               | 1          |
| 3 — ERC-8183 hire      | `hireErc8183Agent` orchestration (session-capped), job polling in `apps/worker`, deliverable fetch/verify, settle/dispute/refund endpoints                                                                                                                                                                                                               | 1          |
| 4 — Skills composition | Consume certified skills: scope sessions from skill address tables; wire `search_skills`/`get_skill` server-side (sha256-checked) or direct `SKILL.md` load for the six protocols; zero-scope session for research skills                                                                                                                                | 2          |
| 5 — x402 (optional)    | Server-side `fetchWithX402` buyer rail; `x402-server` merchant only if marketplace sells output                                                                                                                                                                                                                                                          | 3          |

---

## 13. Verdict

`ALTANA STATUS: READY FOR IMPLEMENTATION`

Rationale:

- **No credentials required.** Altana SDK needs no API key and has no hosted backend ("with no API key and no hosted backend" — `docs.altana.network/sdk`).
- **Testnet is fully available and public:** chain 97 full stack (KeyStore, account contracts, relay), public RPC, self-serve faucet, `BNB_TESTNET` config, documented addresses.
- **Every surface the integration needs is documented** at function/parameter/behavior level: wallets, `grantSession` permissions, `execute` result contract, `revokeSession`, public `isValidKey` verification, x402 buyer/seller rails, and the **full ERC-8183 job lifecycle** (which also resolves TIS OQ-7 — no open documentation question remains on Altana itself).
- **The six hackathon protocols are covered by official certified registry skills**, so no third-party DeFi integration code is required.
- **Existing repo contract slots it in cleanly:** `packages/integrations/src/altana/index.ts` is the pre-wired extension point, `packages/config/src/env.ts` has the server-only-key precedent, and the frozen Agent-Detail UI explicitly anticipates "scopes resolve with the Altana integration."

Residual notes (not blockers): two OQ-8 aspects remain soft — KeyStore has no documented event stream (use on-demand reads/polling) and the intent-relay gas mechanics are described at a high level. Both are accommodated by the design in §4/§11. Integration-phase requirements are an MVP testnet-only policy, a funded testnet admin wallet, and bigint-safe `Session` persistence.
