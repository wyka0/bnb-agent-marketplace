# X.197 Seller Negotiation Fix

**Date:** 2026-08-30 · **Mode:** FIX (diagnostics only) + STOP at infrastructure gate · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs created:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Commit/Push/Deploy:** NONE

> Implemented the only safe, in-scope deliverable (Step 8: precise negotiation-failure diagnostics). The actual shared-seller **availability fix requires infrastructure we do not control** (durable HTTPS seller host / Vercel egress / on-chain endpoint update) — per X.197's final rule, that is STOPPED and reported with the exact manual action, not improvised.

---

## Root Cause

X.196 confirmed: `prepareLiveAgentHire → negotiateSeller` (apps/web/lib/activation/main-track-negotiation.server.ts) returns `null` from `POST {registeredEndpoint}/negotiate` (15s timeout), producing the generic error "seller negotiation failed or endpoint unreachable" (line 245). All affected Live agents share the **single external canned-reference seller host** `103-195-188-198.sslip.io` (IP `103.195.188.198`); the repo's own seller (`services/v2-seller/seller.ts`, Agent 1906) is a **different** service (wallet `0xB0f768…`, `/health` `{status:"ok",seller:…}`) and is **not durably deployed** (X.150/X.151: no VPS/domain/tunnel).

---

## Fix

**What changed (safe, presentation-only, no validation loosened, no on-chain):**

- `apps/web/lib/activation/main-track-negotiation.server.ts`
  - Added `negotiateSellerDiagnosed()` — same request, same 15s timeout, **same validation rules** (accepted:true, chain_id/verifying_contract/provider_sig/negotiation_hash required), but on failure classifies the cause: **`dns` / `timeout` / `http` / `malformed` / `network`** with a secrets-free reason.
  - `prepareLiveAgentHire` now uses the diagnosed path on the **live** default path so the returned reason is specific (e.g. "seller endpoint DNS resolution failed", "seller endpoint returned HTTP 503", "seller negotiation timed out") instead of generic. **Injected ports (tests) keep the established generic reason** — no test contract broken.
  - No endpoint validation bypass, no fallback endpoint, no fabricated quote, no signature bypass.
- `apps/web/lib/activation/main-track-user-hire.verify.ts`
  - Added 8 X.197 checks (stubbed fetch, no network): dns/network, timeout, http(503), malformed(non-json), declined(accepted:false), valid-quote passthrough, and injected-null keeps the generic reason.

**What was NOT changed (blocked):**
- The external `sslip.io` seller host is not reachable-from-production fixable here (not our infra).
- No durable replacement host exists in the repo/environment (X.150/X.151: none provisioned; no VPS/domain/cloud account).
- No on-chain `AgentEndpoint` repoint (would require a transaction — forbidden).

---

## Seller Endpoint

- Current registered endpoint (Agent 2005): `https://range-keeper.103-195-188-198.sslip.io/erc8183` (resolved from on-chain `tokenURI(2005)`).
- Reachability: **resolves + `/health` 200 from this local environment** (`CANNED_REFERENCE_REBALANCING_V1`, chain 97, started 2026-08-28). **Production (Vercel) reachability: UNVERIFIED** — cannot be proven read-only (production prepare requires SIWE auth+CSRF; live `POST /negotiate` is outside this read-only boundary).
- Durability: **NOT durable** — `sslip.io`/IP-backed dynamic reference host, external to this repo; no repo-owned durable HTTPS host exists.

---

## Protocol

Existing negotiation schema **preserved unchanged**:
- Request: `POST {endpoint}/negotiate` body `{ task_description, terms }` (snake_case, `HIRE_TASK_DESCRIPTION` / `HIRE_TERMS`).
- Response required: `response.accepted === true`, `chain_id` (97), `verifying_contract` (commerce `0xa206…`), `provider_sig`, `negotiation_hash`.
- Signature: verified via official SDK `verifyQuoteSignature` against the registered owner; chain-97-only.
- No validation loosened; malformed/declined responses still fail closed (now with a precise reason).

---

## Verification

| Check | Result |
|---|---|
| `GET /health` (shared host, read-only) | **200** (`CANNED_REFERENCE_REBALANCING_V1`, chain 97, endpointAlive) |
| Negotiation schema fixture (existing `main-track-user-hire.verify.ts`) | **PASS** |
| X.197 diagnostics (8 checks: dns/timeout/http/malformed/declined/ok/generic) | **PASS** |
| `marketplace:verify` / `discovery:verify` / `compare:verify` | **104 / 60 / 10 PASS** |
| `dashboard:hires:verify` | **PASS (24 checks)** |
| `pancakeswap:intel:verify` / `pancakeswap:ui:verify` | **10 / 17 PASS** |
| `activation:main-track-user-hire:verify` | **ALL PASS (incl. X.197)** |
| `activation:main-track:verify` (X.131) | **ALL PASS** |
| `web typecheck` / `lint` / `build` | **PASS / PASS / PASS (12/12)** |
| `prettier` / `git diff --check` | **PASS / PASS** |

---

## Production

- **Reachability status: BLOCKED / UNVERIFIED.** The shared external seller host is reachable locally but production (Vercel) reachability could not be confirmed read-only. The diagnostics change means the NEXT time the production prepare runs, the exact failure class (dns/timeout/http/malformed/network) will be surfaced, so the boundary can be proven with a single authorized production check.
- **No deployment performed** (per X.197 — deploy only if credentials legitimately available; none used).

---

## TermiX Readiness

**NOT READY for new paid marketplace hires until seller availability is resolved.** Tasks 4-6 go through this same `prepareLiveAgentHire → negotiateSeller` path; if the shared seller host is not reachable from production, every Hire fails pre-transaction. The diagnostics change does not make the seller reachable — it precisely identifies which fix is needed. TermiX remains **PARTIAL**.

---

## Required Manual Infrastructure Action (exact; NOT performed)

1. **Prove production egress** (operator): from the Vercel runtime run `GET https://range-keeper.103-195-188-198.sslip.io/health` (and DNS resolve). This tells us whether the failure is Vercel egress/DNS (→ fix Vercel network/egress or move to a reachable host) vs the `/negotiate` route on the seller.
2. **Durable seller host** (operator, paid infra): provision a persistent HTTPS host for the canned seller service (per X.150/X.151: `NETWORK=bsc-testnet`, `WALLET_PASSWORD` local-only, `ERC8183_SERVICE_PRICE`, `ERC8183_AGENT_URL`, Keystore outside Git) and re-point the affected agents' on-chain `AgentEndpoint`. Repoint = **on-chain transaction** → requires separate user authorization.

> Per X.197 final rule: "ON-CHAIN ENDPOINT UPDATE REQUIRED — USER AUTHORIZATION NEEDED" — **not executed.**

---

## On-chain Changes

```
Transactions: 0
Signatures: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
```

---

## Git

```
Commit: NONE
Push: NONE
Deploy: NONE — only local files modified:
  - apps/web/lib/activation/main-track-negotiation.server.ts (diagnostics)
  - apps/web/lib/activation/main-track-user-hire.verify.ts (diagnostic tests)
(Working tree also contains the prior uncommitted X.186 permissions/page.tsx — not part of X.197.)
```

**FINAL RULE:** The availability fix requires an on-chain endpoint update and/or a paid durable host — both STOPPED per the hard boundary. No improvising around the blocker. **HARD STOP AFTER X.197.**
