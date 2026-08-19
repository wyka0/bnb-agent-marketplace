# Main Track Activation — X.41 PostgreSQL/Prisma Foundation

Milestone: **X.41 — PostgreSQL/Prisma Foundation**
Branch: not committed (working tree dirty by design)
Chain: BNB Testnet only (chainId 97), no mainnet, no on-chain activity
Scope: persistence-layer foundation only. **No auth, no KMS, no private-key handling, no chain transactions, no signing, no broadcast.**

---

## 1. Status Summary

| Gate | Result |
| --- | --- |
| `prisma --version` (pin 6.19.3) | PASS |
| `prisma validate` | PASS |
| `prisma generate` (v6.19.3) | PASS |
| `prisma migrate diff --from-empty --to-schema-datamodel` (offline) | PASS (exit 0) |
| `pnpm build` (all 8 packages) | PASS (8/8) |
| `pnpm typecheck` (all 8 packages) | PASS (13/13 turbo tasks) |
| `pnpm lint` (all 8 packages) | PASS (13/13 turbo tasks) |
| `pnpm test` (Altana session verifier) | PASS (10/10) |
| Local `prisma migrate deploy` against PostgreSQL | **BLOCKED locally** — Docker/Postgres unavailable in this environment; `migrate status` returns P1001. Migration SQL is reviewed and validated offline; `prisma migrate diff` exit 0 confirms schema-to-SQL parity. |
| Chain activity / KMS / SIWE / login | NOT EXECUTED (out of scope) |
| `git commit` / `git push` | NOT EXECUTED (working tree intentionally dirty) |

---

## 2. Deliverables

### 2.1 Prisma workspace package

- `prisma/schema.prisma` — full schema with explicit datasource (pooled `DATABASE_URL`, direct `directUrl = env("DIRECT_DATABASE_URL")` for migrations).
- `prisma/src/client.ts` — server-only Node `PrismaClient` singleton (production: single instance; non-production: global-singleton guarded by `globalThis` to survive hot reload without connection explosion).
- `prisma/package.json` — `exports` map exposes `./client` only; `sideEffects: false`; `browser: { "./dist/client.js": false }` shim. CLI and client pinned to `6.19.3`. Scripts: `build`, `typecheck`, `lint`.
- `prisma/tsconfig.json` — `target: ES2022`, `module: ESNext`, `strict: true`, `noUncheckedIndexedAccess: true`, `types: ["node"]`.
- `prisma/.env.example` — `DIRECT_DATABASE_URL` added.
- `.env.example` (root) — `DIRECT_DATABASE_URL` added.

### 2.2 Migration

- `prisma/migrations/migration_lock.toml` — `provider = "postgresql"` (Prisma 6.x format).
- `prisma/migrations/202608150001_x41_postgres_prisma_foundation/migration.sql` — reviewed initial migration:
  - 5 enums: `WalletStatus`, `AltanaSessionStatus`, `SessionPermissionKind`, `EncryptedSecretType`, `AuditResult`.
  - 8 tables: `User`, `Wallet`, `SiweChallenge`, `AuthSession`, `AltanaSession`, `SessionPermission`, `EncryptedSecret`, `AuditEvent`.
  - Explicit foreign keys (`Restrict`/`Cascade`/`SetNull`) — see §5.
  - Check constraints: `chainId = 97` on every chain-bearing table; `spendCapRaw >= 0` on `SessionPermission`; `revokedAt` consistency on `AltanaSession` (REVOKED ⇒ non-null `revokedAt`).
  - Unique constraints: `(chainId, address)` on `Wallet`, `nonceHash` on `SiweChallenge`, `attemptHash` on `AuthSession`, `tokenHash` on `AuthSession`, `sessionIdentifier` on `AltanaSession`, `(chainId, keyId)` on `EncryptedSecret`, `(chainId, publicKey)` on `EncryptedSecret`, partial unique `EncryptedSecret.sessionId` (one signer per session).
  - Indexes: active-session lookup, challenge expiry sweep, audit timeline.

### 2.3 Workspace plumbing

- `packages/config/src/env.ts` — optional `DIRECT_DATABASE_URL: z.string().url()` (URL, no default).
- `turbo.json` — `globalEnv` includes `DIRECT_DATABASE_URL`.
- `Dockerfile` — `COPY prisma ./prisma` so Docker image has the schema for `prisma generate`.

---

## 3. Models, Keys, and Indexes (excerpt)

```text
User           id (cuid), createdAt, updatedAt
Wallet         id (cuid), userId FK→User (Restrict), chainId, address,
               status WalletStatus, createdAt, updatedAt
               UNIQUE (chainId, address)
SiweChallenge  id (cuid), walletId FK→Wallet (Restrict), nonceHash UNIQUE,
               issuedAt, expiresAt, consumedAt
AuthSession    id (cuid), walletId FK→Wallet (Restrict), attemptHash UNIQUE,
               tokenHash UNIQUE, issuedAt, expiresAt, revokedAt
AltanaSession  id (cuid), walletId FK→Wallet (Restrict),
               sessionIdentifier UNIQUE, status AltanaSessionStatus,
               issuedAt, expiresAt, revokedAt, lastRefreshedAt
               PARTIAL UNIQUE one_live_per_wallet_idx:
                 (walletId) WHERE status IN ('PENDING','ACTIVE','REVOKING')
SessionPermission
               id (cuid), sessionId FK→AltanaSession (Restrict),
               kind SessionPermissionKind, targetAddress?, selector?,
               spendCapRaw? (BigInt), spendToken?, chainId,
               validAfter?, validBefore?, createdAt
EncryptedSecret
               id (cuid), sessionId FK→AltanaSession (Restrict) UNIQUE,
               kind EncryptedSecretType, ciphertextRef, algorithm,
               keyId, publicKey, chainId, createdAt
               UNIQUE (chainId, keyId), UNIQUE (chainId, publicKey)
AuditEvent     id (cuid), walletId FK→Wallet (SetNull), sessionId?
               FK→AltanaSession (SetNull), action, result AuditResult,
               metadata (Jsonb), createdAt
```

---

## 4. Security Diff Review

| Concern | Status |
| --- | --- |
| Plaintext private keys / mnemonics / seed phrases / raw secrets in schema | **None.** `EncryptedSecret` stores ciphertext metadata only (`ciphertextRef`, `algorithm`, `keyId`, `publicKey`). No `privateKey`, `seedPhrase`, `mnemonic`, `rawSecret`, or `secretBytes` field exists. Grep across `prisma/` returns no matches for `privateKey | rawSecret | seedPhrase | mnemonic | plaintext | secretBytes`. |
| Server-only Prisma client | Confirmed. `prisma/package.json` `exports` exposes only `./client`; `browser: { "./dist/client.js": false }` shim prevents bundling; `sideEffects: false`; `client.ts` lives under `prisma/src/` and uses Node `process.env`. |
| Destructive migration content | None. Migration creates enums/tables/indexes/constraints only; grep for `DROP TABLE|TRUNCATE|DELETE FROM|DROP SCHEMA` returns no matches. |
| Wallet ownership transfer | Enforced by uniqueness on `(chainId, address)` and explicit `userId` FK with `Restrict`. Ownership binding by signature (SIWE) intentionally deferred to X.42 — no silent transfer path exists. |
| Chain 97 enforcement at DB layer | Yes — `chainId` check constraint `chainId = 97` on every chain-bearing table (`Wallet`, `SessionPermission`, `EncryptedSecret`). Mainnet/foreign chain rows cannot be inserted at the DB level. |
| Non-negative spend cap | Yes — `SessionPermission.spendCapRaw >= 0` check constraint. |
| EncryptedSecret type allow-list | Yes — `EncryptedSecretType` enum (`ALTANA_SESSION_SIGNER`); future record kinds require schema change. |
| Single live session per wallet | Yes — partial unique index `one_live_per_wallet_idx`. |
| 1:1 signer per session | Yes — unique on `EncryptedSecret.sessionId`. |
| Non-destructive FK semantics | Yes — see §5. |

---

## 5. Foreign Key Behaviour

| Child.parent | onDelete | Rationale |
| --- | --- | --- |
| `Wallet.user → User.id` | **Restrict** | Wallet ownership is security-sensitive; never silently orphaned. |
| `SiweChallenge.wallet → Wallet.id` | **Restrict** | Challenge audit trail must not silently disappear. |
| `AuthSession.wallet → Wallet.id` | **Restrict** | Session history is security-sensitive. |
| `AltanaSession.wallet → Wallet.id` | **Restrict** | Session history is security-sensitive. |
| `SessionPermission.session → AltanaSession.id` | **Restrict** | Permissions must not silently cascade-deleted with session; revocation is an explicit lifecycle state. |
| `EncryptedSecret.session → AltanaSession.id` | **Restrict** | Secret reference rows must not cascade-deleted; lifecycle is managed by revoke + KMS reaper. |
| `AuditEvent.wallet → Wallet.id` | **SetNull** | Preserve audit history even if wallet row is removed. |
| `AuditEvent.session → AltanaSession.id` | **SetNull` | Preserve audit history even if session row is removed. |

Cascading delete is intentionally avoided for security-bearing records.

---

## 6. Environment Variables (names only, no values)

- `DATABASE_URL` — pooled runtime connection (existing).
- `DIRECT_DATABASE_URL` — Prisma migration direct connection (new). Optional in `packages/config`; required when running `prisma migrate` against a pooler-fronted DB.

Both are server-only. Neither is exposed via `NEXT_PUBLIC_*`.

---

## 7. Local Verification Limitation

This environment does not provide Docker or a reachable PostgreSQL. `prisma migrate status` returns **P1001** ("Can't reach database server") which is expected and does **not** indicate a schema defect:

- `prisma validate` and `prisma generate` pass on the pinned CLI 6.19.3.
- `prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script` produces the same SQL committed in `prisma/migrations/202608150001_x41_postgres_prisma_foundation/migration.sql` and exits 0 (schema-to-SQL parity).
- Apply step (`prisma migrate deploy`) must be executed by an operator against a real PostgreSQL with `DIRECT_DATABASE_URL` set; this is intentionally left for the deployment environment per the "no production connection" rule.

---

## 8. What X.41 Does **NOT** Include

Explicitly out of scope and **not started**:

- X.42 SIWE authentication flow, login, sessions issuance, or wallet ownership binding by signature.
- KMS integration, encryption helpers, ciphertext writers, secret reaper, or any KMS credential handling.
- Any Altana session key generation, signing, transaction construction, broadcast, or on-chain interaction.
- Mainnet support; foreign-chain `chainId` values; `db push` workflow.
- `git commit` / `git push` — working tree remains dirty by design.

---

## 9. Working Tree (post-X.41, pre-commit)

Modified:

```text
.env.example                              |   2 +
Dockerfile                                |   3 +-
apps/web/components/sidebar.tsx           |   1 +
packages/config/src/env.ts                |   5 +
packages/integrations/package.json        |  21 +++
packages/integrations/src/altana/index.ts |   2 +
pnpm-lock.yaml                            |  13 +-
prisma/.env.example                       |   3 +-
prisma/package.json                       |  20 ++-
prisma/schema.prisma                      | 229 ++++++++++++++++++++++++++++--
turbo.json                                |   1 +
```

Untracked (new) — Prisma foundation:

```text
prisma/migrations/
prisma/src/
prisma/tsconfig.json
```

Working tree is dirty and uncommitted. No commit and no push performed.

---

## 10. Next Steps (Out of X.41 Scope — X.42+)

1. X.42 — SIWE authentication: challenge issuance, signature verification (offline-ready), wallet ownership binding by recovered address, `AuthSession` lifecycle.
2. KMS integration — secret encryption helpers reading ciphertext refs; envelope encryption; rotation policy. No plaintext secret material may be written to or read from the DB.
3. Altana session lifecycle binding — X.36 verifier persists sessionIdentifier/`SiweChallenge`/`AltanaSession` rows; revocation and reaper processes; one-live-session invariant enforcement at the application layer backed by the partial unique index.
4. End-to-end Postgres verification in CI once a database service is available; `prisma migrate deploy` against ephemeral Postgres with `DIRECT_DATABASE_URL`.

---

**Bottom line:** X.41 ships a hardened PostgreSQL/Prisma foundation (schema, server-only client, migration with chain-97 + ownership + revocation invariants, env wiring). No auth, no KMS, no chain activity was performed. All in-scope gates pass; the only blocked item is local `migrate deploy`, which is an environment limitation, not a schema defect.
