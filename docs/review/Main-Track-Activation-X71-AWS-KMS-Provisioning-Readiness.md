# X.71 AWS/KMS Provisioning Readiness (Remediation Phase 2 — Audit)

- **Date:** 2026-08-19
- **Baseline:** `Main-Track-Activation-X70-Production-PancakeSwap.md` (X.70 COMPLETE; NEXT recorded: X.71 remediation phase 2, AWS/KMS provisioning prerequisite)
- **Scope:** Readiness / remediation AUDIT ONLY. No AWS resources, no KMS key, no Vercel env changes, no deploy, no blockchain transactions, no mainnet, no activation, no Job 515, no commit/push. Zero source-code modifications were made — and none were justified.
- **Result:** Application-side KMS readiness is **PASS** (fully implemented and verified offline). Real AWS KMS provisioning is **BLOCKED / NOT STARTED** — credentials must and do remain UNSET.

## 1. X.71 Objective

Establish, from repository evidence alone, whether the application is ready for AWS KMS custody the moment real AWS infrastructure exists, and confirm that every custody/activation path fails CLOSED while KMS is unconfigured. Verify the X.49 MEDIUM/LOW remediation ledger is closed. Do not manufacture code changes, credentials, placeholders, or passing states.

## 2. Current KMS Architecture

```text
process env (server-only)
  ALTANA_KMS_PROVIDER (default "aws"; "test" selectable only outside production)
  AWS_REGION                          -> resolveKmsConfig (lib/custody/kms/config.ts)
  ALTANA_KMS_KEY_ID                   -> resolveKmsConfig
            |
            v
  createKmsProvider (lib/custody/kms/factory.ts)      [server-only]
            |
            +-- TestKmsProvider  (fixture adapter; constructor throws in NODE_ENV=production)
            +-- AwsKmsProvider   (SDK: DescribeKey / Encrypt / Decrypt only; symmetric key)
            |
            v
  createAltanaCustody (lib/custody/index.ts)  -> envelope custody (wrapped DEK, AEAD)
            |
            v
  createSessionService (lib/altana-session/index.server.ts, X.49 L-9 cached wiring)
            |
            +-- GET /api/altana/session
            +-- POST /api/altana/session/revoke
            +-- POST /api/activation/hire   (createSession only after identity/capability/review/consent)
```

No new encryption system was invented (X.44 abstraction retained). No AWS SDK credentials, key material, DEK, or private key is embedded in source; the AWS provider performs key ADMINISTRATION nowhere — DescribeKey/Encrypt/Decrypt only.

## 3. Configuration Requirements (expected production values)

```text
AWS_REGION=<real production AWS region>        MUST REMAIN UNSET until provisioned
ALTANA_KMS_KEY_ID=<real production KMS key id> MUST REMAIN UNSET until provisioned
ALTANA_KMS_PROVIDER=aws                        MUST REMAIN UNSET until provisioned
```

- Current production environment reality (X.70 env listing, presence-only): AWS_REGION, ALTANA_KMS_KEY_ID, ALTANA_KMS_PROVIDER are **ABSENT** from Vercel Production. Correct and intentional — no placeholder was introduced.
- Companion custody contract (PENDING, not part of KMS key itself): `ALTANA_ADMIN_CUSTODY_PROVIDER` + `ALTANA_ADMIN_KEY_REFERENCE` are required by the production policy; a raw `ALTANA_TESTNET_PRIVATE_KEY` in production is actively rejected.
- Documented IAM/credential model (X.50): credentials come from Vercel's encrypted server-side env or an AWS identity mechanism, scoped to `kms:Encrypt`, `kms:Decrypt`, `kms:DescribeKey` on ONE key ARN — never `kms:*`, never resource `*`, never in source, never in a browser bundle; CloudTrail enabled on the key.

## 4. Application-Side Readiness — PASS

| Prerequisite | Implementation | Evidence |
|---|---|---|
| KMS provider abstraction + resolver | `resolveKmsConfig`: default provider "aws"; unknown provider -> CustodyConfigError; missing AWS_REGION/ALTANA_KMS_KEY_ID -> CustodyConfigError; "test" in production -> CustodyConfigError | `lib/custody/kms/config.ts` |
| Provider double-guard | `AwsKmsProvider` constructor throws CustodyConfigError without region+keyId; `TestKmsProvider` constructor throws when `NODE_ENV=production` | `lib/custody/kms/aws-kms.ts:27`, `lib/custody/kms/test-kms.ts:24` |
| Production policy assertions | `inspectProductionConfig`/`assertProductionConfig` issue `kms-provider` (provider!=aws), `kms-region-missing` (AWS_REGION), `kms-key-missing` (ALTANA_KMS_KEY_ID), `admin-key-in-env`, `admin-custody-missing`; fails closed with codes+names only, never values | `lib/security/production-config.ts:99-145` |
| Envelope custody | wrapDataKey/unwrapDataKey over wrapped DEK + AEAD seal; no plaintext DEK or signer persisted (X.44 checks) | `lib/custody/envelope.ts`, `lib/custody/aead.ts`, custody.verify.ts |
| Route wiring | `createSessionService` (X.49 L-9 stable cache) constructs custody via `createAltanaCustody(env)`; every failure propagates typed `CustodyConfigError` | `lib/altana-session/index.server.ts:60` |
| No secret exposure | Zero `NEXT_PUBLIC_` secrets (policy rejects pattern); no secret values logged anywhere; responses carry only permissions-safe public views | X.49/X.50/X.70 scans |

## 5. Fail-Closed Verification — PASS

- `resolveKmsConfig({})` -> CustodyConfigError; `resolveKmsConfig({ALTANA_KMS_KEY_ID})` (partial) -> CustodyConfigError; unknown provider -> CustodyConfigError; `resolveKmsConfig({ALTANA_KMS_PROVIDER:"test", NODE_ENV:"production"})` -> CustodyConfigError; test provider selectable ONLY outside production. (custody.verify.ts checks 14/14b/14c/14d + production guard; x50.infrastructure.verify.ts check 6 `kms-provider` + check 7 `kms-region-missing`+`kms-key-missing`.)
- Production policy on a fully provisioned (synthetic) env: `ok: true`; each missing KMS variable produces exactly its issue code (no leakage).
- Route-level: `altanaApiErrorMessage` classifies `CustodyConfigError` by error NAME only (never message content) -> `503 "Altana session support is not configured on this deployment."`; sibling custody errors stay 500; check 446 proves the 503 message reveals no `AWS_REGION|KMS|KEY_ID|provider` internals (session.api.verify.ts checks 435-446, 464).

## 6. Custody Gating Verification — PASS

- Without KMS configuration, `createSessionService()` throws on EVERY request (X.58.1), so no `AltanaSession` record, no signer construction, and no custody round trip can begin.
- When KMS PROVIDED but failing: `KmsAccessError`/`KmsKeyError`/`WrappedKeyCorruptionError` propagate; no record persisted on wrap failure (custody.verify.ts check 13e), decrypt/restore fails closed (checks 13/13d).
- No plaintext/DEK persisted (checks 15-17); audit rows carry ids/status only; error codes stable and typed.

## 7. Activation Gating Verification — PASS

- The only activation entry, `POST /api/activation/hire`, constructs the session service only AFTER exact identity, capability, review, and consent validation (route.ts:36-39 comment contract). Housing it one step later means 503-not-configured short-circuits before any session/execution.
- hire-api verifier: custody unavailable never returns ACTIVE; database failure maps to safe "unavailable" (14/14 PASS).
- No execution HTTP endpoint exists anywhere (X.50 line 124). `executeAllowedOperation` is unreachable without a persisted session, which itself requires KMS.
- Chain safety unchanged: ALTANA_NETWORK=bnb rejected everywhere; chain 97 pinned (5 layers, X.50); no mainnet RPC in executable code.

## 8. X.49 MEDIUM/LOW Remediation Ledger — CLOSED (all 4 MEDIUM, 9/9 LOW resolved)

- MEDIUM (4/4 FIXED in X.49, re-verified by 25/25 x49 verifier): M-1 daily spend-cap UTC bucket; M-2 CI test+audit jobs; M-3 CI lifecycle allowlist (`pnpm.onlyBuiltDependencies`); M-4 app-level live-session duplicate enforcement.
- LOW (9/9 resolved): L-1 server-only marker, L-2 streaming body cap, L-3 shared byte cap, L-4 nonce-denial audit, L-5 Aave streaming response cap, L-6 canonical-origin HTTPS policy, L-7 8004scan per-record validation (DEFERRED in X.49 -> CLOSED in X.50 via `isValidAgentRecord`/`filterValidAgentRecords`, verified by x50 checks + x58 credential verifier), L-8 AEAD internal nonce, L-9 stable per-process service cache.
- Residual X.49 "LOW" entries from final status: (a) distributed limiter live backend — addressed: PostgreSQL provisioned and PASS (X.59/X.61), `RATE_LIMIT_BACKEND` present in Vercel Production env (X.70 env listing); (b) 8004scan row schema — closed per L-7; (c) Prisma build warning — resolved in the Linux deployment image (X.61); only benign ox dynamic-dependency / Windows lookup warnings remain with build exit 0 (X.70).
- Nothing in the X.49 ledger remains an outstanding code item blocking KMS.

## 9. External AWS Provisioning Blockers — BLOCKED (must stay unset)

1. AWS account / access for provisioning: NOT available in this environment (X.50 environment reality check; unchanged).
2. Customer-managed KMS key (`SYMMETRIC_DEFAULT`): NOT created; no key ARN exists.
3. Least-privilege IAM (single-key Encrypt/Decrypt/DescribeKey) + CloudTrail: NOT established.
4. Vercel Production env `AWS_REGION`, `ALTANA_KMS_KEY_ID`, `ALTANA_KMS_PROVIDER=aws`: NOT SET — by design; no placeholder values were introduced or treated as passing.
5. Live KMS round trip (encrypt -> store -> decrypt -> destroy with a synthetic fixture — X.49 prereq 3 / X.50 plan 4): NOT run; cannot be run without real infrastructure.
6. Management custody (remote signer/HSM; `ALTANA_ADMIN_CUSTODY_PROVIDER` + `ALTANA_ADMIN_KEY_REFERENCE`): BLOCKED — same external-infrastructure class; required before ANY production chain write.

## 10. Tests Performed (all offline; no network/RPC/DB)

| Suite | Result |
|---|---|
| `pnpm run custody:verify` (X.44 KMS/custody) | PASS (44 checks; offline — real-Postgres persistence note is the pre-existing P1001 condition) |
| `pnpm run security:x50:verify` (X.50 infrastructure) | 34 checks, 1 failure — known pre-existing stale check-24 ("standalone output and server-external packages remain configured", superseded by X.61 serverless Vercel build). Identified, NOT modified, NOT a KMS item. KMS checks 5-7 PASS. |
| `pnpm run security:x49:verify` (X.49 remediation) | PASS (25/25) |
| `pnpm run altana:session:api:verify` (X.47 session API) | PASS (72/72), incl. CustodyConfigError -> 503 no-leak (checks 435-446, 464) |
| `pnpm run activation:hire-api:verify` (X.65 hire API) | PASS (14/14) — custody unavailable never returns ACTIVE |
| `pnpm run security:x55:verify` (X.55 gap closure) | PASS (22/22) |
| `pnpm typecheck` | PASS (14 tasks) |
| `pnpm lint` | PASS (14 tasks) |

Build: not re-run — zero source changes since X.70, whose `pnpm build` exited 0; X.71 introduces no code, so no new build artifact exists under this step.

## 11. Production Boundary

UNCHANGED. No deployment, no redeploy, no Vercel project/env/secret mutation (presence-only inspection of env NAMES was performed in X.70; nothing modified in X.71). Alias continues to serve the X.69 deployment (dpl_GDDogDS1WKRM1GE8v5mWP35mb8SF, READY).

## 12. Mainnet Boundary

UNTOUCHED. No mainnet RPC, no mainnet-key material, no chain outside 97. X.50's five-layer chain-97 enforcement re-verified via x49/x50 verifiers (PASS).

## 13. Transaction Boundary

NONE. No blockchain transactions, no broadcast, no signing, no gas. `executeAllowedOperation` never entered; live verifiers not run.

## 14. Commit/Push Boundary

NONE. No `git` operations performed; working tree unmodified (audit only). X.71 introduced exactly one file: this report.

## 15. Exact Next Step After X.71

- **X.72 — Real AWS KMS Provisioning (out-of-band):** create the customer-managed symmetric KMS key, least-privilege IAM + CloudTrail, and set `AWS_REGION` / `ALTANA_KMS_KEY_ID` / `ALTANA_KMS_PROVIDER=aws` in Vercel Production only; then run the real encrypt -> store -> decrypt -> destroy round trip with a synthetic fixture (never a real Altana key) and verify the fail-closed 503s disappear while `ALTANA_TESTNET_PRIVATE_KEY` remains absent.
- Its successor: **X.73 — Management Custody (remote signer/HSM) integration** replacing the env-key path (`ALTANA_ADMIN_CUSTODY_PROVIDER`, `ALTANA_ADMIN_KEY_REFERENCE`) before any production chain write, per X.50 plan items 4-5.
- NOT EXECUTED per instruction. Stop after X.71.

## Classification Summary

| Item | Status |
|---|---|
| KMS configuration code (resolver/factory/providers) | PASS |
| Production env policy assertions (kms-provider/region/key, admin custody, no env key) | PASS |
| Fail-closed behavior (config + route 503, no-leak) | PASS |
| Custody gating (no session without KMS; no record on wrap failure) | PASS |
| Activation gating (hire short-circuits before session/execution; no execution endpoint) | PASS |
| X.49 MEDIUM/LOW remediation ledger | CLOSED (4/4 MEDIUM, 9/9 LOW; residual items superseded by deployed infrastructure) |
| App-side readiness | PASS — nothing to add; no code change manufactured |
| Real AWS provisioning (account, key, IAM, CloudTrail) | BLOCKED / NOT STARTED (external) |
| Vercel KMS env values | BLOCKED — intentionally UNSET; presence-only policy holds |
| Live KMS round trip | NOT STARTED — blocked by external provisioning |
| Management custody (remote signer) | BLOCKED (external) |
| Tests / typecheck / lint | PASS |

## Final Status

```text
X.71 STATUS: PASS (application-side readiness verified) WITH BLOCKED EXTERNAL PREREQUISITES

KMS CONFIG CODE:    PASS
PRODUCTION POLICY:  PASS
FAIL-CLOSED:        PASS
CUSTODY GATING:     PASS
ACTIVATION GATING:  PASS
X.49 MEDIUM:        4/4 FIXED
X.49 LOW:           9/9 RESOLVED
REAL AWS KMS:       BLOCKED (NOT STARTED — external; env values correctly UNSET)
LIVE KMS VERIFY:    BLOCKED (external)
MANAGEMENT CUSTODY: BLOCKED (external)
TESTS:              custody 44 PASS | session-api 72 PASS | hire-api 14 PASS |
                    x49 25 PASS | x50 34 checks/1 stale check-24 (identified) |
                    x55 22 PASS
TYPECHECK:          PASS
LINT:               PASS
BUILD:              not re-run (zero code changes since X.70 build PASS)

PRODUCTION:  UNCHANGED
VERCEL:      UNCHANGED
MAINNET:     UNTOUCHED
TRANSACTIONS: NONE
COMMIT:      NO
PUSH:        NO
```