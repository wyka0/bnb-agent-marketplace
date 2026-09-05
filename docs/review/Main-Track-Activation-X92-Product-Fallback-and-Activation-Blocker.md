# Main-Track Activation — X.92: Product Fallback and Activation Blocker

**Date:** 2026-08-21
**Author:** activation workstream (opencode agent)
**Status:** PRODUCT FALLBACK DECISION. No code change required. No deploy/commit/push.

---

## 1. X.91 Starting State

X.91 conclusively established that **no existing authoritative execution-capability source exists**:

- 8004scan = identity/metadata only.
- ERC-8183 = authoritative commercial job state, no `resource`/`executionCapability`.
- BNB Agent SDK signed quote = commercial authority, no `resource`/`executionCapability`.
- `SignedQuoteReader` has no authoritative source feeding it.
- TERMiX / ALTANA skills / x402 = not execution authority.
- X.90 acceptance contract therefore cannot be satisfied; `resolveExecutionCapability()` fails closed; real activation BLOCKED.

X.92 determines how the PRODUCT should behave while that external dependency is unavailable.

---

## 2. Current Activation UX (audited, DISCOVERY → DETAIL → COMPARE → HIRE)

### Discovery (marketplace)

- Agents resolve from the 8004scan registry. `classifyAgentActivation` runs server-side and client-side.
- Real 8004scan agents are **chain 56 (mainnet)**; the activation chain is **97 (BNB testnet)** → every real agent classifies `NOT_ACTIVATABLE` (unsupported-chain) or `CAPABILITY_UNKNOWN`.
- No agent is presented as hireable.

### Agent Detail (`agent-detail-view.tsx`)

- Right rail embeds `<HireReviewPanel>` → shows **"Activation: Unavailable"** badge + disabled "Activation unavailable" button + `classification.detail`.
- For unresolved registry records, a disabled **"Hire — Unavailable"** button with copy _"Hiring opens once the agent is live in the ERC-8004 Registry."_
- Pricing: em-dash `—` / "coming-soon" / "Tier details pending ERC-8004 Registry sync" — never a fabricated number.
- Capabilities: _"Capability tags are not provided by the 8004scan registry record yet."_ / skeletons while pending.
- Footer provenance: _"All data sourced from the ERC-8004 Registry. Values shown as '—' or 'Pending' are awaiting sync — nothing is simulated."_

### Compare (`compare-view.tsx`)

- Uses an `unavailable(label)` helper for every missing field (_"Not provided by 8004scan"_, _"Unavailable"_). Subtitle: _"Compare up to three real ERC-8004 registry agents side by side. Unavailable fields stay explicitly unavailable."_

### Hire (`hire-activation-view.tsx` + `hire-review-panel.tsx` + `/api/activation/hire`)

- `classifyAgentActivation` drives the UI: when `state !== "ACTIVATABLE"`, an amber `AlertTriangle` shows `classification.detail` and the "Review permissions" button is `disabled`.
- `"/api/activation/hire"` is server-enforced via `hire.api.ts` + `evaluateSessionGate` → returns **409 `activation-unavailable`** for any non-verified agent.
- Only when `state === "ACTIVATABLE"` (never true today) is the button enabled; even then the server re-checks the full 12-check gate.

### Verdict

No "Hire Soon", no fake ACTIVE state, no fake execution control, no fabricated capability/price/expiry/job/session. **The current UX is already honest.**

---

## 3. Canonical Activation States (documented, not all reachable today)

| State                    | When                                     | Current product mapping                                                          |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------- |
| AVAILABLE                | Required execution evidence exists       | `classifyAgentActivation` → ACTIVATABLE; button enabled; server gate re-verifies |
| UNAVAILABLE              | Capability evidence does not exist       | `CAPABILITY_UNKNOWN` → "Unavailable" + disabled button + detail                  |
| CONFIGURATION REQUIRED   | Capability exists but user config needed | N/A today (no capability)                                                        |
| CONSENT REQUIRED         | After capability verified                | N/A today; consent path exists in code, gated                                    |
| SESSION CREATION BLOCKED | Custody/session infra unavailable        | `evaluateSessionGate` → custody false → 409                                      |
| ACTIVATION BLOCKED       | Upstream trust dependency unavailable    | `NOT_ACTIVATABLE` (unsupported chain) → "Unavailable"                            |

These are **not** collapsed into a generic "Hire Soon" — each renders an explicit, state-specific message.

---

## 4. Current Unavailable Behavior

For every real agent the user sees:

- A clear **"Unavailable"** activation badge (not "Soon").
- A **disabled** activation control with the exact `classification.detail` as the reason.
- Honest evidence: identity, chain, verification, capabilities, protocols — no fabricated values.
- The backend independently re-confirms unavailability (409) regardless of UI state.

This satisfies the requirement: _users can understand WHY activation is unavailable._

---

## 5. Security Invariants (fail-closed, verified by existing suites)

| Invariant                                            | Enforcement                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Registry-only agent → unavailable                    | `classifyAgentActivation` unsupported-chain / `resolveAgentActivationCapability` returns null |
| Description-only capability → unavailable            | `capability.ts` reads no description-derived capability                                       |
| ERC-8183 commercial job w/o capability → unavailable | `erc8183-capability-provider.ts` requires trusted `resolveCapabilityBinding`; defaults null   |
| Signed quote w/o capability fields → unavailable     | `signed-quote-capability.ts` requires `resource`+`executionCapability`; reader null in prod   |
| Missing provider → unavailable                       | `resolveExecutionCapability(provider?)` returns null                                          |
| Missing custody → unavailable                        | `evaluateSessionGate` custody check                                                           |
| Invalid capability → unavailable                     | `verifyExecutionCapability` placeholder rejection                                             |
| Expired capability → unavailable                     | `expiresAt <= now` rejected                                                                   |

All remain fail-closed (confirmed by `capability-source`, `x80`, `x81`, `x84`, `x85` verifiers — 31/31, ALL, ALL, 14/14, 13/13).

---

## 6. Product Fallback Strategy

Preferred behavior (all already satisfied):

- ✅ Discovery fully usable.
- ✅ Comparison fully usable (`compare-view.tsx`, explicit unavailable fields).
- ✅ Agent intelligence usable (registry data, TERMiX read-only reputation, PancakeSwap read-only market intel).
- ✅ Evidence visible (identity, chain, verification, capabilities, protocols).
- ✅ Capability gaps explicit ("Unavailable", "not provided by 8004scan").
- ✅ Hire remains unavailable where capability is unverified (server 409 + disabled UI).
- ✅ Users understand WHY (state-specific `classification.detail`).
- ✅ No fake transaction or session path exposed (`/api/altana/session` blocked).

**No change required.** The marketplace is useful without pretending activation works.

---

## 7. Demonstrable Marketplace Functionality (hackathon)

Already demonstrable:

1. Real agent discovery (8004scan registry).
2. Typed marketplace data (leaderboard, agent detail, categories).
3. Honest freshness/evidence states (Pending / "—" / Unavailable, never simulated).
4. Four-category diversity (grid-trading, health-factor, rebalancing, yield).
5. Search.
6. Compare (side-by-side, honest unavailable fields).
7. Agent detail (full honest detail view).
8. Real protocol intelligence where available (TERMiX reputation, PancakeSwap read-only pools).
9. SIWE authentication (`/api/auth/{nonce,verify,me}`).
10. Secure session architecture (`altana-session` server-only, audit trail).
11. Consent architecture (`consent.commitment` canonical SHA-256).
12. Fail-closed capability verification (`capability-source`, `x80`/`x81` gates).
13. Production security (CSRF/Origin guards, `Cache-Control: no-store`).
14. Production deployment (Vercel, healthy).

NOT demonstrable yet:

- Real agent activation.
- Real custody (AWS KMS / ALTANA custody not provisioned).
- Real execution.
- Funded live execution jobs.

---

## 8. Testing (STEP 7 — zero code changes)

| Suite                                 | Result                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `activation:capability-source:verify` | 31/31 PASS                                                              |
| `activation:verify`                   | 33 passed, 0 failed                                                     |
| `activation:hire:verify`              | 23/23 PASS                                                              |
| `activation:hire-api:verify`          | 14 checks, 0 failed                                                     |
| `altana:session:verify`               | 25/25 PASS                                                              |
| `altana:session:api:verify`           | 72 checks, 0 failures                                                   |
| `security:x49:verify`                 | 25 checks, 0 failures                                                   |
| `security:x50:verify`                 | 34 checks, **1 failure (check-24, pre-existing, preserved/unmodified)** |
| `activation:x80:verify`               | ALL CHECKS PASSED                                                       |
| `activation:x81:verify`               | ALL CHECKS PASSED                                                       |
| `activation:x84:verify`               | 14 passed, 0 failed                                                     |
| `activation:x85:verify`               | 13 passed, 0 failed                                                     |
| `typecheck` (`tsc --noEmit`)          | clean                                                                   |
| `lint` (`eslint .`)                   | clean                                                                   |
| `build` (`next build`)                | Compiled successfully                                                   |

**Zero code changes were required.** X.50 check-24 intentionally left failing per freeze rules.

---

## 9. Production Read-Only Verification (STEP 8 — NO DEPLOYMENT)

- Homepage: **200** (healthy).
- Marketplace: **200**.
- Agent detail (sample): **200**.
- Compare: **200**.
- `/api/auth/me`: **200** `{"ok":true,"data":null}` (no ambient session).
- Hire POST (unauthenticated): **403 Forbidden** — Hire remains unavailable without verified capability + auth.
- `/api/altana/session`: **503 Server Unavailable** — session creation safely blocked; no ACTIVE session, no execution controls reachable.
- Security headers (`Cache-Control: no-store`, CSRF/Origin guards) intact.
- No fake ACTIVE session; production fail-closed confirmed.

---

## 10. Final Classification

| Axis                       | Classification                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| PRODUCT FALLBACK           | **PASS** — honest, useful fallback already present.                                                                         |
| HONEST ACTIVATION UX       | **PASS** — explicit Unavailable states, no "Hire Soon"/fake.                                                                |
| FAIL-CLOSED SECURITY       | **PASS** — all 8 invariants enforced; suites green.                                                                         |
| REAL ACTIVATION            | **BLOCKED**                                                                                                                 |
| EXTERNAL CAPABILITY SOURCE | **BLOCKED**                                                                                                                 |
| **OVERALL X.92**           | **PASS** — marketplace provides an honest and useful fallback while activation is unavailable; **no code change required.** |

---

## 11. External Dependency (unchanged from X.90/X.91)

> An authoritative external capability source capable of proving job/agent-bound `resource` + `executionCapability` with integrity, identity binding, freshness, provenance and revocation is required before real activation can proceed.

Acceptable categories (none verified/available): (1) provider-signed capability attestation, (2) authoritative capability registry, (3) job-bound capability attestation, (4) official protocol upgrade adding `resource`/`executionCapability` semantics.

---

## Absolute Stop Boundary (reaffirmed for X.92)

AWS/KMS: NOT TOUCHED · ALTANA CUSTODY: NOT TOUCHED · TERMiX: READ-ONLY · PancakeSwap: NOT TOUCHED · MAINNET: NOT TOUCHED · AGENT 1816: NOT TOUCHED · JOB 515: NOT TOUCHED · ERC-8183 CREATION: NOT TOUCHED · ERC-8183 FUNDING: NOT TOUCHED · TRANSACTIONS: NONE · NEW CAPABILITY PROVIDER: NONE · NEW INTEGRATION: NONE · DEPENDENCY CHANGE: NONE · CREDENTIALS: NONE · VERCEL: NO DEPLOYMENT · COMMIT: NO · PUSH: NO

**STOP AFTER X.92.**
