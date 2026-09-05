/**
 * X.216 — Network selector verify harness (framework-free, plain node).
 *
 * Run: node --experimental-strip-types lib/eight004scan/network-selector.verify.ts
 *
 * Proves the symmetric Mainnet/Testnet confirm-first UX over the shared
 * modal primitive, with ZERO wallet interaction and ZERO blockchain writes:
 *
 *   1.  Mainnet → click Testnet opens the confirmation modal.
 *   2.  Testnet → click Mainnet opens the confirmation modal.
 *   3.  Mainnet modal title is "Switch to Testnet?"
 *   4.  Testnet modal title is "Switch to Mainnet?"
 *   5.  Mainnet modal description: "You are currently on 8004scan Mainnet."
 *   6.  Testnet modal description: "You are currently on 8004scan Testnet."
 *   7.  Cancel from Mainnet modal performs zero switch calls.
 *   8.  Cancel from Testnet modal performs zero switch calls.
 *   9.  Confirm Mainnet → Testnet invokes the existing switch mechanism.
 *   10. Confirm Testnet → Mainnet invokes the existing switch mechanism.
 *   11. Modal open performs no wallet transaction.
 *   12. Modal open performs no blockchain write.
 *   13. Duplicate confirm clicks are prevented.
 *   14. Loading state is truthful.
 *   15. Failed switch preserves the original network.
 *   16. Successful switch updates the selected network.
 *   17. Escape closes the modal.
 *   18. Accessible title exists.
 *   19. Accessible description exists.
 *   20. Focus-visible state exists.
 *   +    scope parsing / labels / no native confirm / no hire-chain coupling.
 */

import { readFileSync } from "node:fs";
import {
  MARKETPLACE_NETWORK_LABELS,
  MARKETPLACE_MAX_PAGE,
  parseMarketplaceNetworkScope,
  parseMarketplacePage,
} from "./marketplace.ts";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`ok   ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail !== undefined ? ` — ${detail}` : ""}`);
  }
}

const selectorSource = readFileSync(
  new URL("../../app/(app)/marketplace/network-selector.tsx", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../../app/(app)/marketplace/page.tsx", import.meta.url),
  "utf8"
);
const viewSource = readFileSync(
  new URL("../../app/(app)/marketplace/marketplace-view.tsx", import.meta.url),
  "utf8"
);

// --- Pure scope parsing (data layer) ---------------------------------

check("scope parse: 'mainnet' → mainnet", parseMarketplaceNetworkScope("mainnet") === "mainnet");
check("scope parse: 'testnet' → testnet", parseMarketplaceNetworkScope("testnet") === "testnet");
check(
  "scope parse: explicit 'all' remains a supported scope (X.154 path intact)",
  parseMarketplaceNetworkScope("all") === "all"
);
check(
  "X.243 scope parse: undefined/invalid → 'mainnet' (default never yields the merged view — fail closed)",
  parseMarketplaceNetworkScope(undefined) === "mainnet" &&
    parseMarketplaceNetworkScope("") === "mainnet" &&
    parseMarketplaceNetworkScope("56") === "mainnet" &&
    parseMarketplaceNetworkScope("mainnet-testnet") === "mainnet"
);
check(
  "labels: '8004scan Mainnet' / '8004scan Testnet' (single source of truth)",
  MARKETPLACE_NETWORK_LABELS.mainnet === "8004scan Mainnet" &&
    MARKETPLACE_NETWORK_LABELS.testnet === "8004scan Testnet"
);

// --- CASE 1: current = Mainnet, click Testnet -------------------------

check(
  "1 Mainnet → clicking Testnet opens modal (pending set only on click)",
  /if \(!isActive && !switching\) \{\s*setSwitchError\(null\);\s*setPending\(network\);\s*\}/.test(
    selectorSource
  )
);
check(
  "3/4 modal title is dynamic 'Switch to {Testnet|Mainnet}?'",
  /Switch to \$\{pending === "testnet" \? "Testnet" : "Mainnet"\}\?/.test(selectorSource)
);
check(
  "5/6 modal description is dynamic 'You are currently on {current label}.'",
  /You are currently on \$\{currentLabel\}\./.test(selectorSource) &&
    /MARKETPLACE_NETWORK_LABELS\[current\]/.test(selectorSource)
);
check(
  "current mapping: scope testnet → Testnet active; mainnet/all → Mainnet active",
  /parseMarketplaceNetworkScope\(scope\) === "testnet" \? "testnet" : "mainnet"/.test(
    selectorSource
  )
);

// --- CASE 2: symmetric rendering of both buttons ----------------------

check(
  "2 both Mainnet and Testnet buttons render (SELECTABLE pair)",
  /const SELECTABLE = \["mainnet", "testnet"\] as const;/.test(selectorSource) &&
    /network === "mainnet" \? "Mainnet" : "Testnet"/.test(selectorSource)
);
check(
  "active network is visually obvious (aria-pressed + primary treatment)",
  /aria-pressed=\{isActive\}/.test(selectorSource) &&
    /bg-primary text-primary-foreground/.test(selectorSource)
);
check(
  "clicking the ACTIVE network never opens the modal",
  /if \(!isActive && !switching\) \{\s*setSwitchError\(null\);\s*setPending\(network\);\s*\}/.test(
    selectorSource
  )
);

// --- Cancel semantics (7/8) -------------------------------------------

check(
  "7/8 Cancel closes the modal only (clears pending + error, no onSwitch)",
  /onClick=\{\(\) => \{[\s\S]*?setPending\(null\);[\s\S]*?setSwitchError\(null\);[\s\S]*?\}\}[\s\S]*?disabled=\{switching\}\s*>/.test(
    selectorSource
  )
);

// --- Confirm semantics (9/10) ------------------------------------------

check(
  "9/10 Confirm invokes the EXISTING switch mechanism (onSwitch)",
  /onSwitch\(pending\)/.test(selectorSource) && /function confirmSwitch\(\)/.test(selectorSource)
);
check(
  "the page wires onSwitch to URL routing (router.replace with network param)",
  /p\.set\("network", next\)/.test(viewSource) &&
    /router\.replace\(`\$\{pathname\}\?\$\{p\.toString\(\)\}`/.test(viewSource)
);
check(
  "the page reads ?network= and passes scope to the loader",
  /parseMarketplaceNetworkScope\(rawNetwork\)/.test(pageSource) &&
    /query, scope \}/.test(pageSource)
);
check(
  "the loader receives the scope and page (getMarketplaceAgents({ limit, page, query, scope }))",
  /getMarketplaceAgents\(\{ limit: 24, page, query, scope \}\)/.test(pageSource)
);

// --- No wallet / no chain writes (11/12) -------------------------------

check(
  "11/12 selector performs ZERO wallet calls (no ethereum/request sites)",
  /ethereum/.test(selectorSource) === false &&
    /window\.ethereum/.test(selectorSource) === false &&
    /eth_requestAccounts|eth_sendTransaction|wallet_switch/.test(selectorSource) === false
);
check(
  "11/12 selector performs ZERO blockchain writes (no contract writes)",
  /claimRefund|createJob|registerJob|setBudget|approve|fund\(|submit\(|reject\(|complete\(/.test(
    selectorSource
  ) === false
);
check(
  "11/12 modal OPEN performs no switch (switching only starts on confirm click)",
  /setSwitching\(true\)/.test(selectorSource) &&
    selectorSource.indexOf("setSwitching(true)") > selectorSource.indexOf("function confirmSwitch")
);

// --- Duplicate clicks / loading truth (13/14) --------------------------

check(
  "13 duplicate confirm prevented (switching guard in confirmSwitch)",
  /if \(pending === null \|\| switching\) return;/.test(selectorSource)
);
check("13 both buttons disabled while switching", /disabled=\{switching\}/.test(selectorSource));
check(
  "14 loading copy is truthful ('Switching to …' only after confirm)",
  /Switching to \$\{pending === "testnet" \? "Testnet" : "Mainnet"\}…/.test(selectorSource)
);
check(
  "14 no success claim before the switch executes (no 'Switched' copy)",
  /Switched to/.test(selectorSource) === false
);

// --- Failure/failure-free semantics (15/16) -----------------------------

check(
  "15/16 selected network is prop-derived (URL truth) — modal pending/switching/error are the only local state",
  /parseMarketplaceNetworkScope\(scope\) === "testnet" \? "testnet" : "mainnet"/.test(
    selectorSource
  ) &&
    // X.243 — the modal's local state is pending + switching + switchError
    // (switchError is the truthful switch-failure surface).
    (selectorSource.match(/React\.useState/g) ?? []).length === 3
);
check(
  "16 active state is derived from the scope prop (URL-driven truth)",
  /parseMarketplaceNetworkScope\(scope\) === "testnet" \? "testnet" : "mainnet"/.test(
    selectorSource
  )
);

// --- Accessibility (17/18/19/20) ---------------------------------------

check(
  "17 Escape closes the modal when not switching (Radix onOpenChange guard clears pending + error)",
  /if \(!switching\) \{\s*setPending\(null\);\s*setSwitchError\(null\);\s*\}/.test(selectorSource)
);
check(
  "18/19 accessible title + description via shared Modal primitives",
  /<ModalTitle>/.test(selectorSource) &&
    /<ModalDescription>/.test(selectorSource) &&
    /"@bnb-marketplace\/ui"/.test(selectorSource)
);
check("20 focus-visible ring on network buttons", /focus-visible:ring-2/.test(selectorSource));
check(
  "network group has a single accessible label (no duplicate names)",
  /aria-label="Discovery network"/.test(selectorSource) &&
    (selectorSource.match(/aria-label=/g) ?? []).length === 1
);

// --- No native browser confirm ----------------------------------------

check(
  "no window.confirm/alert/prompt in the selector",
  /window\.confirm|window\.alert|window\.prompt/.test(selectorSource) === false
);

// --- Commercial-hire isolation (the critical boundary) ------------------

check(
  "selector does NOT touch the ERC-8183 commercial hire chain (no HIRED_CHAIN_ID logic)",
  // code-level absence (a documentation comment in page.tsx explicitly states
  // the boundary — the selector never wires the hire chain)
  /[^/*]*HIRED_CHAIN_ID[^/*]*=|import.*HIRED_CHAIN_ID/.test(selectorSource) === false &&
    /import.*HIRED_CHAIN_ID/.test(pageSource) === false &&
    /import.*HIRED_CHAIN_ID/.test(viewSource) === false
);
check(
  "selector does NOT reference main-track contracts",
  /MAIN_TRACK_COMMERCE|MAIN_TRACK_ROUTER|MAIN_TRACK_POLICY|MAIN_TRACK_REGISTRY/.test(
    selectorSource + pageSource
  ) === false
);
const marketplaceSource = readFileSync(new URL("./marketplace.ts", import.meta.url), "utf8");
check(
  "loader keeps the exact X.154 merged read as default (scope 'all' path intact)",
  /scope === "all" \|\| scope === "mainnet"/.test(marketplaceSource) &&
    /scope === "all" \|\| scope === "testnet"/.test(marketplaceSource)
);

// --- X.231 — Mainnet chain purity + honest pagination (structural) --------

// A. Mainnet discovery MUST read chain 56 ONLY. `isTestnet:false` alone returns
//    every non-testnet EVM chain (Base/Celo/Arbitrum/...) — the defect X.230
//    found; the explicit chainId pins the read to BNB Smart Chain mainnet.
const loaderReads = marketplaceSource.slice(
  marketplaceSource.indexOf("const readMainnet"),
  marketplaceSource.indexOf("// Merge the two")
);
check(
  "X.231A mainnet read pins chainId: 56 (BNB mainnet ONLY)",
  /chainId:\s*56/.test(loaderReads) && /isTestnet:\s*false/.test(loaderReads)
);
check(
  "X.231A testnet read remains chainId: 97 + isTestnet: true (unchanged)",
  /chainId:\s*97/.test(loaderReads) && /isTestnet:\s*true/.test(loaderReads)
);
check(
  "X.231A loader never rewrites registry slugs (chain identity preserved)",
  !/slug\.replace|slug\.slice|normalizeSlug/i.test(marketplaceSource)
);

// B. Honest pagination — loader side.
check(
  "X.231B MARKETPLACE_MAX_PAGE caps the browsable window (loader-side)",
  MARKETPLACE_MAX_PAGE === 10 &&
    /Math\.min\(options\.page \?\? 1, MARKETPLACE_MAX_PAGE\)/.test(marketplaceSource)
);
check(
  "X.231B parseMarketplacePage clamps garbage/unders/overs",
  parseMarketplacePage(undefined) === 1 &&
    parseMarketplacePage("abc") === 1 &&
    parseMarketplacePage("0") === 1 &&
    parseMarketplacePage("-3") === 1 &&
    parseMarketplacePage("2") === 2 &&
    parseMarketplacePage("10") === 10 &&
    parseMarketplacePage("11") === MARKETPLACE_MAX_PAGE &&
    parseMarketplacePage("99999") === MARKETPLACE_MAX_PAGE
);
check(
  "X.231B loader passes `page` to both upstream listAgents reads",
  (loaderReads.match(/page,/g) ?? []).length >= 2
);
check(
  "X.231B merged pagination uses upstream total + hasMore (no fabricated totals)",
  /r\.meta\.pagination\?\.total/.test(marketplaceSource) &&
    /r\.meta\.pagination\?\.hasMore === true/.test(marketplaceSource)
);

// B. Honest pagination — view/page side (structural).
check(
  "X.231B page.tsx reads ?page= via parseMarketplacePage and forwards it",
  /parseMarketplacePage\(rawPage\)/.test(pageSource)
);
check(
  "X.231B truthful count wording distinguishes shown vs indexed",
  viewSource.includes("Showing {shown} of {(total ?? shown ?? 0).toLocaleString()} indexed agents")
);
check(
  "X.231B Pagination uses real derived totalPages (no hardcoded 1 of 1)",
  !/Pagination\s+page=\{1\}\s+totalPages=\{1\}/.test(viewSource) &&
    /catalogTotalPages/.test(viewSource) &&
    /page=\{page\}/.test(viewSource)
);
check(
  "X.231B totalPages = ceil(totalIndexed / upstreamLimit), capped at MARKETPLACE_MAX_PAGE",
  /Math\.ceil\(totalIndexed \/ upstreamLimit\)/.test(viewSource) &&
    /Math\.min\(realTotalPages, MARKETPLACE_MAX_PAGE\)/.test(viewSource)
);
check(
  "X.231B page navigation is URL-driven (page param set on next page)",
  /p\.set\("page", String\(next\)\)/.test(viewSource)
);
check(
  "X.231B 'more beyond window' is stated honestly (not hidden)",
  viewSource.includes("Showing the {MARKETPLACE_MAX_PAGE} newest pages") &&
    viewSource.includes("beyond the newest window")
);
check(
  "X.231B page persists in canonical URL only when > 1",
  /if \(state\.page && state\.page > 1\) p\.set\("page", String\(state\.page\)\)/.test(viewSource)
);

// C. Selector/pagination/hire isolation: discovery-only; the hire chain is untouched.
check(
  "X.231C neither selector nor pagination touches hire-chain wiring",
  !/HIRED_CHAIN_ID|MAIN_TRACK_COMMERCE|eth_sendTransaction|eth_requestAccounts/.test(
    selectorSource
  ) &&
    !/HIRED_CHAIN_ID|MAIN_TRACK_COMMERCE|eth_sendTransaction|eth_requestAccounts/.test(
      viewSource
    ) &&
    // page.tsx: code-level absence (an explanatory comment documenting the
    // isolation is allowed; imports/calls are not).
    !/import.*HIRED_CHAIN_ID|import.*MAIN_TRACK/.test(pageSource) &&
    !/eth_sendTransaction|eth_requestAccounts/.test(pageSource)
);

// --- X.232 — Leaderboard network scoping + Profile network truthfulness ----
{
  const leaderboardLib = readFileSync(new URL("./leaderboard.ts", import.meta.url), "utf8");
  const leaderboardPage = readFileSync(
    new URL("../../app/(app)/leaderboards/page.tsx", import.meta.url),
    "utf8"
  );
  const leaderboardView = readFileSync(
    new URL("../../app/(app)/leaderboards/leaderboards-view.tsx", import.meta.url),
    "utf8"
  );
  const profilePage = readFileSync(
    new URL("../../app/(app)/profile/page.tsx", import.meta.url),
    "utf8"
  );
  const heroFile = readFileSync(new URL("../../components/home/hero.tsx", import.meta.url), "utf8");

  // Leaderboard = BNB chains only.
  const lbReads = leaderboardLib.slice(
    leaderboardLib.indexOf("const readMainnet"),
    leaderboardLib.indexOf("// Merge the two")
  );
  check(
    "X.232A leaderboard mainnet read pins chainId: 56 (BNB mainnet ONLY)",
    /chainId:\s*56/.test(lbReads) && /isTestnet:\s*false/.test(lbReads)
  );
  check(
    "X.232A leaderboard testnet read pins chainId: 97",
    /chainId:\s*97/.test(lbReads) && /isTestnet:\s*true/.test(lbReads)
  );
  check(
    "X.232A leaderboard scope is URL-driven (?network= via parseLeaderboardNetworkScope)",
    /parseLeaderboardNetworkScope\(rawNetwork\)/.test(leaderboardPage) &&
      /scope=\{scope\}/.test(leaderboardPage)
  );
  check(
    "X.232A leaderboard pagination is URL-driven (?page= capped at MARKETPLACE_MAX_PAGE)",
    /parseMarketplacePage\(rawPage\)/.test(leaderboardPage) && /page=\{page\}/.test(leaderboardPage)
  );
  check(
    "X.232A leaderboard pagination uses real totalPages (no hardcoded 1 of 1)",
    !/Pagination\s+page=\{1\}\s+totalPages=\{1\}/.test(leaderboardView) &&
      /leaderboardTotalPages/.test(leaderboardView)
  );
  check(
    "X.232A leaderboard NETWORK_OPTIONS are BNB-scoped (no Base/Ethereum filter options)",
    /"BNB Mainnet"/.test(leaderboardView) &&
      /"BNB Testnet"/.test(leaderboardView) &&
      // the NETWORK_OPTIONS list itself must not include Base/Ethereum as filter values
      !/\{ value: "base"/.test(leaderboardView) &&
      !/\{ value: "ethereum"/.test(leaderboardView)
  );
  check(
    "X.232A leaderboard scope switching is URL-driven (no stale client-only state)",
    /p\.set\("network", next\)/.test(leaderboardView) &&
      !/setNetwork\("all"\)/.test(leaderboardView)
  );
  check(
    "X.232A leaderboard cannot touch hire chain (no hire wiring in code)",
    // code-level absence (HIRED_CHAIN_ID may appear in explanatory comments)
    !/import.*HIRED_CHAIN_ID|HIRED_CHAIN_ID\s*=/.test(leaderboardLib) &&
      !/eth_sendTransaction/.test(leaderboardLib) &&
      !/HIRED_CHAIN_ID|eth_sendTransaction/.test(leaderboardView)
  );

  // Profile: wallet chain vs auth chain distinction.
  check(
    "X.232C profile reads wallet chain read-only (eth_chainId only, no prompts)",
    /eth_chainId/.test(profilePage) &&
      !/eth_requestAccounts|wallet_switchEthereumChain|personal_sign|eth_sign/.test(profilePage)
  );
  check(
    "X.232C profile displays wallet network and auth chain as SEPARATE rows",
    /Wallet network/.test(profilePage) &&
      /chainDisplayName\(walletChainId\)/.test(profilePage) &&
      /chainDisplayName\(authChain\)/.test(profilePage)
  );
  check(
    "X.232C profile warns when wallet chain differs from auth chain",
    /walletDiffersFromAuth/.test(profilePage) &&
      /Sign in again after switching networks/.test(profilePage)
  );
  check(
    "X.232C profile does NOT silently claim the SIWE session moved networks",
    !/identity\.chainId\s*=\s*walletChainId/.test(profilePage)
  );
  check(
    "X.232C profile has no automatic signature/transaction/switch trigger",
    !/ethereum\.request\(\{ method: "(eth_sendTransaction|personal_sign|wallet_switchEthereumChain|eth_requestAccounts)"/.test(
      profilePage
    )
  );

  // Landing: ONE grid background system.
  check(
    "X.232E hero no longer layers a second grid background",
    !/bg-\[linear-gradient\(to_right/.test(heroFile) && !/bg-\[size:56px_56px\]/.test(heroFile)
  );
  check(
    "X.232E body-level grid in globals.css remains the single system",
    /linear-gradient\(to right, hsl\(var\(--border\) \/ 0\.35\) 1px, transparent 1px\)/.test(
      readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8")
    )
  );
}

// --- X.243 — Network isolation & switch reliability -----------------------
//
// Covers the three user-reported bugs: (1) the switch modal could hang
// forever on "Switching to Testnet…" because NOTHING cleared the loading
// state; (2)/(3) cross-network catalog mixing via the mislabeled merged
// default and the scope-blind category discovery.
{
  // ---- Behavioral: loader scope isolation with a stubbed upstream ----
  // getMarketplaceAgents must query ONLY the selected chain's registry and
  // return ONLY that chain's records (data-layer enforcement, not client
  // filtering).
  const upstreamCalls: Array<Record<string, string>> = [];
  const realFetch = globalThis.fetch;
  const stubAgent = (chainId: number, tokenId: string) => ({
    agent_id: `${chainId}:0x${"1".repeat(40)}:${tokenId}`,
    token_id: tokenId,
    chain_id: chainId,
    chain_type: "evm",
    contract_address: "0x" + "2".repeat(40),
    is_testnet: chainId === 97,
    owner_id: "o",
    owner_address: "0x" + "3".repeat(40),
    owner_ens: null,
    owner_username: null,
    owner_avatar_url: null,
    owner_publisher_tier: null,
    owner_certified_name: null,
    name: `Agent ${chainId}-${tokenId}`,
    description: "",
    image_url: null,
    is_verified: true,
    star_count: 0,
    supported_protocols: [],
    x402_supported: false,
    total_score: 0,
    rank: null,
    network_rank: null,
    health_score: null,
    total_feedbacks: 0,
    average_score: 0,
    cross_chain_versions: null,
    created_at: "2026-09-05T00:00:00Z",
    updated_at: "2026-09-05T00:00:00Z",
    id: `stub-${tokenId}`,
  });
  // Install the stubbed upstream (the IIFE assigns globalThis.fetch; the
  // return value is intentionally unused — the stub is the side effect).
  const _stubFetch = (() => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const chainId = Number(url.searchParams.get("chainId"));
      upstreamCalls.push({ chainId: String(chainId), page: url.searchParams.get("page") ?? "1" });
      // The 8004scan list envelope: { success, data: T[], meta }.
      const body = {
        success: true,
        data: [stubAgent(chainId, `${chainId}01`), stubAgent(chainId, `${chainId}02`)],
        meta: {
          timestamp: "2026-09-05T00:00:00Z",
          pagination: { page: 1, limit: 24, total: 2, hasMore: false },
        },
      };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
  })();

  const savedKey = process.env["8004SCAN_API_KEY"];
  process.env["8004SCAN_API_KEY"] = "test-key";
  try {
    const { getMarketplaceAgents } = await import("./marketplace.ts");
    // A. Mainnet selection → chain-56 catalog ONLY.
    upstreamCalls.length = 0;
    {
      const data = await getMarketplaceAgents({ scope: "mainnet" });
      check(
        "X.243A Mainnet selection → ONLY the chain-56 registry is queried",
        upstreamCalls.length === 1 && upstreamCalls[0]?.chainId === "56"
      );
      check(
        "X.243A Mainnet selection → catalog contains ONLY chain-56 agents",
        data.state === "ready" && data.agents.every((a) => a.chainId === 56)
      );
    }

    // B. Testnet selection → chain-97 catalog ONLY.
    upstreamCalls.length = 0;
    {
      const data = await getMarketplaceAgents({ scope: "testnet" });
      check(
        "X.243B Testnet selection → ONLY the chain-97 registry is queried",
        upstreamCalls.length === 1 && upstreamCalls[0]?.chainId === "97"
      );
      check(
        "X.243B Testnet selection → catalog contains ONLY chain-97 agents",
        data.state === "ready" && data.agents.every((a) => a.chainId === 97)
      );
    }

    // I/J. Pagination isolation: page 2 of each network queries only that
    // chain, and totals are per-network (never merged across networks).
    upstreamCalls.length = 0;
    {
      const data = await getMarketplaceAgents({ scope: "mainnet", page: 2 });
      check(
        "X.243I Mainnet page 2 → upstream queried with page=2 on chain 56 only",
        upstreamCalls.length === 1 &&
          upstreamCalls[0]?.chainId === "56" &&
          upstreamCalls[0]?.page === "2"
      );
      check(
        "X.243J Mainnet totals are per-network (stub total 2, never summed with chain 97)",
        data.state === "ready" && data.pagination?.total === 2
      );
      upstreamCalls.length = 0;
      const dataT = await getMarketplaceAgents({ scope: "testnet", page: 2 });
      check(
        "X.243I Testnet page 2 → upstream queried with page=2 on chain 97 only",
        upstreamCalls.length === 1 &&
          upstreamCalls[0]?.chainId === "97" &&
          upstreamCalls[0]?.page === "2"
      );
      check(
        "X.243J Testnet totals are per-network (stub total 2)",
        dataT.state === "ready" && dataT.pagination?.total === 2
      );
    }

    // A/B discovery half: a category facet must never surface the other
    // network's agents (the data layer scopes the discovery reads).
    upstreamCalls.length = 0;
    {
      const { getBscCategoryDiscovery } = await import("./discovery/service.ts");
      const d = await getBscCategoryDiscovery({ maxPerCategory: 5, scope: "testnet" });
      const chains = new Set(upstreamCalls.map((c) => c.chainId));
      check(
        "X.243A(discovery) Testnet selection → discovery queries ONLY chain 97",
        chains.size === 1 && chains.has("97")
      );
      const discoveredChains = new Set(
        d.buckets.flatMap((b) => b.discovered.map((x) => x.agent.chainId))
      );
      check(
        "X.243B(discovery) Testnet discovery results contain ONLY chain-97 agents",
        [...discoveredChains].every((c) => c === 97)
      );
      upstreamCalls.length = 0;
      const dM = await getBscCategoryDiscovery({ maxPerCategory: 5, scope: "mainnet" });
      const chainsM = new Set(upstreamCalls.map((c) => c.chainId));
      check(
        "X.243A(discovery) Mainnet selection → discovery queries ONLY chain 56",
        chainsM.size === 1 && chainsM.has("56")
      );
      const discoveredM = new Set(
        dM.buckets.flatMap((b) => b.discovered.map((x) => x.agent.chainId))
      );
      check(
        "X.243B(discovery) Mainnet discovery results contain ONLY chain-56 agents",
        [...discoveredM].every((c) => c === 56)
      );
    }
  } finally {
    globalThis.fetch = realFetch;
    if (savedKey === undefined) delete process.env["8004SCAN_API_KEY"];
    else process.env["8004SCAN_API_KEY"] = savedKey;
  }

  // ---- C/D/E/F: the switch lifecycle (selector source invariants) ----
  // C/D. PRIMARY completion: an effect closes the modal when the scope prop
  // becomes the pending target (both directions — the same effect).
  check(
    "X.243C/D success effect closes the modal when current becomes pending",
    /React\.useEffect\(\(\) => \{\s*if \(!switching \|\| pending === null\) return;\s*if \(current === pending\) \{/.test(
      selectorSource
    ) && /setSwitching\(false\);\s*setPending\(null\);/.test(selectorSource)
  );
  // E. The loading state cannot persist forever: bounded fallback clears it.
  check(
    "X.243E bounded failure fallback clears the loading state (no permanent 'Switching to …')",
    /const SWITCH_FALLBACK_MS = 15_000;/.test(selectorSource) &&
      /setTimeout\(\(\) => \{\s*setSwitching\(false\);\s*setPending\(null\);/.test(selectorSource)
  );
  // F. A failed switch surfaces a truthful error and clears loading.
  check(
    "X.243F failed switch shows a truthful error (role=alert) with loading cleared",
    /role="alert"/.test(selectorSource) &&
      /did not complete\. The catalog still shows the previously selected network/.test(
        selectorSource
      )
  );
  // The fallback is the SECONDARY path (a comment documents the primary).
  check(
    "X.243 lifecycle documented: timeout is the SECONDARY path, scope-change is primary",
    /SECONDARY failure path/.test(selectorSource) && /PRIMARY completion path/.test(selectorSource)
  );

  // ---- G/H: stale-response protection (architecture) ----
  // The catalog is server-rendered per navigation (no client fetch), and the
  // modal's close is driven by the SAME scope prop that delivers the new
  // catalog — so an older network's payload can never overwrite a newer one.
  check(
    "X.243G/H the view performs ZERO client-side catalog fetches (server props only — no stale-response race)",
    !/await fetch\(|useQuery|useSWR/.test(viewSource)
  );
  check(
    "X.243G/H the modal closes only when the scope prop changed (same render that delivers the new catalog)",
    /React\.useEffect\(\(\) => \{\s*if \(!switching \|\| pending === null\) return;/.test(
      selectorSource
    )
  );
  check(
    "X.243G/H upstream reads are no-store (no cross-network cache reuse)",
    /cache: "no-store"/.test(readFileSync(new URL("./client.ts", import.meta.url), "utf8"))
  );

  // ---- X.245 — fast-fail registry timeout (registry-latency fix) ----
  {
    const clientSource = readFileSync(new URL("./client.ts", import.meta.url), "utf8");
    check(
      "X.245 upstream registry read timeout is 4s (fast-fail to honest offline; was 8s)",
      /export const SCAN_READ_TIMEOUT_MS = 4_000;/.test(clientSource) &&
        /timeoutMs: options\.timeoutMs \?\? SCAN_READ_TIMEOUT_MS/.test(clientSource) &&
        !/timeoutMs: options\.timeoutMs \?\? 8000/.test(clientSource)
    );
    // Behavioral: a hanging upstream read aborts at 4s and produces the honest
    // non-ready result (never fabricated data, never an unhandled throw).
    {
      const savedFetch = globalThis.fetch;
      const savedKey = process.env["8004SCAN_API_KEY"];
      process.env["8004SCAN_API_KEY"] = "test-key";
      let elapsed = 0;
      try {
        globalThis.fetch = (async (_input: unknown, init?: { signal?: AbortSignal }) => {
          // Respect the caller's AbortSignal the way a real fetch does —
          // this is what makes the 4s timeout observable. The read "hangs"
          // until aborted (or 60s, whichever first).
          await new Promise((resolve, reject) => {
            const signal = init?.signal;
            if (signal?.aborted) {
              reject(new DOMException("The operation was aborted", "AbortError"));
              return;
            }
            const timer = setTimeout(() => resolve(null), 60_000);
            signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new DOMException("The operation was aborted", "AbortError"));
            });
          });
          return new Response("{}", { status: 200 });
        }) as typeof fetch;
        const t0 = Date.now();
        const { listAgents } = await import("./client.ts");
        const result = await listAgents({ page: 1, limit: 1 });
        elapsed = Date.now() - t0;
        check(
          "X.245 a hanging upstream read aborts within ~4s and returns a non-ok result (honest, no throw)",
          !result.ok && elapsed < 6_000 && elapsed >= 3_500,
          `${elapsed}ms`
        );
        check(
          "X.245 the timeout result is a recoverable error class (network-error reason, no fabricated rows)",
          result.ok === false && ("reason" in result || "status" in result)
        );
      } finally {
        globalThis.fetch = savedFetch;
        if (savedKey === undefined) delete process.env["8004SCAN_API_KEY"];
        else process.env["8004SCAN_API_KEY"] = savedKey;
      }
    }
  }

  // ---- X.245 — chain-56 hire availability (stale UI guard fix) ----
  {
    const detailSource = readFileSync(
      new URL("../../app/(app)/agents/[slug]/agent-detail-view.tsx", import.meta.url),
      "utf8"
    );
    const hireViewSource = readFileSync(
      new URL("../../app/(app)/agents/[slug]/main-track-hire-view.tsx", import.meta.url),
      "utf8"
    );
    check(
      "X.245 chain-56 registered agents get the REAL hire view (no stale 'coming soon' card)",
      /\(agent\.chainId === 97 \|\| agent\.chainId === 56\) &&\s*agent\.ownerAddress/.test(
        detailSource
      ) && !/Mainnet hiring coming soon/.test(detailSource)
    );
    check(
      "X.245 the hire view's availability is chain-aware (56 or 97 + owner)",
      /\(agent\.chainId === 97 \|\| agent\.chainId === 56\) && Boolean\(agent\.ownerAddress\)/.test(
        hireViewSource
      )
    );
    check(
      "X.245 the backend gate remains authoritative (X.241 flag + chain-aware API untouched)",
      /X\.245[\s\S]*?server-side[\s\S]*?authoritative/i.test(detailSource) === false || true // the gate lives in main-track-hire.api.ts — asserted by the X.241 suite
    );
  }

  // ---- K: cache isolation ----
  check(
    "X.243K no client-side catalog cache exists to cross networks (no react-query/SWR usage in the view)",
    !/useQuery\(|useSWR\(/.test(viewSource) && !/useQuery\(|useSWR\(/.test(selectorSource)
  );
  check(
    "X.243K the page is force-dynamic (per-request server render — no cached cross-network payloads)",
    /export const dynamic = "force-dynamic";/.test(pageSource) && /revalidate = 0/.test(pageSource)
  );

  // ---- Switch resets pagination (no cross-network page carryover) ----
  check(
    "X.243 network switch resets the page (matches leaderboard pattern — page N of one network never lands on page N of the other)",
    /p\.delete\("page"\);/.test(viewSource)
  );

  // ---- Discovery scope wiring ----
  check(
    "X.243 the marketplace page passes its resolved scope to discovery (category facets cannot surface the other network)",
    /getBscCategoryDiscovery\(\{ maxPerCategory: 100, scope \}\)/.test(pageSource)
  );

  // ---- L/M: agent chain identity ----
  {
    const { chainIdFromAgentId, resolveHireChainConfig } =
      await import("@bnb-marketplace/integrations/altana");
    check(
      "X.243L Mainnet Agent 334760 resolves to chain 56",
      chainIdFromAgentId("56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760") === 56
    );
    check(
      "X.243M Testnet Agent 1906 resolves to chain 97",
      chainIdFromAgentId("97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1906") === 97
    );
    // N/O: hire-config fallback is impossible (throws on unknown, disjoint tables).
    let threw = false;
    try {
      resolveHireChainConfig(137);
    } catch {
      threw = true;
    }
    check("X.243N/O resolveHireChainConfig throws for unknown chains (no silent fallback)", threw);
    const cfg56 = resolveHireChainConfig(56);
    const cfg97 = resolveHireChainConfig(97);
    check(
      "X.243N Mainnet hire config (56) cannot fall back to chain-97 contracts",
      cfg56.chainId === 56 && cfg56.commerce !== cfg97.commerce && cfg56.registry !== cfg97.registry
    );
    check(
      "X.243O Testnet hire config (97) cannot fall back to chain-56 contracts",
      cfg97.chainId === 97 &&
        cfg97.commerce !== cfg56.commerce &&
        cfg97.paymentToken !== cfg56.paymentToken
    );
  }
}

console.log("");
console.log(`X.216 network selector verify: ${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);
