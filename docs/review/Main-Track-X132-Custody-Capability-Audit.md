# X.132 Production Marketplace Custody Capability Audit

**Mode:** Read-only audit. No transaction, no credential created/modified, no AWS resource, no new job, no Vercel change, no commit/push/deploy. Job 641 untouched.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. What was inspected

1. **Existing KMS implementation** — `apps/web/lib/custody/kms/aws-kms.ts` (`AwsKmsProvider`): calls ONLY `DescribeKey`, `Encrypt`, `Decrypt`. It is **envelope custody** (wraps/unwraps an AES data key for Altana session secrets). It does **not** sign transactions (`kms:Sign` is absent). `factory.ts` (`createKmsProvider`) + `config.ts` (`resolveKmsConfig`) select AWS vs test provider fail-closed. `createAltanaCustody(env)` (custody/index.ts) wires this KMS envelope into the Altana session service.
2. **Existing signer interfaces** — `@bnbagent/sdk@0.5.1` `WalletProvider` abstract class (`signTransaction`/`signMessage`/`signTypedData`, capability model `sign.*`/`intents.*`/`x402.pay`, `IntentExecutor` seam). `ERC8183Client`/`ERC8004Agent` accept any `WalletProvider` — the seam is provider-agnostic.
3. **Existing wallet abstractions** — marketplace `apps/web/lib/altana-session/` (adapter + service + store + custody) + `apps/web/lib/custody/`. The active signer path is `ALTANA_TESTNET_PRIVATE_KEY` read from server env and held in memory (`index.server.ts:53`) — the **dev residual** that `production-config.ts` rejects.
4. **@bnbagent/sdk@0.5.1 wallet/signer APIs** — exports `EVMWalletProvider`, `AltanaWalletProvider` (EIP-7702, session + admin modes, relay `broadcast.self`/`calls.arbitrary`/`intents.erc8183`, never `sign.*`), `TWAKProvider` (CLI), `WalletProvider`. **`TurnkeyWalletProvider` is NOT present in this SDK version** (README lists Turnkey; the installed 0.5.1 dist does not ship it). Peer range: `@altananetwork/sdk >=0.3.3 <0.6.0` (apps/web pins `0.7.0` — incompatible range).
5. **packages/integrations** — `altana/` SDK facade + ERC-8183 adapter (`assertErc8183SigningBoundary` — no signer wired) + `v2/` adapter (`hire-adapter`, `main-track-hire`, all pure/injected).
6. **apps/web/lib/activation** — X.76 `capability-source` (Model A), `session-gate`, `consent.commitment`, `main-track-v2.ts` (Model B policy + custody seam `resolveMainTrackCustody`, currently `main-track-custody-required`).
7. **Environment validation** — `apps/web/lib/security/production-config.ts` rejects `ALTANA_TESTNET_PRIVATE_KEY` in production; `resolveKmsConfig` requires `AWS_REGION`+`ALTANA_KMS_KEY_ID`; `.env.example` documents names only.
8. **Vercel deployment architecture** — serverless; env-scoped production vars; no long-lived credentials in source; Prisma + SDK + KMS runtime.
9. **Remote signing mechanisms present** — none wired. The SDK's `AltanaWalletProvider` (relay) is the available remote/relay signer; not connected to the marketplace.
10. **BNB Agent Studio / ERC-8183 buyer custody available** — the official `@bnbagent/sdk` Altana EIP-7702 **session-key** mechanism (scoped permissions, expiry, on-chain revocation, relay execution) is the ERC-8183-native compliant buyer mechanism, and the marketplace already built the surrounding Altana session + KMS-envelope custody architecture (X.35/X.36/X.44/X.45/X.71/X.72/X.75).

## 2. Historical custody findings (X.71/X.72/X.75/X.44)

- X.44: KMS-encrypted Altana custody design — session secrets wrapped with a KMS data key (envelope), no plaintext at rest.
- X.71: application-side KMS readiness **PASS** (provider/factory/config verified offline).
- X.72: **provisioning is an external execution gate** — AWS access and Vercel access unavailable in this environment; the audited plan requires an operator to create a customer-managed symmetric KMS key + least-privilege IAM + `AWS_REGION`/`ALTANA_KMS_KEY_ID`/`ALTANA_KMS_PROVIDER=aws` in Vercel Production only.
- X.75: three blockers — capability source (Model A), AWS/KMS custody (unprovisioned), management/admin custody (`ALTANA_ADMIN_CUSTODY_PROVIDER`/`ALTANA_ADMIN_KEY_REFERENCE` policy-only; raw `ALTANA_TESTNET_PRIVATE_KEY` residual in `index.server.ts`).

## 3. Answers

**A. Is there already a compliant signer we can use?**
PARTIAL. A compliant signer exists in the SDK — `AltanaWalletProvider` **session mode** (EIP-7702 on-chain session key, relay-executed, `intents.erc8183`, no `sign.*` server-side). It is **not** wired into the marketplace, apps/web does not depend on `@bnbagent/sdk`, and the `@altananetwork/sdk@0.7.0` version is outside the SDK's `<0.6.0` peer range. Not "ready to wire" → **no** for a zero-provisioning answer.

**B. Can @bnbagent/sdk EVMWalletProvider operate through an injected signer without exposing a raw private key to Next.js?**
NO for `EVMWalletProvider` itself — it is a local Keystore V3 wallet and requires the key in-process. YES via the SDK's `WalletProvider` abstraction: `ERC8183Client` accepts any `WalletProvider`, and `AltanaWalletProvider` **session mode** signs ERC-8183 buyer intents through the Altana relay without a raw admin key on the server. The compliant pattern is `WalletProvider` (Altana session) → `ERC8183Client`, NOT `EVMWalletProvider` in production.

**C. Is there an existing KMS abstraction that can be completed without redesign?**
YES. `KmsProvider` + `AwsKmsProvider` (DescribeKey/Encrypt/Decrypt) + factory + config are implemented, offline-verified, and already wired into `createAltanaCustody`. Completing it = **external provisioning only** (operator creates the symmetric key + IAM + three Vercel vars). Note the role is envelope custody of session-key material, not a transaction signer — which is the correct, minimal role.

**D. Is there a Vercel-compatible remote signer architecture already implemented?**
YES (architecture) but **gated**. The marketplace already implements Altana EIP-7702 session creation + session-key custody (KMS envelope) + relay execution on Vercel (X.35/X.36/X.44/X.45). The gating factors are: custody resources unprovisioned (X.72), the raw admin-key signer residual, and the `@bnbagent/sdk`/`@altananetwork/sdk` peer-range conflict.

**E. Is AWS/KMS actually required, or was it only one possible implementation?**
Only ONE possible implementation of at-rest key protection. The ERC-8183-native signing layer is the Altana session key; the at-rest protection of the serialized session key could be any compliant secret-management provider (AWS KMS — the one implemented, HashiCorp Vault, a managed secret store, or an external HSM/MPC). The SDK's `mpc` wallet is a stub by design. KMS is not required; a compliant remote-signer/secret-management option is required.

**F. Can a compliant production marketplace-client wallet be provisioned without storing raw private keys in Vercel?**
YES. Provision a marketplace Altana EIP-7702 account; an **operator** (off-server) grants a scoped, expiring ERC-8183 session key; the serialized session key is wrapped with the existing KMS envelope custody (only ciphertext + wrapped data key persisted; KMS unwraps in memory at signing). No raw key in source, `.env`, or Vercel env; the raw admin EOA key exists only at operator grant time (or under an HSM), never on the server.

## 4. Security-rule compliance of the winning path (Altana session key + KMS envelope)

| Rule                              | Compliance                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| No raw private key in source      | ✅ session key is wrapped ciphertext; admin key never in source                                          |
| No raw private key in `.env`      | ✅ `MAIN_TRACK_CUSTODY_KEY_REFERENCE` is a key reference, not a key                                      |
| No raw private key in Vercel env  | ✅ only KMS region/key-id/provider + serialized wrapped session                                          |
| No browser private key            | ✅ server-only signing; no `sign.*` capability on Altana session                                         |
| No seller wallet reuse            | ✅ marketplace account is a distinct EIP-7702 account                                                    |
| No buyer wallet reuse             | ✅ dedicated marketplace client account (X.130 address never copied)                                     |
| Explicit signing authorization    | ✅ scoped session permissions (`intents.erc8183`, `broadcast.self`) + per-hire user confirmation (X.131) |
| Testnet-only during hackathon     | ✅ chain 97 pinned everywhere                                                                            |
| Auditable signer identity         | ✅ on-chain KeyStore-registered session public key + relay tx evidence                                   |
| Revocation capability             | ✅ on-chain session revocation (`revokeSession`/KeyStore)                                                |
| Fail closed if signer unavailable | ✅ `resolveMainTrackCustody` returns `main-track-custody-required`                                       |

## 5. Classification

**B — SUPPORTED CUSTODY EXISTS BUT REQUIRES USER PROVISIONING.**

The compliant mechanism (official `@bnbagent/sdk` `AltanaWalletProvider` session mode + the already-built Altana session custody + KMS envelope) exists and is partially implemented, but cannot be enabled without operator provisioning:

1. AWS KMS resources (customer-managed symmetric key, least-privilege IAM, `AWS_REGION`/`ALTANA_KMS_KEY_ID`/`ALTANA_KMS_PROVIDER=aws` in Vercel Production) — X.72 external gate.
2. A marketplace Altana EIP-7702 admin account on BSC testnet (funded), plus an operator-granted scoped ERC-8183 session key persisted KMS-wrapped.
3. Reconcile `@bnbagent/sdk@0.5.1` peer range (`@altananetwork/sdk <0.6.0`) vs apps/web's `0.7.0` (isolate the @bnbagent Altana runtime or adopt a compatible altana SDK version).
4. Replace the raw `ALTANA_TESTNET_PRIVATE_KEY` admin path with the KMS-wrapped session signer for production (fail-closed).
5. Wire `AltanaWalletProvider` session mode into the X.131 Main Track route's injected ports.

## 6. Exact minimum next step (winning path)

> Operator-provision AWS KMS (customer-managed symmetric `ENCRYPT_DECRYPT` key + least-privilege runtime identity + `AWS_REGION`, `ALTANA_KMS_KEY_ID`, `ALTANA_KMS_PROVIDER=aws` in Vercel Production only) and provision a marketplace Altana EIP-7702 admin account + a scoped, expiring ERC-8183 session key on BSC testnet; persist the serialized session key via the existing `createAltanaCustody` KMS envelope; then reconcile the `@bnbagent/sdk` peer dependency, replace the raw admin-key signer with the Altana session-mode `WalletProvider`, and wire it into the X.131 Main Track ports (verify with the X.131 harness end-to-end on testnet under separate authorization).

**STOP after the audit.** No transaction, no credentials created, no AWS resource, no job created, no Vercel change, no commit/push/deploy.
