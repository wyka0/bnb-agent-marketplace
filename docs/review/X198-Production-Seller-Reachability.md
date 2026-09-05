# X.198 Production Seller Reachability

**Date:** 2026-08-30 · **Mode:** READ-ONLY · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs created:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Source/Config changes:** 0 · **Commit/Push/Deploy:** NONE

> Read-only determination of whether the production Vercel environment can reach the shared seller. No fix, no POST /negotiate, no new diagnostic endpoint added.

---

## Production deployment

- **Deployment (x-vercel-id):** `bom1::iad1::9q2ds-1788179946417-987fbb531c86` (deployment `987fbb531c86`)
- **Commit:** `ccee8f48a326749004fe72a8d8711f2582051179` (`ccee8f4` — "feat: add truthful hire lifecycle status", X.192)
- **HTTP status:** 200 (`X-Vercel-Cache: MISS`)
- **X.197 diagnostics deployed?** **NO** — `git log` shows no X.197 commit; X.197's `negotiateSellerDiagnosed` is **local-only** (not committed/pushed/deployed). Production therefore still returns the generic negotiation reason, not the precise failure class.

---

## Seller endpoint

- Target: `https://range-keeper.103-195-188-198.sslip.io/erc8183` (Agent 2005 registered endpoint; host `103-195-188-198.sslip.io`, IP `103.195.188.198`)
- Documented health path used for the read-only probe: `https://range-keeper.103-195-188-198.sslip.io/erc8183/health`

---

## Local result

- `GET https://range-keeper.103-195-188-198.sslip.io/erc8183/health` → **200** (~582 ms)
- Body: `{"ok":true,"origin":"CANNED_REFERENCE","identity":"CANNED_REFERENCE_REBALANCING_V1","network":"bsc-testnet","chainId":97,"endpointAlive":true,"startedAt":"2026-08-28T07:03:14.676Z"}`

---

## Production result

- **UNKNOWN / NOT PROVEN.** There is **no existing production-safe health-check route**: no API route under `apps/web/app/api` performs a GET/HEAD to the seller, and the only `/health` fetch in the repo is in the historical local script `lib/activation/x157-hire-agent2005.ts` (not a deployed route). Per X.198, no diagnostic endpoint may be added, and POST /negotiate is forbidden.
- Therefore: **"Production-to-seller reachability cannot be proven without adding a diagnostic endpoint or performing the negotiation POST."** (reported verbatim as required)

---

## DNS

**LOCAL: PASS** (A → `103.195.188.198`)
**PRODUCTION: UNKNOWN** (Vercel runtime DNS to `sslip.io` not observable from here)

## TLS

**LOCAL: PASS** (443 reachable, HTTPS `GET /health` 200)
**PRODUCTION: UNKNOWN**

## HTTP

**LOCAL: PASS** (`/erc8183/health` → 200, ~582 ms)
**PRODUCTION: UNKNOWN**

## Seller health

**LOCAL: PASS** (`endpointAlive:true`)
**PRODUCTION: UNKNOWN**

---

## Negotiation

**NOT TESTED** — `POST /negotiate` is forbidden in X.198. Do not infer negotiation success from `/health`.

---

## Root cause status

**UNPROVEN for production.** Local seller health is PASS, but the production failure reported globally (X.196) cannot be attributed to DNS/timeout/http/malformed/network from production without either (a) the X.197 diagnostics being deployed and an authenticated production prepare run, or (b) a dedicated production-side diagnostic. The shared external `sslip.io` host remains the single point of dependency; whether production egress to it is the blocker is unproven.

**Comparison result:** **C. LOCAL PASS / PRODUCTION UNKNOWN**

---

## TermiX readiness

**BLOCKED.** TermiX Tasks 4-6 run through `prepareLiveAgentHire → negotiateSeller`; production reachability of the shared seller is unproven, and the production deployment does not yet carry the X.197 diagnostics that would reveal the failure class. A new paid marketplace hire cannot be safely scheduled until production-to-seller reachability is proven or the seller is moved to a durable reachable host.

---

## Next action (exactly what is required; NOT performed in X.198)

1. **Deploy X.197 diagnostics** (a normal commit/push of the two X.197 files) so the next production prepare run reports the precise failure class (dns / timeout / http / malformed / network) instead of the generic reason.
2. **One authenticated production prepare attempt** (user SIWE session) on an affected agent — read-only w.r.t. blockchain (prepare only negotiates + verifies; no job, no wallet tx). This will surface the exact class and prove production egress (or seller-host /negotiate regression).
3. If the class is `dns`/`timeout`/`network`: production egress to `sslip.io` is the blocker → fix Vercel egress or move the seller to a durable HTTPS host (operator infra action; on-chain repoint of `AgentEndpoint` requires separate authorization).
4. If `http`/`malformed`: the seller's `/negotiate` route is the issue → operator fix on the seller service.

---

## Safety

```
Transactions: 0
Wallet signatures: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
Source changes: 0
Config changes: 0
Deploy: NO
Commit: NO
Push: NO
Credentials: NONE
HARD STOP
```
