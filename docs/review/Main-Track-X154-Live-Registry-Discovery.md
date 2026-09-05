# X.154 Live Registry Discovery Repair

**Mode:** READ-ONLY investigation + registry-discovery code fix (data-normalization layer only) + authorized production deployment. **ZERO blockchain transactions, zero registerAgent/updateAgent, zero new wallets/jobs, zero AWS/KMS, zero production private keys, no fabricated agents.**

**Git boundary:** `HEAD` = `origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` (unchanged; discovery changes are uncommitted working-tree edits; no commit, no push).

---

## 1. Root cause

The production registry discovery layer excluded BSC Testnet (chain 97) agents at **three independent gates**, plus a fourth casing gate:

1. `marketplace.ts` `getMarketplaceAgents` / `getMarketplaceAgentBySlug` passed **`isTestnet: false`** → the 8004scan API filters out every testnet record (Agent 1906 is `is_testnet: true`). Verified directly: `search=…&isTestnet=false` → 0 records; `search=…` (no flag) → 1 record `97/1906`.
2. `discovery/service.ts` `getBscCategoryDiscovery` / `getBscCategoryPage` used **`chainId: 56, isTestnet: false`** (`BSC_DISCOVERY_CHAIN_ID = 56`).
3. `classifier.ts` `includeInBscDiscovery` = **`chainId === 56 && isTestnet === false`** (chain-97 testnet returns false — asserted by an old test).
4. `pickAgentBySlug` did an **exact case-sensitive** identity match — a checksummed detail slug (`97:0x8004A818…:1906`) never matched the API's lowercase `agent_id` (`97:0x8004a818…:1906`).

So Agent 1906 (a real, indexed chain-97 testnet agent) disappeared: excluded by the chain filters and then failed the casing match on detail lookup.

## 2. Discovery source

The marketplace uses the **8004scan public API** (`https://8004scan.io/api/v1/public/agents`) through the server-only typed client (`client.ts`, key `E8004SCAN_API_KEY` / `8004SCAN_API_KEY`), normalized by `normalize.ts`, surfaced by `marketplace.ts` + `discovery/service.ts`. No alternative source is authoritative for the marketplace; 8004scan is the verified source and it **does** index chain 97.

## 3. Agent 1906 direct verification (read-only)

- `search=97:0x8004A818…:1906` → 1 record: `agent_id='97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1906'`, chain 97, token 1906, owner `0xb0f7681668f916eed97da066d31aa295d34727c0`, `is_testnet=True`.
- On-chain registry (read-only): wallet == owner == seller `0xB0f768…`, agentURI card's A2A endpoint = expired `flux-management-helps-attended.trycloudflare.com` (stale).

## 4. Production feed behavior (before the fix)

`/agents` (static placeholder page) always showed "No agents"; `/marketplace` and category pages returned only `isTestnet:false` records (mainnet chains), so no BSC testnet agent appeared and the chain-97 detail 404'd.

## 5. Fix (registry discovery / data-normalization layer only)

- `classifier.ts`: `includeInBscDiscovery` → `(chainId===56 && isTestnet===false) || (chainId===97 && isTestnet===true)`.
- `discovery/service.ts`: added bounded `listBscAgents` (queries BOTH BNB chains 56+97 and merges; ≤2 requests per keyword); `getBscCategoryDiscovery` and `getBscCategoryPage` use it; `BSC_DISCOVERY_CHAIN_IDS = [56, 97]`.
- `marketplace.ts`: `getMarketplaceAgents` merges a chain-97-testnet query; `getMarketplaceAgentBySlug` omits `isTestnet` (exact identity search — the slug IS the identity).
- `pickAgentBySlug`: case-insensitive identity match (addresses are case-insensitive on-chain).
- Tests updated: `discovery.verify.ts`, `x53.category.verify.ts`, `marketplace.verify.ts` (+ case-insensitivity regression).

No fabricated agents/resources/executionCapability/skills/performance/TVL/APR; no changes to session-gate, capability-source, consent, Model A, Model B semantics, wallet custody, ERC-8183 contracts, or the transaction executor.

## 6. Four-category verification (live, post-deploy)

`/categories/{rebalancing,grid-trading,yield,health-factor}` all return 200 and surface real `/agents/` links (rebalancing 98, grid-trading 44, yield 78, health-factor 56) — no longer empty.

## 7. Agent detail verification (live, post-deploy)

`/agents/97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1906` (and the checksummed casing) now returns **200** and renders: **"BNB Agent Studio v2 Testnet Seller"**, owner `0xB0f768…`, **BSC Testnet**, and the **Hire** CTA (1 U). (Earlier 404s during verification were CDN edge-cache artifacts for the specific URLs; a fresh request resolves.)

## 8. Seller endpoint status

Agent 1906's registered endpoint remains the **expired trycloudflare URL → STALE/UNREACHABLE**. The agent is now honestly visible with that data-quality state (identity VERIFIED, chain 97, owner VERIFIED, endpoint STALE). The Hire CTA remains available and fails closed if the seller endpoint is unreachable. **SELLER HOST = REMAINING OPERATOR BLOCKER** (separate milestone; Vercel is unsuitable for the keystore-backed seller).

## 9. Build / test results

- Web: typecheck PASS · lint PASS · `next build` Compiled successfully.
- Integrations: typecheck PASS · lint PASS · build PASS.
- Suites (all pass): marketplace (84) · discovery · categories:x53 (22) · activation (33) · hire (23/23) · hire-api (14) · capability-source · main-track-v2 (X.131) · main-track-user-hire (X.149) · main-track-user-wallet (X.139/X.134/X.137/X.142/X.144/X.146) · main-track-hire (X.130) · hire-adapter (X.127) · ERC-8183.
- Prettier clean.

## 10. Production deployment result

Deployed the registry-discovery fix to the existing Vercel project (`bnb-agent-marketplace-web`) — production alias live. Verified live: `/marketplace` surfaces chain-97 agents (178 `97:0x…` references, 41 "BSC Testnet", 0 "No agents"); Agent 1906 detail resolves with seller/owner/Hire; four categories surface agents; `/api/activation/main-track-hire` remains live and fail-closed; security headers unchanged.

## 11. Git status

`HEAD`/`origin/main` = `850454da…` (unchanged). Working-tree modifications (uncommitted): `eight004scan/discovery/{classifier,service,p9-audit,discovery.verify,x53.category.verify}.ts`, `eight004scan/{marketplace,marketplace.verify}.ts`. No `.env`/keystore/wallet/password/credential staged. No commit, no push.

## 12. Remaining submission blockers

1. **Durable seller host (operator action)** — Agent 1906's endpoint is stale until a durable host (VM/VPS, X.152 Docker package) is provisioned; then one `registerAgent` re-point (~622k gas, not broadcast).
2. **X.148-class broadcast infrastructure behavior (E)** — gating a live funded Hire, outside this milestone.

## Classification

**A — AGENT DISCOVERY LIVE.**

The registry discovery layer now surfaces real BSC Testnet agents: Agent 1906 is discoverable and its detail page renders the verified seller identity with an honest STALE endpoint state and a fail-closed Hire CTA; the marketplace and all four categories show real registry data; the fix is deployed to production, fully tested, and involves no fabricated data and no blockchain transactions. Remaining work is operator-side (durable seller host) and the documented X.148 infrastructure behavior. **STOP.**
