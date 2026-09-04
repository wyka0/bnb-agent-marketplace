# X.218 — Mainnet ERC-8183 Address Verification (READ-ONLY FORENSICS)

Date: 2026-09-02 · Base: `8318697` (origin/main) · ZERO WRITES — read-only RPC probes only.

## Verdict summary

| Contract                  | Address                                      | Bytecode                                                           | Interface                                                                                    | Live read                                                                                                                                                                                  | Classification                                                    |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Commerce (proxy)          | `0xEa4DAa3100A767e86FDed867729ae7446476EBA6` | EIP-1967 proxy → impl `0xd5f9b570c96b5d67702d508c0bfb8b3b09209787` | 7/7 exact SDK-ABI selectors in impl                                                          | `paymentToken()`, `jobCounter()=56685`, `platformFeeBp()=0`, `platformTreasury()=0x…dEaD`, `getJob(1)` returns a real negotiated job                                                       | **VERIFIED (live kernel)**                                        |
| Router (proxy)            | `0x51895229E12F9876011789B04f8698af06cCD6DA` | EIP-1967 proxy → impl `0xf0cf8f47e5c035f16247ff16e9f367e477ee5007` | 2/2 SDK-ABI selectors (`registerJob(uint256,address)`, `settle(uint256,bytes)`)              | `router.commerce()` → exact Commerce proxy                                                                                                                                                 | **VERIFIED**                                                      |
| Policy (direct)           | `0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5` | 4413-byte direct contract (not a proxy)                            | 2/2 SDK-ABI selectors (`dispute(uint256)`, `disputeWindow()`), `disputeWindow()=604800` (7d) | `policy.commerce()` → Commerce; `policy.router()` → Router (both exact)                                                                                                                    | **VERIFIED**                                                      |
| ERC-8004 Registry (proxy) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | EIP-1967 proxy → impl `0x7274e874ca62410a93bd8bf61c69d8045e399c02` | `name()="AgentIdentity"`, `symbol()="AGENT"`, `ownerOf`, `tokenURI` present in impl          | `ownerOf(45381)` → `0xda977767452c5dd021624511f14df67b6c9c2c1b`; `tokenURI(45381)` → `ipfs://bafkrei…` (the known P12 AAVE agent `56:0x8004a169…:45381` from `lib/activation/contract.ts`) | **VERIFIED (live registry)**                                      |
| $U token (proxy)          | `0xcE24439F2D9C6a2289F741120FE202248B666666` | proxy → impl `0xbef21313c69c009fd7d9510a8d3a481a32473dfc`          | full ERC-20 selector set incl. `DOMAIN_SEPARATOR`                                            | `name()="United Stables"`, `symbol()="U"`, `decimals()=18`, `totalSupply≈9.71e26 wei`                                                                                                      | **VERIFIED (live ERC-20, same identity semantics as testnet $U)** |

## Relationship matrix (all read on-chain, chain 56)

- Commerce → payment token: `paymentToken()` = `0xcE2443…666666` = the SDK's mainnet $U. **CLOSED.**
- Commerce → platform: `platformFeeBp()=0`, `platformTreasury()=0x…dEaD` (the SDK's "dead" treasury is the contract's actual zero-fee placeholder — real config, not stale data).
- Router → Commerce: `router.commerce()` = Commerce proxy. **CLOSED.**
- Policy → Commerce: `policy.commerce()` = Commerce proxy. **CLOSED.**
- Policy → Router: `policy.router()` = Router proxy. **CLOSED.**
- Registry → agents: `ownerOf(45381)` + IPFS `tokenURI(45381)` resolve a real registered agent; token 1 also resolves (`0x89e9…5029`).
- Commerce kernel liveness: `getJob(1)` returns a genuine job — client `0x2BBA…878`, provider `0x0dE5…EE9d`, evaluator = Router, description = negotiated terms JSON (service_type dex-swap, OKX DEX calldata) — **the mainnet kernel is in real production use with ~56,685 jobs created**.

## RPC evidence

- RPC: `https://bsc-rpc.publicnode.com` (PublicNode mainnet — same provider family as the verified testnet RPC).
- `eth_chainId` = `0x38` (56) ✅ · latest block ≈ 119,416,058 (live).
- Cross-checked with `https://bsc-dataseed.bnbchain.org` (official BNB dataseed): chainId `0x38` consistent.
- Historical (archive) queries unavailable on the free tier — irrelevant to verification.

## Testnet comparison (calibration)

- Testnet Commerce `paymentToken()` → `0xc70B8741…5565` (matches SDK testnet table) — proves `paymentToken()` is the authoritative wiring read on both chains.
- Testnet `jobCounter()` = 877 vs mainnet 56,685 — mainnet is the heavily-used deployment.
- Stale-policy trap check (the testnet lesson): mainnet Policy is a direct contract whose `dispute`/`disputeWindow` interface works AND whose `commerce()`/`router()` pointers resolve exactly — i.e., mainnet policy is wired to the live system, NOT stale. The SDK mainnet policy address agrees with on-chain reality.
- Raw `eth_call getJob` reverts were observed on BOTH chains (encoding artifact of raw calls against this kernel); the SDK client decodes correctly — testnet `getJob(787)` via raw call also reverts, so this is not a mainnet anomaly.

## SDK table audit

- `@altananetwork/sdk@0.7.0` `dist/erc8183.js` `ERC8183_ADDRESSES[56]` and `@bnbagent/sdk@0.5.1` `dist/chunk-OXNQ6HN7.js` `BNB_CHAIN_ADDRESSES[56]` — **both agree** with each other AND with on-chain reality (proxy impl slots exactly match the tables' `commerceImpl`/`routerImpl`; live getters return the tables' addresses).
- Classification: **VERIFIED deployment data** (not placeholder/stale), per the on-chain evidence above.
- Repo usage today: NONE of these mainnet addresses are wired into application code; the only mainnet-registry reference is the P12 AAVE agent ID (`lib/activation/contract.ts:3`), which this audit independently confirmed live.

## Production safety

- The addresses are real, live, cross-referenced, and interface-compatible.
- HOWEVER: production wiring still requires the X.217 P0 blockers to clear (durable seller, provider identity, chain-parameterized hire code). Do NOT wire these addresses into production until those milestones land. This audit verifies EXISTENCE + RELATIONSHIPS + LIVENESS, not marketplace operational readiness.

## Probes performed (all read-only)

`eth_chainId`, `eth_blockNumber`, `eth_getCode`, `eth_getStorageAt` (EIP-1967 slots), `eth_call` (paymentToken, jobCounter, platformFeeBp, platformTreasury, name, symbol, decimals, totalSupply, DOMAIN_SEPARATOR, disputeWindow, commerce, router, ownerOf, tokenURI, getJob). ZERO state-changing calls. No wallet. No keys.

## Safety

TRANSACTIONS: 0 · SIGNATURES: 0 · JOBS CREATED: 0 · SWAPS/APPROVALS/LIQUIDITY: 0 · CREATE/REGISTER/SETBUDGET/FUND/SUBMIT/REJECT/COMPLETE/CLAIMREFUND: 0 · JOB 787: UNTOUCHED · AGENT 2005/1906: UNTOUCHED · AGENTENDPOINT: UNCHANGED · WALLET: NOT USED · PRIVATE KEYS: NONE · Application source: UNCHANGED (this file is the only addition, untracked).
