# Main Track Activation — X.46 Live Altana Session E2E (BNB Testnet, chain 97)

- **Date:** 2026-08-15
- **Layer:** Live lifecycle run of the X.45 persistent Altana session against BNB Testnet chain 97 (`apps/web/lib/altana-session/`), plus one real adapter defect found and fixed by the live run (`adapter.ts`)
- **Base:** X.45 persistent session (25/25 offline), X.44 KMS custody, X.43 auth ownership, X.42 SIWE, X.36 demonstrated policy (constants unchanged)
- **Scope:** Full live lifecycle in ONE run: grant → KeyStore register → custody seal → ACTIVE → fresh-instance reconstruct → 27-check read-only preflight → ONE permitted execution → receipt verify → fresh preflight → revoke → post-revoke rejection before broadcast → reconciliation. Testnet only; test KMS only; no commit/push.

## Run Result

```
X.46 STATUS: PASS

CHAIN: 97
SESSION GRANT: PASS (account-level, off-chain)
PERSISTENCE: PASS (in-memory SessionStore stand-in; PostgreSQL BLOCKED P1001 — labeled)
RESTART RECONSTRUCTION: PASS (fresh instance)
LIVE EXECUTION: PASS
REVOKE: PASS
POST-REVOKE REJECTION: PASS
REAL KMS: NOT CONFIGURED (test KMS used)
MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
COMMIT: NO
PUSH: NO
```

## Live Transaction Inventory (all chain 97, all from the expected testnet operator `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`)

| # | Step | Transaction | Detail |
|---|---|---|---|
| 1 | Altana session grant | account-level grant | no broadcast transaction |
| 2 | KeyStore registration | `0xdb1864eb280c0732783a096a61e751e30484ae56f887a6baf0e93c28bfb0630d` | purpose `registerSessionKey`, status success |
| 3 | Permitted session execution | `0x3397cb958f753d1511467bc99e3d26b3fefe3bf25f63eb5acc58a3738b82cc85` | block 125236512, status success; `approve(0x299Ce4113abF88F4997737184aa8A7a3D58AC15C, 1)` — selector `0x095ea7b3`, amount 1 raw unit, value 0; receipt verified with exact `Approval` event |
| 4 | Session revoke | `0xda14cfc7b7dd4bcda5c6437296f334fae6413ba67b6587fd396fa880a70086fe` | block 125236527, status success; purpose `revokeSession` |

## Preflight Gating (all read-only, all PASS before any signing)

- **Preflight #1** (before ANY signing/broadcast): 27/27 PASS — chain/RPC/signer/wallet/user/ownership/policy-exact/target/selector/token/balance/caps/expiry/conflict/available persistence/KMS probe/Job-515-absent/Agent-1816-absent/mainnet-absent/ONE-call/exact-target/exact-selector/amount-in-cap/zero-value/deterministic-calldata
- **Preflight #2** (full re-read immediately before the execution tx): 27/27 PASS
- **Preflight #3** (fresh read-only preflight before revocation): 4/4 PASS — correct session/publicKey, correct wallet, chain 97, KeyStore active immediately before revoke
- Any failed gate aborts the run before a signing; the only broadcast after each gate is the gate's own purpose.

## Lifecycle Evidence

- **Create:** session `8bc26924-bb37-479b-8eb3-a911d375b68e` — grant + KeyStore register + custody seal + ACTIVE persisted; registration tx confirmed.
- **Persistence:** ownership/chain/wallet correct; encrypted secret ciphertext-only; no plaintext key material in any record; status ACTIVE + `keyStoreActive=true`; permissions exactly `CALL,NATIVE_SPEND,TOKEN_SPEND`; expiry `2026-08-15T15:06:12.000Z`.
- **Reconstruction:** completely fresh service instance + fresh adapter + fresh test-KMS provider over the same store reconstructs the ACTIVE session; ECDSA-recovered public key matches the registered KeyStore key; on-chain KeyStore verification `true`.
- **Execution:** exactly ONE genuine session-key transaction, confirmed, receipt success with the exact `Approval` event; spend accounting `spentRaw=1 remainingRaw=0`; KeyStore still active after.
- **Revoke:** real `revokeSession` tx confirmed; KeyStore inactive after; AltanaSession REVOKED with `revokedAt`, encrypted secret destroyed (`destroyedAt` recorded).
- **Post-revoke rejection before broadcast:** `load=blocked/session-revoked` and `execute=denied/session-revoked` — the same permitted operation is refused at the service boundary; no transaction attempted.
- **Reconciliation:** DB revoked = KeyStore inactive = custody secret destroyed; full audit trail `CREATE_STARTED/GRANTED/KEYSTORE_REGISTERED/ACTIVATED/RECONSTRUCTED/EXECUTED/REVOKE_STARTED/REVOKED` all SUCCESS; custody `ENCRYPTED/DECRYPTED/DESTROYED` recorded; audit records contain ids/status only.

## Real Defect Found + Fixed (by the live runs)

`createSdkAltanaSessionAdapter.isKeyStoreActive` previously returned `false` when the adapter's in-memory cached `wallet` was undefined. KeyStore is the authoritative on-chain read (`isValidKey`), so this front-end gate made every fresh process (restart) reconcile a legitimately ACTIVE session to REVOKED. The fix removes the `wallet === undefined` gate — `isKeyStoreActive` is now a pure parameterized read (adapter.ts). Live run #1 exposed this; the final run passes reconstruction + execution + revoke with the fix in place.

Runner-side fixes during the runs (runner only): check 16 in preflight #2 now allows the run's own session id (was flagging the session this run created as a conflict); the reconstruction crypto check compares the recovered 65-byte public key against the registered key directly (an earlier draft wrongly passed it through `getAddress`).

## Aborted Runs + Cleanup (disclosed, bounded)

- Aborted mid-run attempts each registered a new KeyStore key and then revoked it through the runner's abort-safe cleanup path (e.g. cleanup revoke tx `0x2fa018edbe35e9cd5b6c6fef00037ee59d175cbc1ccefc9bdc0cf5995a6c12a0`).
- Residual: the very first live run (pre-rewrite runner, pre-fix, registration tx `0xb6890…b258`) aborted before any revoke path existed; its KeyStore publicKey was never persisted (in-memory store died with the process), so that testnet key cannot be revoked or re-issued. It is bounded: a KeyStore session key can only perform its registered calldata — `approve(0x299Ce4113abF88F4997737184aa8A7a3D58AC15C, 1)` on the $U testnet token for the testnet wallet — 1 raw unit, spend-limited, testnet-only. Recorded as an accepted residual; not subject to further action without the key material.

## Gates (re-run this session)

- typecheck: PASS (turbo, 14/14 tasks, exit 0)
- lint: PASS (exit 0; two unused-assignment lint errors in the runner were fixed)
- build: PASS (turbo, 8/8 tasks; the Prisma client-engine page-data warning is the expected no-Postgres path, identical to X.43/X.44/X.45)
- `pnpm test` (web): PASS — X.42 24 + X.43 41 + X.44 44 + X.45 25 checks, all green
- `prisma validate` / `generate` re-attempt: BLOCKED P1012 (DATABASE_URL/DIRECT_DATABASE_URL env vars absent from this session shell — environment gap of the same P1001 root cause; schema unchanged since X.45)
- `migrate status`: BLOCKED P1001 (no database server) — same as X.45

## Secret-Leak Scan

`privateKey/seedPhrase/mnemonic/sessionToken/AWS_SECRET/AWS_ACCESS_KEY` → no matches except one assertion that verifies `privateKey` is ABSENT from persisted metadata (never prints values) and the final catch-all `console.error` over error objects only. The runner prints PASS/FAIL/INFO lines with public addresses, tx hashes, and env-var NAMES only; key material never leaves the adapter via output. `_probe.ts` temporary artifact deleted.

## Exact Limitations

- Real PostgreSQL round trip still BLOCKED (P1001); persistence exercised via the in-memory store implementing the exact SessionStore contract (labeled stand-in; not claimed as a real DB pass)
- `REAL KMS: NOT CONFIGURED` — test KMS only (X.44)
- No real process restart (deterministic fresh-instance substitute used; same as X.45)
- One unreachable testnet KeyStore key residual from the first aborted run (disclosed above)
- Spend accounting is service-level; the on-chain guard is the 1-unit KeyStore policy itself

## Summary

```
X.46 STATUS: PASS (live full-lifecycle run on BNB Testnet chain 97)

LIFECYCLE:              PASS (grant → register → ACTIVE → reconstruct → execute → revoke → post-revoke reject)
PREFLIGHT GATING:       PASS (27/27 + 27/27 + 4/4 read-only checks; abort before any signing on failure)
REAL TRANSACTIONS:      PASS (register 0xdb1864eb…0630d | execute 0x3397cb95…cc85 | revoke 0xda14cfc7…86fe)
RESTART RECONSTRUCTION: PASS (fresh instance; recovered key == registered KeyStore key)
POST-REVOKE REJECTION:  PASS (denied before broadcast; no tx attempted)
PERSISTENCE:            PASS (contract + in-memory stand-in) / real DB integration BLOCKED (P1001)
ADAPTER DEFECT:         FOUND + FIXED (isKeyStoreActive wallet-gate removed; KeyStore is authoritative)
REAL KMS:               NOT CONFIGURED
MAINNET:                NOT TOUCHED
AGENT 1816:             NOT TOUCHED
JOB 515:                NOT TOUCHED
COMMIT:                 NO
PUSH:                   NO
```