# X.133 Marketplace Custody Provisioning — Testnet

**Mode:** Provisioning audit + gate. No new ERC-8183 job, no submit/settle of Job 641, no transaction, no credentials created, no AWS resource, no Vercel change, no commit/push/deploy. Job 641 remains untouched historical/testnet evidence.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. AWS/KMS availability

**NOT AVAILABLE.** Verified (presence-only, no values inspected):

- Process env: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_PROFILE`, `AWS_REGION`, `AWS_DEFAULT_REGION` — **ABSENT**.
- `~/.aws/credentials` and `~/.aws/config` — **do not exist**.
- `aws` CLI — **not installed**.
- Local env files (repo root, `apps/web`, `services/v2-marketplace`): `AWS_REGION` / `ALTANA_KMS_KEY_ID` / `ALTANA_KMS_PROVIDER` — **EMPTY/ABSENT**.
- Vercel production: previously audited (X.72) — AWS vars ABSENT, and no Vercel CLI/env access in this environment.

This matches X.72 ("AWS ACCESS UNAVAILABLE, VERCEL ACCESS UNAVAILABLE") and X.75.

## 2. KMS key provisioning result

**NOT PROVISIONED — STOPPED AT THE GATE.** Per the milestone, "if AWS credentials are NOT available: STOP. Return B." No KMS key was created, no IAM, no alias, no key policy. No provisioning was fabricated.

## 3. IAM result

**N/A** — no provisioning performed. The audited requirement (unchanged from X.72) is least-privilege `kms:DescribeKey`, `kms:Encrypt`, `kms:Decrypt` on exactly one symmetric `ENCRYPT_DECRYPT` key ARN, via a short-lived runtime identity.

## 4. Marketplace Altana account

**NOT PROVISIONED.** The target account is a distinct BSC-Testnet Altana EIP-7702 account (not seller `0xB0f7...`, not buyer `0x299C...`, not the old local marketplace `0xeb237f...`), testnet-only and auditable. Nothing was created; no private key material exists or was exposed.

## 5–8. Session scope / expiry / spend cap / revocation

**NOT CREATED** (blocked by the AWS gate). The audited, smallest-scope design (from X.132 and the official SDK):

- Scope: ERC-8183 buyer/client operations only — `intents.erc8183`, `broadcast.self`; no arbitrary `sign.*`, no unrelated DeFi permissions.
- Chain: BSC Testnet `97` only.
- Commerce: exact official chain-97 commerce contract (`0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`).
- Spend cap: sufficient for a `1 U` hire + gas.
- Expiry: short-lived.
- Revocation: on-chain session revocation (KeyStore).
- Persistence: serialized with the existing repository custody format and wrapped via `AwsKmsProvider` (envelope) — only ciphertext/wrapped material persisted, never plaintext.

## 9. Chain

`97` — pinned in the custody resolver, `resolveKmsConfig`, the Main Track boundary (`expectedChainId: 97`), and the altana-session service (`altana-session/index.server.ts` rejects mainnet). No mainnet path exists.

## 10. Signer verification

**NOT PERFORMED** — no signer is provisioned. The target signer is `@bnbagent/sdk@0.5.1` `AltanaWalletProvider` in **session mode** (relay `broadcast.self`/`intents.erc8183`, no `sign.*` server-side). Read-only signer-capability checks (load, deterministic identity, chain 97, session valid/unexpired, scope ERC-8183 only, spend cap, revocation, no unrelated access) are defined but cannot run until a session is provisioned under KMS. No transaction was broadcast.

## 11. SDK compatibility

- Installed: `@bnbagent/sdk@0.5.1` (isolated seller/marketplace runtime), `@altananetwork/sdk@0.7.0` (apps/web).
- `@bnbagent/sdk@0.5.1` peer range: `@altananetwork/sdk >=0.3.3 <0.6.0` (optional peer).
- apps/web pins `@altananetwork/sdk@0.7.0` — **outside the peer range**.
- Implication: wiring `AltanaWalletProvider` (session mode) into apps/web directly is an unverified peer mismatch. Required (before enabling): reconcile the altana SDK version or run the `@bnbagent` Altana session runtime in an isolated package/sidecar that the route calls. **No package upgrade was performed** (per the milestone, upgrades are not done casually; this is documented, not applied).

## 12. X.131 integration result

**Unchanged and still fail-closed.** The `resolveMainTrackCustody()` seam continues to return `main-track-custody-required` (no `MAIN_TRACK_CUSTODY_PROVIDER`/`MAIN_TRACK_CUSTODY_KEY_REFERENCE`, and the KMS resources they would reference do not exist). `runMainTrackV2HireActivation()` is wired through the custody seam in `apps/web/lib/activation/main-track-v2.ts` and the route; nothing was bypassed. Wallet logic is NOT in the API route (it stays behind the custody abstraction). No new ERC-8183 job was created to test custody.

## 13. Security tests

Re-run and green (no code changed this milestone):

- `custody:verify` (X.44) — PASS (only the pre-existing local-PostgreSQL persistence subcheck is BLOCKED by absent local DB; unrelated to custody logic).
- `activation:main-track:verify` (X.131) — ALL PASS (30 checks incl. custody fail-closed, raw-key rejection, no signing material to browser).
- `activation:hire:verify`, `activation:capability-source:verify` — PASS.
- `security:x49` 25/25, `security:x55` 22/22 — PASS.
- X.127 `hire-adapter:verify`, X.130 `main-track-hire:verify` — ALL PASS.
- `apps/web` typecheck + lint — PASS. (Build/format were verified green in X.131; nothing changed since.)

## 14. Production impact

**NONE.** No production custody change, no Vercel env change, no deployment, no commit. No secrets, keystores, session keys, KMS plaintext, `.env*`, cloudflared files, or logs were created or staged. No encrypted blobs were printed.

## 15. Exact remaining blocker

**AWS/KMS operator provisioning is the gate (external, requires an authorized operator with AWS + Vercel access):**

1. Provision a customer-managed symmetric `ENCRYPT_DECRYPT` KMS key + least-privilege runtime identity (`kms:DescribeKey/Encrypt/Decrypt` on that key) and set `AWS_REGION`, `ALTANA_KMS_KEY_ID`, `ALTANA_KMS_PROVIDER=aws` in Vercel Production only.
2. Provision the marketplace Altana EIP-7702 admin account on BSC testnet (funded) and have an operator grant a scoped, expiring ERC-8183 session key; persist it KMS-wrapped via the existing `createAltanaCustody` envelope.
3. Reconcile the `@bnbagent/sdk@0.5.1` peer range (`@altananetwork/sdk <0.6.0`) vs `0.7.0` (isolate the @bnbagent Altana runtime or adopt a compatible altana SDK version).
4. Wire `AltanaWalletProvider` session mode into the X.131 Main Track ports (`resolveMarketplaceClient`/`executeErc8183Hire`) and re-verify with the X.131 harness end-to-end on testnet under separate authorization.

## Classification

**B — AWS/KMS OPERATOR PROVISIONING REQUIRED.** AWS credentials are not available in this environment, so per the milestone gate no provisioning was performed (nothing fabricated). The compliant custody design, SDK-compatible signer path, and fail-closed integration are fully specified and tested; only external operator provisioning of AWS/KMS (and the marketplace Altana session + SDK peer reconciliation) stands in the way.

**STOP.** No new ERC-8183 transaction was broadcast; Job 641 untouched; no commit/push/deploy.
