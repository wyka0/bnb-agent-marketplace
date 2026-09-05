# Altana — Implementation Report · Phase 4 (Skills Composition + Capability Adapter)

**Phase:** 4 — Representing the official Altana-certified skills as marketplace agent capabilities.
**Status:** COMPLETE — `ALTANA SKILLS STATUS: READY FOR IMPLEMENTATION (capability metadata only)`
**Date:** 2026-08-09
**Precedes:** the execution phase (authority: session scoped to a skill's address table; competence: certified `SKILL.md`; rail: ERC-8183 job / session).
**Validated against:** `docs/review/Altana-Integration-Discovery.md` (§1.8, §11.1), the official registry `github.com/altananetwork/skills/tree/main/skills`, and `packages/integrations/src/altana/` (Phases 2/3A).

> **Honesty contract:** a skill existing in the registry does NOT mean any agent has it, and nothing here executes. Three surfaces are kept strictly distinct: **AVAILABLE SKILL** (registry), **AGENT HAS SKILL** (explicit, validated mapping), **SKILL EXECUTION** (not available this phase, always stops).

---

## 1. Official Skills Discovered + Canonical Identifiers

Verified by browsing the official registry `github.com/altananetwork/skills/tree/main/skills`. The seven hackathon-certified skills match the discovery doc exactly — **no alternative identifiers invented**:

| #   | Official skill (dir)  | Canonical id              | Category (adapter) | Read/write |
| --- | --------------------- | ------------------------- | ------------------ | ---------- |
| 1   | Aave V3 Lending       | `aave-v3-lending`         | lending            | write      |
| 2   | Venus Lending         | `venus-lending`           | lending            | write      |
| 3   | PancakeSwap Trading   | `pancakeswap-trading`     | trading            | write      |
| 4   | PancakeSwap Liquidity | `pancakeswap-liquidity`   | liquidity          | write      |
| 5   | Lista Staking         | `lista-staking`           | staking            | write      |
| 6   | Token Radar           | `dexscreener-token-radar` | research           | read-only  |
| 7   | Copy Trade            | `copy-trade`              | trading            | write      |

The registry also ships `four-meme`, `wallet-tracker`, and `x402-payments`. These are **out of this phase's 7-skill scope** and intentionally NOT registered: `x402-payments` is explicitly excluded from the marketplace (x402 is out of scope), and the others are not part of the sprint's hackathon capability set. `dexscreener-token-radar` keeps the official `dexscreener-` prefix — the public "Token Radar" display name is documented, not substituted.

Category values (`lending`, `trading`, `liquidity`, `staking`, `research`) are **adapter-level classifications, not registry metadata** — documented as such in the code.

---

## 2. Capability Model — `packages/integrations/src/altana/skills.ts`

### Core types

- `AltanaSkillId` — string-literal union over the 7 canonical ids (`ALTANA_SKILL_IDS`, order-stable).
- `AltanaSkillCategory` — `lending | trading | liquidity | staking | research`.
- `AltanaSkillCapability` — `{ id, name, category, description, source: "Altana certified skill", executable: false }`. `executable` is **literally `false`** on every entry; it can never be truthy this phase.
- `AgentCapabilitySet` — `{ agentId, skills: readonly AltanaSkillId[] }`. **Explicit only**; nothing auto-assigns skills to agents.
- `Altana8004scanAgentCapabilityInput` / `Altana8004scanAgentCapabilities` — bridge shapes (see §5).

### Registry

`ALTANA_CERTIFIED_SKILLS: readonly AltanaSkillCapability[]` — a static, frozen (via `Object.freeze` index) registry of exactly the 7 verified skills, plus the `ALTANA_SKILL_INDEX` id→capability lookup. **Only verified information**: no APYs, balances, prices, TVL, performance, risk, history, or holdings anywhere.

### Functions

- `isSupportedAltanaSkill(id): id is AltanaSkillId` — strict registry-union guard.
- `getAltanaSkill(id): AltanaSkillCapability | undefined` — lookup; `undefined` for unknown.
- `listAltanaSkills(): readonly AltanaSkillCapability[]` / `listAltanaSkillIds()` — deterministic canonical order.
- `getAgentAvailableSkills(set): readonly AltanaSkillCapability[]` — resolves an explicit set to capability entries (throws on an out-of-registry id).
- `emptyAgentCapabilitySet(agentId)` — the honest `{ agentId, skills: [] }` state.
- `validateAgentCapabilities(input): AgentCapabilitiesValidation` — rejects unknown ids (errors name them), normalizes duplicates (`duplicatesRemoved` count, first occurrence kept).
- `map8004scanAgentCapabilities(input)` — §5.
- `assertAltanaSkillsNonExecutable(skillId): never` — the execution boundary, always throws.

Mirrors project conventions: existing `validateAltanaConfiguration` returns `{ ok, errors|config }`; the capability validators use the same `{ ok, errors }` envelope.

---

## 3. Agent → Skill Mapping

No automatic assignment. `AgentCapabilitySet.agentId` is the stable marketplace/8004scan identifier; `skills` only ever comes from **explicit validation** of agent capability data. Absent data → `emptyAgentCapabilitySet(agentId)` → `skills: []`. This prevents the "every agent can do everything" claim.

---

## 4. Architecture Placement

Everything lives in the existing `packages/integrations/src/altana/` extension point — no second Altana package, no new SDK clients, no separate DeFi SDKs (Aave/Venus/PancakeSwap/Lista/DexScreener/copy-trade are registry _skills_, not protocol SDK integrations). Re-exported from `packages/integrations/src/altana/index.ts` → `packages/integrations/src/index.ts`.

```
@bnb-marketplace/integrations (src/altana/)
  index.ts         re-exports ./client.js, ./erc8183.js, ./skills.js  (+ AltanaAdapter contract)
  client.ts        Phase 2 facade
  erc8183.ts       Phase 3A ERC-8183 adapter
  skills.ts        Phase 4 capability/skills adapter   ← NEW
  skills.verify.ts Phase 4 verification runner         ← NEW
  verify.ts / erc8183.verify.ts                        (Phases 2/3A)
```

`packages/data-api` (envelope-only client) is untouched; `packages/ui` untouched; frozen web app untouched.

---

## 5. 8004scan Compatibility

Reviewed the live model in `apps/web/lib/eight004scan/{types,normalize,leaderboard-types}.ts` (frozen; not imported — the adapter carries a local structural mirror).

- 8004scan supplies a **`supported_protocols: string[]`** field and **`x402_supported: boolean`**.
- `supported_protocols` is the API's **interaction-protocol taxonomy** (documented enum in `list-agents` param: `MCP | A2A | OASF | Web | Email`) — it describes how an agent is _reachable_, NOT what it can _do_, and it is **not** a set of Altana skill ids.
- Therefore the bridge maps a protocol string to an Altana skill **only on exact, case-sensitive equality with a canonical `AltanaSkillId`**. Today that never matches, so every 8004scan agent yields:
  - `skills: []`, `unmapped: ["MCP","A2A",…]`, `source: "8004scan"` — the honest **pending/empty** capability state.
- Rule is future-proof: if 8004scan ever emits a canonical Altana skill id verbatim in `supported_protocols`, it maps automatically (demonstrated with a `TEST FIXTURE` in the harness).
- **No capability is fabricated.** Frozen Leaderboards metrics untouched.

---

## 6. Execution Boundary

The adapter provides capability metadata + validation only. `assertAltanaSkillsNonExecutable(skillId): never` is the gate every future execution attempt must pass through — it always throws `AltanaSkillsError` with `ALTANA_SKILLS_EXECUTION_BOUNDARY`. No session, signer, wallet, transaction, or x402 exists in the module.

Future architecture (documented, NOT implemented):
`Agent → Capability → Altana Skill → (ERC-8183 job or scoped session) → Execution`

---

## 7. Security Boundary

1. **No credentials** — no keys, mnemonics, seed phrases, API keys, env reads, or `NEXT_PUBLIC_` secrets. Adapter surfaces carry metadata only.
2. **No execution** — nothing signs, submits, or spends; the sole "action" function throws.
3. **No fabricated claims** — empty/pending states instead of invented mappings; `executable: false`.

---

## 8. Test Results

`pnpm --filter @bnb-marketplace/integrations altana:skills:verify` (after `pnpm build`) → `node dist/altana/skills.verify.js`. Fixtures are labeled `TEST FIXTURE / NOT LIVE DATA`. Exit 0:

```
ok   all 7 official skill ids resolve; registry is canonical + deterministic
ok   unknown + out-of-scope skill ids rejected
ok   empty agent capability set valid (skills: [], never invented)
ok   explicit agent→skill mapping + resolution works
ok   duplicate skills normalized; static registry has zero duplicates
ok   getAgentAvailableSkills rejects an unknown id in a hand-built set -> AltanaSkillsValidationError
ok   unsupported ids rejected with explicit errors
ok   execution boundary stops skill "aave-v3-lending" -> AltanaSkillsError
ok   execution boundary stops skill "venus-lending" -> AltanaSkillsError
ok   execution boundary stops skill "pancakeswap-trading" -> AltanaSkillsError
ok   execution boundary stops skill "pancakeswap-liquidity" -> AltanaSkillsError
ok   execution boundary stops skill "lista-staking" -> AltanaSkillsError
ok   execution boundary stops skill "dexscreener-token-radar" -> AltanaSkillsError
ok   execution boundary stops skill "copy-trade" -> AltanaSkillsError
ok   no execution; every attempt funnels through the stop boundary
ok   capability entries carry metadata only — no credential surface
ok   8004scan bridge: taxonomy never fabricated into skills; exact-id rule demoed
```

Regression: `altana:verify` (Phase 2) and `altana:erc8183:verify` (Phase 3A) both still exit 0. Repo-wide gates: `pnpm lint` 12/12, `pnpm typecheck` 12/12, `pnpm build` 7/7. Security scan (see §10) clean.

Coverage against the sprint's required tests: all 7 skill ids resolve ✓ · unknown id rejected ✓ · list deterministic ✓ · empty set valid ✓ · explicit mapping works ✓ · duplicates normalized ✓ · no execution ✓ · no credentials required ✓.

---

## 9. What Is NOT Implemented (explicit)

- NO skill execution
- NO transactions / signing / wallet
- NO session creation (incl. zero-scope research sessions)
- NO x402
- NO `get_skill` / `search_skills` MCP consumers
- NO mainnet / no testnet writes
- NO private keys or credentials
- NO Hire UI changes, no UI changes at all (Hire · Soon untouched)
- NO new SDK clients or protocol integrations

---

## 10. Final Security Check

Searched the changed surface + repo docs for `PRIVATE_KEY`, `PRIVATEKEY`, `MNEMONIC`, `SEED_PHRASE`, `WALLET_PRIVATE_KEY`, `ALTANA_PRIVATE_KEY`, `8004SCAN_API_KEY`, `NEXT_PUBLIC_8004SCAN_API_KEY`, `Bearer`, `Authorization`, and 64-hex literals.

- `packages/integrations/src/altana/` (all new + prior code): **clean** — the only 64-hex literal is the SDK-documented zero `deliverable` constant in the Phase-3A test fixture.
- Docs: matches are pre-existing prose references to the server-only `8004SCAN_API_KEY` env _name_ (already audited, never a value) and Phase-2 notes that the signer env var is intentionally absent — no real credentials.
- Repo is **not** a git repo (per constraint — nothing staged, nothing published).

---

## 11. Files Changed

### Added

- `packages/integrations/src/altana/skills.ts` — capability adapter (types, registry, mapping, validation, 8004scan bridge, execution boundary).
- `packages/integrations/src/altana/skills.verify.ts` — verification runner (exit 0/1).
- `docs/review/Altana-Implementation-Phase4.md` — this report.
- (generated) `packages/integrations/dist/altana/skills.{js,d.ts}`, `dist/altana/skills.verify.js`.

### Modified

- `packages/integrations/src/altana/index.ts` — header updated; re-exports `./skills.js`.
- `packages/integrations/package.json` — added `"altana:skills:verify"`.

### Untouched

Frozen UI (`marketplace/`, `agents/`, `compare/`, `leaderboards/`), `packages/ui`, `packages/data-api`, `apps/worker`, prisma, env schema, `.env`, GitHub (none).

---

## 12. Requirements for the Next (Execution) Phase

1. **Authority:** grant a session scoped to the skill's `SKILL.md` address table — `calls` allowlist + `spend` cap + `expiry` (least privilege, default deny; `calls` omitted = unrestricted = forbidden). Research skills (`dexscreener-token-radar`) pair with a zero-scope session.
2. **Competence:** load the certified `SKILL.md` for each id (server-side, sha256-checked via `get_skill`/`search_skills` or direct load) for the seven ids above.
3. **Rail:** execute through Altana (`execute` w/ admin signer or scoped session) or an ERC-8183 job (`hireErc8183Agent`) — both pending the externally supplied testnet wallet/signer decision from Phase 3B.
4. **Surface:** wire `AgentCapabilitySet` → the frozen agent-detail permission rows (no UI rework needed; rows already read API data).
5. **Live data:** APYs / balances / prices / TVL / risk / history belong to external data integrations and remain separate from this capability layer.
6. Guard: capability lists may feed only the marketplace metadata — never auto-claim, never auto-execute.
