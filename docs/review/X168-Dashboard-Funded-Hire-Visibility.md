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

## Constraints honored

- No transaction created or executed; Agent 2005 not re-hired; Job 788 not
  created; no blockchain state modified.
- No fabricated ACTIVE/session/performance data.
- No hardcoded Job 787 / Agent 2005 — resolved from authoritative on-chain
  state + registry.
- No private key / server custody introduced.
