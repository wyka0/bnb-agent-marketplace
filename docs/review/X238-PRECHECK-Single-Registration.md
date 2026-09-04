# X.238-PRECHECK — Single-Transaction ERC-8004 Registration Verification

Date: 2026-09-04 — READ-ONLY milestone. Zero transactions, zero signatures,
zero Mainnet writes, zero wallet prompts, zero broadcasts.

## VERIFY 1 — Live contract

| Check                        | Result                                                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network                      | BSC Mainnet                                                                                                                                                                                                                                                                           |
| chainId (live `eth_chainId`) | **56** — PASS                                                                                                                                                                                                                                                                         |
| Registry                     | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (verified table, `mainnet-config.ts`)                                                                                                                                                                                                    |
| Contract code                | **EXISTS** — 130-byte proxy (EIP-1967) — PASS                                                                                                                                                                                                                                         |
| EIP-1967 impl slot           | `0x7274e874ca62410a93bd8bf61c69d8045e399c02`                                                                                                                                                                                                                                          |
| Selector validity            | `register(string,(string,bytes)[])` = `0x8ea42286` — **validated against the live contract** (both `eth_estimateGas` and `eth_call` with this calldata succeed from our owner; the previously assumed `registerAgent(string)` / `0x2d2a9585` **reverts** — confirmed absent on-chain) |

## VERIFY 2 — Exact calldata (SDK encoding)

Rebuilt with the SDK's `AgentURIGenerator` + the SDK's TRUE auto-injected
metadata (from SDK source: `BUILT_WITH_KEY = "built_with"`,
`getBuiltWithValue() = "https://github.com/bnb-chain/bnbagent-sdk#v" + SDK_VERSION`,
SDK version 0.5.1 from package.json):

- **agentURI** — byte-identical decoded content to the X.238 preview (517-char
  `data:application/json;base64` registration file):
  - name: `BNB Agent Studio Mainnet Seller`
  - description: `BSC Mainnet ERC-8183 service seller — real negotiated quote service, mainnet`
  - service: `{name: "ERC-8183", endpoint: "https://inbook-y1-plus.tail3e3640.ts.net:8443", capabilities: ["erc8183-negotiate"]}` — endpoint PASS
  - `registrations: []` (agentId unknown pre-mint; the SDK's optional phase-2 enriches this — see VERIFY 4)
- **metadata**: exactly one entry `built_with = "https://github.com/bnb-chain/bnbagent-sdk#v0.5.1"`

> **CORRECTION vs X.238 preview**: the earlier preview assumed
> `built_with = bnbagent-ts-sdk/0.5.1`. The SDK source actually injects the
> URL form `https://github.com/bnb-chain/bnbagent-sdk#v0.5.1`. The calldata
> in THIS precheck is the authoritative, SDK-faithful version.

- **selector**: `0x8ea42286` — PASS
- **calldata length**: 1866 hex chars (933 bytes), full hex recorded in the
  session facts file and reproduced in the session log; begins
  `0x8ea42286…` and encodes exactly `[agentURI, [{metadataKey:"built_with", metadataValue:"https://github.com/bnb-chain/bnbagent-sdk#v0.5.1"}]]`.

## VERIFY 3 — Read-only simulation

`eth_call` (no state override) with the EXACT calldata, `from = 0xB0f768…7c0`, to the live Registry:

- **SIMULATION SUCCEEDED** — returned `0x…051ba7` → agentId **334759** at the
  simulated block (note: the Registry is actively used — an earlier simulate
  in the same session returned 334750 — so the actual agentId will be
  whatever token the Registry assigns at execution time; it is NOT guessed,
  it will be extracted from the receipt).
- The simulation proves the registration does NOT depend on state-changing
  side conditions beyond msg.sender: the call would succeed as-is from our
  owner address.

## VERIFY 4 — Single-transaction semantics (from SDK source)

`ERC8004Agent.registerAgent(agentUri)` (SDK `erc8004/agent.ts`, verified in
`node_modules/@bnbagent/sdk/dist/erc8004/index.cjs`) is two-phase:

1. **Phase 1** — `contractInterface.registerAgent(agentUri, metadata)`
   broadcasts `register(string agentURI, MetadataEntry[] metadata)`
   (`0x8ea42286`). This is THE registration transaction: mints the agent
   token, stores the URI, sets metadata, returns the agentId.
2. **Phase 2 (conditional)** — only when an agentId was assigned AND the
   parsed URI carries endpoints, the SDK regenerates the URI WITH the
   now-known `agentId` (populating the `registrations` array with
   `{agentId, agentRegistry: "eip155:56:0x8004…"}`) and pushes it via
   `setAgentURI(agentId, finalAgentUri)` — a SECOND transaction.

**Why phase 2 exists**: a URI cannot contain its own future token ID before
the mint; phase 2 enriches the on-chain URI with a self-referencing
`registrations` field. The SDK's own docstring and error type prove this is
enrichment, not validity: a phase-2 failure raises
`ERC8004PartialRegistrationError` with the note "**the agent already exists —
only the registrations field failed to update**".

**Answers** (per the milestone's categories):

- A. required for registration validity — **NO**
- B. convenience/update operation — **YES** (URI enrichment with self-referencing agentId)
- C. triggered only because the SDK parses endpoints — **YES** (that is the trigger condition in code: `endpoints.length > 0`)
- D. otherwise unnecessary when the URI is already supplied to register — **YES**: `register(agentURI, metadata)` stores the supplied URI as the token URI; the endpoint and all service data are fully retained without phase 2

**Conclusion**: the single `0x8ea42286` transaction is SUFFICIENT for a
valid, discoverable, endpoint-bearing registration. The planned execution
script will therefore call the low-level register path ONCE and will NOT
invoke the SDK's two-phase `registerAgent` (which would add an unauthorized
second `setAgentURI` transaction).

## VERIFY 5 — On-chain registration result (Registry ABI/events)

From the SDK-bundled Registry ABI (`IdentityRegistryUpgradeable`):

- `register(string agentURI, MetadataEntry[] metadata) returns (uint256 agentId)` — nonpayable, mints ERC-721 token to msg.sender.
- **Registered event**: `Registered(uint256 indexed agentId, string agentURI, address indexed owner)` — token ID and owner extractable from the receipt logs (SDK `parseRegisteredAgentId` decodes exactly this; the function return also carries the agentId).
- **Owner assignment**: ERC-721 mint to `msg.sender` = our wallet — `Transfer` event emitted; `ownerOf(agentId)` / `balanceOf(owner)` become queryable (balanceOf 0 → 1).
- **URI behavior**: `tokenURI(agentId)` returns the supplied data-URI (the SDK's `getAgentInfo` reads `tokenURI`; its `setAgentUri` docstring confirms `setAgentURI` merely "updates the tokenURI… per the EIP-8004 specification" — i.e. the initial register already SETS the token URI).
- **Metadata behavior**: `MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)` event per entry — our `built_with` entry is stored on-chain.
- **Discoverability**: the agent becomes enumerable (ERC-721 + Registered event + 8004scan indexer ingests chain-56 registrations, exposing owner_address, name, description, endpoints). **The service endpoint is retained** — it lives inside the stored agentURI (`https://inbook-y1-plus.tail3e3640.ts.net:8443`), and the marketplace's negotiation path resolves `{registeredEndpoint}/negotiate` from that URI.

## VERIFY 6 — Duplicate check (fresh)

- On-chain `balanceOf(0xB0f768…7c0)` on the chain-56 Registry = **0** — no existing registration — PASS
- 8004scan (chain 56, first 100 indexed agents): **0 owned by our wallet** — PASS
- No STOP condition. No duplicate registration risk.

## VERIFY 7 — Gas (fresh, exact calldata)

| Item                                                                    | Value                                      |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| `eth_estimateGas` (exact calldata, from owner)                          | **610,444**                                |
| Proposed gas limit (+20% buffer)                                        | **732,532**                                |
| Current `eth_gasPrice` (PublicNode; cross-checked bsc-dataseed earlier) | 0.05 gwei                                  |
| Proposed gasPrice                                                       | **0.1 gwei** (2× headroom, legacy pricing) |
| Maximum cost                                                            | **0.0000732532 BNB**                       |
| Current balance                                                         | **0.000486983084102691 BNB**               |
| Remaining after max cost                                                | **0.000413729884102691 BNB** (85% remains) |

## VERIFY 8 — FINAL TRANSACTION PREVIEW

```
NETWORK:                 BSC Mainnet
CHAIN ID:                56
FROM:                    0xB0f7681668f916eEd97dA066D31aA295D34727c0
TO:                      0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
METHOD:                  register(string agentURI, (string metadataKey, bytes metadataValue)[] metadata)
SELECTOR:                0x8ea42286
VALUE:                   0 BNB (nonpayable)
AGENT URI:               data:application/json;base64,eyJkZXNjcmlwdGlvbiI6…ZHZJfQ== (517 chars; decoded content = name "BNB Agent Studio Mainnet Seller", description "BSC Mainnet ERC-8183 service seller — real negotiated quote service, mainnet", service ERC-8183 @ https://inbook-y1-plus.tail3e3640.ts.net:8443, capabilities ["erc8183-negotiate"])
METADATA:                [{ metadataKey: "built_with", metadataValue: "https://github.com/bnb-chain/bnbagent-sdk#v0.5.1" }]
CALLDATA LENGTH:         1866 hex chars (933 bytes), begins 0x8ea42286
GAS ESTIMATE:            610,444
GAS LIMIT:               732,532 (+20%)
GAS PRICE:               0.1 gwei (100,000,000 wei)
MAXIMUM COST:            0.0000732532 BNB
CURRENT BALANCE:         0.000486983084102691 BNB
EXPECTED REMAINING:      ≈ 0.000413730 BNB
EXPECTED EVENT:          Registered(uint256 indexed agentId, string agentURI, address indexed owner) + MetadataSet(...) + Transfer(0x0 → owner)
EXPECTED AGENT ID:       56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:<tokenId> (tokenId assigned at execution; simulated 334759 at current block; extracted from receipt, never guessed)
```

**THIS IS ONE TRANSACTION ONLY.**

**NO setAgentURI transaction will be executed in this authorization.** The
execution will call the Registry's low-level `register` path directly
(selector `0x8ea42286`) — NOT the SDK's two-phase `registerAgent` wrapper —
specifically so that no second transaction can occur.

## VERIFY 9 — Safety ledger

| Item                                                         | Value                         |
| ------------------------------------------------------------ | ----------------------------- |
| Transactions                                                 | 0                             |
| Signatures                                                   | 0                             |
| Mainnet writes                                               | 0                             |
| Wallet prompts                                               | 0                             |
| Broadcasts                                                   | 0                             |
| Testnet seller                                               | UNCHANGED (healthy, chain 97) |
| Agent 1906                                                   | UNCHANGED                     |
| Agent 2005                                                   | UNTOUCHED                     |
| Job 787                                                      | UNTOUCHED                     |
| MAINNET_HIRE_ENABLED                                         | false                         |
| Private key / mnemonic / WALLET_PASSWORD / keystore contents | NOT PRINTED                   |
| Commit / push                                                | 0                             |

Files changed: only this report (`docs/review/X238-PRECHECK-Single-Registration.md`).
No repository code was modified; all verification ran from temp scripts.

---

## READY_FOR_USER_AUTHORIZATION
