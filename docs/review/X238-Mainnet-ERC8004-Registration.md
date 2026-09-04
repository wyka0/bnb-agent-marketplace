# X.238 — BSC Mainnet ERC-8004 Registration (EXECUTED, SUCCESS)

Date: 2026-09-04 — ONE authorized Mainnet transaction executed exactly as
previewed in X.238-PRECHECK. No other Mainnet transaction was created.

## 1. Pre-registration verification

All X.238-PRECHECK verifications passed before signing (see
`X238-PRECHECK-Single-Registration.md`): live chain-56 Registry (EIP-1967
proxy, impl `0x7274e8…9c02`), selector `0x8ea42286` valid on-chain,
byte-identical calldata assertion (PASS at execution time too), fresh
simulation SUCCESS, `balanceOf(owner)=0` (no duplicate), 8004scan ownership
clean.

Execution-time hard gates (all PASS before the signature):

- calldata byte-identical to preview (1866 hex chars, `0x8ea42286` prefix)
- wallet resolved to `0xB0f768…7c0` from the separate mainnet keystore
- chain 56 confirmed live; balance > max cost; `balanceOf(owner)=0`; nonce 0
- final `eth_call` simulation SUCCESS (simulated agentId 334760)

## 2. Exact registered owner

`0xB0f7681668f916eEd97dA066D31aA295D34727c0` (X.235-P2 user decision —
same public address as the testnet seller; chain-agnostic key, separate
mainnet keystore copy).

## 3. Registry

`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` — the verified chain-56
ERC-8004 Registry from `mainnet-config.ts` (verified live in X.218/X.233).

## 4. Chain

BSC Mainnet, **chainId 56** (asserted at runtime; receipt on chain 56).

## 5. Agent URI (registered, on-chain)

```
data:application/json;base64,eyJkZXNjcmlwdGlvbiI6IkJTQyBNYWlubmV0IEVSQy04MTgzIHNlcnZpY2Ugc2VsbGVyIFx1MjAxNCByZWFsIG5lZ290aWF0ZWQgcXVvdGUgc2VydmljZSwgbWFpbm5ldCIsImltYWdlIjoiIiwibmFtZSI6IkJOQiBBZ2VudCBTdHVkaW8gTWFpbm5ldCBTZWxsZXIiLCJyZWdpc3RyYXRpb25zIjpbXSwic2VydmljZXMiOlt7ImNhcGFiaWxpdGllcyI6WyJlcmM4MTgzLW5lZ290aWF0ZSJdLCJlbmRwb2ludCI6Imh0dHBzOi8vaW5ib29rLXkxLXBsdXMudGFpbDNlMzY0MC50cy5uZXQ6ODQ0MyIsIm5hbWUiOiJFUkMtODE4MyJ9XSwidHlwZSI6Imh0dHBzOi8vZWlwcy5ldGhlcmV1bS5vcmcvRUlQUy9laXAtODAwNCNyZWdpc3RyYXRpb24tdjEifQ==
```

Decoded: name `BNB Agent Studio Mainnet Seller`; description `BSC Mainnet
ERC-8183 service seller — real negotiated quote service, mainnet`; service
`ERC-8183` @ `https://inbook-y1-plus.tail3e3640.ts.net:8443` with
capabilities `["erc8183-negotiate"]`; registrations `[]` (single-transaction
registration — no post-hoc agentId enrichment, by design; the optional
`setAgentURI` phase was NOT authorized and NOT executed).

Metadata stored on-chain: `built_with =
"https://github.com/bnb-chain/bnbagent-sdk#v0.5.1"` (SDK-injected; true SDK
source value) + registry-assigned `agentWallet` entries.

## 6. Gas

| Item                 | Value                      |
| -------------------- | -------------------------- |
| Estimated (precheck) | 610,444                    |
| Gas limit sent       | 732,532 (+20%)             |
| gasPrice sent        | 0.1 gwei (100,000,000 wei) |
| **gasUsed (actual)** | **598,606**                |
| effectiveGasPrice    | 0.1 gwei                   |
| **Actual cost**      | **0.0000598606 BNB**       |

## 7. Balance before

0.000486983084102691 BNB (fresh read at execution time; matched precheck).

## 8. Transaction hash

**`0x59edb71490cbc9ab5cf7e9c156975e642fc86fe0dd1a8d208c311175e48cdbd2`**

(One signature → one broadcast; the initial 120 s receipt poll on PublicNode
timed out, so status was confirmed read-only via multiple RPCs —
bsc-dataseed.binance.org and bsc-dataseed1.defibit.io both returned the
mined receipt. NO retry or rebroadcast was performed — the single
broadcasted transaction was simply confirmed.)

## 9. Receipt status

**success (0x1)** — block 119,971,383 (0x7269e37), 5 logs, all from the
Registry.

## 10. Actual Agent ID

Extracted from the `Registered` event (never guessed):

**`56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760`** (tokenId 334760)

## 11. Owner verification

- `Registered` event `owner` = `0xB0f768…7c0` — PASS
- `Transfer` event: `0x0 → 0xB0f768…7c0`, tokenId 334760 — PASS
- On-chain `ownerOf(334760)` = `0xB0f768…7c0` — PASS
- On-chain `balanceOf(owner)` = 1 (was 0) — PASS
- agentId === Transfer tokenId — PASS

## 12. Endpoint verification

- On-chain `tokenURI(334760)` === the `Registered` event agentURI — PASS
- Decoded on-chain URI endpoint = `https://inbook-y1-plus.tail3e3640.ts.net:8443` — PASS (live endpoint)
- Live seller `GET :8443/health` → 200, chain 56, owner match — the
  registered endpoint currently serves `agentId: null` / `hire: disabled`
  because the running seller process was started before registration and its
  `MAINNET_AGENT_ID` env is still empty (expected; see §14 next steps —
  setting it requires a seller restart, which is a future user-authorized
  step, not part of this milestone).

## 13. Mainnet hire gate status

**MAINNET_HIRE_ENABLED = false.** No Mainnet hire, no ERC-8183 job, no
deliverable submission occurred. The running seller's `/negotiate` continues
to return the truthful disabled response. Enabling Mainnet hire remains a
separate, explicit future authorization.

## 14. Testnet regression

- `https://inbook-y1-plus.tail3e3640.ts.net/health` → 200, chain 97,
  seller `0xB0f768…7c0` — UNCHANGED, healthy.
- Agent 1906: UNCHANGED. Agent 2005: UNTOUCHED. Job 787: UNTOUCHED.
- All mainnet harnesses re-run post-registration: provisioning 52/52,
  readiness 36/36, runtime 35/35 — PASS.

## 15. Security ledger

| Item                                                         | Count                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| Mainnet registration transactions                            | 1 (authorized + executed + confirmed)                               |
| Other Mainnet transactions                                   | 0                                                                   |
| Mainnet hires / jobs                                         | 0                                                                   |
| Signatures                                                   | 1 (the authorized registration tx)                                  |
| Wallet prompts                                               | 1 (the authorized signing)                                          |
| setAgentURI executions                                       | 0 (receipt contains NO URIUpdated events — verified by topic0 hash) |
| Testnet writes                                               | 0                                                                   |
| Retries / rebroadcasts                                       | 0                                                                   |
| Private key / mnemonic / WALLET_PASSWORD / keystore contents | NOT PRINTED                                                         |
| MAINNET_HIRE_ENABLED                                         | false                                                               |
| Commit / push                                                | 0                                                                   |

## 16. Tests

- mainnet-provisioning.verify.ts — 52/52 PASS
- mainnet-seller-readiness.verify.ts — 36/36 PASS
- seller-runtime.verify.ts — 35/35 PASS
- (X.238-PRECHECK live verifications: simulation PASS, gas PASS, duplicate
  check PASS — all read-only)

## 17. Files changed

- This report only (`docs/review/X238-Mainnet-ERC8004-Registration.md`).
- No repository code modified; execution ran from temp scripts (deleted).
- No commit, no push.

## Post-registration state (for the next milestone)

- Mainnet Agent ID to configure: `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760`
- Seller restart with `MAINNET_AGENT_ID` set (so `/health` reports it) is a
  future step requiring user authorization (it touches the running seller).
- `MAINNET_HIRE_ENABLED=true` remains OFF until the user explicitly
  authorizes enabling Mainnet hire.
- Remaining balance: 0.000427122484102691 BNB.
