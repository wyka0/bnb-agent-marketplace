# TermiX AACP — Read-Only Reputation Implementation

**Scope:** Server-side, READ-ONLY TermiX AACP reputation adapter. No wallet, no signer, no private key, no transaction, no staking, no hiring, no settlement. No UI changes, no `packages/ui` changes, no changes to existing Altana/x402/ERC-8183 adapters. No git init/commit/push.
**Date:** 2026-08-10
**Tag legend:** IMPLEMENTED · VERIFIED · BLOCKED · NOT IMPLEMENTED
**Phase:** TermiX AACP Read-Only Reputation — Phase 1 (Discovery + Implementation).

---

## 1. Official TermiX Source — VERIFIED

Authoritative, fetched today from `docs.termix.ai`:

| Page                 | URL                                                  | Used for                                                                          |
| -------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Docs index           | `https://docs.termix.ai/llms.txt`                    | Confirm AACP is the current protocol; MCP/SDK "coming soon"                       |
| Authentication       | `https://docs.termix.ai/aacp/authentication.md`      | Auth matrix — `GET /api/v1/*` is **public**                                       |
| Reputation API       | `https://docs.termix.ai/api-reference/reputation.md` | `GET /api/v1/reputation/:agentId` response + field reference + anomaly bit mask   |
| Agents API           | `https://docs.termix.ai/api-reference/agents.md`     | Agent record shape; `agentId` = NFT token id (uint256 string)                     |
| Network & Contracts  | `https://docs.termix.ai/aacp/network.md`             | BSC Testnet, chain 97, `MockAgentNFT` (`tokenId = agentId`), `GET /api/v1/config` |
| Reputation (product) | `https://docs.termix.ai/product/reputation.md`       | 0–100 scoring model context                                                       |

No third-party tutorials were used. No endpoint paths, parameters, or response fields were guessed.

---

## 2. AACP Overview — VERIFIED

TermiX AACP (Autonomous Agent Capital Protocol) is an ERC-8004 agent-to-agent hiring marketplace on BSC Testnet with on-chain contracts (`ACPCore`, `TermiXStaking`, `TermiXReputation`, `MockAgentNFT`, `MockUSDC`) and a REST backend. Every agent has an on-chain reputation score 0–100 (new agents start at 50). **This phase consumes only the read-only reputation surface.** Job creation/funding/execution/evaluation/settlement/disputes are OUT OF SCOPE (see §19).

---

## 3. Endpoint Used — IMPLEMENTED · VERIFIED

| Endpoint                      | Method | Auth              | Used in                                                        |
| ----------------------------- | ------ | ----------------- | -------------------------------------------------------------- |
| `/api/v1/reputation/:agentId` | GET    | **None (public)** | `client.getRawReputation()` → `getTermixReputationByAgentId()` |
| `/api/v1/config`              | GET    | None (public)     | `client.getConfig()` (contract-address discovery; optional)    |

Only read-only GETs. Documented `:agentId` is a uint256 token-id string. Path is `encodeURIComponent`-escaped.

---

## 4. Authentication — IMPLEMENTED · VERIFIED (public read path)

Per `authentication.md`, `GET /api/v1/*` is **public**. The adapter therefore:

- sends **no** `Authorization` / `Bearer` header (only `Accept: application/json`),
- requires **no** API key, **no** wallet, **no** signature,
- reads **no** credential env var on the read path.

Write auth (Bearer API key, EIP-191 `X-Wallet-*`, on-chain wallet signing) exists in the protocol but is intentionally **not** touched here. An optional server-only `TERMIX_AACP_BASE_URL` override exists for base-URL configuration only (never a secret, never `NEXT_PUBLIC_`). No new env var was added to `packages/config/src/env.ts` (base-URL override is read defensively via `process.env["TERMIX_AACP_BASE_URL"]` and defaults to the public host).

---

## 5. Chain / Network — VERIFIED

BSC Testnet, **chain 97** (`TERMIX_AACP_CHAIN_ID = 97`). Mainnet is never enabled (this phase is read-only and testnet-only). Default base URL `https://termix-backend.dev.termix.click` (https, from `network.md`).

---

## 6. Raw Response Schema — IMPLEMENTED (`types.ts`, `TermiXRaw*`)

Transcribed EXACTLY from `reputation.md` `data`:

```
TermiXRawReputation {
  agentId: string; score: number; totalJobs: number; completedJobs: number;
  onTimeJobs: number; approvedJobs: number; disputeWins: number;
  anomalyFlags: number; evaluatorMetrics?: { overturnCount, borderlineCount, avgDevFromLLM, passRate }
}
```

Envelope: `{ success: true, data: T }` (AACP shape) — parsed by the adapter itself (distinct from the internal `@bnb-marketplace/data-api` `{ ok, data, error }` envelope). No invented fields.

---

## 7. Normalized Schema — IMPLEMENTED (`types.ts`, `TermixReputation`)

```
TermixReputation {
  agentId; chainId: 97; score; totalJobs; completedJobs; onTimeJobs;
  approvedJobs; disputeWins; anomalyFlags; anomalies: TermixAnomaly[];
  evaluatorMetrics?; source: "termix-aacp"; retrievedAt: ISO string
}
```

Only officially-supported fields are copied. `anomalyFlags` is decoded into human-readable `anomalies` per the documented 4-bit mask. `source` and `retrievedAt` are provenance stamps (client-side; not upstream data). **No value is derived or invented.**

---

## 8. Agent Identity Mapping — IMPLEMENTED · VERIFIED

- **TermiX** identifies an agent by `agentId` = Agent-NFT token id (uint256 string). `network.md`: for `MockAgentNFT` (`0x23932e45071ba6Ef687331F429b79C09C34D5eb0`), `tokenId = agentId`.
- **8004scan** exposes `token_id` + `chain_id` + `contract_address` per agent.
- **Deterministic mapping** exists **only** when the ERC-8004 NFT is the TermiX `MockAgentNFT` **on chain 97** → then `token_id === agentId`.
- Any other chain or contract → `mapErc8004ToTermixAgentId()` returns `{ ok:false, reason:"unsupported" }` (**never guessed**), and `getTermixReputationForAgent()` short-circuits with `unsupported` **without any network call** (verified).

---

## 9. Error Handling — IMPLEMENTED · VERIFIED

Discriminated `TermixReputationResult` (never throws to UI):

| Condition                         | Reason              |
| --------------------------------- | ------------------- |
| 200 + valid body                  | `{ ok:true, data }` |
| 404                               | `not-found`         |
| 401                               | `unauthorized`      |
| 403                               | `forbidden`         |
| 429                               | `rate-limited`      |
| 400                               | `bad-request`       |
| 5xx                               | `server-error`      |
| fetch throw / timeout / abort     | `network-error`     |
| malformed 200 body                | `error`             |
| no deterministic identity mapping | `unsupported`       |

**Missing data is NEVER `score: 0`** — it is an explicit failure reason. Verified in the harness (checks 5–11 + malformed-body).

---

## 10. Timeout Behavior — IMPLEMENTED · VERIFIED

Bounded per-request `AbortController` timeout (default **8000 ms**, matching the `eight004scan` client). Abort/timeout maps to `network-error`. Verified (check 11).

---

## 11. 8004scan Relationship — VERIFIED (independent)

TermiX is an **additional** source. The normalized record carries `source: "termix-aacp"`. The adapter does **not** read, overwrite, merge, or composite the 8004scan `total_score` / registry data. No composite score is computed in this phase. Sources remain independently identifiable.

---

## 12. Altana Relationship — VERIFIED (untouched)

No Altana file was modified. TermiX is **not** added to `ALTANA_CERTIFIED_SKILLS`. TermiX is a separate ecosystem integration, not an Altana skill. `altana:skills:verify` remains green.

---

## 13. x402 Relationship — VERIFIED (untouched)

No x402 file was modified. TermiX reputation is plain read-only HTTP data; x402 is **not** used to retrieve it. All x402 verify suites (X.1/X.2/X.3/X.4A) remain green.

---

## 14. ERC-8183 Relationship — VERIFIED (untouched)

No ERC-8183 file was modified. No TermiX job execution, hiring, escrow, or settlement. `altana:erc8183:verify` remains green.

---

## 15. Security — VERIFIED

- **Read-only surface:** the client exposes only `getRawReputation` / `getConfig` (both GET). The harness asserts (checks 12–13) that no `writeContract` / `sendTransaction` / `signMessage` / `signTypedData` / `hire` / `stake` / `settle` / `createJob` / `fundJob` / `makeOffer` / `approve` / `transfer` method exists, and that every exposed function name begins with `get`.
- **No signer / no key:** the read path reads no `PRIVATE_KEY` / `MNEMONIC` / `WALLET_KEY` / `SIGNER` / `FACILITATOR_KEY`. Presence-only env check; values are never read or printed (check 14).
- **No browser exposure:** no `NEXT_PUBLIC_TERMIX*` variable is defined or referenced; the module is server-side.
- **Header discipline:** only `Accept: application/json` is sent; the harness fails if any `Authorization` header is emitted.
- **Scan result:** `grep` for the forbidden patterns over `packages/integrations/src/termix` returns **only** boundary comments and the verify harness's forbidden-name assertion lists — **no credential reads, no write/sign calls, no auth headers.**

---

## 16. Tests — IMPLEMENTED · VERIFIED

`packages/integrations/src/termix/reputation.verify.ts` → `termix:reputation:verify` (offline, injected `fetchFn`, labeled `TEST FIXTURE / NOT LIVE TERMIX DATA`). Covers all 14 required checks:
1 config (chain 97, https, no mainnet) · 2 read-only request · 3 response parsing · 4 score normalization · 5 missing agent · 6 unauthorized · 7 forbidden · 8 rate-limit · 9 server-error · 10 network failure · 11 timeout · 12 no transaction capability · 13 no signer requirement · 14 no secret exposure. Plus anomaly-mask decoding, malformed-body→error, and identity-mapping (deterministic + unsupported short-circuit).

**Result:** all checks pass, exit 0. Full regression green:
`pnpm lint` 12/12 · `pnpm typecheck` 12/12 · `pnpm build` 7/7 · `altana:verify` · `altana:erc8183:verify` · `altana:skills:verify` · `altana:x402:verify` · `altana:x402:testnet:verify` (16) · `altana:x402:marketplace:verify` (10) · `altana:x402:e2e:testnet:verify` (8, clean BLOCKED) · `termix:reputation:verify` (14) — all exit 0.

---

## 17. Live Data Status — BLOCKED-free (public read) · not exercised live this phase

The read path requires **no credential**, so it is **not** credential-blocked. This phase verified the adapter against labeled offline fixtures (no live call is made by the verify harness, consistent with all other verify suites). A live smoke test against `termix-backend.dev.termix.click` is a trivial, optional follow-up (no key needed) and is intentionally not run inside the deterministic verify gate.

---

## 18. Future UI Integration — NOT IMPLEMENTED (intentional)

No UI files were touched (`marketplace/`, `agents/`, `compare/`, `leaderboards/` unchanged). No TermiX badges, filters, or reputation columns were added. UI surfacing is a **separate later phase**. Next UI-integration requirements: (a) a server route/loader that calls `getTermixReputationForAgent()` with the 8004scan identity, (b) an honest empty/`unsupported`/`not-found` state (mirroring the leaderboard `missing-key` pattern), (c) keep the TermiX signal visually distinct from the 8004scan score (no merge).

---

## 19. TermiX Job Execution — NOT IMPLEMENTED (intentionally deferred)

Job creation, funding, offers, execution, evaluation, staking, settlement, and dispute filing are **out of scope**. The legacy "Agent Advantage Report" interface remains an explicit `NOT_IMPLEMENTED` placeholder (`TERMIX_ADAPTER_NOT_IMPLEMENTED`). No write endpoint, wallet, signer, or transaction path was added.

---

## 20. TermiX Bounty Evidence — (no eligibility claimed)

No bounty eligibility is claimed. **Finding:** the TermiX docs contain **no endpoint literally named "Agent Advantage Report."** The authoritative equivalent is the **Reputation API** (`GET /api/v1/reputation/:agentId`) — a per-agent 0–100 advantage signal. If the official TermiX challenge criteria require an "Agent Advantage Report" artifact, this adapter's normalized `TermixReputation` (score + completion/on-time/approval/dispute stats + decoded anomalies) is the honest data source that could back it. No report format is invented and none is produced in this phase.

---

## Files Changed

| File                                                    | Change                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/integrations/src/termix/types.ts`             | NEW — raw + normalized types, constants, identity types                                       |
| `packages/integrations/src/termix/client.ts`            | NEW — read-only GET client (public, bounded timeout, discriminated results, injectable fetch) |
| `packages/integrations/src/termix/reputation.ts`        | NEW — identity mapping, anomaly decode, normalization, `getTermixReputation*`                 |
| `packages/integrations/src/termix/reputation.verify.ts` | NEW — 14-check offline verify harness                                                         |
| `packages/integrations/src/termix/index.ts`             | UPDATED — export read-only surface; deferred-execution stub retained as NOT IMPLEMENTED       |
| `packages/integrations/package.json`                    | UPDATED — added `termix:reputation:verify` script                                             |

No other files were modified. No env schema change. No UI change. No Altana/x402/ERC-8183 change. No git operations.

---

## Status

**TERMIX AACP STATUS: READY FOR UI INTEGRATION** (read-only reputation).
