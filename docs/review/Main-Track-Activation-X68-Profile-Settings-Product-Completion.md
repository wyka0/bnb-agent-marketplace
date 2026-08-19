# Main Track Activation — X.68: Profile / Settings / Product Completion

**Session:** X.68 — Profile, Settings, and product-completion UX.
**Status:** PASS
**Prior:** X.66 (PASS), X.67 (PASS — agent-detail routing fix).
**Repository:** `C:\bnb-agent-marketplace` (monorepo; `apps/web` Next.js 15.5.23 App Router).

---

## 1. Goal

Finalize the Profile and Settings surfaces so the product works end to end with only real,
existing data. Requirements:

- No fabricated identity, reputation, balances, performance, ownership, or transaction data.
- Honest state for every condition: logged out, logged in, session present, revoked,
  invalid/expired, service unconfigured, mobile and desktop viewports.
- Reuse the existing SIWE/auth/Altana-session/revoke architecture; do not weaken any boundary.
- Mobile navigation must reach Profile / Settings (previously only reachable through the
  xl-only sidebar).
- All gates, verifiers, regression, and production verification green; no commit/push.

## 2. Starting State (audit)

- `app/(app)/profile/page.tsx` — placeholder ("Your identity, wallet, and publisher details
  will live here.") with a static "U" avatar and Breadcrumbs only.
- `app/(app)/settings/page.tsx` — placeholder with Skeletons and stale copy ("arrive with the
  auth phase") plus a placeholder "Session keys and spend caps" card.
- `app/(app)/permissions/page.tsx` — already a complete client-side Altana session manager
  (view, status meta, CSRF, revoke), but its logic was page-local.
- Navigation: `components/sidebar.tsx` includes Settings / Permissions / Profile at `xl+` only;
  `components/top-nav.tsx` (desktop nav from `NAV_ITEMS`) and the mobile menu offered no way
  to reach Profile / Settings on phones/tablets.

## 3. Work Done

### 3.1 Shared session client — `apps/web/lib/account/session-client.ts` (new)

Single `"use client"` implementation shared by Profile, Settings, and Permissions (extracted,
not duplicated):

- `useAuthIdentity()` — reads `/api/auth/me`; returns `{ walletAddress, chainId, sessionExpiresAt? } | null`.
- `useSessionManager()` — reads `/api/altana/session`; exposes `session`, `load`, `message`,
  `busy`, `revokeTxHash`, `refresh`, `revoke`. Revoke flow: `window.confirm(REVOKE_CONFIRM_TEXT)`
  → POST `/api/altana/session/revoke` with `__Host-bnb_csrf` cookie + `x-csrf-token` header;
  handles `key-store-revoked` reconciliation and marks owned sessions revoked.
- `csrfCookie()`, `statusMeta()` (Active / Revoked / Expired / Revocation in progress / Failed /
  Revoked (reconciled) / Reconciliation required), shared types
  (`SessionResponse`, `PublicSessionView`, `AuthIdentity`).
- `REVOKE_CONFIRM_TEXT` preserved verbatim from the permissions page: explains scope, states
  revocation is performed on BNB Testnet, and that it does not modify Agent 1816 or Job 515.

### 3.2 Permissions — `app/(app)/permissions/page.tsx`

Refactored onto the shared hooks with identical behavior and copy. No custody material,
no secret endpoints, no fetches of grant/execute paths, no `stack` echoes (existing verifier
constraints kept green).

### 3.3 Profile — `app/(app)/profile/page.tsx` (rewritten)

Real data only:

- Wallet identity card: full and shortened wallet address (when authenticated), network
  ("BNB Testnet — chain 97"), signed-in state, "Sign in" button when logged out.
- Altana session card: real status via `statusMeta` from `/api/altana/session`; honest
  unavailable/error states (e.g. "Altana session support is not configured on this deployment."),
  link to Permissions.
- Navigation card: Marketplace, Compare, Permissions, Settings links.
- Explicit honesty line: "No username, avatar, reputation, balances, or performance are stored
  or fabricated." No fabricated data rendered under any condition.

### 3.4 Settings — `app/(app)/settings/page.tsx` (rewritten)

Real, working settings only:

- Wallet & authentication card (connect / disconnect via existing `AuthControls`).
- Session management card: live Altana session state with revoke control (disabled for
  revoked/failed sessions; confirm dialog explains scope, testnet, Agent 1816 / Job 515
  non-involvement).
- Security & environment card: honest statements (custody not configured in this environment;
  HSTS/CSP active — verifiable claims only).
- Account controls card: sign-out.
- Unsupported preferences (notifications, email/trading preferences, API keys, payment and
  balance controls) are explicitly not offered — nothing invented.

### 3.5 Navigation — `apps/web/components/top-nav.tsx` (rewritten)

- Desktop (`md+`): unchanged primary nav from `NAV_ITEMS`.
- Mobile (`< md`): new hamburger menu mirroring the HomeNav pattern (`aria-expanded`,
  `aria-controls="mobile-menu"`, toggle icon Menu/X), listing Marketplace, Categories, Compare,
  Leaderboards, Permissions, Settings, Profile, plus an AuthControls block; closes on link click.
- Search button, ThemeToggle, AuthControls (`xl+`) unchanged.

## 4. Gates

- `pnpm typecheck` — PASS
- `pnpm lint` — PASS
- `pnpm build` — PASS (warning: ox `tempo/virtualMasterPool` dynamic dependency in
  dependencies, pre-existing, non-blocking; route table: `/profile` 5.62 kB, `/settings`
  5.54 kB, `/permissions` 4.34 kB, `/agents/[slug]` 14.2 kB, middleware 35 kB).

## 5. Tests

| Verifier | Result |
|---|---|
| marketplace | 83/83 PASS |
| discovery | 59/59 PASS |
| compare | 10/10 PASS |
| activation:hire | 23/23 PASS |
| activation:hire-api | 14/14 PASS |
| altana:session | 25/25 PASS |
| altana:session:api | 72/72 PASS |
| security:x49 | 25/25 PASS |
| categories:x53 | 21/21 PASS |
| security:x55 | 22/22 PASS |
| security:x50 | 34 checks, 1 failure — the known pre-existing stale check-24 (standalone output /
  server-external assertion superseded in X.61), **not modified** |

Note: `session.api.verify` check 60 (revoke confirmation copy) was updated to read the copied
text from its new canonical location `lib/account/session-client.ts` (text unchanged) because
X.68 extraction moved it out of `permissions/page.tsx`; the check still requires the
permissions page to consume the shared manager. Intent of the check (confirmation explains
scope, testnet, Agent 1816 / Job 515 non-involvement) preserved.

## 6. Local State Verification (next start, port 3105)

- `/profile`, `/settings`, `/permissions` → 200; old placeholder strings ("will live here",
  "Skeleton") absent; "Loading authentication state…" initial state present; unauth → Connect
  Wallet state with no fabricated data.
- Top nav: desktop primary links unchanged; mobile hamburger renders (`aria-controls="mobile-menu"`)
  with all 7 links + auth block; sidebar unchanged with `aria-current` on active item.
- `/api/auth/me` → 200 `{"ok":true,"data":null}`; `/api/altana/session` (no custody config) →
  503 "Altana session support is not configured on this deployment." — both rendered honestly
  by the pages (server-provided message, no client-side invention).
- Client chunks contain the unavailable-state rendering paths; error copy arrives from the
  server response, never hard-coded.

## 7. Deployment

- `pnpm dlx vercel deploy --prod --yes` → deployment `bnb-agent-marketplace-m14nmrw5p-solo-25cb`
  READY, aliased to `https://bnb-agent-marketplace-web.vercel.app`.
- Platform build: `prisma generate && rm -rf .next && pnpm build` — success.
- No `.env.local` artifacts left behind.

## 8. Production Smoke Test

### Routes (all 200 unless noted)

`/`, `/marketplace`, `/marketplace?q=yield`, `/compare`, `/login`, `/leaderboards`,
`/categories` (+ grid-trading, health-factor, rebalancing, yield), `/agents`, `/dashboard`,
`/permissions`, `/profile`, `/settings`, `/.well-known/agent-registration.json`,
`/agents/2741%3A0x8004a169fb4a3325136eb29fa0ceb6d2e539a432%3A9893`,
`/agents/2741%3A0x8004a169fb4a3325136eb29fa0ceb6d2e539a432%3A9893/hire` — PASS.
`/agents/a%2Fb` → 404, `/agents/%zz` → 400, `/nonexistent-page-x68` → 404 — PASS (edge guard).

### Content & states

- `/profile`: real identity card, no-fabrication line, Connect Wallet state, session card,
  navigation links; mobile menu + sidebar links present.
- `/settings`: wallet/auth card, session-management card with revoke control, security card,
  account controls; connect state honest.
- `/permissions`: session manager wired to shared hooks; mobile/sidebar reachable.
- Auth APIs: `/api/auth/me` → 200 `{data:null}`; `/api/altana/session` → 503 not configured
  (honest); `/api/auth/nonce` GET → 405.

### Security headers (all pages)

CSP with per-request nonce (`script-src 'self' 'nonce-…' 'strict-dynamic'`), HSTS
`max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` locked — PASS. No secrets/keys in any fetched payload.

### Product journey

HOME → MARKETPLACE (real agents) → SEARCH (`?q=yield` → 200) → DETAIL (encoded identity →
200, "Moody Defender Agent") → COMPARE → HIRE → LOGIN (auth flow entry) → PERMISSIONS →
PROFILE → SETTINGS (revoke control present, confirm text explains scope/testnet/1816/515) —
all reachable, all honest.

## 9. Boundaries

- AWS / KMS: NOT TOUCHED.
- Mainnet: NOT TOUCHED.
- Agent 1816: NOT TOUCHED.
- Job 515: NOT TOUCHED.
- Blockchain transactions: NONE.
- Auth/session/revoke boundaries: unchanged and unweakened.
- Commit: NO. Push: NO.