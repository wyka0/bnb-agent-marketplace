# Final QA Report — BNB Agent Marketplace

**Date:** 2026-08-11
**Scope:** Full final QA pass over the completed feature work: Marketplace, Agent Details, Compare, Leaderboards, 8004scan (keyless), Altana (read-only + boundaries), TermiX AACP (read-only reputation UI), PancakeSwap (P1 adapter / P2 server / P3 UI). STRICT MODE — no new features, no redesign, no installs, no credentials, no git.
**Method:** Fresh inspection of repo state + review docs; live build gates; all 12 verify suites; live server smoke tests of all routes; live read-only external checks; security/bundle/path/artifact audits.

---

## 1. Executive Summary

The repository is **release-eligible with two documented action items**. All build gates and all 12 integration verification suites pass. The 8004scan keyless path is verified live (honest `missing-key` state, no crash, no credential exposure). TermiX and PancakeSwap sections render honestly on Agent Details (verified in rendered HTML). Security audits are clean: no secrets, no bundle exposure, no personal paths, no env leaks, clean dependencies, clean CI/Docker.

Two items require attention:

1. **HIGH (functional, non-security) — PancakeSwap live data endpoint is decommissioned.** The P1/P2 constant `PANCAKESWAP_V2_SUBGRAPH_URL = https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2` now returns **404**. The official developer docs moved the BSC V2 subgraph to NodeReal MegaNode / The Graph gateway — both of which require an API key. Adding credentials is forbidden in this QA phase, so **no code fix is possible within STRICT MODE**; the UI already degrades honestly (verified: "temporarily unavailable" server-error state, no crash, no fake data). Remediation is documented (two constant locations + where the key comes from) and is a required post-publication action.
2. **MEDIUM (housekeeping, pre-existing) — screenshot bloat tracked in `docs/`** (~10.9 MB across `docs/review/screenshots/` + `docs/screenshots/`). Not gitignored; should be trimmed or gitignored before publication.

Additionally, this QA found and fixed one real data-honesty bug: the PancakeSwap section copy implied pool ownership/association ("pools associated with this agent's trading/liquidity skills" and "unavailable for this agent"). Both phrasings were removed (pools are global top-TVL, never agent-associated) and the UI verify harness now fails if any such wording returns.

**Risk level: LOW. No CRITICAL findings. Zero security/release blockers.**

---

## 2. Repository State

- Not a git repository (no `.git` — confirmed). Nothing staged/committed; no credentials can be leaked via history.
- No `.env` / `.env.local` / `.env.*.local` present anywhere (only `.env.example` at root and `prisma/.env.example`, both placeholders/defaults).
- Workspace: 8 packages (`apps/web`, `apps/worker`, `packages/{config,data-api,integrations,telemetry,ui}`, `prisma`) + root tooling (turbo 2.10.8, eslint 9, typescript-eslint 8, prettier 3, typescript 5.9, husky, lint-staged).
- Newest review doc is this phase's `PancakeSwap-UI-Integration-P3.md` (2026-08-11 01:45); no newer docs exist.

## 3. Build Results

| Gate             | Result                                                             |
| ---------------- | ------------------------------------------------------------------ |
| `pnpm lint`      | ✅ 12/12 tasks successful (11 cached, 1 executed)                  |
| `pnpm typecheck` | ✅ 12/12 tasks successful                                          |
| `pnpm build`     | ✅ 7/7 tasks successful; 18 routes; Next.js 15.5.23 compiled clean |

Route table (unchanged from intended state): 16 static (`○`), 2 dynamic (`ƒ`) — `/agents/[slug]` and `/leaderboards`, both intentional (server-side data). No unrelated route became dynamic. Build runs fully keyless. The "Next.js plugin not detected in ESLint" warning is pre-existing and informational (flat ESLint config).

## 4. Integration Verification — all 12 suites, exit 0

| Suite                            | Result           | Notes                                                           |
| -------------------------------- | ---------------- | --------------------------------------------------------------- |
| `altana:verify`                  | ✅ 0             | live chain-97 read-only probe (balance read, no tx)             |
| `altana:erc8183:verify`          | ✅ 0             | construction/read/boundary; submission BLOCKED (no signer)      |
| `altana:skills:verify`           | ✅ 0             | metadata only; non-executable boundary enforced                 |
| `altana:x402:verify`             | ✅ 0             | buyer adapter + seller boundary; no merchant/settlement created |
| `altana:x402:testnet:verify`     | ✅ 0             | 16 checks; live signing BLOCKED                                 |
| `altana:x402:marketplace:verify` | ✅ 0             | 10 checks; claims-ignored/no-bypass                             |
| `altana:x402:e2e:testnet:verify` | ✅ 0 (available) | 8 offline checks; clean BLOCKED (externals missing, expected)   |
| `termix:reputation:verify`       | ✅ 0             | 14 checks                                                       |
| `termix:reputation:web:verify`   | ✅ 0             | 11 checks                                                       |
| `pancakeswap:data:verify`        | ✅ 0             | 18 checks (offline fixtures)                                    |
| `pancakeswap:server:verify`      | ✅ 0             | 15 checks (offline fixtures)                                    |
| `pancakeswap:ui:verify`          | ✅ 0             | 18 checks + no-ownership-copy assertion (added this QA)         |

No commands invented; every script verified to exist in the respective manifest.

## 5. Live Read-Only Checks

**A. PancakeSwap — endpoint NOT reachable (404).** One real read performed against the configured official URL: `POST https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2` → **404 Not Found** (host alive; path decommissioned). Probes of current official alternatives: The Graph gateway responds only with "auth error: malformed API key" (key required); NodeReal MegaNode marketplace listing has no keyless raw endpoint; `api.thegraph.com` DNS is dead (hosted service retired). **Verdict:** endpoint reachability FAILED for the configured URL; GraphQL response shape/pool fields/normalization remain verified **offline-only** (fixtures); the live UI degrades to the honest `server-error` state (verified in rendered HTML: pools `[]`, "PancakeSwap pool data is currently unavailable…" — actually "PancakeSwap data is temporarily unavailable"). No write operation performed. This is finding #1 above (see §20 for exact remediation).

**B. TermiX — SKIPPED — NO SUPPORTED LIVE IDENTITY.** No supported TermiX identity (MockAgentNFT tokenId on chain 97) is available; the adapter deliberately refuses to guess. No live read was fabricated. (HTML smoke confirms the honest `unsupported` state renders instead.)

**C. 8004scan — keyless path verified live.** No key was added. Running the built app with no key: `/leaderboards` returns 200 with the honest `"missing-key"` state (agents `[]`), no crash, no error page; rendered HTML contains no `8004SCAN_API_KEY`, no `X-API-Key`, no key value; `.next/static` bundles contain neither string. Pro key deferred per plan (post-publication).

**D. Altana — no live signing attempted.** X.4A remains BLOCKED on external credentials; the E2E harness exits 0 with a clean BLOCKED and no transaction. Read-only probe (per A) is the only chain activity this QA performed.

## 6. Route QA (live smoke, production build)

All 12 routes served 200 on `next start`: `/`, `/marketplace`, `/agents`, `/agents/test-agent`, `/compare`, `/leaderboards`, `/categories`, `/categories/yield`, `/dashboard`, `/settings`, `/profile`, `/login`. No 5xx, no runtime errors, no crash under the server-side TermiX+PancakeSwap fetch path. Dynamic routes confirmed intentional; static routes unchanged.

## 7. Agent Details QA

Rendered HTML for `/agents/[slug]` (live server) confirms present and separated:

- **8004scan** — identity/trust: registry-pending rows in the frozen Reputation section ("Values populate from the ERC-8004 Registry and are shown as pending until the record is connected"). No fabricated values.
- **TermiX** — AACP reputation: separate "TermiX Reputation" section with its own source chip ("TermiX AACP · Read-only on-chain reputation"), honest `unsupported` state for slug-only identity.
- **PancakeSwap** — pool/market intelligence: separate "PancakeSwap Pool Intelligence" section (source chip "PancakeSwap · BSC · Chain ID 56"), honest failure state; description now states "Independent of 8004scan reputation and TermiX AACP — never combined… this is market data, not the agent's own performance."

**No combined score, no composite reputation, no fake trading score, no agent ownership implication for PancakeSwap pools** — the latter enforced by the new harness assertion added this QA (§20, fix #2: ownership wording removed from description and failure copy).

## 8. Data Honesty

- `reserveUSD` → displayed as TVL only; never called APR/APY. ✓ (harness asserts `apr`/`apy` are `null`; the mandatory note "APR/APY unavailable from PancakeSwap V2 data" is verified present.)
- `volumeUSD` → labeled **"Cumulative volume"**; harness fails if the label mentions "24h". ✓
- TermiX missing data is never shown as `0` (unsupported/not-found are discriminated states; harness asserts a genuine `score:0` is preserved only when real). ✓
- 8004scan missing key → `missing-key` state, not an error/crash. ✓ (verified live, §5C)
- Fix applied this QA: PancakeSwap `not-found` copy no longer says "…unavailable for this agent." and the section description no longer claims pools are "associated with this agent's…skills".

## 9. Responsive Audit (static)

Browser/screenshot tooling is **not installed** and installation is forbidden → **"Browser visual QA unavailable."** Static class audit performed across 1440/1280/1024/834/768/390/320:

- New sections: `grid gap-3 sm:grid-cols-2` (1→2 cols), all values `truncate` + `tabular-nums`, headers `flex-wrap`, description `max-w-2xl`, main column `min-w-0`, stats `grid-cols-2 sm:grid-cols-3`. No fixed widths, no `whitespace-nowrap`, no `overflow-x` in changed files. Grid collapses 2→1 cols correctly; no horizontal overflow expected.
- Pre-existing (frozen, unchanged this phase): `compare-preview.tsx` uses `min-w-[640px]` on a home-page table (INFO — may scroll at <640px depending on parent overflow; home page is frozen scope and was not modified); `whitespace-nowrap` on short labels in compare/marketplace/leaderboards (pre-existing, short strings, low risk).

## 10. Security Audit

Full-repo scan (239 source files, redacted output) for `PRIVATE_KEY, PRIVATEKEY, MNEMONIC, SEED_PHRASE, WALLET_PRIVATE_KEY, ALTANA_PRIVATE_KEY, X402_PRIVATE_KEY, FACILITATOR_KEY, 8004SCAN_API_KEY, NEXT_PUBLIC_8004SCAN_API_KEY, NEXT_PUBLIC_TERMIX, NEXT_PUBLIC_PANCAKE, Authorization, Bearer, X-API-Key`:

- **No real secret values anywhere.** Every match is an env-var **name** (verify-harness denylists, zod schema, doc prose), protocol field (`authorization` in EIP-3009 typed data), or the single legitimate server-only env read: `process.env["8004SCAN_API_KEY"]` at `apps/web/lib/eight004scan/client.ts:43` (header set only when a key is present; never `NEXT_PUBLIC_`).
- `NEXT_PUBLIC_8004SCAN_API_KEY` / `NEXT_PUBLIC_TERMIX*` / `NEXT_PUBLIC_PANCAKE*`: **zero occurrences**.
- `.env` / `.env.local` / `.env.*.local`: **ignored** (`.gitignore` covers `.env`, `.env.*`, `!.env.example`, `.env*.local`); no such files exist on disk.
- `.env.example` (root and `prisma/`): placeholders/defaults only (`8004SCAN_API_KEY=` empty; localhost postgres defaults).

## 11. Client Bundle Audit

- `.next/static/**` (53 files) scanned for `8004SCAN_API_KEY, X-API-Key, termix-backend, termix.click, streamingfast, exchange-v2, subgraphs/name, PRIVATE_KEY, MNEMONIC, SEED_PHRASE, FACILITATOR, Bearer, Authorization` → **all SAFE (no matches)**.
- `.next/standalone` hits are all under `server/**` (server-side page bundles): `leaderboards/page.js` (env-name + header — server-only 8004scan client), `agents/[slug]/page.js` (TermiX + subgraph URLs — server component only). These are **not** served to browsers; the boundary is correct. `.next/server` is not a browser artifact.
- Rendered HTML of all 12 routes: clean for all 13 key patterns (no API key names, no backend hostnames, no subgraph URLs, no 64-hex strings).

## 12. Personal Path Audit

- `C:\Users\` — **0 occurrences** in tracked source/docs.
- `/Users/` — only 2 audit-doc prose mentions (explaining there are no leaks). SAFE.
- `/home/` — only route-group path segments (`app/(home)/`, `components/home/*`) and doc prose. SAFE.
- Username (`rashe`) — **0 occurrences** anywhere in source/docs.
- No personal machine paths remain (the earlier `Sprint2F` leak was already neutralized to `<temp>/…` and re-confirmed).

## 13. Generated Files

| Path                                    | Size     | Status                                                                                          |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `node_modules/`                         | 801 MB   | gitignored — SAFE (ignored)                                                                     |
| `apps/web/.next/`                       | 492 MB   | gitignored — SAFE (ignored)                                                                     |
| `.turbo/`                               | 340 MB   | gitignored — SAFE (ignored)                                                                     |
| `packages/*/dist/`, `apps/worker/dist/` | —        | gitignored (`dist/`) — SAFE                                                                     |
| `docs/review/screenshots/` (28 files)   | 10.36 MB | **tracked** — SHOULD BE REMOVED/trimmed or gitignored before publication (MEDIUM, pre-existing) |
| `docs/screenshots/` (2 files)           | 0.55 MB  | **tracked** — SHOULD BE REVIEWED (LOW, pre-existing)                                            |
| logs / tmp / bak / dump                 | none     | SAFE                                                                                            |
| `coverage/`, `.nyc_output/`             | absent   | SAFE                                                                                            |
| `.husky/pre-commit`                     | tracked  | SAFE (lint-staged)                                                                              |

No deletion performed (per STRICT MODE: document only; removal is a pre-publication action).

## 14. README / LICENSE

- **README accuracy bug found and FIXED (minimal):** the status block ("Foundation phase… not implemented yet"), the "interface-only adapters" bullet, and the integrations tree comment were factually stale vs. the implemented features. Updated to describe the delivered state (marketplace UI + read-only integration layers; execution/live-data gated on external credentials). No redesign; env instructions, Docker/CI sections, and roadmap left untouched.
- `8004SCAN_API_KEY` instructions are **server-only** ("read server-side only… never shipped to the browser; without a key the route renders an honest registry-pending state") — accurate and verified (§5C/§10/§11). ✓
- TermiX: no setup instructions exist (nothing needed for read-only; no credentials). PancakeSwap: no setup instructions (nothing needed; documented as read-only in review docs). ✓
- `LICENSE` present: "BNB Agent Marketplace — Proprietary License, All Rights Reserved" — matches README "Proprietary. All rights reserved." ✓ (decision to keep Proprietary vs open is the owner's; documented, not blocking.)

## 15. Review Document Audit

`docs/review/` (38 files). Newer documents added since the prior readiness audit (TermiX implementation + UI integration, Partner-Bounty-Discovery, PancakeSwap Bounty-Discovery, P1/P2/P3, Final-Integration-Gap-Analysis, Altana X.1–X.4A) were scanned this QA — they contain only env-var names, protocol fields, and prose; **no secrets, no personal paths, no private URLs** (verified by the §10 source scan which includes `docs/`).

Classification: **PUBLIC-SAFE** (all 38). No `NEEDS REVIEW`/`MUST REMOVE` items. One content note: documents referencing the now-decommissioned subgraph URL (P1/P2/P3 docs) are historical records; they should be annotated when the endpoint update lands (post-publication, INFO).

## 16. Docker / CI

- `.github/workflows/ci.yml`: install/lint/typecheck/build/format only; **no `secrets.*`, no env vars, no credentials**; works keyless; pinned actions (checkout@v4, pnpm/action-setup@v4 9.15.9, setup-node@v4 node 20, cache@v4). CI requires **no** 8004scan key, **no** TermiX credentials, **no** PancakeSwap credentials. ✓
- `Dockerfile`: multi-stage; copies only manifests + `packages` + `apps` (`.dockerignore` excludes `.env*` except example, `node_modules`, `**/.next`, `**/dist`, docs, etc.); runner is standalone + static + public as non-root `nextjs`; **no `.env` copied, no node_modules copied, no secrets**. Pre-existing INFO: comment typo "prism".
- `docker-compose.yml`: local dev Postgres/Redis with conventional `postgres/postgres` local credentials (INFO, not a secret).
- `.dockerignore`: correct and comprehensive. ✓

## 17. Dependency Audit

- No unexpected/suspicious packages. `@altananetwork/sdk`, `@altananetwork/x402-server`, `ox`, `porto`, `viem` are required by the shipped Altana/x402 integration code. No `@pancakeswap/*` (correctly avoided). All other deps are standard public packages (next, react, zod, tailwind, radix-ui, etc.).
- `pnpm-lock.yaml`: **no `git+`, `github:`, `http://`, no `_authToken`/`_auth`/password, no private registry names, no tarball URLs.** All resolutions come from the public default registry at install time. `.npmrc` contains no auth tokens.
- No upgrades or installs performed (per STRICT MODE).

## 18. Hackathon Feature Check

Implemented and verified present (routes built + live 200 + rendered HTML): main marketplace, agent discovery, agent details, compare, leaderboards, categories, 8004scan identity/reputation (keyless), Altana capability infrastructure (read-only + boundary adapters), TermiX AACP reputation (read-only UI), PancakeSwap pool intelligence (read-only UI).

**Not falsely advertised** (verified):

- TermiX hiring — not present; Hire button is `disabled` + "Soon" + "Hire arrives with the live ERC-8004 Registry".
- PancakeSwap swaps / LP transactions — zero swap/LP/wallet/signing code in the web app; no execution surface.
- Altana live payment / ERC-8183 execution — boundaries enforced; harnesses exit clean BLOCKED; no tx submitted.
- No fake trading scores, no composite reputation, no fabricated APR/APY, no fabricated registry data.

## 19. Known External Blockers (bounty honesty — nothing claimed)

| Integration                 | State                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Altana (live x402/ERC-8183) | BLOCKED on externally supplied funded testnet signer, `FACILITATOR_KEY`, real `payTo` — none added this QA                                                                                                                            |
| TermiX                      | Read-only AACP reputation integrated; execution deferred (no "hire via TermiX")                                                                                                                                                       |
| PancakeSwap                 | Read-only pool intelligence integrated; **official bounty qualification criteria remain UNKNOWN** per `PancakeSwap-Bounty-Discovery.md`; no bounty "won/guaranteed" claim; live data additionally blocked by endpoint/key state (§5A) |
| 8004scan                    | Pro API key not added; keyless path verified; live registry data gated on key (post-publication per plan)                                                                                                                             |

## 20. Fixes Applied This QA (only minimal, per FIX POLICY)

1. **Data-honesty copy fix (real bug):** removed agent-ownership wording from the PancakeSwap section — `agent-detail-view.tsx` description no longer says pools are "associated with this agent's trading/liquidity skills"; `agent-detail-pancakeswap.copy.ts` `not-found` copy no longer says "…unavailable for this agent". Added a harness assertion (fails on `for this agent` / `associated with this agent` in failure copy). Re-verified: `pancakeswap:ui:verify` ✅, `pnpm lint` 12/12 ✅, `pnpm typecheck` 12/12 ✅, `pnpm build` 7/7 ✅, all 12 verify suites ✅, live HTML re-verified (ownership copy gone).
2. **README factual staleness (documentation bug):** three minimal edits (status block, integrations bullet, tree comment) to reflect implemented state.

## 21. Documented Defects & Required Pre-Publication Actions (no further code changes made)

| #   | Severity                                | Item                                                                                                                                                                                                                                                                                                                                                                                                   | Action (post-QA)                                                                                                                                                                                                                                                       |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **HIGH (non-security)**                 | `PANCAKESWAP_V2_SUBGRAPH_URL` (both `packages/integrations/src/pancakeswap/types.ts:21-22` and `apps/web/lib/pancakeswap/client.ts:30-31`) points at decommissioned `bsc.streamingfast.io/…/exchange-v2` (HTTP 404). Official replacement (NodeReal MegaNode or The Graph gateway) requires an API key; credentials are forbidden this phase, so the fix is deferred. UI degrades honestly (verified). | Obtain a NodeReal MegaNode (or The Graph) API key as a server-only secret → replace the two constants → run `pancakeswap:data:verify` / `pancakeswap:server:verify` / live read → keep URL out of client bundles (server-only already). Update P1/P2/P3 docs footnote. |
| 2   | **MEDIUM (housekeeping, pre-existing)** | ~10.9 MB screenshots tracked in `docs/review/screenshots/` + `docs/screenshots/`                                                                                                                                                                                                                                                                                                                       | Trim to a small final set and/or add to `.gitignore` before publishing (use `git rm --cached` equivalents at publication time).                                                                                                                                        |
| 3   | LOW/INFO                                | Dockerfile comment typo ("prism"); CI prisma-generate invocation diverges from root script (both work); `compare-preview.tsx` `min-w-[640px]` home table (frozen)                                                                                                                                                                                                                                      | Optional cleanup; not blocking.                                                                                                                                                                                                                                        |
| 4   | INFO                                    | License is Proprietary/"All Rights Reserved" — confirm owner intent for a public repo                                                                                                                                                                                                                                                                                                                  | Owner decision, documented (not blocking).                                                                                                                                                                                                                             |

## 22. Final Risk Classification

| Severity | Count | Items                                                                                                                                                           |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 0     | —                                                                                                                                                               |
| HIGH     | 1     | PancakeSwap live endpoint decommissioned (functional, non-security; no fix possible without a credential — documented + deferred)                               |
| MEDIUM   | 1     | Tracked screenshot bloat (~10.9 MB, pre-existing)                                                                                                               |
| LOW      | 3     | Dockerfile typo; CI prisma invocation divergence; home compare-preview min-width (all pre-existing/optional)                                                    |
| INFO     | 4     | LICENSE intent (Proprietary); local-dev compose creds; standalone server-bundle strings (correct boundary); historical review docs referencing the old endpoint |

---

## FINAL STATUS

**PUBLIC RELEASE: READY WITH MINOR FIXES**

Rationale:

- **No CRITICAL/HIGH security findings; no exposed secrets; no broken core features; build fully green; all 12 verification suites green; all routes serve 200; keyless 8004scan verified live; TermiX + PancakeSwap sections honest and separated; client bundles clean.**
- The single HIGH item (PancakeSwap endpoint) cannot be fixed inside STRICT MODE because every current official endpoint requires an API key and credential addition is prohibited this phase; the product degrades honestly and the remediation is precise and documented (see §20/§21 #1). The remaining items are non-security cleanup (screenshots) and optional polish.
- Required pre-publication actions: (1) replace the two subgraph-URL constants once a MegaNode/The-Graph key is available (server-only secret) and re-verify; (2) trim/gitignore screenshots; (3) confirm Proprietary license intent. None of these block the current feature set from operating, and none require further feature work.

---

**STRICT STOP — no git init/commit/push, no repository creation, no credentials added, no X.4B, no TermiX hiring, no swap/LP work, no further integrations. Final QA complete.**
