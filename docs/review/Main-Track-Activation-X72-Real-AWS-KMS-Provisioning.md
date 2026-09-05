# X.72 Real AWS KMS Provisioning — Execution Gate Audit & Plan

- **Date:** 2026-08-19
- **Baseline:** `Main-Track-Activation-X71-AWS-KMS-Provisioning-Readiness.md` (X.71 PASS — application-side KMS readiness fully verified; X.72 = external provisioning prerequisite step)
- **Scope:** EXECUTION GATE AUDIT ONLY. Zero external mutations. No AWS resources created, no KMS key created, no Vercel env modified, no credentials invented, no placeholders, no deploy, no blockchain transactions, no mainnet, no activation, no Agent 1816 / Job 515, no PancakeSwap configuration, no commit/push.
- **Result:** **X.72 GATE: BLOCKED — AWS ACCESS UNAVAILABLE, VERCEL ACCESS UNAVAILABLE.** Provisioning requires explicit operator provisioning outside this environment. This report is the audited execution plan with the exact blocking point.

## 1. Execution-Gate Audit Findings (items 1-11)

### 1.1 Exact AWS resources that must exist (item 1)

| Resource | Requirement | Notes |
|---|---|---|
| AWS account | Real production account with billing/policy capabilities | No account exists in this environment (X.50/X.71 unchanged) |
| Customer-managed KMS key | One symmetric key, `KeySpec=SYMMETRIC_DEFAULT`, enabled, usable | Key is consumed by the app via `ALTANA_KMS_KEY_ID` (key id/alias/ARN); never administered from app code |
| IAM identity for the Vercel runtime | Least-privilege role/identity consumed by the AWS SDK default credential chain | Vercel AWS-native short-lived role integration or equivalent server-side mechanism |
| CloudTrail | Trail (or organization trail) with data events on the KMS key; key rotation enabled | Audit requirement per X.50 credential model |
| Key alias | Optional; recommended `alias/altana-session-custody` for operator ergonomics | App accepts id/alias/ARN |

### 1.2 Exact KMS key configuration required (item 2)

- `KeySpec = SYMMETRIC_DEFAULT`
- `KeyUsage = ENCRYPT_DECRYPT`
- `Origin = AWS_KMS`
- Customer-managed (never AWS-managed — the app holds no administration APIs)
- Enabled state; `EnableKeyRotation = true` (annual rotation)
- Key policy: allow the runtime identity `kms:Encrypt`, `kms:Decrypt`, `kms:DescribeKey` on precisely this key ARN; allow the provisioning operator (`kms:CreateKey`, `kms:Enable/Disable/Delete/GetKeyPolicy/EnableKeyRotation`, `kms:DescribeKey`, `kms:TagResource`) and `kms:PutKeyPolicy`; CloudTrail allowed to read key metadata for audit log delivery.
- The application calls only `DescribeKey` / `Encrypt` / `Decrypt` (verified: `lib/custody/kms/aws-kms.ts` maps exactly these three operations to `KmsAccessError`/`KmsKeyError`/`KmsFailureError`).

### 1.3 Exact IAM permissions required by the application (item 3)

```text
kms:Encrypt      on <key ARN>
kms:Decrypt      on <key ARN>
kms:DescribeKey  on <key ARN>
```

- NEVER `kms:*`, NEVER `Resource: *`, never in source, never in a browser bundle (X.48/X.49/X.50 policy, unchanged).
- Credential mechanism: Vercel server-only environment / AWS-native integration issuing short-lived role credentials; no long-lived access keys in source (X.44 line 83 documented).

### 1.4 Provisioning tooling in the repository (item 4)

- **No Terraform, no CDK, no CloudFormation templates** (`*.tf`, `*.tfvars`, `cdk.json`, `template.y*ml`, `serverless.yml` — search: no matches for AWS provisioning).
- `docker-compose.yml` provisions LOCAL dev PostgreSQL 16 + Redis 7 only (dev ergonomics, unrelated).
- `.github/workflows/ci.yml` runs lint/typecheck/build/test/audit only — no AWS actions.
- No `*.sh` / `*.ps1` provisioning scripts exist.

### 1.5 Safety/production-appropriateness of existing scripts (item 5)

- N/A — nothing to evaluate. Any provisioning must be operator-authored at execution time using the audited least-privilege specification above (or a reviewed checked-in IaC artifact in a future step).

### 1.6 Exact Vercel Production variables required (item 6)

```text
AWS_REGION            = <real production AWS region>      UNSET — must remain so until provisioned
ALTANA_KMS_KEY_ID     = <real production KMS key id>      UNSET — must remain so until provisioned
ALTANA_KMS_PROVIDER   = aws                                UNSET — must remain so until provisioned
```

- Set in Vercel **Production scope only**; never preview/development, never in source, never via `NEXT_PUBLIC_`.
- `ALTANA_KMS_PROVIDER=aws` is also the DEFAULT in `resolveKmsConfig` — the variable is set for explicitness/policy completeness, not behavior.
- Companion (later, still PENDING): `ALTANA_ADMIN_CUSTODY_PROVIDER` + `ALTANA_ADMIN_KEY_REFERENCE` — NOT part of X.72.
- Current state (X.70 env listing, presence-only): all three AWS variables ABSENT from Vercel Production — correct, intentional, verified unchanged today (`vercel` CLI absent; no env mutation performed).

### 1.7 Exact synthetic-fixture round-trip flow required (item 7)

Application-level flow (to run ONLY against real AWS infrastructure once provisioned):

1. `createKmsProvider(process.env)` resolves `ALTANA_KMS_PROVIDER=aws` + region + key id → constructs `AwsKmsProvider`.
2. `getKeyMetadata()` → `DescribeKey` succeeds; record returned `keyVersion`/`algorithm` (e.g. `SYMMETRIC_DEFAULT`).
3. `encryptAltanaSecret` with a SYNTHETIC fixture plaintext (a random 32-byte buffer clearly labeled fixture — NEVER a real Altana admin key):
   - `wrapDataKey(DEK)` → `Encrypt`; envelope `ciphertext` + `AAD` bound (`aadVersion=1`, `secretType`, userId, sessionId, `chainId=97`) persisted via `EncryptedSecretRow`.
4. Verify persisted record holds no plaintext DEK (only wrapped material + metadata).
5. `decryptAltanaSecret` → `Decrypt` unwrap → plaintext bytes equal fixture input.
6. Destroy: `destroyAltanaSecret` → soft `destroyedAt` set; subsequent decrypt fails closed (`secret-destroyed`); optionally delete the row.
7. Clear instrumentation/logs of anything except ids/status (audit rows carry ids/status only).

No live-KMS verifier script exists in the repo today (all custody verification uses `TestKmsProvider` fixtures; `session.live.verify.ts` also uses the test provider). The round trip is exercised offline by `custody:verify` (44 checks) and will be re-run through the REAL provider via the same service functions once provisioned — no new executor assumes it can just call AWS.

### 1.8 Exact verification commands available in the repository (item 8)

Offline (executable now, no credentials):

| Command | Source | Expected |
|---|---|---|
| `pnpm run custody:verify` | `lib/custody/custody.verify.ts` | 44 checks PASS (round trip, fail-closed, rotation, destroy) |
| `pnpm run security:x50:verify` | `lib/security/x50.infrastructure.verify.ts` | 34 checks; KMS policy checks 5-7 PASS; check-24 known stale (identified, untouched) |
| `pnpm run security:x49:verify` | `lib/security/x49.security.verify.ts` | 25/25 PASS |
| `pnpm run altana:session:api:verify` | `lib/altana-session/session.api.verify.ts` | 72/72 PASS (CustodyConfigError → 503, no leak) |
| `pnpm run activation:hire-api:verify` | `lib/activation/hire.api.verify.ts` | 14/14 PASS (custody unavailable never ACTIVE) |
| `pnpm run security:x55:verify` | `lib/security/x55.gap.verify.ts` | 22/22 PASS |

Post-provisioning verification sequence (needs AWS credentials; defined in §4): provider metadata probe, one synthetic encrypt→store→decrypt→destroy round trip, production-policy presence check (`security:x50:verify`), then route-level 503 disappearance check via authenticated session API probes — all READ-ONLY except the fixture secret itself.

### 1.9 AWS CLI credential availability (item 9)

- `aws` CLI: **ABSENT** from PATH.
- `AWS_*` environment variable NAMES: **none present**.
- `~/.aws` directory exists (presence only; contents NOT read — and with no CLI and no env vars, no credentials are consumable by this environment anyway).
- **AWS ACCESS: UNAVAILABLE.** No credential values were inspected, printed, or invented.

### 1.10 Vercel CLI/authentication availability (item 10)

- `vercel` CLI: **ABSENT** from PATH (npx could fetch it, but there is no stored auth: `~/.vercel` ABSENT, no `VERCEL_*` env names present; no token available).
- **VERCEL ACCESS: UNAVAILABLE** (non-interactively). Presence-only check; nothing printed.

### 1.11 Can this environment safely perform the provisioning? (item 11)

- **NO.** No AWS identity, no KMS key, no Vercel session, no operator authorization. Provisioning here would require inventing infrastructure state — explicitly forbidden. X.50's environment reality check still holds for the AWS dimension (Vercel/Neon were later provisioned out-of-band by the operator through the approved channels; the same out-of-band path is required for AWS).

## 2. X.72 Classification

| Item | Status |
|---|---|
| Execution-gate audit (resource/key/IAM/CloudTrail spec; env requirements; fixture flow; verification commands) | PASS (verified from repo + reports, this report) |
| Offline verifier evidence at gate (custody 44, x49 25, x50 34/1-stale, session-api 72, hire-api 14, x55 22 — run at X.71/X.72 gate) | PASS |
| Application readiness (X.71) | PASS (carried forward, unchanged) |
| AWS account / CLI / credentials availability | BLOCKED |
| Vercel CLI / authentication availability | BLOCKED |
| Real KMS key creation (SYMMETRIC_DEFAULT, rotation, alias) | NOT STARTED |
| Least-privilege IAM (Encrypt/Decrypt/DescribeKey on one ARN) | NOT STARTED |
| CloudTrail + key policy + rotation configuration | NOT STARTED |
| Vercel Production env (AWS_REGION, ALTANA_KMS_KEY_ID, ALTANA_KMS_PROVIDER=aws) | NOT STARTED (values correctly UNSET) |
| LIVE synthetic-fixture KMS round trip (encrypt→store→decrypt→destroy) | NOT STARTED |

Nothing below is mislabeled: no provisioning action is PASS; nothing was created or configured except this report.

## 3. Execution Plan (operator actions, for the explicit go point)

### Phase A — AWS (single region, e.g. the region the Vercel workload will use)

1. `aws kms create-key --key-spec SYMMETRIC_DEFAULT --key-usage ENCRYPT_DECRYPT` (customer-managed; record key ARN).
2. Attach key policy: runtime identity `kms:Encrypt|kms:Decrypt|kms:DescribeKey` on this ARN; operator admin; `EnableKeyRotation`.
3. `aws kms create-alias --alias-name alias/altana-session-custody --target-key-id <keyId>` (optional).
4. `aws kms enable-key-rotation --key-id <keyId>`.
5. CloudTrail: trail + CloudWatch Logs, data events on this key (or org trail covering it); verify `PutKey` / `Encrypt` / `Decrypt` audit entries at test time.
6. Runtime identity: Vercel AWS-native integration (short-lived role) with exactly the three allowed actions on the ARN — verify `aws sts get-caller-identity` from the deployment identity returns the intended role.
7. Test with the synthetic fixture ONLY (random bytes fixture, never a real key): CreateKey → DescribeKey/Encrypt/Decrypt → disable → schedule deletion (7-day) → destroy fixture records.

### Phase B — Vercel Production env (exact set)

- `AWS_REGION=<real region>`; `ALTANA_KMS_KEY_ID=<real key id or alias>`; `ALTANA_KMS_PROVIDER=aws` — Production scope only, via `vercel env add ... production` on the existing project (`bnb-agent-marketplace-j25bhenpt-solo-25cb`).

### Phase C — Verification sequence (post-env, same deployment or prod server)

1. `pnpm run security:x50:verify` + `pnpm run custody:verify` still PASS (policy now fully green — stale check-24 remains the only x50 failure, unrelated).
2. One synthetic round trip through the real provider path (fixture plaintext): metadata probe → encrypt → store → decrypt-equality → destroy → decrypt-fails-closed.
3. Stop-and-restart the production server; decrypt the SAME fixture twice to prove persistence across restarts (the X.49/X.50 "restart round trip" requirement).
4. Authenticated session probes: creation now proceeds past 503-not-configured (this is the first point at which the live gate opens — evaluate against X.58.1/X.65 semantics before any user session is created).
5. CloudTrail: confirm Encrypt/Decrypt events for the fixture with no key policy changes.

### Phase D — Rollback / removal

- Remove the three Vercel env vars (or set them to a temporary-invalid pairing to re-trigger fail-closed 503s — but never a placeholder as "configured").
- Disable the key (immediate availability change: Encrypt/Decrypt fail closed — application maps to fail-closed 503, no decay to insecure behavior), then schedule deletion (7-day) after confirming no persisted ciphertext depends on it.
- Delete fixture records; verify `destroyedAt` semantics and that no production semaphore or session depends on the deleted fixture.
- Fallback state check: with env removed, `altana:session:api:verify` + `activation:hire-api:verify` prove 503/no-leak returns (fail-closed preserved — application behavior is NOT modified to make X.72 pass).

## 4. Exact Blocking Point

```text
X.72 remains BLOCKED exactly here:
  Operator must provision, out-of-band:
    1) real AWS account + customer-managed SYMMETRIC_DEFAULT KMS key (rotation, alias, CloudTrail),
    2) least-privilege identity for the Vercel runtime (kms:Encrypt|kms:Decrypt|kms:DescribeKey on ONE key ARN),
    3) Vercel Production env: AWS_REGION / ALTANA_KMS_KEY_ID / ALTANA_KMS_PROVIDER=aws.
  Then Phase C verification (synthetic-fixture round trip + restart persistence + CloudTrail) can begin.
  Nothing in this environment can create those resources; no credentials or tokens exist here
  (aws CLI ABSENT, AWS_* env ABSENT, vercel CLI ABSENT, ~/.vercel ABSENT).
```

No authorization to provision was granted, and none is implied. X.72 ends NOT STARTED for every external action.

## 5. Boundaries

- PRODUCTION: UNCHANGED — no deploy, no env mutation, alias still serves X.69 deployment (dpl_GDDogDS1WKRM1GE8v5mWP35mb8SF, READY).
- VERCEL: UNCHANGED — no project/env/secret modification.
- MAINNET: UNTOUCHED — chain 97 only, five-layer enforcement unchanged.
- TRANSACTIONS: NONE — no signing, broadcast, gas, or execution paths entered.
- AGENT 1816 / JOB 515: NOT TOUCHED. ACTIVATION: none.
- COMMIT/PUSH: NONE — the only file change is this report.

## Final Status

```text
X.72 STATUS: BLOCKED (execution gate) — AWS access UNAVAILABLE, Vercel access UNAVAILABLE, no authorization granted

AWS ACCESS:        UNAVAILABLE (aws CLI absent, no AWS_* env, ~/.aws not consumable)
VERCEL ACCESS:     UNAVAILABLE (vercel CLI absent, no ~/.vercel, no VERCEL_* env)
KMS PROVISIONING:  NOT STARTED
IAM:               NOT STARTED
CLOUDTRAIL:        NOT STARTED
VERCEL PROD CONFIG: NOT STARTED (AWS_REGION / ALTANA_KMS_KEY_ID / ALTANA_KMS_PROVIDER remain UNSET)
LIVE KMS ROUND TRIP: NOT STARTED
GATE AUDIT:        PASS (this report — resource/key/IAM/CloudTrail spec, env set, fixture flow,
                    verification sequence, rollback plan, exact blocking point)
OFFLINE GATES:     PASS (custody 44 | x49 25 | session-api 72 | hire-api 14 | x55 22 |
                    x50 34 with only known stale check-24)
APPLICATION SIDE:  PASS (X.71 carried unchanged)

PRODUCTION: UNCHANGED
MAINNET:    UNTOUCHED
TRANSACTIONS: NONE
COMMIT:     NO
PUSH:       NO
```

## 6. Addendum — Full-Execution Attempt: Phase 0 Capability Discovery (2026-08-19)

Authorized X.72 end-to-end execution was attempted. Phase 0 capability discovery was performed exhaustively (presence-only; no credential values inspected or printed):

| Capability check | Result |
|---|---|
| `aws` CLI (Windows PATH, standard AWSCLIV2 install paths, `aws2`) | UNAVAILABLE |
| `aws` CLI inside WSL (Ubuntu / Ubuntu-22.04 distros present) | UNAVAILABLE (`aws: command not found` in WSL) |
| `~/.aws` (Windows) — credentials/config | ABSENT (directory empty) |
| `~/.aws` (WSL) | ABSENT |
| AWS credential env names (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_PROFILE, AWS_DEFAULT_REGION, AWS_WEB_IDENTITY_TOKEN_FILE, AWS_CONTAINER_CREDENTIALS_RELATIVE_URI/FULL_URI, AWS_EC2_METADATA_DISABLED) | ABSENT (none set) |
| `vercel` CLI (PATH, npm global) | UNAVAILABLE |
| `~/.vercel`, `~/.config/vercel` | ABSENT |
| Vercel credential env names (VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, VC_*) | ABSENT (none set) |
| Other cloud/IaC CLIs (az, gcloud, terraform, tofu, cdk, aws-cdk, sam, pulumi, vault, chamber, doctl, ibmcloud) | UNAVAILABLE (none found) |
| Infrastructure MCP/plugin connectors in the agent toolset | NONE (agent toolset contains no AWS/Vercel connector tools) |
| opencode config-level integration scan (`~/.config/opencode/opencode.json` 51 B, `opencode.jsonc` 5,194 B) | NONE — no `mcp`, `aws`, `vercel`, or `npx` entries in either file (the single "token" hit is the model-provider/LLM API key section) |
| Skills registry (`~/.agents/skills`, 30 entries, names only) | NONE — no AWS or Vercel skill exists |
| Env-name sweep for other auth surfaces (names only) | Only LLM/router/media API keys present (AGENTROUTER_API_KEY, HF_TOKEN, INFERENCE_API_KEY, OPENROUTER_API_KEY, POLYCLAW_PRIVATE_KEY, POLYMARKET_API_KEY, POLYMARKET_SECRET, UNSPLASH_ACCESS_KEY) plus CLOUDFLARE_API_TOKEN — none of these is an AWS or Vercel identity and none can configure the Vercel project |

Conclusion: **the required external capability genuinely does not exist in this environment.** AWS authentication is unavailable through every legitimate mechanism (CLI Windows+WSL, shared credentials, env identities, container/metadata roles, IaC tooling, connectors). Vercel access is equally unavailable (CLI, stored auth, env tokens, connectors). No credentials were installed, invented, or requested; no resources were created; production was not modified; the deployment was not redeployed. The application continues to fail closed (`GET /api/altana/session` -> 503 "Altana session support is not configured on this deployment."), which remains the correct behavior while KMS configuration is absent.

X.72 remains BLOCKED with the exact missing capability: **an authenticated AWS identity (CLI + credentials or equivalent connector) and an authenticated Vercel session, present in the environment that executes X.72.** Once an operator provides either real credentials in this environment or runs the documented Phase A-D steps from a session that owns them, Phase C-F execution can resume with the REAL `AwsKmsProvider`. No fake PASS is claimed; no test was manufactured; no source code, environment, or deployment was changed.