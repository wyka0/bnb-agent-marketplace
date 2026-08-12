# Public Repository Readiness Audit — Phase 1

**Scope:** Security + secrets + repository audit ONLY. No application code, frozen
sprints, git operations, or new sprints were touched. Audit performed on
`bnb-agent-marketplace` (repository root).

**Date:** 2026-08-08
**Auditor task:** read-only assessment for eventual GitHub publication.

---

## Executive summary

The repository is **substantially safe to publish**. A full secrets sweep found
**no real credentials, private keys, tokens, or mnemonics** anywhere in tracked
source. The Sprint 2G 8004scan integration is correctly **keyless-safe and
server-only**: the API key is read from `process.env["8004SCAN_API_KEY"]`, is
never `NEXT_PUBLIC_`, and does **not** appear in any client bundle or rendered
HTML. `.gitignore` / `.dockerignore` correctly exclude env files and all
generated artifacts. CI runs without any secret. All three build gates pass with
no key configured.

Blocking items are **non-security housekeeping**: (1) **no `LICENSE` file** while
README declares "Proprietary" — a licensing decision is required before making a
repo public; (2) one committed doc leaks a local username path; (3) ~26 MB of
screenshots and stale build/dep folders exist on disk (all gitignored except
screenshots). None are secrets.

**Overall risk: LOW.** No CRITICAL/HIGH security findings.

---

## Risk classification summary

| Level    | Count | Items                                                                                                                                                                                                                       |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 0     | —                                                                                                                                                                                                                           |
| HIGH     | 0     | —                                                                                                                                                                                                                           |
| MEDIUM   | 3     | Missing LICENSE vs "Proprietary"; personal path/username in a tracked doc; 26 MB screenshots tracked in repo                                                                                                                |
| LOW      | 3     | README missing `8004SCAN_API_KEY` setup note; `docs/` (2 screenshot dirs) tracked; CI prisma-generate invocation differs from root script                                                                                   |
| INFO     | 5     | Local dev DB creds in docker-compose (by design); generated dirs on disk (gitignored); `packages/config/dist` committed-shape on disk (gitignored); Dockerfile comment typo "prism"; 8004scan vars not in turbo `globalEnv` |

---

## 1. Security findings (overview)

- No hardcoded credentials in `apps/**` or `packages/**` source.
- The only auth-header code is server-only and correct
  (`apps/web/lib/eight004scan/client.ts` sets `X-API-Key` **only when a key is
  present**, with no literal value).
- No dynamic `eval`/secret-exfil patterns in project source (matches were all in
  gitignored `node_modules/` / `.next/`).
- Supply chain: `pnpm-lock.yaml` resolves external deps from the public npm
  registry only — **no `git+`, `github:`, `http://`, external `file:`, or
  `_authToken`** entries; the only `link:` entries are internal workspace
  packages. `.npmrc` contains no registry auth tokens.

## 2. Secret findings (redacted)

Full-tree scan for: API keys, private keys, tokens, passwords, secrets,
`Authorization`, `Bearer`, `X-API-Key`, `8004SCAN_API_KEY`, `NEXT_PUBLIC_*`,
wallet keys, seed phrases, mnemonics, credentials.

| FILE                                  | LINE       | TYPE                                                                                   | VALUE                           | SAFE/UNSAFE                                                           |
| ------------------------------------- | ---------- | -------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| `.env.example`                        | 1          | Env placeholder `8004SCAN_API_KEY=` (empty)                                            | _(empty)_                       | **SAFE**                                                              |
| `apps/web/lib/eight004scan/client.ts` | 43         | `process.env["8004SCAN_API_KEY"]` read (server-only)                                   | _(no value)_                    | **SAFE**                                                              |
| `apps/web/lib/eight004scan/client.ts` | 104–105    | `X-API-Key` header set only if key present                                             | _(no value)_                    | **SAFE**                                                              |
| `packages/config/src/env.ts`          | 40         | Optional Zod field `"8004SCAN_API_KEY"`                                                | _(schema only)_                 | **SAFE**                                                              |
| `docker-compose.yml`                  | 12–14      | Local Postgres `POSTGRES_USER/PASSWORD/DB = postgres/postgres/marketplace`             | `postgres` (local dev default)  | **SAFE (INFO)** — non-secret local default, standard for public repos |
| `packages/config/src/env.ts`          | 20         | `DATABASE_URL` default (localhost postgres/postgres)                                   | localhost dev default           | **SAFE**                                                              |
| `docs/TIS.md`                         | 55,127,320 | Prose mentioning "private keys" (architecture text)                                    | _(no key)_                      | **SAFE**                                                              |
| `node_modules/**`, `.next/**`         | —          | Dependency source / TS lib defs / dotenv README placeholders (`YOURSECRETKEYGOESHERE`) | _(placeholders / library code)_ | **SAFE** — gitignored, not published                                  |

**No real/live secret values were discovered.** Nothing to redact beyond the
placeholders noted.

## 3. Environment findings

- `.gitignore` ignores: `.env`, `.env.*`, `.env*.local`, with `!.env.example`
  preserved. ✅ Covers `.env`, `.env.local`, `.env.*.local`.
- `.env.example` contains **only** the placeholder `8004SCAN_API_KEY=`. ✅
- No committed `.env` / `.env.local` files exist anywhere in the tree. ✅
- `8004SCAN_API_KEY` is **server-only**: read via `process.env` in a module
  imported solely by the server component; **never** `NEXT_PUBLIC_8004SCAN_API_KEY`
  (that string does not exist anywhere). ✅

## 4. Client exposure findings

- Scanned `apps/web/.next/static/**` and the standalone static bundle for
  `8004SCAN_API_KEY` and `X-API-Key`: **NO MATCHES (clean)** in any browser
  JS/JSON/HTML. ✅
- Consistent with Sprint 2G runtime verification (rendered HTML contained
  neither the key name nor the header). ✅
- `NEXT_PUBLIC_*` values in the codebase are limited to non-secret URLs
  (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` → localhost
  defaults). ✅

## 5. Personal machine data findings

- **Tracked leak (MEDIUM/LOW):** `docs/review/Sprint2F-Review.md:168` referenced a
  personal Windows temp path (local username + `AppData\Local\Temp\...`) — exposed
  a machine-specific username and temp path. Safe-ish (a throwaway script path, no
  secret) but **not appropriate for a public repo**. _Status:_ **RESOLVED in the
  cleanup phase** — replaced with the neutral form `<temp>/opencode/capture-2f.js`.
- All other repository-root / local-user occurrences are inside
  **gitignored generated locations** — `.turbo/*.log`, `.next/cache/.tsbuildinfo`,
  `.next/types/*.ts`, `apps/web/tsconfig.tsbuildinfo`, `node_modules/.bin/*` — and
  will **not** be published. No `/Users/` or `/home/` leaks in tracked source.

## 6. Generated-file findings (present on disk, gitignore status)

| Path                                                               | On disk | Ignored?                    | Note                                              |
| ------------------------------------------------------------------ | ------- | --------------------------- | ------------------------------------------------- |
| `node_modules/`                                                    | yes     | ✅ `.gitignore`             | not published                                     |
| `apps/web/.next/` (incl. `standalone`, `static`, `cache`, `types`) | yes     | ✅ `.next/`                 | not published                                     |
| `.turbo/`, `apps/*/.turbo/*.log`                                   | yes     | ✅ `.turbo/`                | not published                                     |
| `packages/*/dist/`, `*.tsbuildinfo`                                | yes     | ✅ `dist/`, `*.tsbuildinfo` | not published                                     |
| `docs/review/screenshots/` (96 files, **26.05 MB**)                | yes     | ❌ **tracked**              | **MEDIUM** — large binary bloat for a public repo |
| `docs/screenshots/` (2 files, 0.55 MB)                             | yes     | ❌ tracked                  | LOW — small                                       |
| `tests/.gitkeep`                                                   | yes     | tracked                     | INFO — empty placeholder, fine                    |

_Recommendation:_ decide whether the 26 MB of QA screenshots belong in the public
repo (consider moving to a release asset / external store, or add to
`.gitignore`). No deletion performed (audit only).

## 7. Gitignore findings

`.gitignore` is comprehensive and correct. Present entries cover: `node_modules/`,
`.pnpm-store/`, `dist/`, `build/`, `.next/`, `out/`, `*.tsbuildinfo`, `.turbo/`,
env files (`.env`, `.env.*`, `!.env.example`, `.env*.local`), `coverage/`,
`.nyc_output/`, logs (`*.log`, `logs/`, debug logs), OS/editor artifacts
(`.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/*.local`), `prisma/*.db`,
`next-env.d.ts`, `*.tgz`. **No useful entries missing.** ✅
_(Optional:_ add `docs/review/screenshots/` if screenshots are excluded per §6.)

## 8. GitHub Actions findings

`.github/workflows/ci.yml` (single workflow):

- Jobs: install → lint, typecheck, build, format (fan-out). Uses
  `actions/checkout@v4`, `pnpm/action-setup@v4` (v9.15.9), `actions/setup-node@v4`
  (node 20), `actions/cache@v4`.
- **No hardcoded secrets, no `secrets.*` references, no private URLs, no
  env-exposing commands.** ✅
- **CI runs without the 8004scan key** — none of the jobs require it; `build`
  succeeds keyless (leaderboards route is dynamic, no build-time fetch). ✅
- LOW: `typecheck`/`build` run `pnpm --dir prisma prisma generate`, whereas the
  root script is `pnpm --filter @bnb-marketplace/prisma exec prisma generate`.
  Both are expected to work; note the divergence in case one path breaks.

## 9. Docker findings

- **`Dockerfile`** (multi-stage: deps → builder → runner):
  - Copies only `package.json`, lockfile, `pnpm-workspace.yaml`, `turbo.json`,
    `.npmrc`, `packages`, `apps`. Does **not** copy `.env`. ✅
  - Runner copies only `.next/standalone`, `.next/static`, `public`; runs as
    non-root `nextjs` user. ✅
  - INFO: comment typo "prism" (→ "pnpm"/"prisma"); cosmetic only.
  - INFO: `COPY apps ./apps` in the deps stage would include a local
    `apps/web/.next` if present — mitigated by `.dockerignore` excluding
    `**/.next`. ✅
- **`.dockerignore`**: excludes `node_modules`, `**/dist`, `**/build`, `**/.next`,
  `**/.turbo`, `.git`, `.env`, `.env.*` (keeps `.env.example`), `*.log`, `.vscode`,
  `.idea`, `docs`, `README.md`, `coverage`. ✅ Prevents secrets/artifacts entering
  the image.
- **`docker-compose.yml`**: local-dev Postgres/Redis only; credentials are the
  conventional `postgres/postgres` **local** default (INFO, not a secret). ✅

## 10. Documentation findings

- `README.md`: accurate, honest ("Foundation phase"), no secrets, no personal
  paths, correct setup commands. ✅
- **MEDIUM:** README states _"Proprietary. See `LICENSE` (to be added before first
  release)"_ but **no `LICENSE` file exists**. Publishing publicly while labeled
  Proprietary and unlicensed is legally ambiguous — resolve the license before
  going public.
- **LOW:** README does not mention the optional `8004SCAN_API_KEY` / `.env.example`
  added in Sprint 2G. It still correctly says no `.env` is required (keyless-safe),
  but an "Environment / API keys" note would help contributors.
- `docs/` contains extensive internal sprint reviews (`Sprint2*`, `PRD.md`,
  `TIS.md`, UX blueprints). These are internal-process docs; **safe** content-wise
  (no secrets), but review whether all internal review notes should be public
  (INFO). One of them carries the personal path from §5.

## 11. Dependency findings

- Workspace: **8 manifests** — `apps/web`, `apps/worker`, `packages/{config,
data-api,integrations,telemetry,ui}`, `prisma`.
- Root dev deps: eslint 9, typescript-eslint 8, prettier 3, turbo 2, typescript
  5.6, husky 9, lint-staged 15 — standard, current, reputable.
- `pnpm-lock.yaml`: 140 KB / 3,338 lines. All external resolutions from public
  npm; internal packages via `link:`. No suspicious/private/git sources.
- No local `pnpm audit` was run (network/registry not exercised in this read-only
  audit); recommend running `pnpm audit --prod` in CI before release.
- No obviously unused or suspicious packages detected in manifests. (Deep
  unused-dependency analysis not performed — out of scope for a read-only pass.)

## 12. Repository structure findings

| Item                                                                                                                                                                      | Classification     | Note                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------- |
| `apps/`, `packages/`, `prisma/`, `README.md`, `PRD.md`, `docs/ux`, `docs/design-system`                                                                                   | **SAFE**           | Core source + docs, no secrets                           |
| `.github/workflows/ci.yml`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.gitignore`, `.npmrc`, `.editorconfig`, `.prettier*`, `eslint.config.mjs`, `turbo.json` | **SAFE**           | Config, no secrets                                       |
| `.env.example`                                                                                                                                                            | **SAFE**           | Placeholder only                                         |
| `.husky/pre-commit`                                                                                                                                                       | **SAFE**           | Runs `npx lint-staged`                                   |
| `tests/.gitkeep`                                                                                                                                                          | **SAFE**           | Empty placeholder                                        |
| `docs/review/**` internal sprint notes                                                                                                                                    | **NEEDS REVIEW**   | Internal process docs; one contains a personal path (§5) |
| `docs/review/screenshots/` (26 MB) + `docs/screenshots/`                                                                                                                  | **NEEDS REVIEW**   | Repo bloat; decide keep/exclude                          |
| Missing `LICENSE`                                                                                                                                                         | **NEEDS REVIEW**   | Required before public release                           |
| `node_modules/`, `.next/`, `.turbo/`, `dist/`, `*.tsbuildinfo`                                                                                                            | **SAFE (ignored)** | On disk but gitignored → not published                   |
| —                                                                                                                                                                         | **MUST REMOVE**    | _(none — no secret/credential files found)_              |

## 13. Build results (no API key configured, no code changes)

| Gate       | Command          | Result         |
| ---------- | ---------------- | -------------- |
| Lint       | `pnpm lint`      | ✅ 12/12 tasks |
| Type check | `pnpm typecheck` | ✅ 12/12 tasks |
| Build      | `pnpm build`     | ✅ 7/7 tasks   |

Keyless build confirmed: `/leaderboards` is dynamic (`ƒ`), no build-time network,
no secret required.

---

## Recommended actions before publishing (no changes made yet)

1. **(MEDIUM) License:** add a `LICENSE` file, or change README from "Proprietary"
   to the intended public license. Do not publish unlicensed-Proprietary.
2. **(MEDIUM) Personal path:** scrub the personal Windows temp path from a
   `docs/review/` document — replace with a neutral/relative form.
3. **(MEDIUM) Screenshots (26 MB):** keep a small final evidence set in
   `docs/review/screenshots/` and remove RC/duplicate/debug captures.
4. **(LOW) README env note:** document the optional `8004SCAN_API_KEY`
   (copy `.env.example` → `.env.local`).
5. **(LOW) Internal docs:** confirm the `docs/review/Sprint*` notes are intended
   to be public.
6. **(INFO/optional):** fix Dockerfile "prism" typo; align CI prisma-generate
   command with the root script; consider `pnpm audit` in CI.

None of the above are security/secret exposures.

---

## Cleanup-phase outcomes (post-audit, repository preparation)

Completed during the repository cleanup phase (this document records them so the
audit history stays accurate):

| #   | Item                       | Outcome                                                                                                                                                           |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | LICENSE                    | `LICENSE` added (Proprietary — "All Rights Reserved", matching README's stated intent); README `## License` updated to point at it                                |
| 2   | Personal path              | `Sprint2F-Review.md` now cites `<temp>/opencode/capture-2f.js`; no `C:\Users\...` or username remains in tracked docs                                             |
| 3   | Screenshots                | `docs/review/screenshots/` trimmed 96 → 28 files (26.05 MB → 10.36 MB); RC/duplicate/debug captures removed; all `*.md` screenshot references verified to resolve |
| 4   | README env note            | Added `### Environment` section (copy `.env.example` → `.env.local`; optional `8004SCAN_API_KEY`)                                                                 |
| 5   | Review docs classification | See below — all `docs/review/*.md` classified; no document required relocation to `docs/internal/`                                                                |

**Review-document classification (task 4):** every file in `docs/review/` was
screened for personal paths, usernames, credentials, private URLs, temporary
paths, local-machine info, API keys, unfinished private notes, and secrets.

| Document                               | Classification | Notes                                                                                 |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `Sprint1-RC1.md`                       | PUBLIC-SAFE    | RC evidence; neutral `home-full-tablet-md.png` ref                                    |
| `Sprint1-Review.md`                    | PUBLIC-SAFE    | Final homepage QA; close-up/hover/page refs consolidated into retained final captures |
| `Sprint2B-RC1.md`                      | PUBLIC-SAFE    | Screenshot refs repointed to `marketplace-final-*`                                    |
| `Sprint2B-RC2.md`                      | PUBLIC-SAFE    |                                                                                       |
| `Sprint2B-Review.md`                   | PUBLIC-SAFE    | Screenshot refs repointed to `marketplace-final-*`                                    |
| `Sprint2B-Final.md`                    | PUBLIC-SAFE    |                                                                                       |
| `Sprint2C-RC1.md`                      | PUBLIC-SAFE    |                                                                                       |
| `Sprint2C-RC2.md`                      | PUBLIC-SAFE    | rc2 before/after refs resolved                                                        |
| `Sprint2C-RC3.md`                      | PUBLIC-SAFE    | rc2 refs resolved                                                                     |
| `Sprint2C-Review.md`                   | PUBLIC-SAFE    | Ref repointed to `agent-details-final-*`                                              |
| `Sprint2D-RC1-Review.md`               | PUBLIC-SAFE    | Ref repointed to `navigation-*`                                                       |
| `Sprint2D-RC2-Review.md`               | PUBLIC-SAFE    | Ref repointed to `navigation-*`                                                       |
| `Sprint2D-Review.md`                   | PUBLIC-SAFE    |                                                                                       |
| `Sprint2E-RC2.md`                      | PUBLIC-SAFE    |                                                                                       |
| `Sprint2E-Review.md`                   | PUBLIC-SAFE    | Ref repointed to `compare-final-*`                                                    |
| `Sprint2F-Review.md`                   | PUBLIC-SAFE    | Personal path neutralized                                                             |
| `Sprint2G-Integration-Discovery.md`    | PUBLIC-SAFE    | Discovery record (Phase 1); no secrets; historical                                    |
| `Sprint2G-API-Mapping.md`              | PUBLIC-SAFE    | API contract record; public 8004scan URLs only                                        |
| `AgentCard-Validate.md`                | PUBLIC-SAFE    | Design-system validation record                                                       |
| `Public-Repository-Readiness-Audit.md` | PUBLIC-SAFE    | This document                                                                         |

No document required relocation to `docs/internal/`; all are tame technical QA
records. No `NEEDS REDACTION` items remain after the above edits.

---

## PUBLIC REPOSITORY STATUS

**READY WITH MINOR FIXES**

Rationale: **Zero CRITICAL/HIGH findings — no secrets, keys, tokens, or
credentials are exposed; the API key is server-only and absent from client
bundles; CI/Docker/gitignore are correct; all build gates pass keyless.** The
remaining items are non-security housekeeping (add a LICENSE, scrub one personal
path, decide on 26 MB of screenshots, minor README env note). Address the MEDIUM
items (license + personal path + screenshots) and the repository is safe to
publish publicly.
