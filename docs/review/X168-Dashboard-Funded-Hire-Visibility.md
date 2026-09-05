# X.168 — Dashboard FUNDED-Hire Visibility

## Status

Implemented, verified, and deployed. Zero blockchain transactions.

## Problem

The dashboard showed a static, misleading empty state (`Active agents: 0`,
`Total value: 0.00 BNB`, `Net P&L: 0.00 BNB`, `No agents hired yet`) because it
only recognized ACTIVE/verified activation sessions. A Model-B commercial hire
that is FUNDED on-chain (commercial escrow) — e.g. Agent 2005 "Canned Range
Keeper", Job 787, chain 97, budget 0.001 U — was invisible even though it is a
real, verifiable hire. Model B deliberately never claims ACTIVE.

## Semantics

- **FUNDED** (Model B) = commercial escrow on the chain-97 ERC-8183 commerce.
  It is a real hired position but is **never** called ACTIVE/RUNNING/Managed/
  Autonomous.
- **ACTIVE** (Model A) = managed agent session, only when independently verified.
- The dashboard keeps the existing `Active agents` semantics. A funded-only
  hire yields `Active agents: 0` **and** a separate `Funded hires: N`.

## Implementation

### Data path (read-only)

`apps/web/lib/dashboard/hired-agents.ts` — pure, framework-free resolver:

- connected wallet → pinned chain-97 ERC-8183 commerce job range (bounded
  `maxScan`, newest-first) → `client == wallet` → `status == FUNDED` → valid
  registered provider → agent identity.
- Hard exclusions: malformed job, wrong client, wrong chain, wrong/zero
  provider, OPEN/SUBMITTED/COMPLETED/REJECTED/EXPIRED status.
- Every external read flows through injectable ports (`readJobCount`,
  `readJobs`, `resolveAgent`), so the regression harness is deterministic.
- FUNDED is never coerced into ACTIVE; no performance/session data is
  fabricated; Total value / Net P&L follow the existing product convention
  (`0.00 BNB` / `Not available`) without implying a zero-loss result.

`apps/web/lib/dashboard/hired-agents.server.ts` — live read-only ports:

- PublicNode public RPC for the job counter + ERC-8183 job reads
  (`@bnbagent/sdk` `getJob`, bounded concurrency).
- 8004scan public registry (`listAgents` by `ownerAddress` on chain 97) for
  provider → agent identity.
- No signer, no private key, no raw transaction broadcast anywhere.

`apps/web/app/api/dashboard/hires/route.ts` — authenticated GET feed,
rate-limited (`dashboard.hires` policy), returns the honest dashboard shape.

### UI

`apps/web/app/(app)/dashboard/hired-agents-dashboard.tsx` + updated
`page.tsx`:

- Stat cards: **Active agents**, **Funded hires**, **Total value**, **Net P&L**.
- **Your hired agents**: each FUNDED hire shows agent name, a **FUNDED** badge
  (success variant), `Job #N`, `Amount N.NNN U`, `Network BSC Testnet (chain
97)`, `Provider 0x0eAc…`, `Type: Commercial Hire`. No ACTIVE claim.
- When there are no FUNDED or ACTIVE hires (or no wallet), the existing
  `No agents hired yet` empty state is retained.
- A failed feed shows an honest "Hired agents unavailable — no status was
  assumed" state (never a fabricated hire).

## Regression tests

`apps/web/lib/dashboard/hired-agents.verify.ts` (plain node, all pass):

1. FUNDED Model-B job appears.
2. OPEN job does not appear as hired.
3. ACTIVE Model-A semantics retained (`activeAgents` stays 0).
4. FUNDED never becomes ACTIVE (no fabricated `active` field).
5. Wrong-client job excluded.
6. Wrong-chain job excluded.
7. Wrong-provider job excluded (not-registered and zero-address).
8. Malformed job excluded.
9. No wallet → existing behavior.
10. No funded jobs → empty hired set.
11. Multiple funded jobs → all appear (newest first).
12. Dynamic budget `0.001 U` displayed correctly (data-driven, not 1 U).
13. No hardcoded Agent 2005 / Job 787 in the app surface (static scan).
14. No transaction calls (static scan).
15. No private key material (static scan).
16. Registry-unavailable → hire remains visible with identity degraded.

Run: `pnpm --dir apps/web run dashboard:hires:verify`.

## Regression results

- web typecheck — pass
- web lint — pass
- web next build — pass (`/api/dashboard/hires` route emitted, `/dashboard` renders)
- integrations typecheck — pass
- integrations build — pass
- dashboard:hires:verify — all checks pass
- existing `activation:main-track-user-hire:verify` — all checks pass
- prettier — all X.168 files clean.
  Note: repo-wide `format:check` reports 167 **pre-existing** violations in
  `packages/integrations/src/altana` (untouched by X.168; present on clean HEAD).
- `x50.infrastructure.verify` check #24 (`standalone output and server-external
packages remain configured`) fails on clean HEAD **and** with X.168 changes —
  pre-existing, unrelated to this change (reads `next.config.mjs` / Dockerfile,
  which X.168 does not modify).

## Production verification (read-only)

Expected dashboard for the buyer wallet:

- Active agents: 0
- Funded hires: 1
- Your hired agents: Canned Range Keeper · FUNDED · Job 787 · 0.001 U · BSC Testnet

No false ACTIVE claim. No transaction is sent by the dashboard or its API.

## Deployment

- Commit: `0666ff36ac9acec8a4c40683890839263af8459f` (`0666ff3` "X.168 dashboard
  FUNDED-hire visibility via read-only on-chain state")
- origin/main: `0666ff36ac9acec8a4c40683890839263af8459f`
- Production URL: https://bnb-agent-marketplace-web.vercel.app
- Vercel deployment: auto-deployed from the main-branch push; deployment id
  observed in the response header `x-vercel-id` → `1de9e76f66ae` (segment
  `...-1de9e76f66ae`), served from `bom1::iad1`.
- Deployment status: Ready (production endpoints serve the new build).

### Read-only production verification (no wallet session)

| Check                                  | Result                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                    | 200                                                                                                                                                                             |
| `/marketplace`                         | 200                                                                                                                                                                             |
| `/dashboard`                           | 200; HTML contains "Your hired agents", "Funded hires", "Active agents", "Total value", "Net P&L" (`Net P&amp;L` in HTML), "No agents hired yet" (empty state without a wallet) |
| `/api/dashboard/hires`                 | 200; no-wallet contract `{ok:true,data:{hires:[],activeAgents:0,fundedHires:0,...,totalValue:"0.00 BNB",netPnl:"Not available",connected:false,state:"no-wallet"}}`             |
| `/agents/97:0x8004A818…:2005`          | 200; "Canned Range Keeper", "Hire", "BSC Testnet", "never receives your private key"                                                                                            |
| `/agents/97:0x8004A818…:2005/hire`     | 200                                                                                                                                                                             |
| On-chain Job 787 (PublicNode read)     | `client 0x299Ce411…`, `provider 0x0eAc2F4d…` (Agent 2005 owner), `budget 1000000000000000` (= 0.001 U), `status 1` = FUNDED, chain 97                                           |
| Provider → agent resolution (8004scan) | `registered` → agentId `97:0x8004a818…:2005`, name "Canned Range Keeper", token 2005                                                                                            |

The authenticated buyer-wallet dashboard view cannot be replicated here (the
session cookie lives in the buyer's browser). The verified server feed contract
above plus the passing resolver harness (FUNDED job → shown, activeAgents 0,
never ACTIVE) cover that path. With the buyer wallet
`0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` connected, the dashboard resolves
Job 787 as a funded hire: **Canned Range Keeper · FUNDED · Job 787 · 0.001 U ·
BSC Testnet**, with `Active agents: 0` and `Funded hires: 1`.

Note: an unrelated Job 788 was observed on-chain (different client/provider,
budget 0, FUNDED). It pre-existed; X.168 ran zero transactions and did not
create or modify it.

## Constraints honored

- No transaction created or executed; Agent 2005 not re-hired; Job 788 not
  created; no blockchain state modified.
- No fabricated ACTIVE/session/performance data.
- No hardcoded Job 787 / Agent 2005 — resolved from authoritative on-chain
  state + registry.
- No private key / server custody introduced.
