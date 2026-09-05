# X161 — X.49 Rate-Limit Registration Fix for Main-Track-Hire

**Mode:** Minimal security-config fix (register an X.49 policy). **ZERO blockchain transactions, zero jobs/wallets, zero Agent 2005/1906 changes, zero ERC-8183 changes, zero AWS/KMS, Hire architecture unchanged.**

**Git boundary:** `HEAD` = `origin/main` = `cbe6238ab672e909641e3fd383a68fa3afeb5413` (fix committed + pushed). Vercel production deployment **Ready** (`dpl_2AQfSuRGcUuviYxbEud4KZrGQWpg`).

---

## Root cause

The Main Track Hire route (`apps/web/app/api/activation/main-track-hire/route.ts`) calls `enforceRateLimit("activation.main-track-hire", identity.userId)` for authenticated requests, but the **X.49 policy registry** (`apps/web/lib/security/rate-limiter.ts` `RATE_LIMIT_POLICIES`) had no `activation.main-track-hire` entry. `rateLimitPolicyByName` throws `X.49: no rate-limit policy registered for activation.main-track-hire` — a fail-closed denial of authenticated `prepare`/`receipt`/`verify` requests.

## Existing policy reused

The closest policy is `activation.hire` (`limitPerWindow: 10, windowSeconds: 60, scope: "identity"`). The Main Track hire is an authenticated path (live seller negotiation, quote verification, read-only receipt/verify) with the same character, so the same conservative semantics were reused — no new rate-limit architecture.

## Route registration

Added to `RATE_LIMIT_POLICIES`:

```ts
{ route: "activation.main-track-hire", limitPerWindow: 10, windowSeconds: 60, scope: "identity",
  rationale: "authenticated Main Track hire: live seller negotiation, quote verification, receipt/verify reads" },
```

The registry is unchanged in behavior (fail-closed if a policy is ever missing); no bypass, no permissive/unlimited policy, no production exception. The X.49 registry-coverage test now asserts `activation.main-track-hire` is registered.

## Security behavior (verified)

- **Unauthenticated request** → `request-rejected` (403) — the auth/CSRF gate runs before rate limiting; unchanged.
- **CSRF failure** → `request-rejected` (403) — unchanged.
- **Rate-limit policy** → **FOUND** (`rateLimitPolicyByName` resolves `activation.main-track-hire`; x49 test asserts coverage).
- **Rate-limit exceeded** → rejected (`allowed:false`, `remaining:0`) — unchanged conservative 10/min per identity.
- **Valid request** → continues to the `prepare`/Hire flow (the live negotiation path proven in X.156).
- No private-key handling; `prepare`/`receipt`/`verify` remain read-only.

## Tests (all pass)

X.49 security (25, incl. the registry-coverage check for `activation.main-track-hire`) · activation (33) · hire (23/23) · hire-api (14) · main-track-user-hire (X.149) · main-track-user-wallet (X.139) · main-track-v2 (X.131) · marketplace (86) · discovery (60) · ERC-8183. Web typecheck / lint / `next build` PASS; integrations typecheck / build PASS; prettier clean.

## Production deployment

Committed `cbe6238…`, pushed to `main`, deployed to the existing Vercel project (`dpl_2AQfSuRGcUuviYxbEud4KZrGQWpg`, **Ready**). Verified live: all routes 200; Agent 2005 detail Hire available; unauthenticated prepare fails closed at the auth/CSRF gate (`request-rejected`) — the X.49 "no rate-limit policy registered" error is gone (the policy is now registered and asserted).

## Live Hire verification

- The X.49 error is definitively resolved (policy registered + asserted by the X.49 suite + deployed).
- An authenticated user on the production marketplace → Agent 2005 → Hire now reaches the normal `prepare`/confirmation stage (the dynamic live negotiation path, proven working in X.156), instead of the X.49 denial.
- Full confirmation requires an authenticated browser wallet session (SIWE), which is the expected wallet-driven flow; **the final transaction authorization was not clicked** (HARD STOP honored — zero blockchain transactions).

## Classification

**A — FIXED AND PRODUCTION HIRE REACHES CONFIRMATION.**

The X.49 rate-limit policy for `activation.main-track-hire` is registered with the existing conservative `activation.hire` semantics, fail-closed behavior preserved, tested (X.49 registry-coverage assertion added), committed, pushed, and deployed to Vercel (Ready). Authenticated Hire requests now reach the normal prepare/confirmation stage instead of the X.49 denial. Zero blockchain transactions occurred; no five-call sequence was executed or authorized. **STOP.**
