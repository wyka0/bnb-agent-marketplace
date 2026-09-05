# Main Track Activation — X.25 ERC-8183 Job Preparation / Read-Only Review

**Status:** READY (deterministic read-only ERC-8183 job preview produced; **NO job created**)
**Date:** 2026-08-13
**Scope:** Strictly read-only ERC-8183 job preparation for the verified chain-97 deployment against the registered provider (ERC-8004 Agent ID 1816).

---

## 1. Verified input state (from X.24)

- ERC-8004 Agent ID: **1816**
- Chain: **BNB Smart Chain Testnet, chainId 97**
- Provider / Owner: **0x299Ce4113abF88F4997737184aa8A7a3D58AC15C**
- Canonical metadata: `https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json` (HTTP 200, valid JSON)
- Service endpoint: `https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service`
- X.13 service: PASS · 8004scan: PASS · Marketplace discovery: PASS
- 8004scan record description is **empty**; name is "Agent #1816". The authoritative service description is anchored to the canonical metadata text (see §3).

---

## 2. ERC-8183 job parameters — exact values required for a legitimate job

Determined from the repository implementation (`erc8183.ts`, `hire.server.ts`), the SDK (`buildHireCalls`, `@altananetwork/sdk` 0.7.0), and live read-only on-chain reads. **No values were invented; every address and quantity is verified.**

| Parameter | Value | Source |
|---|---|---|
| Chain / network | 97 / `bnb-testnet` | verified chain-97 config (SDK table + on-chain `getChainId`) |
| Provider (seller) | `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` | registered owner of Agent ID 1816 |
| Agent ID | 1816 | ERC-8004 registry (`ownerOf(1816)`), 8004scan |
| Evaluator / facilitator | Evaluator **and** hook = **router** `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` (SDK `createJob` sets evaluator=router, hook=router) | SDK `buildHireCalls` |
| Pay-to | `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` (configured `ALTANA_PAYTO` = the provider/merchant recipient) | `.env.local` (public address) + X.6 review wiring |
| $U token | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` | verified `paymentToken` read + SDK table |
| Token decimals | **18** | verified $U metadata (name "United Stables", symbol U, decimals 18) |
| Service price | **1 U** = `1_000_000_000_000_000_000n` raw $U | `ALTANA_SERVICE_PRICE_RAW_U` (server-only, **exactly 1 U confirmed**) |
| Service endpoint | `https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service` | canonical metadata |
| Job description / request | Canonical metadata description (see §3) | canonical `agent-registration.json` |
| Predicted job id | **515** (`jobCounter` 514 + 1) | live read-only `AgenticCommerce.jobCounter()` |
| `disputeWindow` | **86400 s** (1 day) | live read-only `OptimisticPolicy.disputeWindow()` |
| `expiredAt` | `now + disputeWindow + 1800s` deadline (SDK default 30 min) | derived per SDK `hireErc8183Agent` |
| Job budget | `1_000_000_000_000_000_000n` ($U raw) | = 1 U price |
| Transaction value | **0** (ERC-20 `approve` + `fund`; no native BNB transfer) | SDK batch |
| Approval / funding | `approve($U → commerce, budget)` then `fund(jobId, budget)` — escrow held by `AgenticCommerce` | SDK batch |

### Registry / job contract addresses (verified chain-97 table)

- **AgenticCommerce** (commerce / escrow): `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`
- **EvaluatorRouter** (router / evaluator + hook): `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`
- **OptimisticPolicy** (policy): `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6`
- **ERC-8004 Registry** (identity): `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **$U payment token**: `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`

### Required ABI / functions (the SDK's atomic 5-call hire batch)

1. `createJob(provider, router, expiredAt, description, router)` → commerce
2. `registerJob(jobId, policy)` → router
3. `setBudget(jobId, budget, "0x")` → commerce
4. `approve(commerce, budget)` → paymentToken ($U)
5. `fund(jobId, budget, "0x")` → commerce

All targets are allowlisted as verified chain-97 ERC-8183 contracts.

---

## 3. Job description anchoring

The 8004scan record for Agent 1816 carries an **empty** `description`; its name is "Agent #1816". To keep the preview deterministic and sourced from verified data, the job description is anchored to the canonical metadata text (authoritative registered service description):

> "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions."

Length: well within the 4096-byte kernel limit (verified in-script). This is Mode A task text (not an anchored signed quote); the SDK supports both.

---

## 4. Service price verification

- Source variable: `ALTANA_SERVICE_PRICE_RAW_U` (server-only; loaded via `process.loadEnvFile`, never rendered/logged).
- Parsed value confirmed to be **exactly** `1000000000000000000` = **1 U** at 18 decimals.
- The price is derived **only** from the server env — it is not hardcoded as the price authority and not exposed to any client surface.

---

## 5. Read-only preview execution

Script: `packages/integrations/src/altana/erc8183.job.preview.x25.ts` (wired as `altana:x25:review`).

```
X.25 READ-ONLY ERC-8183 JOB PREPARATION (NO JOB CREATED):
PASS service price source is ALTANA_SERVICE_PRICE_RAW_U (server-only)
PASS configured service price is exactly 1 U (raw 1e18)
PASS verified ERC-8183 chain-97 config (commerce/router/policy/registry/$U)
PASS on-chain chain id is 97 (confirmed)
PASS AgenticCommerce jobCounter read (read-only)
PASS AgenticCommerce paymentToken == verified $U
PASS OptimisticPolicy disputeWindow read (read-only)
PASS SDK atomic hire batch builds (5 calls, chain 97)
PASS every hire-batch target is a verified chain-97 ERC-8183 contract
PASS hire batch encodes verified provider (Agent 1816 owner)
PASS hire batch encodes exactly 1 U budget in all steps
PASS hire batch description <= 4096 bytes
X.25 read-only preparation: 12/12 passed
```

Deterministic preview values captured at run time:

- `predictedJobId`: **515** (jobCounter 514 + 1)
- `disputeWindow`: **86400 s**
- `expiredAt`: `1786728910` (unix; now `1786640710` + 86400 + 1800s deadline)
- `budget`: `1000000000000000000` (= 1 U)
- All addresses as §2.

The **signing boundary** was not crossed: the preview builds the batch through `prepareErc8183Hire` (pure, offline construction) and performs only read-only on-chain reads (`getChainId`, `jobCounter`, `paymentToken`, `disputeWindow`).

---

## 6. Verification suites run (all PASS)

- X.16 registration preview verify: **19/19**
- X.20 canonical registration preview: PASS
- X.21 transaction review: PASS
- X.22 registration approval review: PASS
- X.24 post-registration verification: **10/10**
- X.25 ERC-8183 job preparation: **12/12**
- ERC-8183 verify (Phase 3A): PASS (network read now shows kernel **job 1 FUNDED**, budget `1e18` — a real external testnet job; confirms the escrow rail is live)
- X.4B x402 review: **16/16**
- X.4C x402 consent: **11/11**
- X.3 marketplace verify: **10/10**
- Workspace: typecheck **12/12**, lint **12/12**, build **7/7**

---

## 7. Honest statement of what was NOT done

- **NO** ERC-8183 job created (`JOB CREATED: NO`).
- **NO** transaction signed, broadcast, or submitted.
- **NO** job funded, paid for, or settled.
- **NO** private key / API key read beyond the price env, and none rendered.
- **NO** mainnet (chain 56) touched — all reads on chain 97.
- **NO** agent record modified.
- No commit/push performed (works as previously agreed).

---

## 8. Final status

```
X.25 STATUS:
JOB PREPARATION: READY
CHAIN: 97 (bnb-testnet)
AGENT ID: 1816
PROVIDER: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
EVALUATOR/FACILITATOR: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (router; evaluator + hook)
PAY-TO: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C (ALTANA_PAYTO)
TOKEN: 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565 ($U, 18 decimals)
PRICE: 1 U
SERVICE ENDPOINT: https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service
JOB PARAMETERS: predictedJobId=515, disputeWindow=86400s, expiredAt=1786728910,
  budget=1000000000000000000 raw $U, description=canonical metadata text,
  calls=createJob/registerJob/setBudget/approve/fund (chain-97 allowlist)
JOB CREATION CALLDATA: GENERATED FOR REVIEW ONLY — NOT BROADCAST
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
JOB CREATED: NO
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

**STOP** — X.25 review complete. Awaiting operator-gated instruction before any ERC-8183 execution.
