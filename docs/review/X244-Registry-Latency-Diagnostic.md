# X.244 — Registry Latency & Network Switch Diagnostic

Date: 2026-09-06 — **DIAGNOSTIC ONLY. Zero code changes, zero commits, zero
pushes, zero deployments, zero blockchain activity** (no transactions, no
signatures, no hire flows; Job 56715 untouched — verified FUNDED via a
read-only check in this session's prior milestone; MAINNET_HIRE_ENABLED and
seller runtime unchanged).

## 1. Verdict summary

| Symptom                                              | Root cause                                                                                                                                                                                                                                                                                                                                      | Class                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| "Waiting for ERC-8004 Registry" / "Registry offline" | **8004scan upstream instability**: intermittent HTTP 502 `BACKEND_ERROR` (~50% of reads during measurement window) after ~10.5s slow-fails                                                                                                                                                                                                      | **Upstream (third-party API)**                       |
| 5–10s network-switch delay                           | **Server-side render blocked on the upstream read**: the marketplace page is `force-dynamic` and awaits the full upstream waterfall (catalog + 4 discovery reads) BEFORE responding; a slow/failing 8004scan read directly extends the navigation. The client-side router transition itself is fast (~300–600ms TTFB when upstream is healthy). | **Data-fetch (upstream), amplified by architecture** |

**The registry itself (BSC chain-56/97 contracts and RPC) is healthy** — the
on-chain reads used elsewhere (ownerOf, tokenURI, job reads) all respond
normally. The failing component is the **8004scan indexer API**
(`https://8004scan.io/api/v1/public`), a third-party hosted service.

## 2. Exact measured timings (request waterfall)

### Direct upstream measurements (the EXACT production reads)

| Read                                           | Result (measurement window)                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Mainnet catalog (`chainId=56`, limit 24)       | **HTTP 502 after ~10.4–11.0s** (BACKEND_ERROR) in most attempts; occasionally HTTP 200 in **1.3–2.2s** (1 of 6 sustained) |
| Testnet catalog (`chainId=97`)                 | same pattern: 502 ~10.4s; occasional 200                                                                                  |
| Discovery reads (4 keyword searches per scope) | same: mostly 502 ~10.4–11.0s; one 200 in 3.1s observed                                                                    |
| Sustained mainnet x6                           | **1× 200 (2.2s), 5× 502 (~10.4–11.0s)**                                                                                   |
| Sustained bare-domain x8 (later window)        | 4× 502 (10.3–11.2s) then 4× 200 (1.3–21.3s) — flaky, roughly 50%                                                          |
| Tiny read (`limit=1`, no filters)              | also 502 — NOT a query-complexity issue                                                                                   |
| `www.8004scan.io` variant                      | 502 (the bare domain is the correct/served host)                                                                          |

### The per-switch waterfall (what a user experiences)

The switch is a URL navigation (`router.replace ?network=…`) → Next.js
server-renders the marketplace page. Measured phases:

| Phase                                                                                                                                                    | Timing                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. User click → modal confirm → URL transition start                                                                                                     | immediate (client)                                                                              |
| 2. Router transition → server request dispatched                                                                                                         | ~100–300ms                                                                                      |
| 3. **Server render blocked on upstream** (catalog + 4 discovery reads in `Promise.all`, each with an **8s AbortController timeout** in `client.ts` L129) | **1.3–2.2s healthy / 8s timeout / ~10.4s 502 slow-fail** ← THE DELAY                            |
| 4. HTML response → client render                                                                                                                         | ~300–600ms TTFB observed when upstream cached/healthy; total download 5.7–9.4s (200–313KB HTML) |
| 5. Catalog normalization + visible render                                                                                                                | negligible (in-memory pure functions, ~1,000s of records)                                       |

**Production page measurements (`/marketplace?network=…`):**

- Healthy window: TTFB **271–580ms**, full HTML 5.7–8.6s, registry renders READY
- Unhealthy window: TTFB ~2.2s, full **8.5–10.3s**, HTML contains BOTH
  "Waiting for ERC-8004 Registry" (the RegistryStatusCount when
  `catalogReady=false`) AND "Registry offline" (the RegistryOffline card for
  the error `data.state`) — **cards may still render from a partially
  successful read, but the status/count line reports waiting and the error
  card renders for failed discovery buckets**

**Conclusion (F):** the 5–10s delay is **(4) registry timeout +
(2) data-fetch delay combined** — specifically, the server render waits on
8004scan reads that currently slow-fail at ~10.4s (502) or hit the 8s app
timeout. It is NOT navigation delay and NOT rendering delay.

## 3. B. The exact request behind the status messages

| Attribute                       | Value                                                                                                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint                        | `GET https://8004scan.io/api/v1/public/agents?page=1&limit=24&chainId=56\|97&isTestnet=…&sortBy=created_at&sortOrder=desc` (catalog) + 4× `…&search=<category>` (discovery) — issued server-side (Vercel function, iad1)                           |
| Source                          | **8004scan public API** (third-party indexer) — NOT on-chain RPC, NOT an internal marketplace API                                                                                                                                                  |
| HTTP status on failure          | **502** with body `{"success":false,"error":{"code":"BACKEND_ERROR","message":"An error occurred while fetching data from the backend"}}`                                                                                                          |
| Response time (failing)         | ~10,300–11,200ms (upstream slow-fail)                                                                                                                                                                                                              |
| App timeout                     | **8,000ms** AbortController (`apps/web/lib/eight004scan/client.ts` L129 → `packages/data-api/src/client.ts` L116–122) — a hanging read aborts at 8s; the observed 502s arrive at ~10.4s (before/around the timeout, both produce non-ready states) |
| Retry behavior                  | **None** (single read per surface; the UI's "Retry" button re-runs the page load)                                                                                                                                                                  |
| Failure class                   | **Upstream/third-party** (8004scan backend), not the marketplace app, not the browser, not BSC RPC                                                                                                                                                 |
| "Waiting for ERC-8004 Registry" | `marketplace-view.tsx` L119 — renders whenever `catalogReady` is false (registry/count status line)                                                                                                                                                |
| "Registry offline"              | `RegistryOffline` card (`marketplace-view.tsx` ~L888+) — renders for non-ready `data.state` (server-error/network-error/timeout mapping in `marketplace.ts` `mapStatusToState`)                                                                    |

## 4. C. Network scope isolation (verified — X.243 behavior confirmed live)

- Mainnet selected → only `chainId=56` requests (1 catalog + 4 discovery).
- Testnet selected → only `chainId=97` requests.
- **No dual-network fetch on switch** (the scope resolves server-side from
  the URL; the X.243 harness asserts single-chain reads and production HTML
  confirms per-scope chain-only content).
- The delay is NOT caused by double-fetching — each switch performs exactly
  5 upstream reads for ONE chain (all parallel).

## 5. D. Cache/refetch analysis

- `force-dynamic` + `revalidate = 0` + `cache: "no-store"` → **every switch
  and every refresh performs a full fresh upstream fetch** (by design — the
  X.231 truthful-catalog decision).
- No client cache, no memoization, no dedup exists (server-props
  architecture; no react-query/SWR).
- Mainnet → Testnet → Mainnet therefore = 3 full page loads = 15 upstream
  reads. **With a healthy upstream this costs ~1.3–2.2s per switch; with the
  current flaky upstream it costs 8–10.4s per switch.** The refetch-per-
  switch design amplifies the upstream problem but is not itself the
  primary delay today.

## 6. E. UI dependency analysis

**Yes — the switch IS blocked on registry availability, structurally.** The
modal (X.243) closes when the new scope prop arrives; the new scope prop
arrives only when the server finishes the upstream reads; the upstream reads
are awaited before ANY response. So the user waits for the full data fetch
before the modal closes and the new catalog paints. The selector is
mechanically correct (it always completes — bounded by the fallback), but
its completion latency is coupled to the slowest upstream read. An ideal
architecture would close the modal on navigation commit and stream/paint the
catalog separately (Next.js Suspense/loading boundaries per section), which
the current single-await page does not do.

## 7. Is the registry healthy?

- **On-chain ERC-8004 registries (chain 56/97): HEALTHY** (all on-chain
  reads in this session and prior milestones respond normally).
- **8004scan indexer API: UNHEALTHY/DEGRADED as of this diagnostic window**
  — ~50% 502 failure rate with ~10.4s slow-fails across filtered and
  unfiltered reads, on both chains, from multiple vantage points (local
  machine and the Vercel server function). One earlier 100% 502 episode
  (both chains, ~11s), then partial recovery (4/8 ok at 1.3–2.2s). This
  matches the user-reported intermittent "Registry offline".

## 8. Recommended minimal fix (PROPOSED ONLY — NOT implemented)

The marketplace cannot fix 8004scan. Minimal, low-risk app-side mitigations
(in priority order):

1. **Per-request upstream timeout reduction + fast-fail**: lower the catalog
   read timeout from 8s to ~4s (a healthy 8004scan read completes in
   ~0.7–2.2s). A flaky upstream then fails in 4s instead of blocking the
   render for 8–10.4s, and the honest "Registry offline + Retry" state
   appears sooner. Files: `apps/web/lib/eight004scan/client.ts` (one
   constant).
2. **Short server-side cache (e.g. `revalidate = 30`–60s or an in-memory
   per-scope TTL cache for the 5 reads)**: a Mainnet→Testnet→Mainnet
   round-trip then reuses ≤60s-old data instead of 15 fresh reads. This is
   the biggest UX win after an outage-free window, at the cost of
   staleness ≤60s (the truthful-counts wording already says "indexed
   agents", not "live"). Files: `apps/web/app/(app)/marketplace/page.tsx`
   (+ possibly a tiny cache helper). NOTE: this changes the X.231
   "always-fresh" decision — needs explicit approval.
3. **Do NOT** couple the modal close to data arrival (option E): the X.243
   modal already closes on the scope prop; decoupling would require
   streaming architecture changes (Suspense boundaries) — larger risk,
   deferred.

**Expected latency after fix 1+2:** healthy upstream → switch in
**~0.5–1.5s** (TTFB + cached/fresh read); degraded upstream → honest offline
state in **≤4s** instead of 8–10.4s.

**Risks/regressions:** (1) timeout reduction could false-fail slow-but-
healthy reads (~2.2s worst observed healthy; 4s keeps ~1.8× headroom);
(2) any caching weakens the X.231 "never stale" guarantee and must be
reflected in the truthful-counts copy + harness; (3) both changes are
catalog-display-only — zero commercial/hire-path impact (hire reads do not
use these paths).

**Files that would need modification (for a future authorized milestone):**

- `apps/web/lib/eight004scan/client.ts` (timeout)
- `apps/web/app/(app)/marketplace/page.tsx` (caching, if approved)
- `apps/web/lib/eight004scan/network-selector.verify.ts` + `marketplace.verify.ts` (assertion updates only if caching changes no-store expectations)

## 9. Tests (run, unchanged)

| Suite                                       | Result           |
| ------------------------------------------- | ---------------- |
| network-selector.verify (X.216/231/232/243) | **92/92 PASS**   |
| marketplace.verify                          | **104/104 PASS** |
| X.149 user-hire (commercial-path safety)    | ALL PASS         |
| mainnet-hire-preflight                      | 27/27 PASS       |

No tests were modified.

## 10. Status

**PASS — root cause identified, minimal fix proposed but NOT implemented.**

Root cause: third-party 8004scan indexer API instability (~50% 502 at
~10.4s during the measurement window) combined with a by-design
always-fresh server-rendered catalog that blocks each network switch on the
full upstream waterfall (8s app timeout worst case). The on-chain registries
and the marketplace app are healthy; the X.243 isolation/switch code is
working exactly as designed (the modal always completes; the observed delay
is upstream data-fetch, not the switch mechanism).

**STOP — diagnostic complete. No code changed, nothing committed, nothing
deployed. Awaiting direction on the proposed minimal fix.**

## Addendum — X.245 fix status

The proposed minimal fix (option 1: timeout reduction 8s to 4s) was
user-authorized and implemented in X.245 (commit recorded in
X245-Registry-Latency-Fix.md). Option 2 (the 30-60s server cache) was
explicitly NOT approved and NOT implemented. A second finding was fixed in
X.245: the chain-56 agent Hire card's permanently-disabled state was a
stale X.234-era UI guard (Category C), unrelated to this registry
degradation; see X245-Registry-Latency-Fix.md section 3.
