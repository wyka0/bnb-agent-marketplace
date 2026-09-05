# X.242-CLEANUP — Remove Incorrect Vercel Project

Date: 2026-09-05 — Infrastructure cleanup only. **ZERO blockchain activity.**
Jobs 56715 (FUNDED) and 56714 untouched; escrow untouched; no source code
modified; no commit; no push.

## 1. Projects discovered

| Project | Domain | Verdict |
| --- | --- | --- |
| `bnb-agent-marketplace-web` | `https://bnb-agent-marketplace-web.vercel.app` | **CORRECT production** |
| `bnb-agent-marketplace` | `https://bnb-agent-marketplace-solo-25cb.vercel.app` | **INCORRECT duplicate** (created accidentally during X.242-DEPLOY-ENABLE when `vercel link` matched the repo name instead of the `-web` project) |

## 2. Verification of the correct project (before delete)

- Latest production deployment: `a61a863v5` — **Ready** (the X.242-RECOVERY
  deploy `779fa54`, serving since 21:05 GMT+0530), holding the production
  alias.
- Production domain: **HTTP 200** — Mainnet Agent 334760 page fully serves.
- Environment: `MAINNET_HIRE_ENABLED` present (Production) — value never
  printed; unchanged (true).
- Mainnet seller (external `:8443/health`): `chain 56`, owner `0xB0f768…7c0`,
  **`hire: "enabled"`**, agentId `56:0x8004…a432:334760`.
- Mainnet hiring remains enabled; seller configuration untouched; no
  redeploy performed.

## 3. Verification of the incorrect project (before delete)

- Deployments: **5, ALL status Error** (my aborted X.242 CLI deploy attempts —
  root-directory mismatch; never aliased, never served traffic).
- **Zero Ready/Production deployments.**
- **Zero environment variables** ("No Environment Variables found").
- Project alias `bnb-agent-marketplace-solo-25cb.vercel.app` → **HTTP 404**
  (not serving).
- No legitimate application depends on it (the GitHub repo deploys only to
  `bnb-agent-marketplace-web`; the CLI link artifact was the sole cause).

All pre-delete conditions satisfied → deletion authorized by this milestone.

## 4. Deletion result

```
vercel remove bnb-agent-marketplace --yes
> Found 1 project for removal in solo-25cb
> Success! Removed 1 project
- bnb-agent-marketplace
```

ONLY `bnb-agent-marketplace` deleted. The GitHub repository untouched; no
deployments removed from the correct project.

## 5. Post-delete verification

- `bnb-agent-marketplace`: **DELETED** (absent from `vercel projects ls`;
  its old alias now 404s).
- `bnb-agent-marketplace-web`: **EXISTS** — sole project in the team.
- Production: **HEALTHY** — domain HTTP 200; Agent 334760 page live.
- Production domain: **ACTIVE**.
- Mainnet Agent: **334760** · Mainnet chain: **56** · Mainnet hire:
  **ENABLED** (web flag env intact, verified by name; seller `hire:
  "enabled"` live).
- Seller: **ENABLED** and healthy. Testnet seller: chain 97, unchanged.
- Read-only production page check performed (no writes, no redeploy).

## 6. Environment safety verification

- No secret values printed at any point (values are Hidden/Sensitive in CLI
  output; only variable NAMES were inspected).
- `MAINNET_HIRE_ENABLED`, `MAINNET_SERVICE_PRICE` (1e13 wei), seller
  configuration, and the production domain were NOT modified.
- The `.vercel/` local link directory remains gitignored (never committed);
  the link currently points at the CORRECT project
  (`bnb-agent-marketplace-web`).

## 7. Blockchain ledger

| Item | State |
| --- | --- |
| Transactions / signatures / approvals / transfers | **0 / 0 / 0 / 0** |
| Job 56715 | **FUNDED — untouched (escrow intact)** |
| Job 56714 | untouched (OPEN, expires naturally) |
| Agent 334760 / 1906 / 2005 / Job 787 | untouched |
| Testnet writes | 0 |

**STOP — cleanup complete. Production verified healthy on the sole correct
project.**
