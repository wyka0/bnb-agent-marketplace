# X.73 Management Custody — Dependency / Readiness Audit

- **Date:** 2026-08-19
- **Baseline:** `Main-Track-Activation-X72-Real-AWS-KMS-Provisioning.md` (BLOCKED execution gate — no AWS/Vercel access, KMS NOT PROVISIONED) and `Main-Track-Activation-X71-AWS-KMS-Provisioning-Readiness.md`
- **Scope:** AUDIT ONLY. No code changes, no credentials, no deployment, no blockchain activity, no mainnet, no Agent 1816 / Job 515 execution, no commit/push. Nothing was created except this report.
- **Result:** READINESS PASS / IMPLEMENTATION BLOCKED. The unsafe environment-key signing path exists in code but is correctly closed in production by policy + env absence; no production bypass of KMS/custody gates exists; no management-custody abstraction exists yet — X.73's implementation requirements are documented below and remain BLOCKED on external dependencies (X.72 KMS provisioning first, then a real remote-signer/HSM provider selection).

## 1. X.73 Objective

Establish management custody readiness for the long-lived Altana admin/provider signer: audit every signing surface, every operator-authorization surface, every production gate, and the interface that must replace the environment-key signer path (`ALTANA_ADMIN_CUSTODY_PROVIDER` + `ALTANA_ADMIN_KEY_REFERENCE`) before any production chain write. Confirm that no production path can bypass the KMS/custody gates today. Do not modify anything.

## 2. X.72 Dependency Status — BLOCKED (cascades to X.73)

- Real AWS KMS: NOT PROVISIONED. AWS access UNAVAILABLE, Vercel access UNAVAILABLE (X.72 gate).
- Vercel Production: `AWS_REGION`, `ALTANA_KMS_KEY_ID`, `ALTANA_KMS_PROVIDER`, `ALTANA_ADMIN_CUSTODY_PROVIDER`, `ALTANA_ADMIN_KEY_REFERENCE` all remain UNSET by design (presence-only, X.70/X.72 listings; no `vercel` CLI here).
- Live KMS round trip: NOT STARTED. Production chain writes must not occur until BOTH X.72 (KMS) and X.73 execution (management custody) are complete.
- X.73 execution therefore cannot begin until X.72 dependencies exist — the two steps are strictly sequential per X.40/X.50 architecture.

## 3. Current Custody Architecture

```text
SESSION material (X.44 envelope custody)          ADMIN/operator authority (ALTANA_TESTNET_PRIVATE_KEY)
  KmsProvider abstraction (test|aws)     <---     used ONLY to build the admin signer in:
    resolveKmsConfig — fail-closed                 apps/web/lib/altana-session/index.server.ts:53,56
    factory — server-only                          createSdkAltanaSessionAdapter({adminPrivateKey, rpcUrl})
    AwsKmsProvider (DescribeKey/Encrypt/Decrypt)   adapter.ts:121 signerFromPrivateKey(opts.adminPrivateKey)
    TestKmsProvider (prod-guarded, X.71 PASS)      -> Altana SDK client.createWallet({ signer: adminSigner })
  encryptAltanaSecret / decryptAltanaSecret
    wrapped DEK + AEAD, AAD bound, chain-97       X.46/X.58.1: service construction fails closed -> 503
  persisted: EncryptedSecretRow (Postgres)         (no leak; verified session-api checks 435-446, 464)
```

- Session signing material NEVER touches a browser bundle, routes, or API bodies (public views only, X.47).
- The admin signer is a memory-held local viem/Altana SDK signer derived from the env private key — for local/testnet operation only (X.46 documented; X.50 line 112: "correct for local/testnet but must be replaced by a remote-signer adapter before production writes").

## 4. Current Signing/Execution Architecture

Every surface that can construct a chain signer, repository-wide (all consume `ALTANA_TESTNET_PRIVATE_KEY` from env — name reported, never value):

| Surface | Kind | Web-wired? | Gated? |
|---|---|---|---|
| `apps/web/lib/altana-session/index.server.ts:53` (`buildSessionService` → `createSdkAltanaSessionAdapter`) | Runtime path (grant/register/revoke use admin signer; execute uses session signer) | YES — behind auth + custody | YES — fail-closed 503 without env key; KMS custody required for session material |
| `packages/integrations/src/altana/erc8183.job515.funding.execute.x28c.ts`, `job515.submission.execute.x30.ts`, `job515.settlement.execute.x32.ts`, `job515.execution.review.x29a.ts`, `erc8183.job.creation.x26.ts`, `erc8183.job.completion.cont.ts`, `registration-execution.x23.ts` | Standalone OPERATOR CLI scripts (`.env.local`, chain 97, `sendTransaction` via walletClient) | NO — never imported by `apps/web` (verified: zero imports; `packages/integrations/src/altana/index.ts` exports only the x36 PUBLIC snapshot) | Operator-invoked only; chain-97 pinned via SDK `BNB_TESTNET` |
| `packages/integrations/src/altana/altana.session.x36.ts` | Legacy session demo script (public snapshot `session.x36.public.ts` is evidence-only, revoked session) | NO | Snapshot contains no signing code |
| `apps/web/lib/auth/auth.verify.ts`, `auth.hardening.verify.ts` | Test fixtures (`generatePrivateKey` throwaways) | NO (verifiers) | N/A |

`executeAllowedOperation` (the only function that submits an Altana session call) is invoked exclusively by verifier suites (`session.verify.ts`, `session.api.verify.ts`, `session.live.verify.ts`) and exposed by the service object; NO route handler calls it — confirmed again this audit. **No execution HTTP endpoint exists** (X.50/X.71/X.72 finding, unchanged).

## 5. Admin-Key Handling Audit — GATED, no unsafe production path

- **Policy (release gate):** `lib/security/production-config.ts:130-145` — production rejects a present `ALTANA_TESTNET_PRIVATE_KEY` (`admin-key-in-env`) and requires BOTH `ALTANA_ADMIN_CUSTODY_PROVIDER` and `ALTANA_ADMIN_KEY_REFERENCE` (`admin-custody-missing`). Verified: x49/x50 verifiers + X.51 presence listing (ABSENT in Vercel).
- **Runtime:** `buildSessionService` calls `requiredEnv("ALTANA_TESTNET_PRIVATE_KEY")` FIRST → absent in production → `CustodyConfigError`-class 503 ("Altana session support is not configured on this deployment."), no leak; KMS custody gate (`createAltanaCustody`) is a separate always-on fail-closed layer.
- **Gate that must remain closed until X.73 execution:** `admin-key-in-env` policy AND the physical absence of `ALTANA_TESTNET_PRIVATE_KEY` in Vercel Production (presence-only verified today). No runtime object refuses the env key INDEPENDENTLY of the policy — that runtime refusal is itself part of the X.73 implementation requirement (§15, item 4). Until then the deployment pipeline must keep the variable absent.
- No plaintext key storage: not in Postgres, not in source, not in browser code, not returned through APIs (audit rows carry ids/status only).
- Standalone operator scripts read the key only from local `.env.local` on chain 97 — operator-tooling scope, outside the web surface, and outside production writes (Job 515/Agent 1816 NOT executed; verified no executable coupling in session code, x49 check 24-25).

## 6. Remote Signer/HSM Interface Readiness — NOT STARTED

- **No management-custody abstraction exists.** The adapter accepts a raw hex key string (`createSdkAltanaSessionAdapter({ adminPrivateKey })`); the only signer production path is `signerFromPrivateKey` (@altananetwork/sdk).
- `KmsProvider` (X.44) covers SESSION signer material only — it does NOT and must NOT sign admin transactions (SYMMETRIC_DEFAULT key, Encrypt/Decrypt/DescribeKey only, X.50).
- SDK compatibility note: the Altana SDK consumes signer objects (`client.createWallet({ signer })`; `signerFromPrivateKey`, `createPrivateKeySigner`); a remote signer/HSM must surface an equivalent SDK-compatible signer or client wrapper (provider-specific adapter) — this is the X.73 build surface.
- Provider candidate space documented (X.38/X.39/X.40): Turnkey, Fireblocks, Coinbase Developer Platform, HashiCorp Vault/HSM, AWS CloudHSM, or equivalent compatible managed signing service. No selection has been made (external decision).

## 7. ALTANA_ADMIN_CUSTODY_PROVIDER Readiness — PARTIAL (config contract only)

- Config contract EXISTS and is production-enforced: presence required in production (`admin-custody-missing`); documented in `.env.example:34-38` ("PRODUCTION MUST use a remote signer / HSM reference"); X.50/X.51/X.52/X.71/X.72 records require it before production writes.
- Runtime SUPPORT does NOT exist: no provider registry, no selector, no adapter consuming it. Any value set today would be inert (still 503 at `requiredEnv`).
- Classification: PARTIAL because values stay UNSET and runtime consumption is NOT STARTED.

## 8. ALTANA_ADMIN_KEY_REFERENCE Readiness — PARTIAL (config contract only)

- Same contract status as §7: required in production by policy; absent from Vercel (X.51 listing, X.72 gate); `.env.example` documented; X.40/X.44 models define it as the exact key/address selector within the custody provider (e.g., key id, vault path, HSM slot).
- Runtime consumption NOT STARTED; no lookup/signing path exists for the reference.

## 9. Production Execution Gates — PASS (all closed)

1. **Chain gate:** `ALTANA_NETWORK=bnb` refused everywhere; SDK `BNB_TESTNET` pinned; DB `CHECK chainId=97`; 16-check revoke preflight (X.50 five layers — PASS).
2. **Config gate:** `inspectProductionConfig`/`assertProductionConfig` — `admin-key-in-env`, `admin-custody-missing`, `kms-*`, `auth-origin-*`, `rate-limit-*` (x50 verifier PASS, only stale check-24 unrelated).
3. **Service-construction gate:** missing env key or KMS config → typed error → 503 no-leak (session-api 72/72 PASS).
4. **Custody gate:** session secrets unusable without KMS unwrap; registration/execution functions require a live, custody-attached session (X.44/X.45/X.46 PASS offline).
5. **Activation gate:** `POST /api/activation/hire` sequence — identity → rate limit/CSRF/origin → capability (agent identity + review) → consent → service creation (custody) → execution eligibility. Custody failure returns 503 "activation-unavailable"/not-configured and can NEVER produce ACTIVE (hire-api 14/14 PASS, incl. "custody unavailable never returns ACTIVE").
6. **No execution endpoint:** nothing calls `executeAllowedOperation` outside verifiers.

Sequence verified intact this audit; NOT modified.

## 10. Unsafe Fallback Audit — NO bypass found; one declared residual

- Environment-key path EXISTS in code (`index.server.ts:53`) but is CLOSED in production today by policy (release gate) + env absence (runtime 503). It is NOT reachable from any browser path and cannot produce chain writes without a custody-attached session (semaphore + permissions + spend cap, X.49 H-4/M-1).
- **Declared residual (documented, not a live hole):** if an operator were to place `ALTANA_TESTNET_PRIVATE_KEY` into a production env, the runtime would construct the local signer (policy is enforcement-by-process, not in-runtime refusal). X.73 execution MUST eliminate this residual by making runtime construction refuse the local-env path in production (§15, item 4). Until then the deployment operator keeps the variable absent — presence-only verified UNSET, and nothing here can set it.
- No silent fallback to an env key exists in any custody path; no DEV→PROD leakage mechanism (KMS test provider double-guarded, X.44/X.71).
- No plaintext key persistence, no browser exposure, no API return of signing material (X.47/X.49 checks PASS).

## 11. Test Evidence (run this audit)

| Suite | Result |
|---|---|
| `pnpm run custody:verify` (X.44) | PASS (44 offline; real-Postgres persistence note = pre-existing P1001 environment) |
| `pnpm run altana:session:verify` (X.45) | PASS (25/25) |
| `pnpm run altana:session:api:verify` (X.47) | PASS (72/72) |
| `pnpm run activation:hire-api:verify` (X.65) | PASS (14/14) |
| `pnpm run security:x49:verify` | PASS (25/25) |
| `pnpm run security:x50:verify` | 34 checks / 1 failure = known pre-existing stale check-24 ("standalone output and server-external packages remain configured" — superseded by X.61 serverless build; not a custody/KMS item; identified, untouched) |

No new tests were written — no test infrastructure gap blocks X.73 READINESS; runtime behavior will only be testable once the remote-signer provider exists (documented requirement, §15).

## 12. Required External Dependencies

1. **X.72 completion first** — real AWS KMS provisioned (key, IAM, CloudTrail, Vercel env) and live synthetic round trip passed; application then constructs custody for real.
2. **Remote signer/HSM provider selection** (operator/business decision among documented candidates: Turnkey, Fireblocks, CDP, Vault/HSM, CloudHSM, or equivalent Altana-SDK-compatible signing service).
3. **Provider account/key provisioning** — key material for the admin wallet created/imported into the custody service; `ALTANA_ADMIN_KEY_REFERENCE` (key id/path/slot) assigned; approvals policy + incident response (X.40 checklist items).
4. **Vercel Production env:** `ALTANA_ADMIN_CUSTODY_PROVIDER=<selected provider>` + `ALTANA_ADMIN_KEY_REFERENCE=<key selector>` (server-side secrets; after X.72's AWS vars).

## 13. Blockers

- X.72 AWS KMS provisioning (operator, out-of-band) — REQUIRED FIRST.
- Remote signer/HSM provider selection + key provisioning (operator, out-of-band).
- No AWS access / no Vercel access / no operator provisioning authorization in this environment (X.72 gate; unchanged).
- No approval to activate or write on chain 97 testnet (all activation remains OFF; Agent 1816 / Job 515 untouched).

## 14. Security Boundary

- No credentials, keys, seed phrases, tokens, or secret values printed or read (presence/absence and code shape only — e.g., `ALTANA_TESTNET_PRIVATE_KEY` verified ABSENT from Vercel Production by name, X.70/X.51).
- No deployment, no env mutation, no Vercel/project change.
- Mainnet untouched; no chain-56 reference exists in executable code.
- No transactions, no signing, no broadcast; live verifiers not run (would transact).
- No commit/push; no source files modified (audit-only).

## 15. Exact Implementation Requirements for Future X.73 Execution

1. **ManagementCustodyProvider interface** (new, server-only): `providerName`, `keyReference` validation, `getAdminSigner()` returning an SDK-compatible Altana signer (or thin client wrapper). Registry keyed by `ALTANA_ADMIN_CUSTODY_PROVIDER` value; unknown provider → typed config error (fail-closed), mirroring `resolveKmsConfig`.
2. **Provider selection wiring** in `buildSessionService`: production requires a real provider (policy-compatible with `admin-custody-missing`); `ALTANA_ADMIN_KEY_REFERENCE` selects the exact key; the local-env signer remains DEV/TEST-only.
3. **Adapter change:** `createSdkAltanaSessionAdapter` accepts a signer (or provider handle) instead of a raw key for the admin path; chain-97 pinning and grant/register/revoke/execute semantics unchanged; session-signer custody via `KmsProvider` unchanged.
4. **Runtime refusal in production** of the local-env path (closing the §10 residual) — e.g., provider must not be the env-key default under `NODE_ENV=production`, enforced at service construction, identical 503/no-leak semantics.
5. **Tests (to be added at execution, not now):** provider registry fail-closed (missing/unknown provider, missing key reference in production), adapter construction with a fake remote-signer provider (no network), production policy interaction (`admin-custody-missing` disappears only with real values), activation/hire end-to-end still 503 until provider + KMS both real.
6. **Verification prerequisites:** X.72 Phase C must be green first; then a read-only admin-signer probe (derived address vs `ALTANA_ADMIN_KEY_REFERENCE` owner, chain 97) before ANY write.

## 16. Exact Next Step

- **X.73 EXECUTION can only begin after X.72 completes** (operator provisions AWS KMS per X.72 Phases A–C). The concrete next step is therefore: operator performs X.72 execution (AWS account → SYMMETRIC_DEFAULT key + least-privilege IAM + CloudTrail → Vercel Production env → synthetic round trip). When green, X.73 execution proceeds: select remote-signer provider → implement `ManagementCustodyProvider` + adapter changes (§15) → set `ALTANA_ADMIN_CUSTODY_PROVIDER`/`ALTANA_ADMIN_KEY_REFERENCE` → verify gates → THEN (separate, later step) production activation.
- NOT EXECUTED here. This report stops the sequence at the audit.

## Classification Summary

| Item | Status |
|---|---|
| X.72 dependency (KMS provisioning prerequisite) | BLOCKED |
| Current custody architecture (session envelope, fail-closed) | PASS |
| Admin-key handling — production gating (policy + env absence) | PASS |
| Unsafe fallback — live bypass of KMS/custody gates | PASS (none found; env-key path closed; residual documented) |
| Activation gate sequence (identity→capability→review→consent→custody→eligibility; custody failure never ACTIVE) | PASS |
| No execution HTTP endpoint | PASS |
| ALTANA_ADMIN_CUSTODY_PROVIDER – config contract | PARTIAL (policy+docs exist; runtime support NOT STARTED) |
| ALTANA_ADMIN_KEY_REFERENCE – config contract | PARTIAL (policy+docs exist; runtime support NOT STARTED) |
| Remote signer/HSM abstraction + integration | NOT STARTED (no abstraction exists; provider unselected) |
| X.73 IMPLEMENTATION (code + provisioning) | BLOCKED (X.72 + provider selection external) |

## Final Status

```text
X.73 STATUS: READINESS PASS / IMPLEMENTATION BLOCKED

X.72 DEPENDENCY:    BLOCKED (AWS access UNAVAILABLE; KMS NOT PROVISIONED — prerequisite)
CUSTODY ARCHITECTURE: PASS (envelope + fail-closed, X.71 carried)
ADMIN KEY AUDIT:    PASS (env-key path exists, production-closed by policy + absence; residual documented)
REMOTE SIGNER/HSM:  NOT STARTED (no abstraction; provider unselected — external)
ACTIVATION GATE:    PASS (identity->capability->review->consent->custody->eligibility; never ACTIVE on custody failure)
UNSAFE FALLBACK:    PASS (no live bypass; no silent env-key fallback; runtime-refusal is X.73 requirement)
IMPLEMENTATION:     BLOCKED (needs X.72 + provider provisioning, out-of-band)

TESTS: custody 44 PASS | session 25 PASS | session-api 72 PASS | hire-api 14 PASS |
       x49 25 PASS | x50 34/1 (known stale check-24, untouched)

PRODUCTION: UNCHANGED
VERCEL:     UNCHANGED
MAINNET:    UNTOUCHED
TRANSACTIONS: NONE
COMMIT:     NO
PUSH:       NO
```