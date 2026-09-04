# X.236-P2 — Mainnet Seller Runtime (COMPLETE)

Date: 2026-09-04 — Zero transactions, zero signatures, zero wallet prompts.

## 1. Milestone verdict

**COMPLETE** — The Mainnet seller runtime (`seller-mainnet.ts`) now exists in
`services/v2-mainnet-seller/`, adapted from the PROVEN Testnet seller
architecture (SDK wallet + NegotiationHandler + node http server) and pinned
to chain 56 with the VERIFIED Mainnet address table from `mainnet-config.ts`.
This closes the PARTIAL gap recorded in X.236: a runtime file now exists that
can be started once the user completes the manual prerequisites (keystore
copy, WALLET_PASSWORD, BNB funding, ERC-8004 registration).

No process was started in this milestone — starting the seller requires the
user-provided keystore and password secrets, which do not exist yet. This
milestone delivered the CODE, its safety harness, and its container recipe.

## 2. What was built

### 2.1 `seller-mainnet.ts` (224 lines, chain-56-pinned)

Same architecture as the proven Testnet seller, with Mainnet-specific safety:

| Concern         | Testnet seller (`v2-seller/seller.ts`) | Mainnet seller (`seller-mainnet.ts`)                       |
| --------------- | -------------------------------------- | ---------------------------------------------------------- |
| Chain           | 97 (bsc-testnet)                       | **56 (bnb-mainnet)**                                       |
| Network gate    | `NETWORK !== "bsc-testnet"` → throw    | `NETWORK !== "bnb-mainnet"` → throw                        |
| Keystore dir    | `~/.bnbagent` (default)                | `~/.bnbagent-mainnet` (separate; **never** falls back)     |
| Contracts       | Testnet table (chain 97)               | VERIFIED Mainnet table (chain 56)                          |
| Port            | 3000                                   | 3001                                                       |
| Public endpoint | Funnel :443 → localhost:3000           | Funnel :8443 → localhost:3001                              |
| Hire flag       | always negotiable                      | `MAINNET_HIRE_ENABLED` (default **false**)                 |
| Agent ID        | Agent 1906 (registered)                | `MAINNET_AGENT_ID` (**empty until ERC-8004 registration**) |
| Job watcher     | fundedJobWatcher (chain 97 jobs)       | **none** (no Mainnet jobs exist)                           |

Verified Mainnet address table (from X.218/X.233, all verified live on chain 56):

- Commerce `0xEa4DAa3100A767e86FDed867729ae7446476EBA6`
- Router `0x51895229E12F9876011789B04f8698af06cCD6DA`
- Policy `0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5`
- Registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- $U `0xcE24439F2D9C6a2289F741120FE202248B666666`

### 2.2 Endpoints served

- `GET /health` — safe public info only: `{status, chain: 56, seller, hire, agentId}`.
- `GET /.well-known/agent-card.json` — public card advertising the ERC-8183
  service at the ROOT URL (consistent with the X.220 seller-card lesson — the
  marketplace negotiates at `{registeredEndpoint}/negotiate`).
- `POST /negotiate` — when `MAINNET_HIRE_ENABLED=false` (the default), returns
  a **truthful** unavailable response:
  `accepted: false`, reason "Mainnet hiring is not yet enabled. Commercial
  hire is currently available on BSC Testnet (chain 97) only.", chain 56,
  Mainnet Commerce as verifying contract, `provider_sig: null`, zero-value
  negotiation hash. **No signing occurs in the disabled state.**
  When enabled (future), delegates to the proven `NegotiationHandler`.
- `GET /job/{id}/response` — returns 501 "not implemented for Mainnet (no
  funded jobs exist yet)" — truthful, since no Mainnet jobs exist.

### 2.3 Startup gates (fail-fast, before any server bind)

1. `NETWORK` must be literally `bnb-mainnet` — refuses to start otherwise.
2. `WALLET_PASSWORD` must be present (runtime secret; never committed, never printed).
3. Mainnet keystore must exist at `~/.bnbagent-mainnet/<owner>.json` —
   refuses to start, **never falls back to the Testnet keystore**.
4. Loaded wallet address must equal `MAINNET_OWNER_ADDRESS`
   (`0xB0f7681668f916eEd97dA066D31aA295D34727c0`, the X.235-P2 user decision —
   same public address on both chains; the key pair is chain-agnostic, the
   keystore COPY is separate to avoid shared mutable state).
5. `MAINNET_HIRE_ENABLED=true` requires a non-empty `MAINNET_AGENT_ID` —
   the Mainnet seller refuses to negotiate without a registered identity.

## 3. Fixes applied during this milestone

1. **Syntax error at line 35** — the original draft had
   `resolve(fileURLToPath(new URL(".", import.meta.url), "../..");` (missing
   the closing paren of `fileURLToPath`). Fixed to match the proven Testnet
   pattern: `resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")`.
2. **Prettier formatting** — file reformatted to repo style; `--check` passes.
3. **`tsconfig.json`** — added `allowImportingTsExtensions` (valid because
   `noEmit: true`), matching how the sibling harnesses run under
   `node --experimental-strip-types`. Typecheck now passes.
4. **Standalone install** — `services/*` is outside `pnpm-workspace.yaml`
   (mirroring the proven `v2-seller` layout), so the service carries its own
   `node_modules` via `pnpm install --ignore-workspace` + its own
   `pnpm-lock.yaml`.
5. **`services/v2-seller/seller.ts`** — fixed two pre-existing TS2352 errors
   (`AgentInfo` → `Record<string, unknown>` casts now go through `unknown`)
   and applied prettier. No behavior change; typecheck passes.

## 4. Verification evidence

### 4.1 `seller-runtime.verify.ts` — 35/35 PASS

Chain pinning (56, all five Mainnet contracts, configurable RPC, zero Testnet
addresses), truthful disabled-negotiate response (no `provider_sig`), separate
keystore path + hard-fail + no Testnet fallback, owner address check (same
public address, NOT Agent 1906), wallet-mismatch hard fail, empty
`MAINNET_AGENT_ID` by default, no `registerAgent`/`createJob`/`fund`/`submit`/
`claimRefund`/`setAgentURI` calls anywhere, no `fundedJobWatcher`, port 3001
default, and Testnet-seller invariants unchanged (still gates bsc-testnet,
still chain 97).

### 4.2 Sibling harnesses — all PASS (no regression)

- `mainnet-seller-readiness.verify.ts` — 36/36 (A1–A10 safety invariants,
  G1–G11 gates correctly BLOCKED by design).
- `mainnet-provisioning.verify.ts` — 52/52.
- `mainnet-registration-preview.verify.ts` — preview still BLOCKED on
  placeholders (correct — registration not yet authorized).
- `main-track-user-hire.verify.ts` — ALL PASS (X.224/X.225/X.226/X.234
  chain-aware hire suites, incl. mainnet switch to 0x38, gate-before-negotiate).
- `network-selector.verify.ts` — 63/63.
- `hire.verify.ts` 24/24, `hire.api.verify.ts` 14/14, `p13-review.verify.ts`
  20/20, `x85` 13/13, `x84` 14/14, `x81` ALL, `x80` ALL, `activation.verify.ts`
  33/33, `capability-source.verify.ts` ALL, `main-track-v2.server.verify.ts`
  ALL, `activation.live.verify.ts` READY.

### 4.3 Workspace-level

- `pnpm typecheck` (turbo, 14 tasks) — PASS.
- `pnpm lint` (turbo, 14 tasks) — PASS.
- `pnpm build` (turbo, 8 tasks) — PASS.
- `pnpm test` — 7/8 PASS; the single failure is the **documented pre-existing
  debt** (`x50.infrastructure.verify` check #24, fails on clean HEAD, do not
  modify). No new failures introduced.
- Both seller services typecheck + prettier clean.

## 5. Safety contract (restated)

- ZERO transactions, signatures, or wallet prompts in this milestone.
- The Mainnet seller NEVER falls back to the Testnet keystore.
- `MAINNET_HIRE_ENABLED` defaults to **false**; when false, `/negotiate`
  returns a truthful unavailable response with no signing.
- `MAINNET_AGENT_ID` stays empty until a future user-authorized ERC-8004
  registration on chain 56.
- No private key is ever printed; the keystore is encrypted Keystore V3.
- No `registerAgent`, `createJob`, `fund`, `submit`, `claimRefund`,
  `setAgentURI` call exists in the module.
- The Testnet seller (port 3000, Agent 1906, chain 97) is UNTOUCHED in
  behavior and remains the only live commerce path.

## 6. Remaining blockers before the Mainnet seller can RUN

1. **Keystore copy (user, manual)** — encrypted Keystore V3 for
   `0xB0f768…7c0` must be copied to `~/.bnbagent-mainnet/`.
2. **WALLET_PASSWORD (user, secret)** — runtime env for EVMWalletProvider.
3. **BNB funding (user)** — `0xB0f768…7c0` currently holds 0 BNB on chain 56;
   ~0.001 BNB suffices for gas.
4. **ERC-8004 registration (user-authorized tx)** — `registerAgent(string
agentURI)` on the chain-56 Registry; the registration preview
   (`mainnet-registration-preview.verify.ts`) shows the exact payload.
5. After registration: set `MAINNET_AGENT_ID` (and optionally
   `MAINNET_HIRE_ENABLED=true` only when Mainnet hire is meant to go live).

## 7. Status

**X.236-P2 COMPLETE.** Files remain uncommitted in the working tree alongside
the X.234 chain-aware hire architecture — no commit/push/deploy without
explicit user authorization (HARD STOP).
