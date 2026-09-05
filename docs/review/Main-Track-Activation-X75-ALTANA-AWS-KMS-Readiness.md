# Main Track Activation X.75 - ALTANA / AWS-KMS Activation Readiness Audit

- **Date:** 2026-08-19
- **Scope:** Audit only. No AWS/KMS configuration, ALTANA provisioning, deployment, code change, transaction, or activation was performed.
- **Overall classification:** **PARTIAL / BLOCKED for real activation**
- **Application architecture:** READY with documented production gaps
- **Production integration:** healthy and fail-closed; real activation is not enabled

## 1. Executive summary

The repository contains a substantial Hire -> Consent -> Session -> Custody ->
Execution architecture with strong offline safety coverage. The implementation
enforces exact identity, SIWE ownership, CSRF/origin checks, consent digest
binding, chain-97 policy, session ownership, permission allowlists, spend
reservations, KeyStore reconciliation, revocation, and safe error responses.

That does **not** make real activation production-capable yet.

Three independent blockers remain:

1. **Capability source:** `resolveAgentActivationCapability()` returns `null` for
   every registry record because 8004scan does not provide verified pricing/action
   metadata. Therefore real marketplace agents never reach `ACTIVATABLE`.
2. **AWS/KMS session custody:** the production project has no `AWS_REGION`,
   `ALTANA_KMS_KEY_ID`, or explicit `ALTANA_KMS_PROVIDER`; the real symmetric KMS
   key, IAM runtime identity, rotation, CloudTrail, and synthetic live round trip
   have not been provisioned.
3. **Management/admin custody:** production policy requires
   `ALTANA_ADMIN_CUSTODY_PROVIDER` and `ALTANA_ADMIN_KEY_REFERENCE`, but no runtime
   provider abstraction consumes them. The active web adapter still accepts
   `ALTANA_TESTNET_PRIVATE_KEY`, which production policy rejects. KMS envelope
   custody does not replace admin transaction signing.

The correct current state is fail-closed: no real agent activation, no session
creation, no execution, and no blockchain transaction.

## 2. Current activation architecture

### Marketplace -> detail -> hire

1. Marketplace and category views construct an encoded exact ERC-8004 identity:
   - `apps/web/app/(app)/marketplace/page.tsx`
   - `apps/web/app/(app)/marketplace/marketplace-view.tsx`
   - `apps/web/components/category-dashboard.tsx`
   - `apps/web/lib/eight004scan/card.ts`
2. Agent detail decodes and exact-resolves the identity:
   - `apps/web/app/(app)/agents/[slug]/page.tsx`
   - `getMarketplaceAgentBySlug()` and exact `agent_id` matching
3. `AgentDetailView` classifies activation and only links to hire for
   `ACTIVATABLE` records:
   - `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`
4. Hire page confirms the exact registry identity and renders the review/consent
   flow:
   - `apps/web/app/(app)/agents/[slug]/hire/page.tsx`
   - `apps/web/app/(app)/agents/[slug]/hire/hire-activation-view.tsx`

### Hire -> consent -> session

1. `HireActivationView` reads `/api/auth/me` and `/api/altana/session`.
2. It sends `POST /api/activation/hire` with `{ action: "review", agentId }`.
3. The API enforces safe mutation/origin, CSRF, authentication, exact identity,
   capability, and server-generated review:
   - `apps/web/app/api/activation/hire/route.ts`
   - `apps/web/lib/activation/hire.api.ts`
   - `apps/web/lib/activation/hire.server.ts`
4. The server returns a consent digest bound to the current review.
5. Activation resubmits the exact digest. A constant-time comparison rejects any
   changed review with 409.
6. Only after identity, capability, review, and consent pass does the route call
   `createSessionService()` and `createAltanaSession()`.

### SIWE identity

- Challenge: `apps/web/app/api/auth/nonce/route.ts` and
  `apps/web/lib/auth/service.ts`
- Verification: `apps/web/app/api/auth/verify/route.ts`
- Session lookup: `apps/web/lib/auth/session.server.ts`
- Persistence and ownership: `apps/web/lib/auth/prisma-store.server.ts`
- Auth data: `User`, `Wallet`, `SiweChallenge`, `AuthSession` in
  `prisma/schema.prisma`

The SIWE flow binds domain, URI, chain, nonce, digest, issue time, expiry, and
recovered signer address. Authentication is persisted in PostgreSQL, and prior
sessions are revoked on successful authentication.

### Session -> custody -> execution

- Service entry: `apps/web/lib/altana-session/index.server.ts`
- Session lifecycle: `apps/web/lib/altana-session/service.ts`
- SDK adapter: `apps/web/lib/altana-session/adapter.ts`
- Session persistence: `apps/web/lib/altana-session/store.prisma.server.ts`
- Public session view: `apps/web/lib/altana-session/view.ts`
- Session read API: `apps/web/app/api/altana/session/route.ts`
- Revoke API: `apps/web/app/api/altana/session/revoke/route.ts`
- API safety/error mapping: `apps/web/lib/altana-session/api.ts`
- Custody entry: `apps/web/lib/custody/index.ts`
- Envelope/AES-GCM custody: `apps/web/lib/custody/envelope.ts`, `aead.ts`
- KMS provider: `apps/web/lib/custody/kms/config.ts`, `factory.ts`, `aws-kms.ts`

Creation persists a pending session, grants the Altana session, registers its
session key, encrypts the generated session private key through custody, and only
then marks the row active. Reconstruction requires active DB state, live KeyStore
state, valid expiry, matching wallet/public key, and successful custody decrypt.

The internal `executeAllowedOperation()` implementation is bounded to an allowed
approval call and enforces policy, chain, expiry, existing allowance, atomic spend
reservation, confirmed receipt, expected event, and post-execution KeyStore
liveness. There is currently **no public execution HTTP route** invoking it.

## 3. Custody configuration audit

Values were not printed or read. The status below records names and presence only.

### Vercel Production environment

Observed through `npx vercel env ls production`:

| Variable                        | Status                                             | Classification                                            | Purpose                                                                                               |
| ------------------------------- | -------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | PRESENT                                            | READY                                                     | Pooled PostgreSQL runtime connection                                                                  |
| `DIRECT_DATABASE_URL`           | MISSING                                            | NOT REQUIRED at runtime; required for operator migrations | Direct Prisma migration connection                                                                    |
| `AUTH_CANONICAL_ORIGIN`         | PRESENT                                            | READY                                                     | SIWE domain/URI binding                                                                               |
| `RATE_LIMIT_BACKEND`            | PRESENT                                            | READY                                                     | Prisma-backed cross-instance rate limiting                                                            |
| `PRISMA_QUERY_ENGINE_LIBRARY`   | PRESENT                                            | READY                                                     | Vercel Prisma runtime engine path                                                                     |
| `8004SCAN_API_KEY`              | MISSING by exact name; `E8004SCAN_API_KEY` PRESENT | READY for current deployed alias/config                   | Existing production registry configuration uses the alias shown by Vercel                             |
| `ALTANA_KMS_PROVIDER`           | MISSING                                            | MISSING CONFIGURATION                                     | Explicit production AWS provider selection; code defaults to AWS but policy requires valid AWS config |
| `AWS_REGION`                    | MISSING                                            | MISSING CONFIGURATION                                     | AWS KMS region                                                                                        |
| `ALTANA_KMS_KEY_ID`             | MISSING                                            | MISSING CONFIGURATION                                     | Customer-managed KMS key ID, alias, or ARN                                                            |
| `ALTANA_ADMIN_CUSTODY_PROVIDER` | MISSING                                            | MISSING CONFIGURATION + CODE NEEDED                       | Remote admin-signing provider selector                                                                |
| `ALTANA_ADMIN_KEY_REFERENCE`    | MISSING                                            | MISSING CONFIGURATION + CODE NEEDED                       | Provider-specific admin key selector                                                                  |
| `ALTANA_TESTNET_PRIVATE_KEY`    | absent by policy                                   | READY as a safety condition                               | Must remain absent from production                                                                    |
| `ALTANA_NETWORK`                | not listed                                         | CODE DEFAULT / verify deployment value                    | Must resolve to `bnb-testnet`, never mainnet                                                          |
| `ALTANA_RPC_URL`                | not listed                                         | OPTIONAL CONFIGURATION                                    | Optional BNB Testnet RPC override; SDK/public RPC fallback exists                                     |
| `ALTANA_PAYTO`                  | not listed                                         | EXTERNAL DEPENDENCY for live merchant flow                | x402/ERC-8183 merchant recipient                                                                      |
| `ALTANA_FACILITATOR_ADDRESS`    | not listed                                         | EXTERNAL DEPENDENCY for live merchant flow                | x402 facilitator/operator configuration                                                               |
| `ALTANA_OPERATOR_ADDRESS`       | not listed                                         | EXTERNAL DEPENDENCY for live merchant flow                | Operator configuration                                                                                |
| `ALTANA_SERVICE_PRICE_RAW_U`    | not listed                                         | EXTERNAL DEPENDENCY for live merchant flow                | Real service price                                                                                    |
| `FACILITATOR_KEY`               | not listed                                         | NOT REQUIRED for current non-executing web path           | Live x402 seller/facilitator only                                                                     |

The `.env.example` file documents these names with empty placeholders and states
that the raw admin key is local-only and rejected by production policy. No local
`.env.local`, `apps/web/.env.local`, or matching process environment values were
present in this audit shell.

## 4. AWS/KMS requirements

### Answers derived from implementation

1. **Does the application require AWS KMS directly?**
   Yes, for production envelope custody of generated Altana session private keys.
   `AwsKmsProvider` constructs `KMSClient({ region })` directly.

2. **What key type is expected?**
   A customer-managed symmetric KMS key with `SYMMETRIC_DEFAULT` and
   `ENCRYPT_DECRYPT` usage. The app accepts a key ID, alias, or ARN.

3. **What KMS operations are performed?**
   Exactly `DescribeKey`, `Encrypt`, and `Decrypt` in
   `apps/web/lib/custody/kms/aws-kms.ts`. The application does not create,
   administer, rotate, sign, or verify with KMS.

4. **Is signing performed by KMS or elsewhere?**
   KMS does not sign. AES-GCM is performed in application memory with a generated
   data-encryption key; KMS wraps/unwraps that data key. Altana transaction signing
   currently occurs through viem/Altana SDK signer objects derived from the raw
   `ALTANA_TESTNET_PRIVATE_KEY` path. That path is not production-compliant.

5. **What IAM permissions are required?**
   Runtime code implies only:
   - `kms:DescribeKey`
   - `kms:Encrypt`
   - `kms:Decrypt`

   They must be scoped to one KMS key ARN. Provisioning/operator permissions and
   CloudTrail administration are external operational requirements, not runtime
   application permissions.

6. **Is a dedicated AWS IAM role/user required?**
   An AWS runtime identity is required by the AWS SDK default credential chain. The
   repository does not define access keys, a role assumption flow, or a Vercel AWS
   integration. The exact runtime identity mechanism is therefore an external
   account/platform decision. Long-lived access keys must not be placed in source
   or browser-visible variables.

7. **Is ALTANA responsible for custody while KMS protects key material?**
   Not exactly. The application owns the envelope-custody boundary and uses KMS to
   protect persisted session signer material. Altana owns the on-chain KeyStore,
   session grant, registration, execution, and revocation protocol. A separate
   management-custody provider is still required for the long-lived admin signer.

8. **What network assumptions exist?**
   The runtime needs reachability from Vercel to AWS KMS in the configured region,
   PostgreSQL, and a BNB Testnet RPC. Altana SDK operations and KeyStore reads are
   chain 97 only. No mainnet fallback is permitted.

9. **What production variables must be configured?**
   At minimum: `AWS_REGION`, `ALTANA_KMS_KEY_ID`, and explicit
   `ALTANA_KMS_PROVIDER=aws`, alongside the existing database/auth/rate-limit
   configuration. These alone are insufficient until the admin signer path is
   replaced.

10. **What can be validated without creating AWS resources?**
    Resolver fail-closed behavior, provider selection, production test-provider
    rejection, envelope/AES-GCM behavior with the test provider, AAD/session
    binding, no plaintext persistence, restart reconstruction, error mapping, and
    no-secret public views. A real AWS round trip, IAM authorization, CloudTrail,
    and Vercel runtime connectivity cannot be validated without external resources.

### Required AWS resources

| Resource                             | Status                    | Purpose                                               |
| ------------------------------------ | ------------------------- | ----------------------------------------------------- |
| AWS account with authorized operator | REQUIRED EXTERNAL ACCOUNT | Provisioning and policy ownership                     |
| Customer-managed symmetric KMS key   | NOT CONFIGURED            | Wrap/unwrap session data keys                         |
| Least-privilege runtime AWS identity | NOT CONFIGURED            | `DescribeKey`/`Encrypt`/`Decrypt` on one key          |
| Key policy and rotation              | NOT CONFIGURED            | Key governance                                        |
| CloudTrail coverage for KMS key      | NOT CONFIGURED            | Audit evidence                                        |
| Vercel production KMS variables      | MISSING                   | Runtime selection                                     |
| Real AWS synthetic round trip        | NOT RUN                   | Validate metadata, encrypt, persist, decrypt, destroy |

## 5. ALTANA requirements

### Local implementation

Implemented locally:

- Chain-97 Altana SDK adapter and policy construction.
- Session grant/register/reconstruct/execute/revoke orchestration.
- `CALL`, native-spend, and token-spend permission rows.
- One-day token/native spend limits from the fixed policy.
- Exact target/function selector checks for the bounded approval operation.
- PostgreSQL session, permission, encrypted-secret, audit, and reservation state.
- KeyStore liveness reconciliation.
- Revocation safety gate with 16 checks.
- Safe public session views that omit private key, ciphertext, KMS material, AAD,
  internal key IDs, and raw tokens.

### Production configuration

Missing or not verified:

- AWS KMS region/key/provider configuration.
- Production runtime AWS identity.
- Remote management-custody provider and key reference.
- A verified admin signer compatible with the Altana SDK.
- BNB Testnet RPC override, if the SDK/public fallback is not sufficient for the
  chosen production reliability requirement.
- A real verified activation capability source containing amount, expiry, job ID,
  resource URL, payment recipient, and protocol details.

### External service dependencies

- Neon/PostgreSQL runtime and migrations.
- 8004scan registry API for exact agent identities.
- Altana SDK and BNB Testnet RPC.
- Altana KeyStore/KeyStoreController/ERC-8183 contracts on chain 97.
- An approved remote signer/HSM or equivalent management custody service.
- x402 marketplace/facilitator only if a live merchant/payment flow is actually
  required; current payment guard is reject-only.

No separate Altana REST API key is used by the active session adapter. The active
path is SDK/on-chain based. The x402 seller-side variables are separate from
session custody and do not make activation possible by themselves.

## 6. Exact activation dependency chain

|   # | Dependency                                            | Status                                                                | Classification                                                               |
| --: | ----------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
|   1 | Marketplace/detail/hire UI and exact identity routing | READY                                                                 | Implemented; production routes verified                                      |
|   2 | SIWE identity, ownership, nonce/session persistence   | READY                                                                 | Production configured and offline/live boundaries verified                   |
|   3 | Neon PostgreSQL schema and runtime                    | READY                                                                 | X.59/X.61 evidence; Vercel `DATABASE_URL` present                            |
|   4 | Prisma-backed rate limiting                           | READY                                                                 | Vercel variable present; offline security checks pass                        |
|   5 | Exact identity and consent digest binding             | READY                                                                 | Server recomputation and constant-time comparison                            |
|   6 | Capability source for real actionable agents          | **BLOCKED**                                                           | Current resolver always returns `null`; requires code/external verified data |
|   7 | AWS KMS envelope custody                              | **BLOCKED**                                                           | Requires AWS key, IAM identity, CloudTrail/rotation, env, live round trip    |
|   8 | Production management/admin custody                   | **BLOCKED**                                                           | Requires provider selection, runtime abstraction, provider key, and env      |
|   9 | Altana chain-97 contracts/RPC/admin funding           | **EXTERNAL**                                                          | Requires live testnet service resources and authorized signer                |
|  10 | x402/payment verification                             | **BLOCKED for live paid flow**                                        | Current payment guard is reject-only; no verified payment path               |
|  11 | Public execution route                                | **NOT REQUIRED for current audit; CODE NEEDED for browser execution** | Internal bounded execution exists, no route invokes it                       |
|  12 | Real session creation                                 | **BLOCKED**                                                           | Requires capability, custody, admin signer, DB, and chain resources          |
|  13 | Real agent activation                                 | **BLOCKED**                                                           | No real activation performed or currently reachable                          |

## 7. Security assessment

### Verified protections

- Private keys and seed material do not enter browser bundles or public session
  views.
- KMS ciphertext, wrapped data keys, AAD, internal key IDs, and session tokens are
  excluded from API responses.
- Custody ownership is server-authoritative and bound to authenticated user and
  wallet IDs.
- SIWE verifies exact domain, URI, chain, nonce, expiry, digest, and recovered
  signer address.
- Consent is recomputed server-side and compared constant-time against the exact
  digest returned by review.
- Session scope is persisted as call and spend permission rows.
- Chain 97 is pinned; mainnet is explicitly rejected.
- Revocation is authenticated, origin/CSRF protected, ownership checked,
  idempotent, KeyStore-aware, and blocks execution after revoke.
- Spend reservations occur before broadcast and use PostgreSQL locking; ambiguous
  broadcast outcomes are held rather than released blindly.
- Rate limiting is identity-scoped and Prisma-backed in production.
- Errors map to safe 401/403/409/502/503/500 responses without stack, config,
  KMS, RPC, or custody internals.

### Residuals and limitations

- `ALTANA_TESTNET_PRIVATE_KEY` remains a runtime signer path in
  `index.server.ts`; production policy rejects the variable, but the runtime does
  not independently refuse it. A management-custody implementation must close
  this residual before production writes.
- `ALTANA_ADMIN_CUSTODY_PROVIDER` and `ALTANA_ADMIN_KEY_REFERENCE` are policy
  contracts only; current runtime ignores them.
- The schema does not visibly define the service-referenced live-session partial
  unique index in the current Prisma file; the deployed migration/database should
  be checked before claiming that database invariant.
- Audit metadata may retain truncated exception text in database audit rows. It is
  not returned to browsers, but code-only audit requirements would need a separate
  hardening change.
- No public execution API exists. This is safer than exposing unreviewed execution,
  but browser-driven execution cannot be claimed until a narrowly scoped route is
  intentionally designed and verified.

## 8. Production read-only verification

Verified against `https://bnb-agent-marketplace-web.vercel.app` without mutation:

| Surface                                           | Result                                                        |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `/`                                               | 200                                                           |
| `/marketplace`                                    | 200                                                           |
| `/compare`                                        | 200                                                           |
| `/categories`                                     | 200                                                           |
| Four category pages                               | 200 each                                                      |
| Encoded agent detail                              | 200; resolves `Corgent - Cortensor Agent`                     |
| Encoded `/hire`                                   | 200                                                           |
| `/permissions`                                    | 200                                                           |
| `/profile`                                        | 200                                                           |
| `/settings`                                       | 200                                                           |
| `/login`                                          | 200                                                           |
| `GET /api/auth/me`                                | 200 with `{"ok":true,"data":null}`                            |
| `GET /api/altana/session`                         | 503 generic not-configured response                           |
| unauthenticated `POST /api/altana/session/revoke` | 503 generic not-configured response from service construction |
| unauthenticated `POST /api/activation/hire`       | 403 `Request rejected.`                                       |

Headers present on `/`:

- CSP with per-request nonce, `strict-dynamic`, `object-src 'none'`,
  `frame-ancestors 'none'`, and `upgrade-insecure-requests`.
- HSTS `max-age=63072000; includeSubDomains`.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` disabling camera, geolocation, microphone, payment, and USB.

The 503 is the intended session-not-configured behavior. No live session, custody
secret, signer, RPC write, or transaction was created by these probes.

## 9. Verification status

Focused offline checks run in X.75:

| Suite                        | Result                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `custody:verify`             | PASS - 44 checks; real PostgreSQL persistence subcheck BLOCKED locally by P1001 |
| `altana:session:verify`      | PASS - 25/25                                                                    |
| `altana:session:api:verify`  | PASS - 72/72                                                                    |
| `activation:hire:verify`     | PASS - 23/23                                                                    |
| `activation:hire-api:verify` | PASS - 14/14                                                                    |
| `security:x49:verify`        | PASS - 25/25                                                                    |
| `pnpm typecheck`             | PASS - 14/14 tasks                                                              |
| `pnpm lint`                  | PASS - 14/14 tasks                                                              |
| `pnpm build`                 | PASS - 8/8 tasks                                                                |

The known X.50 stale check-24 assertion was not changed. The full test suite was
not necessary for this audit and was not run.

## 10. Classification

```text
X.75 STATUS: READINESS PASS / REAL ACTIVATION BLOCKED

ARCHITECTURE:                 PASS (implemented, fail-closed)
AUTH / SIWE / OWNERSHIP:      PASS
CONSENT / CSRF / RATE LIMIT:  PASS
SESSION / REVOKE SAFETY:     PASS (offline verified)
AWS KMS APPLICATION CODE:    PASS (offline provider/envelope checks)
AWS KMS RESOURCES:           BLOCKED / NOT CONFIGURED
MANAGEMENT CUSTODY:          BLOCKED / CODE + EXTERNAL PROVIDER NEEDED
REAL CAPABILITY SOURCE:      BLOCKED / CODE + VERIFIED EXTERNAL DATA NEEDED
LIVE ALTANA SESSION:         BLOCKED
REAL AGENT ACTIVATION:       BLOCKED
PRODUCTION READ-ONLY HEALTH: PASS
```

## 11. Single recommended next action

The next action after X.75 should be **X.72-style out-of-band AWS KMS
provisioning and synthetic custody validation**, performed by an authorized
operator in the AWS/Vercel environment. This is the documented prerequisite before
management-custody implementation and any production chain write.

That action must create/configure only the approved symmetric KMS custody resource,
least-privilege runtime identity, key governance/audit controls, and the three
production KMS variables, then run the synthetic encrypt -> persist -> decrypt ->
destroy round trip. It must not use a real Altana key, activate an agent, or send a
blockchain transaction.

After that prerequisite, a separate code/provider milestone is still required for
the remote admin signer and a separate capability-source milestone is required
before any real registry agent can become activatable. Neither starts in X.75.

## 12. Explicit boundaries

```text
AWS/KMS: AUDIT ONLY - NOT CONFIGURED
ALTANA CUSTODY: AUDIT ONLY - NOT PROVISIONED
TERMiX: NO CHANGES
PANCAKESWAP OPTION B: NO CHANGES
MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
VERCEL DEPLOYMENT: NONE
COMMIT: NO
PUSH: NO
```
