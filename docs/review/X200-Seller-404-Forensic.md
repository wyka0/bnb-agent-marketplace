# X.200 Seller 404 Forensic

**Date:** 2026-08-30 · **Mode:** READ-ONLY · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs created:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **AgentEndpoint:** UNCHANGED · **Secrets:** NONE · **Commit/Push/Deploy:** NONE

> Definitive production result (from X.199 context + this forensic): authenticated production prepare reaches the seller host, but the negotiation route returns HTTP 404. This forensic determines the correct seller negotiation route and whether the registered AgentEndpoint is compatible — read-only only.

---

## Production error

- **HTTP 404** — `"seller endpoint returned HTTP 404"` (the X.197 diagnostic class is `http`, status 404).
- DNS working, TLS working, Vercel can reach the host, authentication reached the prepare path → failure is at the **seller HTTP route**.

---

## Registered endpoint

- Agent 2005 on-chain `tokenURI(2005)` → registered AgentEndpoint (read-only, `resolveRegisteredEndpoint`):
  `https://range-keeper.103-195-188-198.sslip.io/erc8183`
- Protocol: HTTPS · Chain: 97 · Agent: `97:0x8004A818BFB912233c491871b3d84c89A494BD9e:2005` · Owner/provider: `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a`
- **`/erc8183` is the registered seller base path** (its `/health` serves there), so the base endpoint itself is valid and reachable.

---

## Requested route

`negotiateSellerDiagnosed` (apps/web/lib/activation/main-track-negotiation.server.ts) constructs:

```
base = endpoint.endsWith("/negotiate") ? endpoint : `${endpoint.replace(/\/+$/,"")}/negotiate`
POST {base}
  headers: { "content-type": "application/json" }
  body:    JSON.stringify({ task_description, terms })
  timeout: AbortSignal.timeout(15_000)
```

→ For Agent 2005 the production request is **`POST https://range-keeper.103-195-188-198.sslip.io/erc8183/negotiate`** — the SDK-standard `{registeredEndpoint}/negotiate` convention (matches the repo's own seller: `services/v2-seller/seller.ts` implements `POST /negotiate`).

Expected response schema (unchanged, fail-closed): `response.accepted === true`, `chain_id` (97), `verifying_contract` (commerce `0xa206…`), `provider_sig`, `negotiation_hash`.

---

## Seller response

Read-only route discovery against `https://range-keeper.103-195-188-198.sslip.io`:

| Route | Method | Result |
|---|---|---|
| `/erc8183/health` | GET | **200** |
| `/health` | GET | **200** |
| `/erc8183` | GET/OPTIONS/HEAD | 404 |
| `/erc8183/negotiate` | GET/OPTIONS/HEAD | **404** |
| `/negotiate` | GET/OPTIONS/HEAD | **404** |

No `Allow` header returned anywhere. The host is up and serves health at both `/health` and `/erc8183/health`, but does **not** expose a `/negotiate` route at `/erc8183/negotiate` or `/negotiate`. (`POST` was not attempted — outside the read-only boundary; the 404 pattern is consistent across methods.)

---

## Route discovery

Only the two health routes (`/health`, `/erc8183/health`) respond. No negotiation route is served on this host. No alternate seller interface path was found via GET/OPTIONS/HEAD.

---

## Local seller implementation findings

- **The `CANNED_REFERENCE_REBALANCING_V1` seller at `sslip.io` is NOT contained in this repository** (no source reference; identity appears only in docs and live responses). **"The seller service is an external dependency and cannot be fixed from this marketplace repository."**
- The repository DOES contain a complete ERC-8183 seller implementation: `services/v2-seller/seller.ts` implements `GET /health`, `GET /.well-known/agent-card.json`, **`POST /negotiate`** (line 75), and `GET /job/{id}/response`. However it is a **different** service (owner `0xB0f768…`, `/health` returns `{status:"ok", seller:…}`), is **not durably deployed** (X.150/X.151: no VPS/domain/tunnel), and Agent 1906's registration points to a dead tunnel.

Conclusion: the deployed shared seller is a **health-only / stale reference build missing the `/negotiate` handler**.

---

## Root cause

**Classification: D — seller deployment is stale/incomplete.**

Evidence:
- The seller host is reachable and serving (`/erc8183/health` 200) → not an outage/egress issue.
- The negotiation route `POST /erc8183/negotiate` is **not implemented** on that host (404 across methods; no `Allow` header; no alternate route).
- The marketplace URL construction is **correct** (`{registeredEndpoint}/negotiate`, matching the repo's own seller and the SDK convention) → not classification A.
- No evidence of a different negotiation route → not C.
- The registered `/erc8183` base is valid (health serves there) → the AgentEndpoint itself is reachable; what is missing is the `/negotiate` route on that host → E alone is not the cause.
- The deployed service serves health but not negotiation → **stale/incomplete reference build (D)**, mechanism B (server does not implement `/negotiate` at the served path).

---

## Exact remediation

1. **Marketplace code:** **NO change required** — the URL construction `{endpoint}/negotiate` is correct and matches the SDK + repo seller.
2. **External infrastructure (operator, exact):** redeploy/replace the shared seller service with a **complete ERC-8183 seller that implements `POST {base}/negotiate`** returning the accepted-quote envelope (the repo's `services/v2-seller/seller.ts` is a known-good implementation), OR point the marketplace at a different live negotiating seller endpoint.
3. **If the correct seller is only reachable by changing the on-chain AgentEndpoint** (e.g., re-point Agent 2005/2003 to a durable negotiating host): this requires an **on-chain transaction** →

**"ON-CHAIN ENDPOINT UPDATE REQUIRED — USER AUTHORIZATION NEEDED"**

**Do NOT perform the transaction.** (X.200 is read-only.)

---

## Verify no side effects

```
Transactions: 0
Signatures: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
AgentEndpoint: UNCHANGED (no tokenURI write; read-only resolution only)
Job counter: UNCHANGED BY THIS INVESTIGATION (no state-changing call)
Secrets: NONE
```

---

## TermiX readiness

**BLOCKED.** The shared seller host does not implement `POST /negotiate`, so Tasks 4-6 (and any marketplace Hire) cannot obtain a quote — the prepare path fails with HTTP 404 before any transaction. TermiX remains **PARTIAL** until the seller negotiation route is restored (complete seller redeploy) or a correct negotiating endpoint is used (with on-chain repoint authorization if needed).

---

## Safety

```
Transactions: 0
Wallet signatures: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
AgentEndpoint: UNCHANGED
Job counter: UNCHANGED by this investigation
Secrets: NONE
Source changes: 0
Commit: NONE
Push: NONE
Deploy: NONE
POST /negotiate: NOT performed (read-only boundary respected)
HARD STOP
```
