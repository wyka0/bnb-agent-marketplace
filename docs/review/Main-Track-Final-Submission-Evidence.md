# Main Track — Final Submission Evidence (BNB Agent Studio Marketplace)

**Production checkpoint:** `b441c21` (chore: reconcile complete X.49-X.71 product tree with PancakeSwap Option B)
**Production URL:** https://bnb-agent-marketplace-web.vercel.app/
**Prepared from:** X.93 (Judge Experience Audit) + X.94 (Production/Submission Readiness Audit)
**Classification:** READY — OUTCOME A (no code changes; audit + documentation only)
**Honesty posture:** Real agent activation is BLOCKED; the product is presented as a production-ready _marketplace experience_, never as a live execution platform.

---

## 1. Product summary

BNB Agent Studio Marketplace is a production-oriented marketplace for discovering, understanding, and comparing autonomous AI agents on BNB Chain. It is built on real ERC-8004 registry data (8004scan), with evidence-first trust boundaries, four equal-priority categories, search, comparison, protocol intelligence, secure SIWE authentication, and a fail-closed activation pathway. No execution capability is fabricated.

## 2. Main Track problem solved

BNB agents need a **trustworthy marketplace**: a place where a user can find an agent, understand its real on-chain provenance and reputation evidence, compare alternatives side-by-side, and reach a clearly-bounded hire/activation decision — without being misled by simulated capability, fake APY, or false "live" status.

## 3. Discover experience

- Home → Marketplace with a real agent grid, honest loading/empty/offline states.
- Global client-side search over name / capability / protocol / category with result counter and match highlight.
- Progressive disclosure filters (Category, Verification, Risk, Protocols, Builder, Registry, Activity, Status) applied instantly; active filters mirrored in a removable chip bar.
- Category navigation via the four equal-priority routes and the marketplace Category facet (backed by bounded BSC discovery inference, never an 8004scan classification).
- Agent cards follow the identity → trust → capability → action hierarchy; every card shows a registry-status badge.
- Registry provenance is labelled ("8004scan"); freshness is surfaced via `RegistryBadge` (synced / waiting / offline).

## 4. Agent detail / understanding

`/agents/[slug]` presents: identity, owner (when resolved), full registry record (chain, token, contract, scores, x402 flag, timestamps), and three independent evidence blocks:

- **8004scan registry** (primary source).
- **TERMiX AACP** — read-only on-chain reputation (BSC Testnet chain 97), shown separately and never combined into a composite score.
- **PancakeSwap** — read-only market intelligence (TVL from on-chain reserves × official USD price; 24h volume and APR/APY are never fabricated and render as "—").

Verification gaps show `Pending`; risk shows `Risk pending` (corrected in X.93 from a fabricated green "Low risk"); provenance footer states "nothing is simulated".

## 5. Search

Client-side, real-record search with priority (name → capability → category → protocol → builder). Highlights the matched field; result counter reports "N agents found for 'X'"; zero results shows a friendly reset state. No fabricated results.

## 6. Compare

`/compare` is URL-backed (`?compare=slug,slug,slug`), max 3 agents, duplicate-prevented, with remove/clear and empty/one-agent states. Missing or unavailable fields are shown explicitly ("—", "Not classified by 8004scan", "Not provided by 8004scan") — never invented. Exact registry identities (slug) are used throughout.

## 7. Four equal-priority categories

All four routes exist and render equally (Blueprint principle 6 — no category visually favored):

- `/categories/rebalancing`
- `/categories/grid-trading`
- `/categories/yield`
- `/categories/health-factor`

Each surfaces via BSC-discovery inference with evidence excerpts; verification gaps and unavailable states are honest.

## 8. Data quality / provenance

| Field                     | Source                             | Fallback                        |
| ------------------------- | ---------------------------------- | ------------------------------- |
| Agent identity / registry | 8004scan                           | pending                         |
| Verification              | 8004scan                           | Pending                         |
| Protocols / x402          | 8004scan record                    | "None listed" / "Not supported" |
| Risk                      | none provided                      | "Risk pending"                  |
| Registry status           | 8004scan sync                      | waiting / offline               |
| PancakeSwap TVL           | on-chain reserves × official price | "—"                             |
| PancakeSwap 24h vol / APR | not on-chain                       | never shown                     |
| TERMiX reputation         | AACP (read-only)                   | honest unavailable              |
| Freshness                 | record timestamps                  | "—"                             |

No fake APY, TVL, health factor, price, or execution capability. Every displayed value is source-attributed.

## 9. Authentication and security

- **SIWE**: nonce issued server-side; signature verified; wallet ownership enforced before any session action.
- **CSRF**: `__Host-bnb_csrf` cookie + `x-csrf-token` header, same-origin only.
- **Session controls**: creation, rotation, revocation (idempotent) via `lib/altana-session`.
- **Rate limiting**: PostgreSQL-backed.
- **Safe error mapping**: non-Error → 500; custody-specific errors classified separately; no stack traces / secrets leaked.
- **Security headers** (verified live): CSP with per-request nonce + `strict-dynamic` (no unsafe/wildcard, no third-party origin), HSTS (`max-age=63072000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera/geolocation/microphone/payment/usb.

## 10. Hire eligibility

`/agents/[slug]/hire` is a review/eligibility surface. It gated by `classifyAgentActivation`: only registry-resolved, non-testnet, activatable agents can even reach "Review permissions". All other agents show an honest "Unavailable" state with the reason. No activation is claimed until the server returns a persisted active session.

## 11. Activation trust boundary

The chain is fail-closed end-to-end (verified by suites):
SIWE → ownership → CSRF → consent digest → **capability verification** → **exact server-resolved identity match** → **session gate** → rate limiting → session creation → revoke.

Hard distinctions enforced:

- ERC-8004 registry listing ≠ executable capability.
- Agent description ≠ executable capability.
- Self-asserted capability ≠ authoritative capability.
- ERC-8183 commercial job ≠ execution capability.
- Signed quote ≠ execution capability without required attestation.

Authoritative capability resolution lives in `lib/activation/capability-source.ts` (X.76). Read-only providers: X.81 (ERC-8183), X.84 (registration-file candidate), X.85 (signed-quote verifier). None fabricate ACTIVE.

## 12. Honest unavailable states

- Registry offline / missing API key → skeletons + "Waiting for ERC-8004 Registry" + retry.
- No agents match → contextual empty state with clear filters.
- Unresolved agent → "Pending Category", em-dash fields, disabled Hire.
- Unavailable agent in hire → amber alert + disabled button + `classification.detail`.
- `/api/altana/session` with no custody → **503** (honest, not a fake session).

## 13. PancakeSwap read-only intelligence

PancakeSwap Option B: keyless, read-only market intelligence. TVL computed from on-chain reserves × official USD prices; token prices from official sources; fee tier and reserves shown. 24h volume and APR/APY are explicitly not available on-chain and render as "—". A mandatory read-only disclaimer and sample scope are displayed. No swaps, approvals, or LP transactions are performed or implied.

## 14. TERMiX integration status

TERMiX AACP reputation is integrated **read-only** (server-fetched, browser never calls the TermiX backend directly). It is a separate signal from 8004scan and is never merged into a composite score. When no deterministic ERC-8004 → AACP identity mapping exists, the honest "unavailable for this identity" state renders. No experiment reruns were performed to improve numbers.

## 15. Production readiness

- `pnpm build`: success (all routes compile, including the four category pages, marketplace, compare, hire, leaderboards, dashboard, profile, settings, permissions, and all APIs).
- `pnpm typecheck`: clean. `pnpm lint`: clean.
- All GET routes return 200 in production; `/api/auth/me` returns 200 `{"ok":true,"data":null}` unauthenticated; hire POST returns 403 unauthenticated; `/api/altana/session` returns 503 when custody is unavailable.
- X.50 check-24 is a **known, intentionally preserved stale assertion** (not modified to obtain green).

## 16. Known limitations (disclosed, not hidden)

1. No authoritative external execution-capability source exists (X.91 OUTCOME C).
2. ALTANA custody is not provisioned; AWS/KMS is not configured (NOT touched).
3. No real funded execution job exists; no real execution has been authorized.
4. Therefore CONFIGURE and live MONITOR/MANAGE of running agents are not available and are shown honestly, not simulated.
5. Agent risk is not provided by 8004scan and is shown as pending.
6. Leaderboard "Category" column is "—" because 8004scan does not classify category (honest).

## 17. Judge demo path

HOME → MARKETPLACE → CATEGORY → AGENT → EVIDENCE (TermiX + PancakeSwap blocks) → COMPARE → HIRE → PERMISSIONS → PROFILE → SETTINGS. Every step resolves 200; CTAs are clear; unavailable/coming-soon states are honest; the activation boundary is explicit. A judge can understand the product and its trust posture in under 30 seconds.

## 18. Verification evidence

| Suite                           | Result                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------- |
| capability-source (X.76)        | ALL PASSED                                                                    |
| activation (P12)                | 33 passed, 0 failed                                                           |
| hire (X.6)                      | 23/23 — SIGNING NOT PERFORMED, BROADCAST NOT PERFORMED, PAYMENT NOT PERFORMED |
| hire-api (X.65)                 | 14 passed, 0 failed                                                           |
| session (X.45)                  | 25/25 PASS                                                                    |
| session-api (X.47)              | 72 checks, 0 failures                                                         |
| security:x49                    | 25 checks, 0 failures — Agent 1816 / Job 515 have no executable coupling      |
| x80 consent+session-gate        | ALL PASSED — never fabricates ACTIVE                                          |
| x81 ERC-8183 read-only provider | ALL PASSED — never bypasses custody                                           |
| x84 capability candidate        | 14 passed, 0 failed                                                           |
| x85 signed-quote verifier       | 13 passed, 0 failed                                                           |
| typecheck / lint                | clean                                                                         |
| build                           | success                                                                       |

## 19. Production checkpoint

- **HEAD SHA:** `b441c219abc7d48798bba1c2465a6404972ab733`
- **Project:** `bnb-agent-marketplace-web`
- **URL:** https://bnb-agent-marketplace-web.vercel.app/
- **State:** all X.72–X.94 work present as the working tree (uncommitted per no-commit boundary).

## 20. Exact activation blocker

Real activation requires an **authoritative execution-capability source** that satisfies the X.90 acceptance contract (verified provider returning `VerifiedExecutionCapability` with real resource/attestation), plus provisioned ALTANA custody (AWS/KMS) and a real funded job. None exist today. The marketplace deliberately stops at hire _eligibility_ and a fail-closed consent/activation boundary, and does not fabricate capability, jobs, sessions, or execution. This is the single, clearly-communicated gap between "submission-ready marketplace" and "live agent execution."

---

**Submission positioning (truthful):** FUNCTIONALITY (Discover → Understand → Compare → Hire eligibility), DATA QUALITY (real registry data, source attribution, no fabricated metrics), AGENT DIVERSITY (four equal categories), TRUST (ERC-8004 identity ≠ execution authority; fail-closed until authoritative evidence exists), SECURITY (SIWE, CSRF, same-origin, sessions, rate limiting, hardened headers, no secret leakage).
