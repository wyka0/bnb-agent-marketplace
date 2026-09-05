# X.236 — Mainnet Seller Deployment (PARTIAL)

Date: 2026-09-04 · Zero transactions, zero signatures, zero wallet prompts.

## 1. Deployment verdict

**PARTIAL** — Tailscale Funnel routing for the Mainnet seller endpoint is
successfully configured and verified. However, the actual Mainnet seller process
(`seller-mainnet.ts`) does not yet exist as a runtime file in
`services/v2-mainnet-seller/`, so no process is listening on port 3001.
Additionally, Fly.io (the preferred host) requires billing setup and returned
a payment-required error. The fallback (Tailscale path-based routing on a
second port) was successfully configured.

## 2. Fly.io app name

**BLOCKED** — Fly.io returned: "We need your payment information to continue!
Add a credit card or buy credit: https://fly.io/dashboard/wyka0/billing"
The app `bnb-mainnet-seller` was NOT created.

## 3. Actual HTTPS hostname

**Tailscale Funnel (fallback — configured and working):**

`https://inbook-y1-plus.tail3e3640.ts.net:8443`

This is a **separate port** on the same hostname, routing to a separate
local process on port 3001. The Testnet seller (port 443/3000) is
completely unaffected.

## 4. /health result

**502 Bad Gateway** — expected. The Funnel is correctly routing HTTPS
traffic to port 3001, but no Mainnet seller process is running on 3001 yet.
The seller runtime (`seller-mainnet.ts`) does not exist in the repository.

## 5. /negotiate result

**NOT REACHED** — no process on port 3001.

## 6. Chain ID verification

Not verifiable until the seller process exists. The Tailscale route is
configured, but chain verification requires a live /health response.

## 7. Owner verification

Not verifiable until the seller process exists.

## 8. Keystore handling

**NOT COPIED** — per X.235-P1 Phase 5 and X.235-P3 Phase 5, the keystore
copy requires explicit user approval:

- SOURCE: `~/.bnbagent/wallets/0xB0f768….json` (encrypted Keystore V3)
- DESTINATION: separate volume/path for the Mainnet seller
- STATUS: **NOT COPIED** (user approval required, documented in X.235-P1)
- Private key/mnemonic/password/keystore contents: NEVER PRINTED

## 9. Testnet isolation verification

**PASS** — Testnet seller verified unchanged:

- `https://inbook-y1-plus.tail3e3640.ts.net/health` → HTTP 200, chain 97, seller `0xB0f768…`
- Port 3000 routing unchanged
- Funnel on 443 unchanged
- Agent 1906: unchanged (job 920 still COMPLETED)
- Mainnet routing on port 8443 is completely separate from port 443

## 10. Mainnet registration status

**NOT REGISTERED** — no ERC-8004 mainnet agent exists. No `registerAgent`
was called. The Mainnet Agent ID remains empty.

## 11. MAINNET_AGENT_ID status

**EMPTY** — correctly not set. Will be populated only after a future
user-authorized registration transaction.

## 12. MAINNET_HIRE_ENABLED status

**false** — not set in any environment file. The chain-aware hire
architecture (X.234) correctly rejects mainnet quotes with a truthful
"Mainnet hiring is unavailable" message.

## 13. Transaction count

**0**

## 14. Signature count

**0**

## 15. Wallet prompts

**0**

## 16. Files changed

No files were modified in this milestone. Tailscale configuration was changed
at the system level (added `mainnet-seller` service on port 8443 → 3001).
No repository files were committed or modified.

## 17. Test results

| Suite                                  | Result            |
| -------------------------------------- | ----------------- |
| mainnet-provisioning:verify            | 52/52 PASS        |
| mainnet-seller-readiness:verify        | 36/36 PASS        |
| activation:main-track-user-hire:verify | ALL CHECKS PASSED |
| network-selector:verify                | 63/63 PASS        |
| typecheck                              | exit 0            |
| lint                                   | exit 0            |
| git diff --check                       | exit 0            |

## 18. Remaining blockers for registration

1. **Mainnet seller runtime** — `seller-mainnet.ts` does not exist. The proven
   testnet seller (`services/v2-seller/seller.ts`) must be adapted to chain 56
   using the verified `mainnet-config.ts` address table. This is a code-writing
   milestone, not a deployment step.

2. **Keystore copy** — user must manually copy the encrypted Keystore V3 to the
   mainnet seller's separate volume path. User approval required (documented).

3. **Mainnet BNB funding** — `0xB0f768…` has 0 BNB on chain 56. User must
   transfer real BNB (~0.001 BNB sufficient). No automatic funding.

4. **Fly.io billing** (if Fly.io is later preferred) — user must add billing
   at https://fly.io/dashboard/wyka0/billing. This is a user action.

## Infrastructure prepared

The following IS ready (from this milestone):

- Tailscale Funnel port 8443 → localhost:3001 (Mainnet route)
- Port 3001 is free on this machine
- Testnet port 443 → 3000 completely isolated
- HTTPS certificates automatically managed by Tailscale
- The mainnet HTTPS endpoint is live (currently 502 — no process on 3001)
