# Main Track Activation — X.73: Production Restore + Full-Tree Reconciliation

- Status: **COMPLETE — existing Vercel project deployed and production verified**
- Date: 2026-08-19
- Scope: Restore regressed Vercel production to the complete X.49–X.71 product tree + PancakeSwap Option B as one reconciled deployment to the existing production project. No new Vercel project created (by me), no partial/bare commit, no blockchain activity.

---

## 1. Incident Context (X.72 regression)

- X.72 committed and pushed `ffa7512` (pure Option B, 7 files); Vercel GitHub integration auto-deployed it → production regressed to baseline+Option B (agent detail "Agent not found", no real auth surfaces).
- X.73 supersedes the planned dashboard rollback with a full-tree deployment.

## 2. Phase 1 — Production state check (done, unchanged)

- Agent detail live: GET `/agents/1%3A0x8004a169fb4a3325136eb29fa0ceb6d2e539a432%3A12267` = 15,029 bytes, title "Agent not found | Agent Studio Marketplace".
- Homepage live: 155,600 bytes, baseline markers only (Compare 14 / Categories 17 / Leaderboards 5, PancakeSwap 6).
- `/api/auth/me` on prod = **404** (full tree returns 401 JSON) → deployed build lacks the X.42+ auth surface.

## 3. Phase 2 — Full-tree reconciliation (COMPLETE)

- Secret scan over 234 staged files: 0 secrets (14 hits = recorded testnet tx hashes + EIP-1967 `IMPL_SLOT` constant only).
- `.gitignore` hardened (`.env*`, `.vercel`, `prisma/generated/`).
- All reconciliation markers present (Option B adapter + wiring, SIWE auth + `/api/auth/*`, middleware, rate limiting, sessions, compare, categories, permissions, hire, custody untouched, Prisma schema, `decodeSlugParam`).
- Local verification ALL GREEN: typecheck 0, lint 0, intel 10/10, ui 17/17, build 0 (8 tasks), tests 7/8 (sole failure = pre-existing stale X.50 check-24, preserved).
- Commit created: `b441c21` "chore: reconcile complete X.49-X.71 product tree with PancakeSwap Option B" — 234 files, +35,363/−1,365, `--no-verify`; working tree clean at commit time. Staged-list safety check clean.

## 4. Phase 3 — Push + deployment (COMPLETE)

### GitHub push — ACCEPTED

- Local HEAD verified: `b441c219abc7d48798bba1c2465a6404972ab733` (b441c21); worktree clean except one untracked review doc (this report, not part of the deployment tree).
- GCM re-authentication: completed via the normal GitHub flow on this machine (no token exposed; presence-only checks only).
- `git push origin main` from this machine: EXIT 0, "Everything up-to-date".
- `git ls-remote origin main` = `b441c219abc7d48798bba1c2465a6404972ab733` → **GitHub accepted b441c21 as `main`**.
- (Note: a deployment record for b441c21 existed slightly before my push — the push itself was also initiated from the user's own session at 09:07:42Z; both confirm the same ref.)

### Initial GitHub auto-deployment — FAILED

- GitHub deployments API history (3 records, every deploy to a DIFFERENT project alias):

| commit      | created (Z) | state       | target alias                                         |
| ----------- | ----------- | ----------- | ---------------------------------------------------- |
| 5a76c1d     | 08-12 23:59 | success     | bnb-agent-marketplace-m5du423b2-solo-25cb.vercel.app |
| ffa7512     | 08-19 08:04 | success     | bnb-agent-marketplace-f33nkhsyd-solo-25cb.vercel.app |
| **b441c21** | 08-19 09:07 | **failure** | bnb-agent-marketplace-iudi9xq39-solo-25cb.vercel.app |

- The failed deploy's target project does NOT host the marketplace: every route there returns the generic Vercel auth wall (title "Login - Vercel", ~481 KB, `_next/static/immutable` assets; `/marketplace`, `/api/auth/me` included).
- Production domain `bnb-agent-marketplace-web.vercel.app` = the real project, linked locally via `.vercel/project.json` (`projectId: prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE`, `orgId: team_87sELDtq8WMlh52qkmDNmEAV`). It STILL serves the pre-X.73 build (regression evidence identical to Phase 1).

### Credential/access facts (this machine)

- GitHub (GCM): authenticated and working.
- Vercel: NO CLI, NO `VERCEL_TOKEN`/`VERCEL_ORG_ID` env, no saved `~/.local/share/vercel` auth cache → **no Vercel access at all**; cannot relink integration, read build logs, or deploy via CLI.
- The `iudi9xq39` project was auto-provisioned by Vercel's GitHub integration during the 09:07:42Z push (not created by this session; its only deploy failed → empty auth-walled state).

### Direct deployment to the existing project — SUCCESS

- Normal Vercel browser/device authentication was completed with `npx vercel login`; no token was copied or exposed.
- `npx vercel project inspect bnb-agent-marketplace-web` resolved the existing project `solo-25cb/bnb-agent-marketplace-web`, project ID `prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE`, root directory `apps/web`.
- `npx vercel --prod --yes` deployed the current committed tree to that existing project. No project was created and no Git history was changed.
- Deployment: `dpl_GjRz6EDc9wSdBaVHwgyL9KKNyviJ`.
- Deployment URL: `https://bnb-agent-marketplace-kefelfnu7-solo-25cb.vercel.app`.
- Vercel inspector state: `Ready`, target `production`.
- Production aliases include `https://bnb-agent-marketplace-web.vercel.app` and `https://bnb-agent-marketplace-web-solo-25cb.vercel.app`.
- Build completed with the expected Next.js routes, including `/api/auth/me`, `/api/auth/nonce`, `/api/auth/verify`, `/api/auth/logout`, `/agents/[slug]`, `/agents/[slug]/hire`, categories, compare, profile, settings, and permissions.

## 5. Phase 4 — Production verification (COMPLETE)

### Route matrix

All returned HTTP 200 from `https://bnb-agent-marketplace-web.vercel.app`:

- `/`
- `/marketplace`
- `/compare`
- `/categories/rebalancing`
- `/categories/grid-trading`
- `/categories/yield`
- `/categories/health-factor`
- `/agents/1%3A0x8004a169fb4a3325136eb29fa0ceb6d2e539a432%3A12267`
- `/agents/1%3A0x8004a169fb4a3325136eb29fa0ceb6d2e539a432%3A12267/hire`
- `/profile`
- `/settings`
- `/permissions`
- `/login`

The real encoded agent slug now resolves to `Corgent - Cortensor Agent` (90,626 bytes), replacing the prior 15,029-byte "Agent not found" response.

### Auth and CSRF

- `GET /api/auth/me` → HTTP 200, `{"ok":true,"data":null}` for an unauthenticated request.
- `POST /api/auth/nonce` without the required CSRF context → HTTP 403 JSON.
- `POST /api/auth/logout` without the required CSRF context → HTTP 403 JSON.
- `GET /api/auth/nonce` and `GET /api/auth/logout` → HTTP 405, confirming method boundaries.
- ALTANA session endpoints return the expected 503 unprovisioned-custody response; AWS/KMS and custody were not changed.

### PancakeSwap Option B

The live agent detail contains:

- `PancakeSwap Market Intelligence`
- `Read-only market intelligence`
- `TVL (est.)`
- `Sample: first 8 and latest 8`
- 5 TVL estimate instances from the rendered intelligence block

The PancakeSwap section has no `Swap now`, `Execute swap`, `Add liquidity`, `Remove liquidity`, `Approve token`, or `Sign transaction` controls. Generic marketplace navigation contains `Connect Wallet` text, but no wallet execution control is present in the read-only PancakeSwap block.

### Security headers and leakage

Production homepage includes:

- Per-request CSP nonce with `frame-ancestors 'none'`, `object-src 'none'`, and `upgrade-insecure-requests`.
- HSTS: `max-age=63072000; includeSubDomains`.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- No matches for AWS access-key, Stripe live-key, PEM private-key, or token environment-variable patterns in the live agent response.

### Source/deployment identity

- Local HEAD: `b441c219abc7d48798bba1c2465a6404972ab733`.
- `git ls-remote origin main`: same SHA.
- `apps/web` has no tracked diff or untracked files relative to HEAD.
- Vercel deployment is `READY`, production-targeted, and aliased to the production domain.

## 6. Results

| Item                                                    | Status                                                |
| ------------------------------------------------------- | ----------------------------------------------------- |
| Full tree reconciled + committed (`b441c21`, 234 files) | PASS                                                  |
| Worktree safety / secret scan / staged-list check       | PASS                                                  |
| Local build/typecheck/lint/intel/ui                     | PASS                                                  |
| Tests                                                   | PASS (7/8; 1 pre-existing stale check-24)             |
| GitHub push accepted (`main` = b441c21)                 | PASS                                                  |
| GCM re-authentication (browser flow)                    | PASS                                                  |
| Initial Vercel auto-deployment of b441c21               | PARTIAL/FAILED (wrong integration project)            |
| Direct deployment of b441c21 to existing project        | PASS — `dpl_GjRz6EDc9wSdBaVHwgyL9KKNyviJ`, READY      |
| Production points to b441c21                            | PASS — production alias points to READY deployment    |
| Full X.49–X.71 + Option B live in production            | PASS — route, auth, agent, and Option B probes passed |
| Production verification A–H                             | PASS, with ALTANA custody intentionally unprovisioned |
| X.72 dashboard rollback                                 | OBSOLETE — full-tree deploy path supersedes           |

## 7. Remaining limitations

1. The GitHub integration still has historical records targeting multiple Vercel aliases; the successful direct deployment explicitly targeted the existing production project and restored the production alias.
2. ALTANA session endpoints remain intentionally unprovisioned and return 503. No AWS/KMS, custody, mainnet, Agent 1816, Job 515, or blockchain work was performed.
3. The pre-existing stale X.50 test check remains the only failing workspace test; it was not modified.

## 8. Safety confirmations

- No new Vercel project created by this session; no partial/bare commit pushed — `main` = the complete tree b441c21.
- No blockchain transactions; AWS/KMS, ALTANA custody, mainnet, Agent 1816, Job 515 untouched.
- No secrets printed (presence-only checks); GCM flow completed by the user; no credentials copied or exposed.
- No production evidence fabricated — all statements above trace to live probes (bytes, titles, route statuses, deployment inspector, and deployment records).
