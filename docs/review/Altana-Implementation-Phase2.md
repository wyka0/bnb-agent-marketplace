# Altana — Implementation Report · Phase 2 (Setup + Adapter + Verification)

**Phase:** 2 — Implementation of the Altana foundation.
**Status:** COMPLETE — `ALTANA STATUS: READY FOR IMPLEMENTATION`
**Date:** 2026-08-09
**Precedes:** Altana session/ERC-8183/x402/skills phases (documented boundaries below, NOT implemented).
**Validated against:** `docs/review/Altana-Integration-Discovery.md` and `@altananetwork/sdk` 0.7.0.

---

## 1. SDK Package / Version

| Package              | Version in workspace         | Reason                                                                               |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| `@altananetwork/sdk` | `0.7.0` (exact)              | Official SDK; matches docs (`changelog` describes 0.7.0 as current).                 |
| `viem`               | `^2.21.0` (resolved 2.55.11) | Declared **peer dependency** of the SDK; companion transport/types for the adapter.  |
| `ox`                 | `^0.14.0` (resolved 0.14.33) | Declared **peer dependency** of the SDK (required, `peerDependenciesMeta` is empty). |
| `porto`              | `0.2.37` (exact)             | Declared **peer dependency** of the SDK (required).                                  |

Sources: `pnpm view @altananetwork/sdk` → `peerDependencies = { ox: '^0.14.0', porto: '0.2.37', viem: '^2.21.0' }`, `dist-tags.latest = 0.7.0`. No optional peers (`peerDependenciesMeta` empty), so all three peers are installed. **Not installed:** `@altananetwork/mcp`, `@altananetwork/x402-server`, `hypersigner-keystore-mcp` (not needed for this phase; MCP is also Bun-only per docs).

The SDK exports (verified from installed `dist/index.d.ts`): `createClient`, `BNB`, `BNB_TESTNET`, `ETHEREUM`, `BASE`, `signerFromPrivateKey`, `balances`-enabled `Client`, `ERC8183_ADDRESSES`, x402 helpers, and session functions — all confirmed present. The adapter uses only **createClient + balances (read)** this phase.

---

## 2. Files Changed

### Added

- `packages/integrations/src/altana/client.ts` — server-safe adapter facade (`createAltanaClient`, `validateAltanaConfiguration`, `getAltanaStatus`, `checkAltanaReadonly`, types, `AltanaConfigError`).
- `packages/integrations/src/altana/verify.ts` — read-only verification runner (QA gate, exit code 0/1).
- (generated) `packages/integrations/dist/altana/{client,verify,index}.{js,d.ts}`.

### Modified

- `packages/integrations/src/altana/index.ts` — updated module header; preserves the session-level `AltanaAdapter` interface contract + `ALTANA_ADAPTER_NOT_IMPLEMENTED`; now re-exports `./client.js`.
- `packages/integrations/package.json` — added the four SDK deps + `"altana:verify": "node dist/altana/verify.js"`.
- `packages/config/src/env.ts` — added **server-only** `ALTANA_NETWORK` (default `"bnb-testnet"`) and `ALTANA_RPC_URL` (optional) to the Zod env schema.
- `pnpm-lock.yaml` — dependency resolution (+23 packages).

### Untouched (per constraints)

Frozen UI (Marketplace / Agent Details / Navigation / Compare / Leaderboards), `apps/web` (does not import integrations), `packages/ui`, Hire UI, worker logic, prisma.

---

## 3. Adapter Architecture

Everything lives under the existing `packages/integrations/src/altana/` extension point (no second package).

```
@bnb-marketplace/integrations (src/altana/)
  index.ts    session-level contract (AltanaAdapter) [future]  +  re-export client.js facade
  client.ts   createAltanaClient        → SDK createClient({ chains:[NetworkConfig] })
              validateAltanaConfiguration(input) → { ok:true; client; config } | { ok:false; errors[] }
              getAltanaStatus(client, { probe? }) → resolved network/config snapshot
              checkAltanaReadonly(client, { probeAddress? }) → plain-balance read, best-effort
  verify.ts   CLI proof: config validation + testnet default + read-only probe
```

Key design decisions:

- **Defaults to BNB testnet (chain 97) always** — `network ?? env?.ALTANA_NETWORK ?? "bnb-testnet"`. Mainnet requires an explicit opt-in (`network: "bnb"`); there is no code path that defaults to 56.
- **Network/chain-id consistency is validated** — `defaultChainId` must match the selected network (56 ↔ `bnb`, 97 ↔ `bnb-testnet`); mismatches throw `AltanaConfigError` / are collected as validation errors.
- **RPC override clones the network config** (`{ ...networkConfig, publicRpcUrl }`) — honored per the SDK's documented "Override per-environment if needed."
- **No SDK naming invented** — `createClient` (SDK) is wrapped behind the requested facade names; status/probe are adapter-level facades, not SDK functions (the SDK exposes no such functions).
- **Reads derive from the SDK's real config** (`client.chains[0].keyStore`, `.keyStoreController`, `.publicRpcUrl`, `.explorer`, `.relayUrl`) — no hardcoded addresses in the adapter.

---

## 4. BNB Testnet Configuration

- Target: **BNB Smart Chain Testnet, chain id 97**, via the SDK's ready-made `BNB_TESTNET` config.
- Verified at runtime: `defaultChainId 97`, `keyStore 0x6b8361C29d05D498b1a12B54A37310f94171E94A` (matches `docs.altana.network/concepts/networks/testnet`), public RPC `https://bsc-testnet-rpc.publicnode.com`, relay `https://testnet-relay.altana.network`.
- `ALTANA_NETWORK` env default is `"bnb-testnet"`; explicit `"bnb"` (56) is allowed but never the default.
- No faucet/funding was requested; the probe reads the zero address's native balance (a grant, not a spend).

---

## 5. Server / Client Boundary

- The adapter and all SDK imports are **server-safe** and live only in `packages/integrations` (a server library). `apps/web` does not import the integrations package (verified by grep), so the SDK never enters the browser bundle.
- Env additions are **server-only** (`ALTANA_NETWORK`, `ALTANA_RPC_URL` — no `NEXT_PUBLIC_` prefix), consistent with the existing `8004SCAN_API_KEY` precedent in `packages/config/src/env.ts`.
- No private keys, session secrets, wallet credentials, or x402 credentials are introduced, exposed, or required this phase.
- `checkAltanaReadonly` is a plain `eth_getBalance` (via SDK `balances`): no signer, no userOp, no relay, no transaction. It would throw without a signer on any write attempt, which is the guardrail.

---

## 6. Read-Only Verification Method

`pnpm --filter @bnb-marketplace/integrations altana:verify` runs `node dist/altana/verify.js` (after `pnpm build`). It proves:

1. **Config validation (offline):** `bnb-testnet` resolves to chain 97; `bnb` resolves to 56; mixed network/`defaultChainId` and unknown networks (`"mainnet"`) and non-http `rpcUrl` are rejected.
2. **Default construction:** `createAltanaClient()` yields `defaultChainId === 97` (never mainnet).
3. **SDK identity:** `@altananetwork/sdk@0.7.0`, `configured=true`.
4. **Read-only probe (best-effort):** native balance of the zero address on chain 97. RPC outage downgrades to `SKIP ... (network read, not a failure)` and still exits 0.

Exit policy: `1` = integration/config failure (the gate); `0` = ready. Executed result:

```
ok   network=bnb-testnet chainId=97 keystore=0x6b8361C29d05D498b1a12B54A37310f94171E94A
ok   validation rejects unknown networks, mismatched chainIds, bad rpcUrls
ok   sdk=@altananetwork/sdk@0.7.0 configured=true defaultChainId=97
ok   readonly probe (chain 97) nativeBalanceWei=10863790441323524860563
ALTANA STATUS: READY FOR IMPLEMENTATION      (exit 0)
```

**Windows note (QA):** calling `process.exit()` immediately after an HTTP request through the global `fetch` triggers a libuv crash (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src/win/async.c; exit 0xC0000409`) on this Node build. Reproduced with a bare `fetch` + `process.exit(0)`. The verify runner therefore sets `process.exitCode` and lets Node exit naturally (clean, ~0.6s, exit 0).

---

## 7. Future Boundary — Sessions (NOT IMPLEMENTED)

The `AltanaAdapter` interface in `packages/integrations/src/altana/index.ts` is the compile-time contract for the real session phase. Preserve these documented invariants:

- **Session shape:** SDK `Session = { walletAddress, signer, publicKey, permissions, expiry }`; `SessionPermissions = { calls?: CallPermission[], spend?: SpendPermission[] }`; spend `limit` in smallest token unit with **18 decimals on BNB Chain vs 6 on Ethereum**.
- **Byte-exact persistence:** `permissions + expiry + publicKey` must round-trip verbatim (bigint-safe JSON; key reordering/math breaks execute).
- **Least privilege:** `calls` omitted = unrestricted; always set `calls` + `spend`; scope from the skill's address table (future phase).
- **`register` flag:** on-chain KeyStore registration is default; `register: false` for ephemeral keys.
- **`isValidKey(wallet, keccak256(pubkey))`/`getKeys`** remain the free, vendor-free verification reads.
- **Signer env var** (`ALTANA_ADMIN_PRIVATE_KEY` or secret-manager reference) is intentionally **absent** this phase; add it in the session phase only.

## 8. Future Boundary — ERC-8183 (NOT IMPLEMENTED)

Documented for the next phase (from `docs.altana.network/sdk/erc8183` and SDK exports):
`hireErc8183Agent` (atomic relay intent: createJob → registerJob → setBudget → approve $U → fund; supports the session-key path), `getErc8183Job` (OPEN → FUNDED → SUBMITTED → COMPLETED), `getErc8183DeliverableUrl` + manifest verification (`job.deliverable` = keccak256 of manifest), `settleErc8183Job` (`approve` / `dispute`), `buildClaimRefundCall(chainId, jobId)` (after-expiry refund), `ERC8183_ADDRESSES` for BSC 56 and testnet 97. No ERC-8183 calls exist in the adapter yet.

## 9. Future Boundary — Skills (NOT IMPLEMENTED)

The six hackathon protocols (Aave, Venus, PancakeSwap, Lista, Token Radar, Copy Trade) are **official Altana Skills Registry skills** (`github.com/altananetwork/skills`): `aave-v3-lending`, `venus-lending`, `pancakeswap-trading`, `pancakeswap-liquidity`, `lista-staking`, `dexscreener-token-radar`, `copy-trade` (plus `wallet-tracker`, `x402-payments`, `four-meme`). None are added as marketplace integrations; the capability phase will scope sessions from the skill address tables and (optionally) consume `search_skills`/`get_skill` server-side (sha256-checked). Research skills pair with a **zero-scope session**.

## 10. Future Boundary — x402 (NOT IMPLEMENTED)

**Recorded requirement for the future phase:** `fetchWithX402` must run **server-side only** — third-party x402 endpoints often omit `X-PAYMENT` from CORS `Access-Control-Allow-Headers` (documented browser limitation). Rails: `permit2-exact` (any token approved to Permit2; includes B402) and `exact`/EIP-3009; one-time provisioning via `approveTokenForPermit2` + `approveSignatureChecker`; envelope must carry a `resource` for b402 merchants; seller side would use `@altananetwork/x402-server` (`createX402Merchant` + `guard`). Nothing is implemented.

---

## 11. Dependencies

Runtime (added to `packages/integrations/package.json`): `@altananetwork/sdk@0.7.0`, `viem@^2.21.0`, `ox@^0.14.0`, `porto@0.2.37`. No unrelated packages installed; no existing dependency upgraded (the four were newly introduced). Lockfile updated via `pnpm`. Node ≥ 20 (root engine) and current Node 24 both work with the SDK in ESM.

---

## 12. Security Considerations

1. **No secrets this phase** — no private keys, API keys, or credentials introduced or required for read-only verification. Altana needs no API key.
2. **Server-only surface** — adapter lives in a server package; web bundle excludes it; Altana env stays non-`NEXT_PUBLIC_`.
3. **Testnet-first default** — no code path defaults to mainnet; chain-id vs network mismatches are rejected.
4. **Read-only muscle memory** — the sole on-chain action is `eth_getBalance` on the zero address; any write attempt would throw (no signer present).
5. **No session/spend/stake created** — matches the intent "Do not create production sessions." Per the discovery doc, future session rules (byte-exact persistence, 18-vs-6 decimals, least-privilege allowlists, `isValidKey` verification, instant revocation) remain the invariants for the session phase.

---

## 13. Validation Run

```
pnpm lint       → 12/12 tasks successful (incl. config, integrations, worker, web)
pnpm typecheck  → 12/12 tasks successful
pnpm build      → 7/7 tasks successful (incl. Next.js 15.5.23 web production build)
altana:verify   → READY, exit 0 (see §6)
```

No blockers encountered. The SDK initialized and performed a read-only probe against the public BNB testnet RPC as documented.
