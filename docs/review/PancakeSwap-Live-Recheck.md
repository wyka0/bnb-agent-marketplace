# PancakeSwap Live Recheck

Date: 2026-08-11

## 1. Current Official Source

- **OFFICIAL SOURCE:** NodeReal PancakeSwap GraphQL v2 (Free), the current
  keyed BSC V2 GraphQL package identified by the task and prior source
  verification.
- **REPOSITORY FACT:** production already targets NodeReal Free by default;
  no obsolete StreamingFast endpoint was called during this recheck.
- **REPOSITORY FACT:** the existing adapter is read-only and exposes no swap,
  approval, Permit2, liquidity, wallet, signer, or transaction path.

## 2. Endpoint

- **OFFICIAL SOURCE:** endpoint pattern:
  `https://open-platform.nodereal.io/{API_KEY}/pancakeswap-free/graphql`.
- **REPOSITORY FACT:** `buildPancakeSwapEndpoint` / the local credential
  resolver use this Free product path (with a harmless trailing slash in the
  production builder).
- **VERIFIED:** the live request used the configured credential only as the
  URL path segment. The authenticated URL and key were never printed or
  returned.

## 3. Key Presence

- **LIVE DATA:** process environment at command launch: key absent.
- **LIVE DATA:** secure workspace `.env.local`: `PANCAKESWAP_API_KEY` present
  and non-empty (presence-only parse).
- **LIVE DATA:** effective recheck status: **KEY PRESENT**.
- **VERIFIED:** the key value was not printed, logged, added to source, added
  to this report, or returned to the user.

## 4. Minimal GraphQL Test

- **LIVE DATA:** exactly one minimal POST was sent with query
  `{ __typename }`.
- **LIVE DATA:** HTTP status: `500`.
- **LIVE DATA:** content type: `application/json; charset=utf-8`.
- **LIVE DATA:** response was JSON-parseable.
- **LIVE DATA:** GraphQL `data`: absent.
- **LIVE DATA:** GraphQL `errors[]`: absent.
- **LIVE DATA:** `__typename`: absent.
- **VERIFIED:** minimal query result: **FAIL**.
- **VERIFIED:** no retry was performed.

## 5. Pool Query Test

- **REPOSITORY FACT:** the existing `PAIRS_QUERY` selects `id`, `name`,
  token0/token1 identity and symbols, `reserve0`, `reserve1`, `reserveUSD`,
  `reserveBNB`, token prices, cumulative `volumeUSD`,
  `untrackedVolumeUSD`, and `totalTransactions`.
- **VERIFIED:** the pool request was conditional on minimal-query success.
- **LIVE DATA:** the minimal request failed with HTTP 500, so the conditional
  pool query was **NOT SENT**.
- **LIVE DATA:** pool query result: **FAIL / NOT RUN DUE TO MINIMAL SOURCE
  FAILURE**.
- **LIVE DATA:** pools returned: `0` (no pool request/response; not an empty
  successful data result).
- **VERIFIED:** no production fallback or retry was invoked by this dedicated
  recheck.

## 6. HTTP Status

- **LIVE DATA:** minimal query: HTTP `500`.
- **LIVE DATA:** pool query: no HTTP status because it was not sent.
- **LIVE DATA:** Premium: **NOT TESTED / NOT AVAILABLE**. No credential signal
  establishing Premium entitlement was used; no subscription or paid request
  was attempted.

## 7. Response Result

- **LIVE DATA:** response body shape: parseable JSON object without standard
  GraphQL `data` or `errors[]` fields.
- **LIVE DATA:** no pool rows, token fields, reserve values, volume, prices,
  or transaction counts were available to verify live.
- **REPOSITORY FACT:** offline fixtures continue to verify those fields and
  honest error handling, but fixtures are not live-data proof.
- **LIVE DATA:** query success: **NO**.

## 8. Error Classification

- **LIVE DATA:** the server returned HTTP 500 for the smallest valid GraphQL
  introspection query before any production pool query was attempted.
- **INFERENCE:** exact sanitized category: **NodeReal Free source/server
  error**.
- **INFERENCE:** this is not a client-side `PAIRS_QUERY` validation failure,
  because `PAIRS_QUERY` was never sent.
- **INFERENCE:** this is not a normal rate limit response (HTTP 429), nor an
  explicit authentication response (401/403), based on the observed status.
- **UNKNOWN:** whether the underlying source-side cause is Free-package
  availability, quota/CU exhaustion represented as HTTP 500, or another
  NodeReal backend fault. The body did not include a standard GraphQL error or
  machine-readable category.
- **REPOSITORY FACT:** prior bounded observations documented the same Free
  package HTTP 500 behavior for `__typename` with the configured key. The
  current recheck confirms that behavior persists.
- **OFFICIAL SOURCE:** the two attempted NodeReal documentation URLs for error
  codes/API-key guidance returned 404 during this recheck, so no unsupported
  mapping from HTTP 500 to a more specific NodeReal error was made.

## 9. Security

- **VERIFIED:** key remains server-only in `PANCAKESWAP_API_KEY`.
- **VERIFIED:** no `NEXT_PUBLIC_PANCAKE*` variable is configured in the current
  process or `.env.local`.
- **VERIFIED:** production reads the key from `process.env` only and does not
  set Authorization/Bearer headers.
- **VERIFIED:** `.next/static` contains no `PANCAKESWAP_API_KEY`,
  `NEXT_PUBLIC_PANCAKE`, NodeReal host, Free GraphQL path, Authorization, or
  Bearer marker.
- **VERIFIED:** the key/authenticated endpoint was not printed by the live
  command and is absent from this report.
- **VERIFIED:** no wallet, signature, payment, swap, approval, liquidity
  operation, or transaction occurred.

## 10. Recommendation

- **INFERENCE:** do not change production query/schema/constants based on this
  check. The minimal query itself fails before the existing pool query is
  involved.
- **INFERENCE:** retain the current honest `server-error` UI state and treat
  NodeReal Free as an external source blocker.
- **INFERENCE:** contact NodeReal or inspect the account dashboard privately
  for Free-package status/quota/CU information; do not expose the key in a
  support artifact.
- **UNKNOWN:** whether source recovery, quota reset, or an explicitly entitled
  Premium package would resolve the issue. Premium was not tested.
- **REPOSITORY FACT:** production code needs changing: **NO** for this result.

---

## FINAL STATUS

PANCAKESWAP STATUS:
AUTHENTICATED BUT SOURCE ERROR

- key present: **YES**
- minimal query: **FAIL**
- pool query: **FAIL / NOT SENT after minimal failure**
- HTTP status: **500** (minimal query)
- number of pools returned: **0** (pool query not sent)
- exact sanitized error category: **NodeReal Free source/server error;
  specific quota/package/backend cause UNKNOWN**
- production code needs changing: **NO**
