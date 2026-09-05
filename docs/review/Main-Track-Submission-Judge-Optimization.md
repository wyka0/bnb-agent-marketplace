# Main Track Submission — Judge Experience Optimization

## 1. Starting State

The marketplace entered this milestone as a Main Track release candidate with an honest activation fallback. X.91 established that real activation is blocked because no authoritative execution-capability source exists and custody is unprovisioned. X.92–X.97 preserved that boundary and validated discovery, registry evidence, category intelligence, read-only TermiX evidence, read-only PancakeSwap intelligence, and fail-closed Hire behavior.

This milestone did not reopen activation architecture, custody, AWS/KMS, ALTANA, Agent 1816, Job 515, or execution.

## 2. Judge Journey Audit

The audited journey was:

`/` → `/marketplace` → `/categories/*` → `/agents/[slug]` → `/compare` → `/agents/[slug]/hire`

The homepage provides direct Marketplace and Categories entry points, four equal category tracks, live registry-backed discovery, featured records, and a Compare preview. Marketplace and category pages link to real agent detail routes. Agent detail exposes registry identity, source labels, comparison, evidence, permissions, performance placeholders, TermiX reputation, PancakeSwap intelligence, pricing placeholders, activity, and the activation boundary. Hire resolves the exact registry identity and remains fail-closed when activation capability is unavailable.

`/agents` remains an explicit empty state and is not linked by the primary navigation. This is honest and low-risk; the judge path uses `/marketplace` as the populated catalog.

## 3. Four-Category Parity

Rebalancing, Grid Trading, Yield Optimisation, and Health Factor Monitoring all use the shared `CategoryDashboard` structure. Each supplies:

- A clear category explanation and monitoring scope
- Live or bounded discovery where the source responds
- Comparable metadata and source attribution
- Explicit unavailable metrics
- Decision signals and an activation review path
- Risks, limitations, verification gaps, and `analysis-only` execution mode

The X.53 and X.54 verifiers passed. The four category pages receive equal structural treatment; no category is visually or functionally secondary. Existing category-specific evidence remains appropriately bounded: no synthetic health factor, no inferred grid backtest, and no numeric APR/APY.

## 4. Data-Quality Audit

The judge path was searched for unsupported prices, APR/APY, TVL, performance, execution, and active-state language.

Registry values are sourced from the 8004scan path. Missing values render as `—`, `Pending`, or an explicit unavailable message. Category market intelligence derives only from real returned values and identifies source, chain, and timestamp. PancakeSwap volume and APR/APY remain unavailable rather than being estimated. TermiX metrics render only from a real server-fetched read-only result; unavailable, malformed, unsupported, and network-failure states do not become score zero.

Compare uses only real registry fields. It has no composite ranking, fabricated score, or inferred category. Unsupported fields are consistently labeled, including missing description, category, capabilities, protocols, reputation, registry score, and listing date.

## 5. Trust-Boundary Audit

The product correctly distinguishes:

- ERC-8004 identity from execution authority
- Registry descriptions and self-declared capabilities from verified execution capability
- TermiX read-only reputation from marketplace hiring
- PancakeSwap market intelligence from agent performance
- A management session from a real active execution session

The main trust defect found was presentation-level: homepage and dashboard copy described scoped sessions, live performance, monitoring, and production-ready agents as though those capabilities were already available. Those claims could make a judge infer a stronger product state than the verified implementation supports.

## 6. Hire UX Audit

Hire remains deliberately fail-closed. The review page shows the exact registry identity, source, network, verification state, category state, published capability metadata, requested-scope result, and the server-confirmed review only when returned by the server.

For unavailable agents, the page explains why activation is unavailable: the classification cannot verify an authoritative execution capability. It states that no activation is claimed until a persisted active session is returned. No fake active session, job, transaction, custody material, or execution control is rendered.

The existing server behavior remains unchanged for this milestone: unavailable capability cannot produce `ACTIVE`, and the Altana session remains unavailable in the current environment.

## 7. Compare Audit

Compare supports up to three distinct registry agents and preserves exact registry identities in the URL. The selection flow prevents duplicates and rejects a fourth selection. The table is evidence-first and identifies `8004scan` as the source.

The comparison answer is limited to real evidence: description, protocols, chain, verification, reputation, registry score, registry identity, listing state, and listing date. There is no fabricated “best agent” ranking. A judge can select an agent by comparing published registry evidence while seeing where evidence is missing.

The X.64 compare verifier passed with 10 checks.

## 8. PancakeSwap Presentation Audit

X.97 Option B was preserved unchanged in scope and behavior. Agent detail presents bounded BSC mainnet PancakeSwap V2 intelligence using real on-chain reserves, the official PancakeSwap price source, computed TVL, explicit unavailable 24-hour volume, explicit unavailable APR/APY, source/chain labeling, bounded sample scope, and a read-only disclaimer.

No execution control or new PancakeSwap integration was added. The PancakeSwap UI verifier passed all checks. The standalone server verifier was not counted as a product failure because its direct Node invocation imported `server-only` without the repository’s existing test loader shim; the UI and intelligence verification paths remained clean.

## 9. TermiX Presentation Audit

TermiX remains a separate, server-fetched, read-only reputation signal from TermiX AACP on BSC Testnet. It is never merged with 8004scan into a composite score. Unsupported identity mappings and unavailable responses remain explicit unavailable states.

The existing TermiX evidence remains capability-comparison evidence. It is not described as a marketplace-hire experiment, and the product does not claim that TermiX hired an agent through the marketplace. The TermiX web verifier passed all 11 checks. Strict hired-through-marketplace eligibility remains blocked as documented by X.96.

## 10. Changes Made

Only copy changes were justified by the audit:

- Homepage hero now leads with discovery, comparison, registry evidence, and explicit activation boundaries.
- Homepage journey labels now use `Review` and `Trust` instead of implying available scoped sessions and live monitoring.
- Trust banner copy now describes the fail-closed activation boundary, future explicit scoping, and source-labeled evidence.
- Why Trust copy now describes evidence-first data and a transparent catalog instead of claiming live performance streams or production-ready execution.
- Dashboard copy now says verified activations will show real session and performance data, avoiding an implication that current performance tracking exists.
- Agent detail Performance copy now states that operating metrics are unavailable until an authoritative source is connected.

No data, API, activation, custody, security, category, TermiX, or PancakeSwap execution code was changed.

## 11. Verification Results

Passed:

- `compare:verify`: 10/10
- `categories:x53:verify`: 21/21
- `categories:x54:verify` and X.55 gap verifier: 38/38 and 22/22
- `activation:hire:verify`: 23/23
- `activation:hire-api:verify`: 14/14
- `security:x49:verify`: 25/25
- `security:x55:verify`: passed
- PancakeSwap UI verifier: all checks passed
- TermiX reputation web verifier: all checks passed
- Web typecheck: passed
- Web lint: passed
- Changed-file Prettier check: passed
- Web production build: completed successfully

X.50 check-24 remains the known pre-existing failure: standalone output and server-external package configuration. It was preserved unchanged as required. The build emitted the existing `viem/ox` critical-dependency warning and the existing Next.js ESLint-plugin notice; compilation and static generation completed successfully.

## 12. Production Read-Only Results

No production deployment or mutation was performed in this milestone. No production read-only request was issued because no deployment was created and no running production endpoint was provided in the current workspace.

The source-level route and verifier checks cover the requested boundaries: category routes, marketplace discovery, agent detail, compare, Hire fail-closed behavior, unavailable Altana session behavior, absence of fabricated active state, absence of unsupported execution controls, and security-header policy.

## 13. Remaining Limitations

- Real activation remains blocked by the absence of an authoritative execution-capability source and unprovisioned custody.
- TermiX strict hired-through-marketplace eligibility remains blocked.
- PancakeSwap remains read-only.
- Performance, pricing, permissions, and related-agent values remain pending or unavailable where authoritative sources do not exist.
- `/agents` remains an explicit empty future-milestone page; `/marketplace` is the populated discovery entry point.
- X.50 check-24 remains stale and failing by prior instruction.

These limitations are visible in the product and are not replaced with simulated values.

## 14. Final Main Track Classification

**PASS** for the Main Track judge-experience milestone.

The marketplace now tells the intended story directly through the product: find BNB agents, understand their registry and protocol evidence, compare only real fields, review what activation would require, and never treat unsupported execution claims as active capability. Real activation remains honestly **BLOCKED**, independently of this Main Track classification.

No deployment, commit, push, activation reopening, custody work, transaction work, or X.91 architecture change was performed.
