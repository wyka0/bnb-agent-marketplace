# X.237 — Mainnet Seller Live Verification (PASS)

Date: 2026-09-04 — Verification-only milestone. Zero Mainnet transactions,
zero Mainnet signatures, zero Mainnet writes, zero wallet prompts.

## 1. Overall verdict

**PASS — Mainnet seller LIVE + VERIFIED.** The Mainnet seller runtime
(`services/v2-mainnet-seller/seller-mainnet.ts`) is running locally on port
3001 and reachable through the real Tailscale HTTPS endpoint
`https://inbook-y1-plus.tail3e3640.ts.net:8443`, pinned to chain 56 with the
verified Mainnet address table. MAINNET_AGENT_ID remains empty (no ERC-8004
registration exists or was attempted) and MAINNET_HIRE_ENABLED remains false.
The Testnet seller is unchanged and healthy. No registration, hire, job, or
any blockchain write occurred.

A significant finding: the owner wallet `0xB0f768…7c0` now holds
**0.000486983084102691 BNB on chain 56** (it was 0 at X.233/X.235) — the
Mainnet gas-funding blocker is CLEARED.

## 2. Local /health result (Task 3)

`GET http://localhost:3001/health` → **HTTP 200**:

```json
{
  "status": "ok",
  "chain": 56,
  "seller": "0xB0f7681668f916eEd97dA066D31aA295D34727c0",
  "hire": "disabled",
  "agentId": null
}
```

- healthy/ready status: `status: "ok"` — PASS
- chainId = 56 — PASS
- intended public owner `0xB0f768…7c0` — PASS
- Agent ID empty/unregistered (`agentId: null`, honest) — PASS. The service
  makes no claim that an ERC-8004 registration exists.

## 3. Local /negotiate result (Task 4)

`POST http://localhost:3001/negotiate` → **HTTP 200**:

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

The truthful disabled response is the CORRECT verification result for this
milestone: because MAINNET_HIRE_ENABLED must remain false, the seller
correctly refuses to quote. It reports chain 56 and the Mainnet Commerce
`0xEa4D…EBA6` as the verifying contract, signs nothing (`provider_sig: null`),
creates no job, submits no transaction, calls no registerAgent, and performs
no ERC-8183 writes. (Generating a SIGNED Mainnet quote would have violated
the zero-signature ledger of this milestone, so the disabled gate firing
exactly as designed is the verified behavior.)

## 4. External HTTPS /health result (Task 5)

`GET https://inbook-y1-plus.tail3e3640.ts.net:8443/health` → **HTTP 200**:

```json
{
  "status": "ok",
  "chain": 56,
  "seller": "0xB0f7681668f916eEd97dA066D31aA295D34727c0",
  "hire": "disabled",
  "agentId": null
}
```

Funnel routing `:8443 → 127.0.0.1:3001` confirmed live (verified via
`tailscale funnel status`: `https://…ts.net:8443 (Funnel on) → proxy
http://127.0.0.1:3001`).

## 5. External HTTPS /negotiate result (Task 5)

`POST https://inbook-y1-plus.tail3e3640.ts.net:8443/negotiate` → **HTTP 200**:

Identical truthful disabled response as local: `accepted: false`, reason
"Mainnet hiring is not yet enabled…", chain_id 56, Mainnet Commerce
verifying contract, `provider_sig: null`. The HTTPS endpoint demonstrably
reaches the same Mainnet seller process on port 3001.

## 6. Chain verification

| Surface                          | Chain reported | Expected | Result |
| -------------------------------- | -------------- | -------- | ------ |
| Local :3001 /health              | 56             | 56       | PASS   |
| HTTPS :8443 /health              | 56             | 56       | PASS   |
| HTTPS :8443 /negotiate chain_id  | 56             | 56       | PASS   |
| Startup banner                   | chain: 56      | 56       | PASS   |
| Testnet :3000/HTTPS :443 /health | 97             | 97       | PASS   |
| Testnet /negotiate chain_id      | 97             | 97       | PASS   |

No cross-routing: :8443 serves chain 56 only; :443 serves chain 97 only.

## 7. Owner verification

- Running Mainnet seller reports seller/owner `0xB0f7681668f916eEd97dA066D31aA295D34727c0` — matches the authorized owner (X.235-P2 decision).
- Startup gate passed: keystore resolved to the same address (wallet-mismatch hard-fail did not trigger).
- Testnet seller reports the same public address on chain 97 — consistent with the chain-agnostic-key, separate-keystore-copy design.
- Testnet provider_sig from the isolation check recovers (EIP-191, SDK's own `recoverMessageAddress` pattern) to `0xB0f768…7c0` — seller signing identity unchanged.

## 8. Mainnet contract-address verification (Task 1)

The running seller consumes ONLY the verified Mainnet table (X.218/X.233
provenance, `mainnet-config.ts` — code-inspected in this milestone):

| Contract          | Address                                      | Source                                                                    |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | verified table                                                            |
| ERC-8183 Commerce | `0xEa4DAa3100A767e86FDed867729ae7446476EBA6` | verified table; also served as verifying_contract in /negotiate responses |
| Router            | `0x51895229E12F9876011789B04f8698af06cCD6DA` | verified table                                                            |
| Policy            | `0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5` | verified table                                                            |
| $U payment token  | `0xcE24439F2D9C6a2289F741120FE202248B666666` | verified table                                                            |

No invented or substituted addresses; zero Testnet addresses
(`0xa206…`/`0xD7d3…`/`0xd6a4…`) appear anywhere in the Mainnet runtime
(also asserted by the 35-check runtime harness).

## 9. Agent ID status

- `MAINNET_AGENT_ID`: **empty** — `/health` reports `agentId: null`, startup
  banner "(not registered)".
- No Agent 1906 usage: the runtime harness asserts "no hardcoded Agent 1906
  as mainnet agent" (code has no agent ID literals).
- No guessed/foreign agent ID: none exists in config or runtime state.

## 10. Mainnet BNB balance (Task 7)

Read-only `eth_getBalance` via PublicNode on chain 56 (chainId re-confirmed
56 by the same client):

**0.000486983084102691 BNB**

The X.233/X.235 blocker ("0 BNB on chain 56") is CLEARED — the wallet has
been funded. No transfers were made; no funding sufficiency beyond this
observed figure is claimed (it is adequate for a typical registerAgent gas
fee on BSC, but the exact sufficiency is a user decision at authorization
time).

## 11. Keystore availability

- Path: `C:\Users\rashe\.bnbagent-mainnet\0xB0f7681668f916eEd97dA066D31aA295D34727c0.json`
- Present: YES — the running seller loaded it successfully (startup gates
  passed: NETWORK=bnb-mainnet, WALLET_PASSWORD provided via process env —
  never printed, keystore contents never read/printed).
- The seller uses the SEPARATE mainnet keystore dir; no Testnet keystore
  fallback occurred (harness-asserted; startup would have hard-failed).

## 12. Testnet isolation result (Task 6)

`GET https://inbook-y1-plus.tail3e3640.ts.net/health` → **HTTP 200**
`{"status":"ok","chain":97,"seller":"0xB0f7681668f916eEd97dA066D31aA295D34727c0"}`

`POST https://inbook-y1-plus.tail3e3640.ts.net/negotiate` (correct SDK wire
format: `{task_description, terms:{deliverables, quality_standards, …}}`) →
**HTTP 200**, `accepted: true`, full quote with `chain_id: 97`, Testnet
Commerce `0xa206…B0DE` as verifying contract, provider signature present
(off-chain EIP-191 quote signing — the seller's existing, X.220-verified
designed behavior; no transaction/writes). Signature recovers to the seller
wallet (see §7).

- Port map verified: Mainnet `:8443 → 3001 → chain 56`; Testnet `:443 →
3000 → chain 97` (funnel status + live probes).
- No cross-routing: each endpoint serves only its own chain/seller.
- Testnet seller process (PID 3464, `node --import tsx seller.ts`) untouched.
- Agent 1906, Agent 2005, Job 787: untouched (no code or registry action
  touched them in this milestone).

Note: during startup attempts, two duplicate seller processes correctly
self-terminated with EADDRINUSE (one for each port) — the existing healthy
processes were left as-is; no process was killed or modified.

## 13. Transaction / signature / write ledger (Tasks 8–9)

| Item                   | Count                                             |
| ---------------------- | ------------------------------------------------- |
| Mainnet transactions   | 0                                                 |
| Mainnet signatures     | 0                                                 |
| Mainnet writes         | 0                                                 |
| Mainnet wallet prompts | 0                                                 |
| Mainnet jobs created   | 0                                                 |
| registerAgent calls    | 0 (no such code path exists in the runtime)       |
| ERC-8183 writes        | 0 (only the truthful disabled negotiate response) |

- No automatic registration: startup code contains no registerAgent; the
  runtime harness asserts this (check: "no registerAgent, createJob, fund,
  submit, claimRefund, setAgentURI").
- No agent-ID guessing: `MAINNET_AGENT_ID` stays empty; `MAINNET_HIRE_ENABLED=true`
  would hard-fail at startup without a registered ID (gate verified in code).
- MAINNET_HIRE_ENABLED remains false — `isMainnetHireEnabled({}) === false`
  re-verified at runtime; only the literal string "true" enables it.
- The only on-chain reads this milestone: /health, /negotiate handling (no
  chain read needed for disabled path), and the Task-7 balance read
  (`eth_getBalance` + `eth_chainId`). Testnet negotiate performed the
  seller's standard off-chain quote signing (no chain write).
- Log inspection: the only error ever logged was EADDRINUSE from duplicate
  start attempts (expected, self-terminated); no tx/sign/write activity in logs.

## 14. Tests (Task 10)

| Suite                                            | Result     |
| ------------------------------------------------ | ---------- |
| mainnet-provisioning.verify.ts                   | 52/52 PASS |
| mainnet-seller-readiness.verify.ts               | 36/36 PASS |
| seller-runtime.verify.ts (X.236-P2)              | 35/35 PASS |
| main-track-user-hire.verify.ts (X.234/X.224–226) | ALL PASS   |
| network-selector.verify.ts (X.216/231/232)       | 63/63 PASS |
| Workspace typecheck (turbo)                      | 14/14 PASS |
| Workspace lint (turbo)                           | 14/14 PASS |
| Workspace build (turbo)                          | 8/8 PASS   |
| prettier --check (seller files)                  | PASS       |
| git diff --check                                 | CLEAN      |

(The documented pre-existing debt — `x50.infrastructure.verify` check #24 —
was not run/modified in this milestone; it is known to fail on clean HEAD
and was left exactly as-is.)

## 15. Files changed

NONE. This milestone performed zero modifications to repository files.
The only artifacts created are this report and a temp verification script
(outside the repo, deleted after use). Working tree state is unchanged
from the end of X.236-P2 (uncommitted X.234/X.235/X.236 files remain, as
intended — no commit/push authorized).

## 16. Remaining blocker for ERC-8004 registration

Exactly ONE blocker remains: **user authorization for the registerAgent
transaction** on chain 56.

Everything else is now ready:

- Owner wallet funded (0.000486983084102691 BNB — gas available).
- Keystore in place (separate mainnet path, loaded, working).
- Mainnet seller LIVE at the durable public endpoint
  `https://inbook-y1-plus.tail3e3640.ts.net:8443` (health + negotiate
  verified through real HTTPS).
- Verified Registry address (`0x8004…a432`) and registration payload
  preview available (`mainnet-registration-preview.verify.ts` — real owner
  address can now be substituted for the placeholder).
- After registration: set `MAINNET_AGENT_ID`, then (when Mainnet hire is
  meant to go live) `MAINNET_HIRE_ENABLED=true` — both remain OFF until
  the user explicitly authorizes.

## Final state

- Mainnet seller: **LIVE + VERIFIED** (port 3001, HTTPS :8443)
- Mainnet chain: 56
- Mainnet owner: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- Mainnet Agent ID: **EMPTY**
- MAINNET_HIRE_ENABLED: **false**
- Testnet seller: UNCHANGED, healthy (chain 97, Agent 1906)
- Agent 1906: UNCHANGED · Agent 2005: UNTOUCHED · Job 787: UNTOUCHED
- Transactions: 0 · Signatures: 0 (mainnet) · Wallet prompts: 0 · Mainnet writes: 0
- Private key: NOT PRINTED · Password: NOT PRINTED · Keystore contents: NOT PRINTED
- Commit: 0 · Push: 0
