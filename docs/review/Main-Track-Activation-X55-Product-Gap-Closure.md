# X.55 Product Gap Closure

- **Date:** 2026-08-15
- **Baseline:** X.54 (four categories PARTIAL; 298 offline checks PASS)
- **Scope:** Product gap closure only. No AWS/KMS/Neon/Vercel work, no blockchain transaction, no mainnet, no Agent 1816 / Job 515 change, no commit/push.
- **Headline:** Two real defects fixed (Prisma engine packaging; misleading error status) and one genuine feature gap closed (public x402 requirement selection). Three categories **cannot honestly reach PASS** — the audit proved no data source in this repository can supply the required metrics.

## The decisive audit finding

Before implementing anything I audited whether any existing integration could legitimately supply yield or lending data. The result determined what could honestly change:

| Capability | Verdict | Evidence |
|---|---|---|
| APR / APY | **DOES NOT EXIST** | `pancakeswap/client.ts:243-244` hardcodes `apr: null, apy: null`; the V2 `PAIRS_QUERY` selects `reserveUSD`/`volumeUSD` only |
| Fee revenue (`feesUSD`) | **DOES NOT EXIST** | repo-wide grep for `feesUSD`/`pairDayData`/`poolDayData` → zero matches |
| 24h / daily volume | **DOES NOT EXIST** | `volumeUSD` is cumulative lifetime only |
| Any other DeFi data client | **DOES NOT EXIST** | no DefiLlama / Beefy / Venus / CoinGecko / Binance / DexScreener anywhere |
| Aave lending data | **DOES NOT EXIST** | the MCP client calls exactly one tool, `getAaveV3SupportedChains`, returning `{chainId, chainName}[]` |
| Health factor / balances | **DOES NOT EXIST** | no `getUserAccountData`, no lending ABI; only `eth_getBalance` (native BNB) exists |

A trap worth recording: `packages/integrations/src/pancakeswap/index.ts` declares an `LpPool` interface with `apr`, `apy`, `volume24hUsd`. It is **dead interface-only scaffolding** marked `PCS_ADAPTER_NOT_IMPLEMENTED` — building on it would have produced fabricated metrics with no source.

**Conclusion:** APR/APY, 24h windows, and health factors could only have been produced by estimation. I did not estimate them.

## What I fixed

### 1. Prisma engine packaging — the X.54 local 500 (FIXED)

**Root cause found, not guessed.** The Windows query engine existed in the pnpm virtual store, but Next.js build tracing never copied it into the output. Its search paths were `apps/node_modules/...` (wrong nesting level, a pnpm artifact) and `apps/web/.prisma/client`. Before the fix, `.next/standalone` contained **no** engine and every build logged `PrismaClientInitializationError` twice.

**Fix:** an explicit generator `output = "../prisma/generated/client"`, so the client and native engine are emitted inside the workspace package on a traceable path, and `prisma/src/client.ts` imports from there.

**Security architecture unchanged:** the client is still `server-only`, still blocked from browser bundles by the package `browser` map. Only the artifact location moved.

**Evidence:**

```text
before: .next/standalone → NO engine; build logged PrismaClientInitializationError ×2
after : .next/standalone/prisma/generated/client/query_engine-windows.dll.node present
        build log: no PrismaClientInitializationError
        standalone runtime log: no Prisma init error
```

Also added `prisma/generated/` to `.gitignore` — it is a regenerated build artifact and is confirmed untracked.

### 2. Misleading error status (FIXED)

With the engine fixed, `/api/altana/session` still returned **500** because `ALTANA_TESTNET_PRIVATE_KEY` is absent here, so the service cannot be constructed. A 500 implies the request failed; the truth is the capability is not configured.

Now classified as **503** with `"Altana session support is not configured on this deployment."` The message never names the variable or leaks internals (verified by check 6). Database failure still maps to 503, unknown failure still to a generic 500.

**Verified on the standalone server:**

```text
/api/altana/session => 503 {"ok":false,"error":{"message":"Altana session support is not configured on this deployment."}}
```

Note: my first attempt tested with `next start`, which Next warns is invalid under `output: standalone`. I re-ran against `.next/standalone/apps/web/server.js` — the correct target.

### 3. x402 requirement selection (CLOSED)

The audit found the smallest legitimate missing feature: `parsePaymentRequired` was public, but the official `selectX402Requirement` was reachable only inside the integrations package. A caller could parse a 402 challenge and then had **no supported way to choose an option**.

Added `selectPaymentRequirement()` — pure, offline, delegating to the official SDK selector, reusing the same chain-97 guard. It signs nothing, submits nothing, needs no session/signer/key/network. Mainnet and unknown chains are refused. Both execution boundaries (`X402_EXECUTION_REQUIRES_SESSION`, `assertX402SellSideBoundary`) remain intact.

While testing this I found my own fixture was wrong, not the code: the SDK's `resolveRail` accepts scheme `"permit2"` / `"exact"` or `extra.assetTransferMethod`, so a bare `scheme: "permit2-exact"` is unresolvable. I corrected the fixture to a real challenge shape rather than loosening the assertion.

## Main Track status

### Rebalancing — PARTIAL

1. **What works:** live 8004scan BNB-Chain discovery with per-match registry evidence; live PancakeSwap TVL, reference price (`token0Price`), liquidity depth; capability, decision signals, five stated risks; analysis-only labelling; activation path.
2. **What is missing:** execution (no rebalance is performed); rebalance cost context (gas/route depend on the executing account).
3. **Why not PASS:** the category cannot act. Marking PASS would imply automated rebalancing exists.
4. **Exact dependency:** Altana remote-signer custody (X.52 blocker) plus a scoped permission design.

### Grid Trading — PARTIAL

1. **What works:** discovery + evidence; real cumulative swap counts (grid fills depend on two-way activity); strategy/risk framing; explicit ANALYSIS-vs-EXECUTION separation.
2. **What is missing:** grid range (no price-history source), and any execution engine.
3. **Why not PASS:** no orders can be placed and no range can be derived without estimating — both would be fabrication.
4. **Exact dependency:** a verified price-history/OHLC source for range guidance, plus an execution engine with scoped permissions.

### Yield Optimisation — PARTIAL

1. **What works:** discovery + evidence; real TVL, cumulative volume, swap counts, spot price; a turnover ratio that is an exact arithmetic identity over two real values; per-pool comparison table.
2. **What is missing:** APR/APY and any 24h window.
3. **Why not PASS:** yield is the defining metric of this category and no source publishes it. Estimating it from TVL and cumulative volume would be invented data.
4. **Exact dependency:** a source that genuinely publishes fee/emission data (e.g. PancakeSwap `pairDayData`/`feesUSD` via a subgraph that exposes them, or an official yield API).

### Health Factor Monitoring — PARTIAL

1. **What works:** agent discovery is fully functional; capability, thresholds-to-check, five risks; **AGENT CAPABILITY is explicitly distinguished from USER POSITION DATA**; renders zero pools and all-null signals by design.
2. **What is missing:** any account-specific lending position — no supplied/borrowed balances, no health factor, no liquidation threshold.
3. **Why not PASS:** the repo has no lending integration at all. The Aave MCP returns only a chain list, and its user-data tools failed live (`JSON-RPC -32603`, recorded in P13b). Synthesizing a health factor is explicitly forbidden.
4. **Exact dependency:** a lending-market reader (Aave/Venus `getUserAccountData` or equivalent) scoped to a connected account.

## Partner tracks

| Track | Status | Basis |
|---|---|---|
| PancakeSwap | **PARTIAL** | Real read-only intelligence integrated into three categories (TVL, price, swap activity, turnover). Still no APR/APY source. Safety intact: `server-only` barrier, no signer, no swap, no approval, zero `MAX_UINT`, no unbounded spend, no hidden execution. |
| TermiX | **PARTIAL** | Template verified to record 3 tasks × 2 arms with time/cost/output/quality; ≥1 trading-or-security task required; still banner-marked "NO RESULTS RECORDED YET". No measurement invented. |
| Altana | **PASS** | X.46 evidence preserved; no new transaction; custody/security boundaries untouched. |
| ERC-8004 / 8004scan | **PASS** | Bounded discovery reused, not duplicated. Malformed rows dropped, missing credential → honest state, empty → `empty`, rate-limit → honest state, source timestamps rendered. |
| ERC-8183 | **PASS** | Job 515 evidence preserved and untouched. |
| x402 / B402 | **PARTIAL** | Parse + scheme/rail validation + review/consent + **new public requirement selection** all work offline. Payment execution and sell-side settlement still throw by design (no session, no facilitator). |

## Infrastructure

| Item | Status |
|---|---|
| PostgreSQL | **BLOCKED** (no credentials; unchanged) |
| KMS | **BLOCKED** (no AWS identity; unchanged) |
| Vercel | **BLOCKED** (no project/token; unchanged) |
| Production smoke test | **BLOCKED** (nothing deployed) |

## Verification

| Gate | Result |
|---|---|
| `pnpm prisma validate` | PASS |
| `pnpm prisma generate` | PASS (now emits into the workspace) |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (exit 0; **no PrismaClientInitializationError**) |
| `pnpm test` | **PASS (exit 0) — 320 checks** |
| `pnpm audit` | PASS — no known vulnerabilities |

```text
X.42 PASS · X.43 PASS · X.44 PASS · X.45 25/25 · X.47 63/63
X.49 25/25 · X.50 34/34 · X.53 21/21 · X.54 23/23 · X.55 22/22
```

### Route verification (standalone server, the correct target)

```text
/                          => 200
/categories/rebalancing    => 200
/categories/grid-trading   => 200
/categories/yield          => 200
/categories/health-factor  => 200
/api/auth/me               => 200
/api/altana/session        => 503 "not configured on this deployment"
```

### Generated-HTML fabrication scan

```text
no numeric APY rendered          no numeric APR rendered
no numeric health factor         no performance/backtest claim
no "coming soon"
present: Unavailable · Intentionally not shown ·
         Analysis / recommendation only · Risks and limitations
```

## Files changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Generator `output` → workspace path (fixes engine tracing) |
| `prisma/src/client.ts` | Import from workspace-generated client; still `server-only` |
| `.gitignore` | Ignore `prisma/generated/` build artifact |
| `packages/integrations/src/altana/x402.ts` | **New** public `selectPaymentRequirement()`; imports SDK selector |
| `apps/web/lib/altana-session/api.ts` | Misconfiguration → 503 with a safe message |
| `apps/web/lib/security/x55.gap.verify.ts` | **New** 22-check gap-closure verifier |
| `apps/web/package.json` | Registered X.55 verifier in `test` + `security:x55:verify` |
| `docs/review/Main-Track-Activation-X55-Product-Gap-Closure.md` | This report |

X.54 category code was left intact — no unnecessary rewrites.

## Remaining gaps

1. **Yield APR/APY** — needs a source that publishes fee/emission data.
2. **Health factor** — needs a lending-market reader for a connected account.
3. **Grid range** — needs a verified price-history source.
4. **Execution** (rebalance/grid) — needs Altana custody + scoped permissions.
5. **x402 payment execution** — needs a Session; sell side needs a facilitator EOA.
6. **TermiX** — 3×2 measurements must be run by a human operator.
7. **Infrastructure** — PostgreSQL, KMS, Vercel (X.52 blockers).

## Final status

```text
X.55 STATUS: PASS WITH FINDINGS

MAIN TRACK
  Rebalancing:              PARTIAL
  Grid Trading:             PARTIAL
  Yield Optimisation:       PARTIAL
  Health Factor Monitoring: PARTIAL

PARTNER TRACKS
  PancakeSwap:        PARTIAL
  TermiX:             PARTIAL
  Altana:             PASS
  ERC-8004/8004scan:  PASS
  ERC-8183:           PASS
  x402/B402:          PARTIAL

INFRASTRUCTURE
  PostgreSQL: BLOCKED
  KMS: BLOCKED
  Vercel: BLOCKED
  Production smoke test: BLOCKED

VERIFICATION
  Build: PASS
  Tests: PASS (320 checks)
  Audit: PASS

MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
COMMIT: NO
PUSH: NO
```
