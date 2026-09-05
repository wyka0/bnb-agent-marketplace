# X.196 Seller Negotiation Forensic

**Date:** 2026-08-30 · **Mode:** READ-ONLY · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs created:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Source:** UNMODIFIED · **Commit/Push/Deploy:** NONE

> Read-only forensic investigation of the global Hire error "seller negotiation failed or endpoint unreachable". No fix applied, no hire executed, no job created, no POST /negotiate performed (read-only boundary respected).

---

## Executive Result

**Exact failure boundary:** `apps/web/lib/activation/main-track-negotiation.server.ts` → `prepareLiveAgentHire` → **`negotiateSeller`** (line 129-159) — the HTTP **`POST {registeredEndpoint}/negotiate`** returns `null`, so `prepareLiveAgentHire` returns `{ ok: false, reason: "seller negotiation failed or endpoint unreachable" }` (line 245). The failure is in **boundary C→D** (contacting the seller endpoint / receiving a valid negotiation response). It occurs **before** blockchain, wallet confirmation, and ERC-8183 transaction preparation.

**Shared cause (proven):** every currently-affected Live agent's registered endpoint points to the **same single canned-reference seller host** `103-195-188-198.sslip.io` (IP `103.195.188.198`). This is one shared provider dependency, not N independent agent bugs.

---

## Hire Flow

```
Browser (MainTrackHireView — apps/web/app/(app)/agents/[slug]/main-track-hire-view.tsx)
  │  POST /api/activation/main-track-hire { action:"prepare", agentId }
  ▼
Route (apps/web/app/api/activation/main-track-hire/route.ts)
  │  mainTrackHireApi → deps.prepareUserHire
  ▼
prepareLiveAgentHire (apps/web/lib/activation/main-track-negotiation.server.ts)
  ├─ resolveRegisteredEndpoint(agentId)   → on-chain tokenURI → HTTPS A2A endpoint
  ├─ negotiateSeller(endpoint)            → HTTP POST {endpoint}/negotiate   ← FAILURE BOUNDARY
  ├─ verifyQuoteSignature(quote, owner)   → official SDK verdict (EIP-191/1271)
  └─ prepareMainTrackUserHire(...)        → 5-call ERC-8183 plan (chain 97, commerce, $U)
  ▼
Browser wallet (user EIP-1193) → eth_sendTransaction x5 (createJob…fund)  ← NOT REACHED
```

| Boundary | File / function | Method | Timeout | Failure mode |
|---|---|---|---|---|
| UI entry | `main-track-hire-view.tsx` `prepare()` | POST | — | maps `body.error?.message` → "Hire is unavailable…" |
| API | `route.ts` + `main-track-hire.api.ts` | POST `/api/activation/main-track-hire` | — | `prepareUserHire` outcome |
| Endpoint resolver | `resolveRegisteredEndpoint` | `eth_call` tokenURI (chain-97 registry) | — | returns `endpoint:null` → "agent card has no registered…endpoint" |
| **Negotiation** | **`negotiateSeller`** (lines 129-159) | **HTTP POST `{endpoint}/negotiate`** | **15s (`AbortSignal.timeout`)** | returns `null` → "seller negotiation failed or endpoint unreachable" |
| Signature | `verifyQuoteSignature` | SDK, on-chain reads | — | invalid sig → fail-closed |
| Wallet | `MainTrackHireView` `confirmHire` | `eth_sendTransaction` (browser) | — | never reached when prepare fails |

**Failure is confirmed BEFORE blockchain:** the error string originates solely from `prepareLiveAgentHire` returning a non-ok prepare outcome; the wallet/ERC-8183 phase never starts. (Also present as a parallel pure-orchestration path in `packages/integrations/src/altana/v2/hire-adapter.ts:133`, same reason, not the production route.)

---

## Evidence

- `apps/web/lib/activation/main-track-negotiation.server.ts:245` — the only production source of the exact string.
- `negotiateSeller` returns `null` when: fetch throws (DNS/conn/timeout), `!response.ok`, `accepted !== true`, or missing `chain_id/verifying_contract/provider_sig/negotiation_hash`.
- `apps/web/lib/activation/main-track-hire.api.ts` — `prepareUserHire` wired to `prepareLiveAgentHire` (no env, no alternate route).
- `docs/review/Main-Track-X155C-8004Scan-Live-Agent-Audit.md` — registered endpoints: 2005 → `range-keeper.103-195-188-198.sslip.io/erc8183`, 2003 → `health-guard.103-195-188-198.sslip.io/erc8183`.
- `docs/review/Main-Track-Activation-X7-Agent-Discovery.md` — GridPilot (chain 97) shares the same shared health endpoint.
- `docs/review/Main-Track-X156-Dynamic-ERC8183-Hire.md` — same endpoint; live read-only proof that `POST /negotiate` previously returned a valid signed quote (0.001 U, provider `0x0eAc…`, chain 97). So the **schema is known-good**.
- README.md §BNB Agent Studio — same `range-keeper…sslip.io/erc8183` endpoint.

---

## Agent Comparison

| Agent | Registered endpoint (shared host) | Shares dependency? |
|---|---|---|
| 2005 · Canned Range Keeper | `range-keeper.103-195-188-198.sslip.io/erc8183` | YES (same IP/host) |
| 2003 · Canned Health Guard | `health-guard.103-195-188-198.sslip.io/erc8183` | YES (same IP/host) |
| YieldPilot (2044) | canned-reference host (per reported symptom + X.7 family) | YES |
| Canned Grid Keeper | canned-reference host | YES |
| GridPilot (1805) | same shared health endpoint (X.7) | YES |
| Agent 1906 | dead trycloudflare tunnel | separate (own failure, not this error) |

All converge on **one `sslip.io`/IP-backed provider service** → the same negotiation route, resolver, timeout, and signature path. This explains why an unrelated set of agents shows the identical error.

**Read-only live check (this forensic):** `Resolve-DnsName 103-195-188-198.sslip.io` → `103.195.188.198` (resolves); `GET https://range-keeper.103-195-188-198.sslip.io/health` → **200** `{"ok":true,"origin":"CANNED_REFERENCE","identity":"CANNED_REFERENCE_REBALANCING_V1","network":"bsc-testnet","chainId":97,"endpointAlive":true,"startedAt":"2026-08-28T07:03:14.676Z"}`.

> Note: the service is reachable **from this local environment**, but the error is reported **globally in production** (Vercel). Local reachability does NOT prove production (Vercel function) egress/DNS to `sslip.io`. I could not reproduce the production path here: `POST /negotiate` is forbidden by this read-only boundary, and the production prepare API requires SIWE auth + CSRF cookies (no session available). So boundary C (production cannot contact seller) vs D (negotiate response invalid) cannot be fully separated from here — but the shared-host convergence is proven, and X.156 already proved the schema is valid against this exact host.

---

## Production Configuration

| Item | State |
|---|---|
| Provider/seller base URL env | **ABSENT / NOT USED** (endpoint comes from on-chain `tokenURI`, never env) |
| Negotiation service env | **ABSENT / NOT USED** |
| Seller service env | **ABSENT / NOT USED** |
| Provider signature verification config | **NOT USED** (SDK `verifyQuoteSignature`, pinned commerce `0xa206…`, $U `0xc70B…`, chain 97) |
| RPC | **PRESENT** (pinned PublicNode `bsc-testnet-rpc.publicnode.com`) |
| Chain 97 | **PRESENT** (hard-pinned) |
| API keys for negotiation | **NONE / NOT USED** |

No shared env misconfiguration is the cause — the shared dependency is the **single `sslip.io` seller host**, which is reached dynamically by endpoint resolution.

---

## Failure Classification

**4. seller endpoint unavailable** — a shared provider/endpoint dependency.

Concrete evidence:
- All affected agents resolve to the **same `103-195-188-198.sslip.io`** canned-reference seller service (X.155C, X.7, live DNS).
- The error is emitted by the single shared `negotiateSeller` boundary whenever that host's `/negotiate` is unreachable/invalid from the calling server.
- The schema is known-good (X.156 live proof), so a protocol mismatch (6) is not supported by evidence.
- Whether the production failure is the shared host being unreachable from Vercel (8) vs. the `/negotiate` route now failing on that host cannot be fully separated read-only without an authenticated production prepare and a permitted POST — recorded as a caveat, not asserted.

---

## Root Cause

Only what the evidence proves:

1. The marketplace's dynamic Hire negotiates with each agent's **registered on-chain endpoint** via one shared `negotiateSeller` code path.
2. Every currently-affected Live agent's registered endpoint points to the **same single canned-reference seller host** `103-195-188-198.sslip.io` (IP `103.195.188.198`), a `CANNED_REFERENCE` service.
3. When that one host is not reachable/valid from the calling (production) server, **every agent on it** fails identically with "seller negotiation failed or endpoint unreachable" — a **single point of failure**, not per-agent defects.
4. The host is currently reachable locally (health 200), so the outage is a **server-side reachability/egress issue** to that shared host (or a live `/negotiate` regression on it) rather than a code/schema bug.

---

## Recommended Fix (NOT implemented)

1. **Prove production egress:** from the Vercel runtime, run a read-only `GET https://range-keeper.103-195-188-198.sslip.io/health` (and resolve DNS) to confirm the production server can reach the shared host. This separates boundary C (egress) from D (negotiate route).
2. **Durable seller host (per X.150/X.151):** provision a persistent HTTPS host for the canned seller service and re-point the affected agents' on-chain `AgentEndpoint` to the durable URL — removes the `sslip.io`/IP-backed single point of failure. (Operator action; requires authorized registration tx, ~622k gas precedent, not broadcast in this forensic.)
3. **Improve diagnostics only:** surface the precise sub-failure from `negotiateSeller` (DNS / timeout / non-2xx / accepted:false / missing fields) in the error so future diagnosis is exact. Do not hardcode fallback endpoints, do not bypass verification, do not disable negotiation.

---

## TermiX Impact

**Yes — this blocks the 3 paid marketplace hires.** Tasks 4-6 (and any marketplace hire) run through the exact `prepareLiveAgentHire → negotiateSeller` path. If the shared seller host is unreachable/invalid from production, every Hire (including the authorized TermiX tasks) will fail at negotiation with this exact error **before any transaction**, so no job can be created/funded and no TermiX deliverable evidence can be captured. The blocker must be resolved (durable seller host or production egress fix) before the TermiX execution can succeed.

---

## Safety

```
Transactions: 0
Signatures: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
Secrets exposed: NO
Source modifications: 0
Commit: NONE
Push: NONE
Deploy: NONE
POST /negotiate: NOT performed (read-only boundary)
FINAL HARD STOP
```
