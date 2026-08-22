# Main Track X.93 — Judge Experience Audit

**Status:** COMPLETE — OUTCOME B (one highest-value fix applied)
**Date:** 2026-08-21
**Scope:** Audit the complete BNB Agent Studio Marketplace against the Main Track product vision and judging criteria (docs/ux/Marketplace-UX-Blueprint.md §1, §2, §16) and recommend/apply the single highest-value change that improves the judge experience.
**Constraints honored:** AUDIT FIRST; no uncontrolled feature sprint; did NOT reopen X.91; AWS/KMS/ALTANA custody untouched; TERMiX read-only; PancakeSwap audit-only; no deploy/commit/push.

---

## 1. Audit method

Traced the exact scripted hackathon demo path (Blueprint §16, 10 steps) plus the supporting journey surfaces, reading the live implementation of every step:

| Blueprint step         | Surface                                                   | Verdict                                                                                                            |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1. Open the site       | `app/(app)/...` layout + landing (prior milestones)       | PASS — BNB-branded, honest                                                                                         |
| 2. Explore Marketplace | `marketplace/marketplace-view.tsx`                        | PASS — real grid, honest states, status badge                                                                      |
| 3. Search "rebalance"  | same (client-side over real fields)                       | PASS — live counter + highlight                                                                                    |
| 4. Category filter     | `marketplace-view.tsx` Category facet                     | PASS* — but category is BSC-discovery inference, not 8004scan; "Trading" label in blueprint maps to "Grid Trading" |
| 5. Sort → Trending     | `SortDropdown` + `sortMarketplaceAgents`                  | PASS — instant, state shown                                                                                        |
| 6. Compare 2 agents    | `compare/compare-view.tsx`                                | PASS — explicit "—" for unavailable fields                                                                         |
| 7. Agent Details       | `agents/[slug]/agent-detail-view.tsx`                     | PASS* — trust row + provenance; **risk mislabeled (see §2)**                                                       |
| 8. Click Hire          | `hire-review-panel.tsx` / `hire/hire-activation-view.tsx` | PASS — disabled/fail-closed, no fake checkout                                                                      |
| 9. Back to Marketplace | URL state preserved                                       | PASS                                                                                                               |
| 10. Dark mode          | design tokens                                             | PASS (prior)                                                                                                       |

Supporting surfaces also audited: `leaderboards/leaderboards-view.tsx` (honest skeletons, category column honestly "—"), `hire-review-panel.tsx`, `hire-activation-view.tsx` (fail-closed; no activation claimed without persisted session).

## 2. Findings (judging criteria)

**Functionality — PASS.** Every path (search → filter → sort → compare → details → hire) is traversable with zero dead ends; honest empty/registry-offline states throughout; URL state survives round-trips.

**Data Quality — PASS with one defect.** Provenance is explicit on every surface ("8004scan", "TermiX AACP", "PancakeSwap read-only", "nothing is simulated"). Missing values render as "—" or "Pending", never fabricated — with one exception:

- **DEFECT (high value):** `agent-detail-view.tsx:571` rendered `<MarketplaceRiskBadge state="low" label="Risk —" withIcon />` — i.e. **every agent showed a green "Low risk" badge regardless of any real risk data**. 8004scan does not provide risk. The marketplace `RiskLevel` token set has no `unknown` state, so the badge could only ever show a concrete (and misleading) level. This is a fabricated trust signal that directly undermines the Data-Quality / Trust criteria. Notably the same page's Trust & Verification grid (line 925) already shows risk honestly as `Pending`.

**Agent Diversity — PASS (weak on leaderboards).** Marketplace shows category chips, protocol variety, builder variety per Blueprint §1. The leaderboard "Category" column is always "—" (8004scan does not classify category) — honest, but the diversity story is weaker there than on the marketplace. Accepted as honest; not fixed (out of the single-fix budget).

**Trust — PASS after fix.** Verification/Builder/Registry/Reputation statuses are sourced or honestly pending. Risk was the only misleading signal (fixed below).

**Judge Experience — PASS.** The §16 demo path runs end-to-end; offline path reinforces the honesty story.

## 3. Decision: OUTCOME B

The single highest-value change is removing the fabricated green "Low risk" badge on the agent trust strip. It is the only place in the judge's first-glance trust row that asserts a concrete (false) assurance, and it is internally inconsistent with the page's own grid.

### Change applied

`apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`

- Removed the unused `MarketplaceRiskBadge` import (line 68) — it has no honest `unknown` state in the marketplace token set.
- Replaced the trust-strip risk node with the existing honest `Pending` chip, matching the Trust & Verification grid on the same page:

```diff
-      <MarketplaceRiskBadge state="low" label="Risk —" withIcon />
+      <Pending text="Risk pending" />
```

This makes the trust strip consistent: risk is now shown as "pending" (awaiting audited risk), exactly like the grid — no green reassurance, no fabricated data. No credential, no network, no production behavior change.

## 4. Regression

- `pnpm typecheck` (apps/web): clean.
- `pnpm lint` (apps/web): clean.
- No `.verify.ts` exists for this client component; change is purely presentational and contained to one file.

## 5. Out of scope / explicitly not changed

- X.91 capability source search: not reopened.
- AWS-KMS / ALTANA custody: untouched.
- TERMiX, PancakeSwap: read-only, unchanged.
- "Coming Soon" status badge: retained intentionally — it is the Blueprint-sanctioned honest hiring-roadmap signal (§9/§16), not a fabricated agent-lifecycle state.
- Leaderboard Category column "—": left honest (documented, not fixed within single-fix budget).

## 6. Conclusion

The Main Track marketplace already satisfies the judge demo path with honest, source-attributed data and zero dead ends. The one defect that could read as "fake" to a judge — a universal green "Low risk" badge — is now fixed. **X.93 is complete.** Real activation remains blocked (X.91 OUTCOME C: no authoritative external capability provider; no ALTANA/AWS-KMS custody), and no deploy/commit/push was performed.
