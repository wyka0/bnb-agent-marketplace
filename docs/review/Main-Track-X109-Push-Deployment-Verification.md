# X.109 Push Vercel Build Fix + Deploy

## 1. Pushed Commit SHA

- Full SHA: `46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`
- Short SHA: `46fcdc6`
- Commit: `fix: build web workspace correctly on Vercel`

Pre-push verification confirmed the commit was exactly one fast-forward ahead of the prior release and changed only `vercel.json`.

## 2. Remote SHA

Push result:

```text
141143b..46fcdc6  main -> main
```

After fetch:

- Local HEAD: `46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`
- `origin/main`: `46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`

No force option was used. No additional commit was created.

## 3. Vercel Deployment ID

- Existing project: `bnb-agent-marketplace-web`
- Project ID: `prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE`
- Deployment ID: `dpl_9BmChoK2f2fUH52FJeL7Xwietp9j`
- Deployment URL: `https://bnb-agent-marketplace-60aazrlvf-solo-25cb.vercel.app`
- Production alias: `https://bnb-agent-marketplace-web.vercel.app`

No new Vercel project was created.

## 4. Deployment Status

**READY / SUCCESS**

Vercel structured metadata reported:

- `readyState: READY`
- Target: production
- Framework: Next.js
- Node runtime: `nodejs24.x`
- Build command: the corrected Prisma + workspace-root Turbo command
- Production alias assigned

GitHub commit status reported:

```text
state: success
description: Deployment has completed
```

## 5. Deployment Provenance

**PROVENANCE: PASS**

Independent evidence binds production to the exact release fix:

- GitHub `origin/main` is `46fcdc6a...`.
- Vercel project metadata reports `githubCommitSha: 46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`.
- Vercel deployment ID `dpl_9BmChoK2f2fUH52FJeL7Xwietp9j` reached READY.
- The deployment received the production alias.
- The production homepage renders the release-only evidence-first copy introduced by the parent release commit.

Production is now reconciled to `46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`.

## 6. Production Routes

Read-only smoke results:

- `/` → `200`
- `/marketplace` → `200`
- `/agents` → `200`
- `/compare` → `200`
- `/categories/rebalancing` → `200`
- `/categories/grid-trading` → `200`
- `/categories/yield` → `200`
- `/categories/health-factor` → `200`
- Representative agent detail route → `200`

All four categories remain present and equally represented.

## 7. Activation Behavior

Production API results:

- `GET /api/auth/me` → `200`, `{"ok":true,"data":null}`
- Unauthenticated `POST /api/activation/hire` → `403`
- `GET /api/altana/session` → `503`

Confirmed:

- No ACTIVE session exists or is fabricated.
- No fake capability or job appears.
- No execution control is exposed for unavailable activation.
- No transaction was created.
- Custody remains unavailable.

## 8. Judge Experience

The production artifact now contains:

- `Risk pending`
- “Discover and compare AI agents ... with registry evidence and explicit boundaries around what can be activated.”
- `Evidence first`
- `Fail-closed activation`
- “Activation is gated until authoritative execution capability and custody are verified.”
- Explicit unavailable and pending states

The previous misleading homepage claims are absent from the primary release surface:

- No “Scoped sessions” journey claim
- No “Live on-chain” monitoring journey claim
- No claim that agents have production execution capability
- No fabricated performance values

## 9. Security Headers

Production returned:

- CSP with per-request nonce and `strict-dynamic`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Restrictive `Permissions-Policy`
- `frame-ancestors 'none'`, `object-src 'none'`, and `upgrade-insecure-requests`

No secret leakage was observed.

## 10. PancakeSwap

Production agent detail retains:

- `PancakeSwap Market Intelligence`
- `PancakeSwap · BSC mainnet · Chain ID 56`
- On-chain reserves and official PancakeSwap price attribution
- Computed TVL
- `24h volume —`
- `APR/APY not available from on-chain data`
- Explicit read-only disclaimer
- No swaps or liquidity transactions
- No execution or LP transaction controls

The PancakeSwap UI verifier also passed all checks.

## 11. TermiX

Production agent detail retains:

- `TermiX Reputation`
- `TermiX AACP · Read-only on-chain reputation`
- Separate attribution from 8004scan
- Honest unavailable identity state
- No composite score
- No marketplace-hire claim
- No transaction claim

The TermiX web verifier passed all checks.

## 12. Regression

Focused release checks passed:

- Capability-source verifier: all checks passed
- Hire API verifier: `14/14`
- Security X.49: `25/25`
- Compare: `10/10`
- Category X.53: `21/21`
- PancakeSwap UI: all checks passed
- TermiX web: all checks passed

The complete X.108 local baseline also passed build, sequential typecheck/lint, activation, Hire, session/session API, security, category X.54, PancakeSwap, and TermiX verification.

X.50 check-24 remains **PRE-EXISTING STALE ASSERTION — PRESERVED**.

## 13. Production Conclusion

The approved release plus Vercel build fix is live on the existing production project. The production alias is bound to a READY deployment sourced from exact SHA `46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`. Routes, registry discovery, category parity, partner read-only surfaces, authentication boundary, security headers, and fail-closed activation behavior are healthy.

## Final Classification

- PUSH: **PASS**
- VERCEL DEPLOYMENT: **PASS**
- PROVENANCE: **PASS**
- PRODUCTION HEALTH: **PASS**
- JUDGE EXPERIENCE: **PASS**
- ACTIVATION SAFETY: **PASS**
- SECURITY: **PASS**

## OVERALL X.109

**RELEASE LIVE AND RECONCILED**

No source modification, additional commit, force push, new Vercel project, activation change, provider change, custody operation, AWS/KMS work, ALTANA work, transaction, Agent 1816 change, Job 515 change, TermiX change, or PancakeSwap execution change was performed after the authorized push.
