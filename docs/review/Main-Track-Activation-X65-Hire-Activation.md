# Main Track Activation — X.65 Hire / Activation

**Scope:** local-only completion of a safe activation product path over the
existing SIWE/auth, Altana session, Prisma persistence, custody, public session
view, and revoke architecture. No deployment or infrastructure work.

## Results

| Area | Result | Notes |
|---|---|---|
| HIRE UI | **PASS** | Cards/details no longer show `Hire Soon`; current agents show disabled `Unavailable` with the real classifier reason. A dedicated identity-confirming activation page exists for a verified actionable record. |
| AUTH | **PASS** | Activation API requires existing authenticated identity + same-origin JSON + CSRF. Hire page supports in-place SIWE and refreshes the intended identity afterward. |
| ACTIVATION | **PARTIAL** | Review/confirmation/session adapter is implemented, but current 8004scan records expose no verified pricing/action capability and therefore cannot become ACTIVATABLE. No real session was created. This is the correct fail-closed result. |
| PERMISSIONS | **PASS** | UI shows safe agent identity/category/capabilities/network/scope; successful responses use only `PublicSessionView`. Agent binding adds only `agentId`, `agentName`, `agentSource`. |
| REVOKE | **PASS** | Hire page and Permissions page reuse `/api/altana/session/revoke`; inherited verifier covers revoke, double revoke, reconciliation, ownership, CSRF, and revoked-session execution rejection. |
| MARKETPLACE | **PASS** | Card state derives from existing capability classifier. Current records are disabled/unavailable; only `ACTIVATABLE` records can show `Activate`. No fake button. |
| SECURITY | **PASS** | Exact identity, server recomputed review/digest, ownership, CSRF, identity rate limiting, safe error mapping, public-view allowlist, and secret exclusion verified. |
| BUILD | **PASS** | Sequential typecheck, lint, and final production build pass. New route `/agents/[slug]/hire` builds dynamically. |
| TESTS | **PARTIAL** | Focused/inherited verifiers pass. Aggregate `pnpm test` retains only the pre-existing stale X.50 check-24 `@prisma/client` assertion; X.65 did not touch infrastructure. |

## Existing Architecture Reused

- `getAuthenticatedUser` server identity and SIWE cookies.
- Existing safe mutation request checks and `__Host-bnb_csrf` pairing.
- Existing rate limiter, now identity-scoped for `activation.hire` (10/min).
- Exact 8004scan identity resolution and existing activation classifier/review
  pipeline (`runHireActivation`).
- Existing `createAltanaSession` service; no second session implementation.
- Existing Prisma session store and `publicMetadata` JSON (no schema change).
- Existing `PublicSessionView`, ownership boundary, reconciliation, and revoke
  route/API.
- Existing production-safe `altanaApiErrorMessage` mapping.

## Product Flow

1. Marketplace/details resolve the exact registry `agent_id`.
2. Card/detail state uses `classifyAgentActivation`.
3. Non-actionable records show `Unavailable` / `Activation unavailable` with
   the classifier explanation.
4. An ACTIVATABLE record links to `/agents/<exact agent_id>/hire`.
5. The hire page confirms registry identity, 8004scan source, category
   availability, x402 capability, protocols, network, verification, and
   requested Altana policy scope.
6. Unauthenticated users use existing SIWE in place; no activation request is
   made before authentication.
7. `review` recomputes the exact record and immutable review server-side.
8. `activate` must submit the exact pinned consent digest; the server
   recomputes review and rejects changes.
9. Only after all checks pass does the route construct the existing session
   service and call `createAltanaSession`.
10. A successful session is tagged in existing public metadata with exact
    `agentId`, safe `agentName`, and source `8004scan`.
11. The UI claims Active only after receiving the persisted public session.
12. Revoke reuses the existing authenticated/CSRF-protected route.

## Honest Current State

The documented 8004scan response has no actionable amount/job/expiry/resource
fields. `resolveAgentActivationCapability` therefore returns `null`; chain-56
records are NOT_ACTIVATABLE and chain-97 records without a verified capability
are CAPABILITY_UNKNOWN. Consequently:

- No live marketplace agent exposes enabled Activate today.
- No fake price, capability, permission, agent ID, ACTIVE row, or session is
  created.
- Missing persistence/custody returns an honest safe unavailable response.
- Local runtime returned `503 { code: "activation-unavailable", message:
  "Session persistence is unavailable." }` without stack/config details.

## Files / Changes

- Added pure, injected API core: `lib/activation/hire.api.ts`.
- Replaced `/api/activation/hire` with authenticated review + confirm adapter.
- Added `/agents/[slug]/hire` review/activation UI.
- Reworked details hire panel and mobile bar to capability-aware states.
- Reworked AgentCard standard/detailed copy from `Hire Soon` to
  `Activate`/`Unavailable`; added an honest unavailable reason to card data.
- Bound exact agent identity through existing session `publicMetadata` and
  exposed only safe fields in `PublicSessionView` / Permissions UI.
- Added AuthControls completion callback for in-place SIWE return.
- Updated identity-scoped activation rate-limit policy.

## Verification

### Focused

- `activation:hire:verify` — **23/23 PASS**; explicitly reports signing,
  broadcast, and payment NOT performed.
- `activation:hire-api:verify` — **14/14 PASS**:
  unauthenticated, CSRF, malformed/unknown identity, non-actionable no-create,
  no fake ACTIVE, exact identity, changed consent, safe public session, no
  custody secrets, agent binding, duplicate conflict, DB unavailable, custody
  unavailable.
- `altana:session:verify` — **25/25 PASS** (offline fake adapter/test custody).
- `altana:session:api:verify` — **72/72 PASS**, including ownership, CSRF,
  safe view, revoke, double revoke, revoked execution denial, DB/custody errors.
- `marketplace:verify` — **83/83 PASS**.
- `discovery:verify` — **59/59 PASS**.
- `compare:verify` — **10/10 PASS**.

### Required Gates

- `pnpm typecheck` — PASS.
- `pnpm lint` — PASS.
- `pnpm build` — PASS; `/agents/[slug]/hire` and activation/session routes are
  dynamic.
- `pnpm test` — PARTIAL: all suites through X.49 pass; X.50 check 24 is the
  pre-existing stale `@prisma/client` external-package assertion superseded by
  X.61 direct-import/tracing. It was not weakened or edited.

### Local UI (port 3102, no env credentials)

- `/` — 200.
- `/marketplace` — 200; no `Hire Soon`; unavailable state is honest when live
  data exists (local missing-key view shows no fake cards).
- `/compare` — 200.
- exact agent detail route — 200 honest unresolved state locally.
- exact agent hire route — 200 honest unresolved/not-found state locally.
- `/permissions` — 200 safe empty/unavailable session view.
- Activation API — safe 503 persistence unavailable; no ACTIVE claim.
- Authenticated real activation/revoke UI could not be live-exercised locally
  because database, registry key, and custody configuration are intentionally
  absent. Offline injected verifiers cover those state transitions without a
  real broadcast.

## Explicit Boundaries

- **AWS/KMS: NOT TOUCHED**
- **MAINNET: NOT TOUCHED**
- **AGENT 1816: NOT TOUCHED**
- **JOB 515: NOT TOUCHED**
- **BLOCKCHAIN TRANSACTIONS: NONE**
- **COMMIT: NO**
- **PUSH: NO**
- **DEPLOYMENT: NO**

STOP: X.65 ends here.
