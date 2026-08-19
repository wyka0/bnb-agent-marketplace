# Reproducing the TermiX Agent Advantage Measurements

Another evaluator can reproduce all three comparisons with the steps below.
Numbers will differ slightly (network variance); the *relative* findings about
provenance, chain safety, and false-positive suppression should not.

## 1. Prerequisites

| Requirement | Value used in the recorded run |
|---|---|
| Node | v24.14.1 (needs `--experimental-strip-types`) |
| pnpm | 9.15.9 |
| Repo state | X.55 (320 offline checks passing) |
| `8004SCAN_API_KEY` | required — server-side only, in root `.env.local` |
| `PANCAKESWAP_API_KEY` | optional (returned `server-error` during the recorded run) |
| Network egress | `8004scan.io:443` |
| Database / KMS / deployment | **not required** |

Install and verify:

```bash
pnpm install --frozen-lockfile
pnpm --dir prisma exec prisma generate
```

Confirm the credential is present without printing it:

```bash
node -e "const fs=require('fs');const has=fs.readFileSync('.env.local','utf8').split(/\r?\n/).some(l=>/^\s*8004SCAN_API_KEY\s*=\s*\S/.test(l));console.log('8004SCAN_API_KEY present:',has)"
```

## 2. Task inputs

Frozen in [`EXPERIMENT-PROTOCOL.md`](./EXPERIMENT-PROTOCOL.md). Summary:

| Task | Input |
|---|---|
| 1 | category `yield-optimisation`; `chainId=56`, `isTestnet=false`, `search=yield`, `limit=100` |
| 2 | all four categories, each with its own keyword, same chain filters |
| 3 | three 402 fixtures: valid chain-97 permit2; same challenge selected against chain 56; malformed body (embedded in the harness) |

## 3. Marketplace route / agent under test

- Loader: `getBscCategoryPage(key)` in `apps/web/lib/eight004scan/discovery/service.ts`
- Classifier: `apps/web/lib/eight004scan/discovery/classifier.ts`
- x402 screening: `parsePaymentRequired` + `selectPaymentRequirement` from `@bnb-marketplace/integrations/altana`
- User-facing equivalents: `/categories/{rebalancing,grid-trading,yield,health-factor}`

## 4. Baseline (Arm A) procedure

The unaided procedure, scripted for timing parity:

1. Call `listAgents()` directly with identical filters.
2. Screen records with a plain case-insensitive substring match on
   `name + description` — the naive approach before precedence rules are known.
3. For Task 3, inspect the 402 body for object shape, `accepts[]`, and presence
   of a `network` field, with **no chain allowlist**.

Arm A deliberately does not use the classifier. That difference is the
measurement.

## 5. Marketplace (Arm B) procedure

Call the marketplace loader with the same inputs and retain its full output
including per-record evidence, counts, state and timestamp.

## 6. Run the harness

`getPancakeSwapPools` and the Prisma store are `server-only`, so a Node harness
needs a loader shim (this only neutralises the `server-only` import marker; it
changes no application logic):

```bash
cd apps/web
node --experimental-strip-types \
  --import "data:text/javascript,import{register}from'node:module';import{pathToFileURL}from'node:url';register('data:text/javascript,export async function resolve(s,c,n){if(s===%22server-only%22)return{url:%22data:text/javascript,%22,shortCircuit:true};return n(s,c);}',pathToFileURL('./'));" \
  lib/termix/advantage-harness.ts
```

Expected console shape (values will differ):

```text
task-01 armA=<ms>/<req>  armB=<ms>/<req>
task-02 armA=<ms>/<req>  armB=<ms>/<req>
task-03 armA=<ms>/<req>  armB=<ms>/<req>
evidence written to docs/termix/evidence/
```

## 7. Timing method

- `performance.now()` immediately around each arm's call, rounded to whole ms.
- Single run, warm network, same process, arms executed back to back.
- **Not averaged.** Treat a small delta (tens of ms) as no difference.
- Request cost measured by wrapping `globalThis.fetch` and counting invocations.
- Monetary cost recorded as `NOT MEASURABLE` (no published unit price).

## 8. Quality rubric

Five dimensions — Correctness, Completeness, Actionability, Data/source quality,
Risk awareness — scored 0–5 (max 25), defined in `EXPERIMENT-PROTOCOL.md`
**before** execution. Score both arms from the saved evidence only. Use
`NOT ASSESSABLE` rather than inventing a score.

## 9. Adjudicating divergences

When arms disagree, inspect each divergent record and rule true/false positive
against the task criterion. To reproduce the Task 1 mechanism finding:

```bash
cd apps/web
node --experimental-strip-types -e "
const run = async () => {
  const { classifyAgent } = await import('./lib/eight004scan/discovery/classifier.ts');
  const mk = (name, description) => ({ id:'x', agentId:'56:0xa:1', tokenId:'1', slug:'56:0xa:1', name, chainId:56, chainType:'evm', isTestnet:false, category:null, protocols:[], description, x402Supported:false, verification:'unverified', risk:null, registryScore:null, sourceRank:null, networkRank:null, healthScore:null, averageScore:null, totalFeedbacks:null, starCount:null, reputationLevel:null, activity:null, successRate:null, updatedAt:null, createdAt:null, ownerAddress:null, contractAddress:null, imageUrl:null, source:'8004scan' });
  console.log('name-only keyword =>', classifyAgent(mk('x-yield-optimizer.agent','Compares Venus stablecoin markets and returns an allocation.')).categories.length);
};
run();"
```

Expect `0` — reproducing the description-precedence false negative.

## 10. Evidence locations

| Path | Contents |
|---|---|
| `docs/termix/EXPERIMENT-PROTOCOL.md` | Pre-registered protocol + deviations log |
| `docs/termix/Agent-Advantage-Report.md` | Final report |
| `docs/termix/evidence/RUN-METADATA.json` | Run metadata + caveats |
| `docs/termix/evidence/QUALITY-SCORING.json` | Rubric scores with justifications |
| `docs/termix/evidence/task-0{1,2,3}/` | Inputs, both arms, adjudications |

## 11. Safety constraints (must hold on any re-run)

- BNB Testnet 97 only. Task 3 must **refuse** the chain-56 case.
- No signing, no submission, no transaction (`signed:false`, `submitted:false`).
- Do not modify Agent 1816 or ERC-8183 Job 515.
- Never paste a credential into evidence files.

## 12. Known reproducibility caveats

- Registry contents change; counts (131/100/58) will drift.
- Task 1's large timing gap is single-run and partly network variance.
- PancakeSwap returned `server-error` in the recorded run; pool data is excluded
  by design and its absence is not a failure of the experiment.
