# Main Track Activation — X.76: Verified Execution Capability Source

**Status:** PASS — PROVIDER BOUNDARY IDENTIFIED (investigation complete; external provider required before activation)
**Date:** 2026-08-21
**Milestone scope:** Read-only investigation + conservative adapter boundary only. No AWS/KMS, no ALTANA custody, no TERMiX change, no PancakeSwap change, no mainnet/Agent 1816/Job 515, no blockchain transactions, no deployment, no commit, no push.

---

## 1. X.75 starting state

From `docs/review/Main-Track-Activation-X75-ALTANA-AWS-KMS-Readiness.md`, the Hire → Consent → Session → Custody → Execution pipeline was already fail-closed:

- `resolveAgentActivationCapability()` in `apps/web/lib/activation/capability.ts` **always returns `null`**.
- No real agent reaches `ACTIVATABLE`; the capability source was already identified as `BLOCKED` because the resolver had no input carrying verified price/expiry/jobId/resource/execution-capability.
- X.75 confirmed AWS KMS and management custody were also `BLOCKED`/unconfigured.

X.76 isolates the _first_ of those blockers: the **verified execution-capability source**.

## 2. Capability data flow

```
Registry / Provider
        │  (identity + metadata only today: 8004scan GET /agents)
        ▼
   Hire (fetchAgentRows → findAgentByIdentity → resolveAgentIdentity)
        │
        ▼
   Consent (classifyAgentActivation → CAPABILITY_UNKNOWN when capability null)
        │
        ▼
   Session (createAltanaSession — only reached if review/consent succeed)
        │
        ▼
   Custody (KMS envelope + management-custody signer — X.75 BLOCKED)
        │
        ▼
   Execution (ERC-8183 hire batch — never reached; capability null)
```

The single extension point where a real capability would enter is
`resolveAgentActivationCapability(record)` (and, downstream, `opts.capability`
in `runHireActivation`). Both currently resolve to `null` for every real record.

## 3. Required capability fields

The existing `AgentActivationCapability` contract (`capability.ts`) requires:

| Field         | Type   | Meaning                                               |
| ------------- | ------ | ----------------------------------------------------- |
| `kind`        | string | Action kind (`erc8183-hire`)                          |
| `amount`      | bigint | Verified price in chain-97 `$U` atomic units          |
| `expiresAt`   | bigint | Absolute unix seconds for the ERC-8183 job expiry     |
| `jobId`       | bigint | Predicted ERC-8183 job id (`jobCounter() + 1`)        |
| `resourceUrl` | string | Protected resource advertised in the x402 requirement |

The X.76 provider boundary (`capability-source.ts`) mirrors these as string
fields with explicit verification metadata so every value has an authoritative
source and method.

## 4. 8004scan evidence

`Scan8004Agent` (`apps/web/lib/eight004scan/types.ts`) is the only agent
integration. Its documented fields are identity and metadata **only**:

- identity: `agent_id`, `chain_id`, `is_testnet`, `owner_address`, `name`, `description`
- discovery metadata: `supported_protocols[]`, `x402_supported` (boolean), `is_verified`, star/score/health metrics, timestamps.

It contains **no** `price`, **no** `expiry`, **no** `jobId`, **no** `resource`,
**no** `executionCapability`. The boolean `x402_supported` is a capability
_flag_, not a verified execution capability, and certainly not proof that an
agent is executable.

Verified at runtime by `capability-source.verify.ts` (checks 2a–2f): the live
`Scan8004Agent` shape exposes none of the five required fields.

## 5. Existing integration evidence

- `../eight004scan/client.ts` — `listAgents()` returns `Scan8004Agent[]` only.
- `../eight004scan/marketplace.ts`, `card.ts` — map identity/metadata to cards;
  explicitly mark every real registry agent `hireable: false` because no
  verified actionable capability exists.
- `hire.server.ts` — `runHireActivation` resolves capability via
  `resolveAgentActivationCapability(...)`; for every real record this is `null`,
  so classification is `CAPABILITY_UNKNOWN` (chain 97) or `NOT_ACTIVATABLE`
  (chain 56). The `ACTIVATABLE` branch only runs when a real capability is
  supplied, and then refuses at the first missing/unsafe value.

No current integration produces a verified execution capability.

## 6. TERMiX relevance

TERMiX (X.74) is a read-only, honest yield-agent comparison surface. It was
re-classified `PARTIAL` and is not a capability source. It is **not** used as an
execution-capability provider and is not changed by X.76. The same honesty rule
applies here: a registry listing or a natural-language description is never
treated as executable evidence.

## 7. Trust / security boundary

DISCOVERY DATA (who an agent is, what protocols it advertises) is **separated**
from VERIFIED EXECUTION CAPABILITY (that it can be hired, at what price, with
what job, resource, and expiry). A registry listing alone is NOT executable. A
description alone is NOT executable.

The safety property enforced by this milestone:

> `resolveExecutionCapability(...)` returns `null` whenever no authoritative
> provider supplies a fully verified, future-dated capability.

No code path in production can reach Session/Execution without a non-null
capability, and no capability can be non-null without an authoritative source.
This preserves the X.75 fail-closed posture.

## 8. Implementation changes

**No production behavior changed.** The following were added, all pure and
framework-free, none imported by any route or server module:

- `apps/web/lib/activation/capability-source.ts` — the adapter _boundary_ only:
  - `VerifiedExecutionCapability` (the required contract, with `verification`
    metadata: `source`, `verifiedAt`, `method`).
  - `ExecutionCapabilityProvider` interface (the external dependency contract).
  - `verifyExecutionCapability(cap)` — non-coercing validator rejecting
    placeholders (`price:"0"`, `jobId:"unknown"`, `resource:"default"`,
    `executionCapability:"enabled"`), missing fields, elapsed expiry, and
    untrusted/empty verification metadata.
  - `resolveExecutionCapability(input, provider?)` — returns `null` when no
    provider is supplied (the current production reality). It never constructs,
    imports, configures, or networks to a provider. **No real provider is
    implemented.**
- `apps/web/lib/activation/capability-source.verify.ts` — 31-check focused
  verifier proving the boundary returns `null` and rejects malformed data, and
  that a complete authoritative fixture capability is accepted (test-only
  provider; never deployed).
- `apps/web/package.json` — added script
  `activation:capability-source:verify`.

**Untouched:** `capability.ts`, `hire.server.ts`, `hire.api.ts`,
`app/api/activation/hire/route.ts`, custody, altana-session, 8004scan client,
TERMiX, PancakeSwap, security config. No environment variables read. No network
calls introduced.

## 9. Test results

| Verifier                                     | Result                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `activation:capability-source:verify` (X.76) | 31/31 PASS                                                                  |
| `activation:hire:verify`                     | 23/23 PASS                                                                  |
| `activation:hire-api:verify`                 | 14/14 PASS                                                                  |
| `altana:session:verify`                      | 25/25 PASS                                                                  |
| `altana:session:api:verify`                  | 72/72 PASS                                                                  |
| `security:x49:verify`                        | 25/25 PASS                                                                  |
| `security:x50:verify`                        | 33/34 PASS (check 24 = known stale X.50 assertion, intentionally unchanged) |
| `categories:x53:verify`                      | 21/21 PASS                                                                  |
| `security:x55:verify`                        | 22/22 PASS                                                                  |
| `typecheck`                                  | PASS                                                                        |
| `lint`                                       | PASS                                                                        |
| `build`                                      | PASS (only a pre-existing transitive `ox`/`viem` dependency warning)        |

X.76 capability verifier proves the critical safety property: with no provider,
`resolveExecutionCapability(...)` is `null`; and `resolveAgentActivationCapability`
remains `null` for real-shaped mainnet and testnet 8004scan records.

## 10. Production read-only results (no deployment)

Read-only checks against `https://bnb-agent-marketplace-web.vercel.app`
(still on `b441c21`):

- `/`, `/agents`, `/marketplace`, `/agents/[slug]` → **200**
- `/api/auth/me` → **200** `{"ok":true,"data":null}`
- `/api/auth/nonce` (POST, no CSRF) → **403**
- `/api/activation/hire` (POST, unauth) → **403**
- `/api/altana/session` → **503** (not configured)
- Headers: CSP (nonce-based), `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` all present.

Marketplace healthy, agent detail healthy, Hire honest, unavailable agents
remain unavailable, no fake `ACTIVE` session, no execution control without
verified capability, security headers intact.

## 11. Final classification

| Dimension           | Result                                                                    |
| ------------------- | ------------------------------------------------------------------------- |
| CAPABILITY SOURCE   | **BLOCKED** — no authoritative source exists in the current architecture  |
| CAPABILITY RESOLVER | **PASS** — correctly returns `null`; no fabricated capability             |
| HIRE ELIGIBILITY    | **PASS** — no real agent becomes actionable; unavailable states preserved |
| REAL ACTIVATION     | **BLOCKED** — cannot proceed without a verified capability source         |

**Overall: X.76 PASS — PROVIDER BOUNDARY IDENTIFIED.** The investigation is
complete; 8004scan is proven insufficient, and the exact external dependency is
documented below. No implementation was invented and production activation
remains unavailable.

## 12. Exact next dependency

The repository requires an **authoritative Verified Execution Capability provider**
implementing `ExecutionCapabilityProvider` (`capability-source.ts`):

- A source that can attest, per agent, a real `jobId`, `resource`,
  `executionCapability`, `price`, and `expiresAt`, each with an explicit
  `verification.source` + `verification.method` (e.g. an on-chain ERC-8004 job
  registry, or an Altana job-attestation service).
- Until that provider exists and is deliberately wired into the hire pipeline
  (alongside the still-BLOCKED AWS KMS custody and management-custody signer from
  X.75), real activation stays `BLOCKED`.

This is an external integration decision/implementation — **out of scope for
X.76**, which stops here per the milestone boundary.

---

**Files changed (documentation + boundary only):**

- `apps/web/lib/activation/capability-source.ts` (new)
- `apps/web/lib/activation/capability-source.verify.ts` (new)
- `apps/web/package.json` (added `activation:capability-source:verify` script)

**Not committed, not pushed.** Working tree contains this report plus the
untracked X.73/X.74/X.75 reports.
