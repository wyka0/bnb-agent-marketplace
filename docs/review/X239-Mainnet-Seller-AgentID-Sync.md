# X.239 — Mainnet Seller Agent-ID Sync (COMPLETE)

Date: 2026-09-05 — Runtime/configuration milestone. Zero transactions, zero
signatures, zero Mainnet writes, zero wallet prompts during this milestone.

## Previous → New agentId state

|                     | Before X.239                              | After X.239                                                |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| `/health` `agentId` | `null` (process started pre-registration) | **`56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760`** |

## 1. Process identification (Phase 1)

- **Mainnet seller (port 3001): PID 3368** — `node --import tsx seller-mainnet.ts`, started 2026-09-04 22:40:05 (pre-registration start; the cause of `agentId: null`).
- **Testnet seller (port 3000): PID 3464** — `node --import tsx seller.ts`, confirmed alive and untouched throughout.
- Baseline pre-restart health: 3001 → `{"chain":56,"seller":"0xB0f768…7c0","hire":"disabled","agentId":null}`; 3000 → `{"chain":97,…}`.

## 2. Runtime environment (Phase 2)

Restart environment (process env only — nothing written to tracked files):

- `NETWORK=bnb-mainnet`, `CHAIN_ID=56`
- `MAINNET_OWNER_ADDRESS=0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- `MAINNET_KEYSTORE_DIR=~/.bnbagent-mainnet` (separate mainnet keystore)
- `MAINNET_AGENT_URL=https://inbook-y1-plus.tail3e3640.ts.net:8443`
- **`MAINNET_AGENT_ID=56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760`** (new)
- `MAINNET_HIRE_ENABLED` **unset → false** (flag unchanged, stays disabled)
- `WALLET_PASSWORD` injected from the existing `.env.local` secret mechanism
  into process env only — never printed, never committed.

## 3. Restart (Phase 3)

- Gracefully stopped **only** PID 3368 (mainnet seller); port 3001 freed; port 3000/testnet untouched.
- Started fresh mainnet seller: **PID 9100**, started 2026-09-05 00:47:53.
- All startup gates passed (NETWORK gate, keystore gate, wallet-match gate; banner: `chain: 56 | owner: 0xB0f768…7c0 | hire: DISABLED | agentId: 56:0x8004…:334760 | keystore: ~/.bnbagent-mainnet`).

## 4. Health verification (Phase 4)

`GET http://localhost:3001/health` → **HTTP 200**:

```json
{
  "status": "ok",
  "chain": 56,
  "seller": "0xB0f7681668f916eEd97dA066D31aA295D34727c0",
  "hire": "disabled",
  "agentId": "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760"
}
```

`GET https://inbook-y1-plus.tail3e3640.ts.net:8443/health` → **HTTP 200**, identical values. Funnel routing `:8443 → 127.0.0.1:3001` reaches the new process.

## 5. Negotiate verification (Phase 5)

`POST https://…:8443/negotiate` → **HTTP 200**:

```json
{
  "response": {
    "accepted": false,
    "reason": "Mainnet hiring is not yet enabled. Commercial hire is currently available on BSC Testnet (chain 97) only."
  },
  "chain_id": 56,
  "verifying_contract": "0xEa4DAa3100A767e86FDed867729ae7446476EBA6",
  "negotiation_hash": "0x0000…0000",
  "provider_sig": null
}
```

- Chain 56 — PASS. Mainnet Commerce `0xEa4D…EBA6` as verifying contract — PASS.
- Correct disabled-gate behavior: no signing (`provider_sig: null`), no quote, no job, no write. This is the expected provider behavior while `MAINNET_HIRE_ENABLED=false` (any signature would violate this milestone's zero-signature ledger).

## 6. Registry cross-check (Phase 6 — read-only)

- `ownerOf(334760)` → `0xB0f7681668f916eEd97dA066D31aA295D34727c0` — **PASS**
- `tokenURI(334760)` → decodes to name `BNB Agent Studio Mainnet Seller`, endpoint `https://inbook-y1-plus.tail3e3640.ts.net:8443` — **PASS** (matches the live seller URL)
- `balanceOf(owner)` → 1 (the single X.238 registration; no new registrations)
- Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (verified table)

## 7. Testnet regression (Phase 7)

- `GET https://inbook-y1-plus.tail3e3640.ts.net/health` → **HTTP 200**, chain **97**, seller `0xB0f768…7c0` — unchanged.
- Safe read-only testnet negotiate → HTTP 200, `accepted: true`, `chain_id: 97`, verifying contract `0xa206…B0DE`, provider_sig present (the seller's standard off-chain quote flow; no job created, no write).
- Agent 1906: UNCHANGED. Agent 2005: UNTOUCHED. Job 787: UNTOUCHED.

## 8. Safety ledger (Phase 8)

| Item                                | Count                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Mainnet transactions this milestone | **0**                                                                                                             |
| Mainnet signatures                  | **0**                                                                                                             |
| Mainnet writes                      | **0**                                                                                                             |
| Wallet prompts                      | **0**                                                                                                             |
| Mainnet hires / ERC-8183 jobs       | **0 / 0**                                                                                                         |
| Existing registration tx            | `0x59edb71490cbc9ab5cf7e9c156975e642fc86fe0dd1a8d208c311175e48cdbd2` (confirmed on-chain in Phase 6; NOT re-sent) |
| Testnet writes                      | 0                                                                                                                 |
| Keystore reads/decryption           | 0 (loaded encrypted by the seller only)                                                                           |
| Secrets printed                     | none                                                                                                              |

## 9. Tests (Phase 9)

| Suite                                             | Result                  |
| ------------------------------------------------- | ----------------------- |
| seller-runtime.verify.ts (X.236-P2)               | 35/35 PASS              |
| mainnet-seller-readiness.verify.ts                | 36/36 PASS              |
| mainnet-provisioning.verify.ts                    | 52/52 PASS              |
| main-track-user-hire.verify.ts (chain-aware hire) | ALL PASS                |
| network-selector.verify.ts                        | 63/63 PASS              |
| Workspace typecheck / lint / build                | PASS (turbo, all tasks) |
| prettier --check                                  | PASS                    |
| git diff --check                                  | CLEAN                   |

## 10. Files changed

This report only (`docs/review/X239-Mainnet-Seller-AgentID-Sync.md`). No
repository code, config, or tracked files modified. No commit, no push.

## Final state

- Mainnet seller: **LIVE** (PID 9100, port 3001, HTTPS :8443)
- Agent ID: `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760` (runtime-synced with on-chain registration)
- chainId: 56 · Owner: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- MAINNET_HIRE_ENABLED: **false** (unchanged)
- Testnet seller: UNCHANGED (PID 3464, chain 97, Agent 1906)
- Transactions / signatures this milestone: **0**
