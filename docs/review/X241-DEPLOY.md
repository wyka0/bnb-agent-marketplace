# X.241-DEPLOY — Commit, Push & Production Deployment

Date: 2026-09-05 — Code deployment only. Zero blockchain transactions,
zero writes, zero signatures, zero wallet prompts. `MAINNET_HIRE_ENABLED`
remains **false** everywhere (web + seller).

## 1. Starting commit

`05ab4f42cd0034f8853906e839c67ba52d0966ab` ("feat: align network context
across marketplace surfaces") — production was serving this with the old
chain-97 hard pin.

## 2. X.241 commit SHA

**`2766dc17b585d76a44415cb956ef617efc1bdf61`**
(`2766dc1` "feat: prepare chain-aware mainnet activation")

## 3. Files committed (37)

**Web app (chain-aware hire path):**

- `apps/web/lib/activation/main-track-hire.api.ts` — chain-aware gate
  replacing the chain-97 hard pin (identity-determined chain; identity/record
  mismatch → `unsupported-chain`; foreign registry → `registry-mismatch`;
  chain 56 behind `MAINNET_HIRE_ENABLED`, literal `"true"` only → truthful
  `mainnet-hire-disabled` 409)
- `apps/web/lib/activation/main-track-negotiation.server.ts` — chain-aware
  endpoint resolution + Mainnet gate + signature validation via
  `resolveHireChainConfig`/`chainIdFromAgentId`
- `apps/web/lib/activation/main-track-user-hire.ts` — chain-aware prepare +
  Mainnet gate (X.234)
- `apps/web/lib/activation/main-track-user-hire.verify.ts` — +X.241 A–G
  regression tests (12 new checks)
- `apps/web/lib/activation/mainnet-hire-preflight.verify.ts` — NEW read-only
  preflight harness (24 checks)
- `apps/web/lib/activation/hire.verify.ts`, `capability.ts` — supporting updates
- `apps/web/app/api/activation/main-track-hire/route.ts` — flag wiring
- `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` — truthful chain-56
  "coming soon" card
- `apps/web/app/(app)/agents/[slug]/main-track-hire-view.tsx` — supporting updates

**Integrations (authoritative chain seam):**

- `packages/integrations/src/altana/hire-chains.ts` — NEW (chain-56/97 tables,
  `resolveHireChainConfig`, `chainIdFromAgentId`, `isMainnetHireEnabled`)
- `packages/integrations/src/altana/index.ts` — seam export
- `packages/integrations/src/altana/v2/main-track-user-wallet.ts` — chain-aware
  5-call builder (`cfg`-resolved addresses)

**Services:**

- `services/v2-mainnet-seller/` (14 files) — NEW isolated chain-56 seller
  runtime + 4 harnesses (runtime 35-check, readiness 36-check, provisioning
  52-check, registration preview) + Dockerfile/README/configs
- `services/v2-seller/seller.ts` — X.221 fulfillment code + two lint fixes
  (unused-var removal, `AgentInfo` cast fix; behavior unchanged; typecheck + prettier clean)

**Review docs (X.218–X.241):** 9 milestone reports.

## 4. Files deliberately EXCLUDED (not staged)

- `apps/web/app/(app)/permissions/page.tsx` — excluded per standing
  constraint (never in releases).
- `docs/termix/*` (Agent-Advantage-Report.md, QUALITY-SCORING.json,
  evidence/task-04/05/06) — unrelated user work; left uncommitted.
- `docs/review/X180–X236-P2` pre-mainnet-track review docs (22 files) —
  unrelated to this deployment; left uncommitted.
- `services/v2-mainnet-seller/.env.example` — gitignored by the repo's
  `.env.*` rule (names-only file; convention preserved).
- No `.env`/keystore/credential files anywhere in the commit (verified).

## 5. Validation results (run before commit; full matrix)

| Suite                                         | Result                   |
| --------------------------------------------- | ------------------------ |
| seller-runtime / readiness / provisioning     | 35/36/52 — all PASS      |
| main-track-user-hire.verify (incl. X.241 A–G) | ALL PASS                 |
| mainnet-hire-preflight.verify                 | 24/24 PASS               |
| network-selector                              | 63/63 PASS               |
| hire.verify (X.6) / hire.api.verify (X.65)    | 24/24 · 14/14 PASS       |
| main-track-v2.server / capability-source      | ALL PASS                 |
| activation.verify (P12)                       | 33/33 PASS               |
| typecheck / lint / build (turbo)              | 14/14 · 14/14 · 8/8 PASS |
| prettier (changed files) / git diff --check   | PASS / CLEAN             |

Husky pre-commit (lint-staged) initially caught 2 real lint errors — fixed
before commit: unused `publicClient` (seller.ts L219) and unused
`toFunctionSelector` import (registration-preview harness). No tests
weakened or removed.

## 6. Security audit

- Pre-commit pattern scan of all 37 staged files: 9 pattern hits — ALL
  verified to be negative guards (comments asserting secrets are never
  handled, env-var _name_ references, test regexes asserting absence). Zero
  actual secrets.
- Staged-diff scan for token/key patterns (`gho_`, `ghp_`, `sk-`, `AKIA`,
  `BEGIN PRIVATE KEY`, real `WALLET_PASSWORD=` values, hex private keys):
  **CLEAN**.
- No keystores, no `.env` values, no Tailscale credentials, no local runtime
  artifacts committed. `.env.example` remains names-only (and gitignored).

## 7. Push result

- Branch: `main` · Remote: `origin` → `github.com/wyka0/bnb-agent-marketplace`
- Push: `05ab4f4..2766dc1  main -> main` — **SUCCESS** (no force, no rewrite)
- Remote HEAD confirmed: `2766dc17b585d76a44415cb956ef617efc1bdf61`

## 8. Production deployment URL

`https://bnb-agent-marketplace-web.vercel.app`

Deployed via the repository's existing Vercel GitHub integration (auto-deploy
on push — the same mechanism as all prior releases). No CLI credentials were
invented; no environment variables were changed. (Vercel CLI is not
installed/authed locally; the git integration is the supported path.)

## 9. Production deployment / commit verification

**Definitive proof production runs `2766dc1`:**

- `05ab4f4` (previous production): does NOT contain "Mainnet hiring coming
  soon" anywhere; API has the old `agent.chain_id !== 97` pin.
- `2766dc1`: contains both the chain-aware API (`chainIdFromAgentId` gate,
  `mainnet-hire-disabled`) and the chain-56 card text.
- Live production agent page for 334760 (HTTP 200, 93,405 bytes) now renders
  **"BNB Agent Studio Mainnet Seller"** + **"Mainnet hiring coming soon"** +
  **"Mainnet hiring unavailable"** (disabled button) — all three strings
  exist only in the X.241 commit. Previous production could not produce them.

## 10. Mainnet disabled verification

- Web flag: `MAINNET_HIRE_ENABLED` **unset/false** in production (default).
  A chain-56 hire attempt through the production API now takes the truthful
  X.241 path: identity resolves to chain 56 → flag false → 409
  `mainnet-hire-disabled` "Mainnet hiring is unavailable (coming soon)…" —
  fails closed BEFORE negotiation. (Previously the same request hit the
  obsolete `unsupported-chain` 409.)
- Mainnet seller: `https://…ts.net:8443/health` → `hire: "disabled"`,
  `agentId: 56:0x8004…:334760` — unchanged, still disabled.
- UI: the chain-56 agent page displays discovery information + the disabled
  truthful card; no wallet interaction reachable.
- No wallet prompt, no transaction, no API execution of a hire occurred.

## 11. Testnet regression

- Testnet agent 1906 page: HTTP 200 (94,097 bytes) — unchanged, healthy.
- Testnet seller: `https://…ts.net/health` → 200, chain 97,
  seller `0xB0f768…7c0` — unchanged.
- Agent 1906: UNCHANGED · Agent 2005: UNTOUCHED · Job 787: UNTOUCHED.
- Marketplace mainnet scope selector live (chain-56-only mainnet catalog).
- Zero Testnet transactions.

## 12. Blockchain ledger

| Item                                                          | Count         |
| ------------------------------------------------------------- | ------------- |
| Transactions / writes / signatures / wallet prompts           | 0 / 0 / 0 / 0 |
| $U transfers / approvals / jobs / hires (mainnet AND testnet) | 0             |
| `MAINNET_HIRE_ENABLED` (web + seller)                         | false / false |

## 13. Remaining X.242 prerequisites (first real Mainnet hire)

1. **Buyer needs ≥ 1 $U** on chain 56 ($U `0xcE24…6666`) — currently 0 $U
   (owner wallet `0xB0f768…7c0`); user must fund or designate a funded buyer.
2. **Buyer BNB readiness must be rechecked** at execution time (currently
   0.000427122484102691 BNB — sufficient at present gas prices for the
   5-tx sequence, but must be re-verified fresh).
3. **Mainnet seller flag remains disabled** — enabling
   (`MAINNET_HIRE_ENABLED=true` + process restart on port 3001) is a
   separate user-authorized step.
4. **Web Mainnet flag remains disabled** — enabling in the Vercel env is a
   separate user-authorized step.
5. **Fresh X.242 precondition run required** — all 12 preconditions re-check
   (deployment ✅ is now one of them; $U is the hard blocker).
6. **Fresh explicit user authorization required** before the first real
   Mainnet hire — prior registration authorization does NOT extend to a
   hire; the X.242 authorization gate will present the full preview and
   stop.

**STOP — deployment complete and verified. Mainnet hiring remains disabled.**
