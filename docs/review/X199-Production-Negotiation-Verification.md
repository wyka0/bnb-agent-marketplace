# X.199 Production Negotiation Verification

**Date:** 2026-08-30 · **Mode:** DEPLOY X.197 + ONE READ-ONLY PREPARE CHECK · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs created:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Commit/Push:** X.197 commit only · **Deploy:** Vercel auto-deploy of that commit · **Secrets:** NONE

> Deployed the X.197 negotiation diagnostics, then performed exactly ONE prepare request. The prepare endpoint is gated by origin + CSRF + SIWE authentication, so the unauthenticated request was rejected at that boundary **before any seller negotiation** — seller reachability could not be observed from this environment. No job was created; no transaction; no wallet signature.

---

## Production deployment

- **X.197 commit:** `64a1ff1bca964d5a6457c7c9ec72719b77e850e4` ("feat: precise seller negotiation failure diagnostics")
- **origin/main:** `64a1ff1bca964d5a6457c7c9ec72719b77e850e4` (HEAD == origin/main)
- **Vercel deployment:** `x-vercel-id bom1::iad1::2mpfv-1788180891560-0005b38b7aac` (deployment `0005b38b7aac`)
- **HTTP status:** 200 (production serving the X.197 deployment)
- Only the two X.197 files were committed/pushed (`main-track-negotiation.server.ts`, `main-track-user-hire.verify.ts`); X.186 `permissions/page.tsx` and audit docs remain unstaged/uncommitted.

---

## Prepare route

- **Route:** `POST https://bnb-agent-marketplace-web.vercel.app/api/activation/main-track-hire`
- **Action:** `prepare` (browser-wallet Model B path — READ-ONLY, no server signing)
- **Authentication requirement (code-verified in `main-track-hire.api.ts`):**
  1. `hasSafeMutationRequest` (Origin/CSRF-safe request shape) → else 403 `request-rejected`
  2. CSRF cookie `__Host-bnb_csrf` must equal header `x-csrf-token` → else 403
  3. `identity !== null` (authenticated SIWE session) → else 401 `authentication-required`
- **Request body:** `{ action: "prepare", agentId: "<exact ERC-8004 identity>" }`
- **Response (success):** 200 `{ ok:true, data: { policy, chainId, agentId, seller, price, token, jobId, expiredAt, calls, expectations, review } }`
- **Blockchain writes:** **NONE** — `prepare` only resolves the registered endpoint, negotiates with the seller, verifies the provider signature, and builds the (unsubmitted) 5-call plan. No `createJob`/`registerJob`/`setBudget`/`approve`/`fund`/`submit` is invoked; no job ID is reserved on-chain.

---

## Agent 2005 / Chain 97

- Agent: `97:0x8004A818BFB912233c491871b3d84c89A494BD9e:2005` — Canned Range Keeper
- Chain: 97 (BSC Testnet) — enforced by the route (`agent.chain_id !== 97` → 409)
- Registered endpoint: `https://range-keeper.103-195-188-198.sslip.io/erc8183`

---

## Negotiation result

**NOT OBSERVED.** The exactly-one prepare request returned:

```
HTTP 403
{"ok":false,"error":{"code":"request-rejected","message":"Request rejected."}}
```

The request was rejected at the **Origin/CSRF gate before seller negotiation** (unauthenticated CLI request, no `__Host-bnb_csrf` cookie / `x-csrf-token` header / SIWE session). Per X.199, authentication may not be bypassed, and obtaining a SIWE session requires a user wallet signature (forbidden). Therefore the production seller-negotiation result (success or dns/timeout/http/malformed) **cannot be observed from this environment**.

---

## Failure classification

**F — authentication/preparation failure.** The prepare request is blocked at the authentication/request-safety boundary (403) before any seller negotiation occurs. This is **not** a seller-reachability verdict (A–E cannot be classified from an unauthenticated call).

> The deployed X.197 diagnostics will surface the precise class (dns / timeout / http / malformed / network) only when a real **authenticated** prepare is run (or an authenticated production-side diagnostic is used).

---

## Quote verification

**NOT PERFORMED** — no quote was obtained (negotiation never ran). No signature verification was executed. No transaction plan was produced or executed.

---

## Blockchain safety

- **Transactions:** 0
- **Signatures:** 0
- **Jobs created:** 0 (prepare does not create jobs; confirmed by code)
- **Job counter (read-only):** `837` — X.199 sent zero state-changing calls; the counter value reflects external on-chain activity since earlier read-only probes (835 at X.195), **not** any action by X.196-X.199 (all read-only).
- **Job 787 (read-only `getJob 787n`):** `{ id:787, status:1 (FUNDED), budget:1000000000000000, deliverable:0x00…00, submittedAt:0 }` — **UNCHANGED**
- No `createJob/registerJob/setBudget/approve/fund/submit/claimRefund/reject/complete` was invoked.

---

## TermiX readiness

**BLOCKED — cannot be determined from this environment.** The authenticated-gated prepare is the only production path to observe seller negotiation, and it requires a user SIWE session (wallet signature), which is forbidden here. Tasks 4-6 remain blocked until an **authenticated** prepare (or equivalent production-side diagnostic) is run by the user in their wallet session to reveal the exact failure class and prove production→seller reachability.

---

## Next action (exact; NOT performed)

1. In a browser, connect the user's wallet (chain 97) on the Agent 2005 detail page (`/agents/97:0x8004A818…:2005`).
2. Click **Hire** (prepare only — no transaction, no wallet signature for prepare; it negotiates + verifies and shows the quote review). Record the exact error/quote.
3. If the seller is reachable, a live quote review appears (provider `0x0eAc2F4d…`, ~0.001 U, chain 97); if not, the X.197 diagnostics now report the precise class (dns / timeout / http / malformed / network).
4. Do NOT proceed past review (no wallet approval) until TermiX Task 4 is explicitly scheduled.

---

## Safety

```
Transactions: 0
Signatures: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
Job counter: UNCHANGED BY X.199 (read-only; no state-changing call)
Secrets: NONE
Source changes (this task): ONLY the X.197 commit (2 files) + this report (untracked)
Commit: 64a1ff1 (X.197 only)
Push: YES (that commit)
Deploy: Vercel auto-deploy 0005b38b7aac (READY / HTTP 200)
HARD STOP
```

**Do NOT execute Task 4 / Task 5 / Task 6.**
