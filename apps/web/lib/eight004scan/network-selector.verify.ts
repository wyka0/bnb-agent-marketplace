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
  "scope parse: undefined/invalid → 'all' (X.154 default preserved)",
  parseMarketplaceNetworkScope(undefined) === "all" &&
    parseMarketplaceNetworkScope("") === "all" &&
    parseMarketplaceNetworkScope("56") === "all" &&
    parseMarketplaceNetworkScope("mainnet-testnet") === "all"
);
check(
  "labels: '8004scan Mainnet' / '8004scan Testnet' (single source of truth)",
  MARKETPLACE_NETWORK_LABELS.mainnet === "8004scan Mainnet" &&
    MARKETPLACE_NETWORK_LABELS.testnet === "8004scan Testnet"
);

// --- CASE 1: current = Mainnet, click Testnet -------------------------

check(
  "1 Mainnet → clicking Testnet opens modal (pending set only on click)",
  /if \(!isActive && !switching\) setPending\(network\)/.test(selectorSource)
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
  /if \(!isActive && !switching\) setPending\(network\)/.test(selectorSource)
);

// --- Cancel semantics (7/8) -------------------------------------------

check(
  "7/8 Cancel closes the modal only (setPending(null), no onSwitch)",
  /<Button variant="outline" onClick=\{\(\) => setPending\(null\)\} disabled=\{switching\}>/.test(
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
  "15/16 selected network is prop-derived (URL truth) — only modal pending/switching are local state",
  /parseMarketplaceNetworkScope\(scope\) === "testnet" \? "testnet" : "mainnet"/.test(
    selectorSource
  ) &&
    // the ONLY useState hooks are the modal's pending + switching flags
    (selectorSource.match(/React\.useState/g) ?? []).length === 2
);
check(
  "16 active state is derived from the scope prop (URL-driven truth)",
  /parseMarketplaceNetworkScope\(scope\) === "testnet" \? "testnet" : "mainnet"/.test(
    selectorSource
  )
);

// --- Accessibility (17/18/19/20) ---------------------------------------

check(
  "17 Escape closes the modal when not switching (Radix onOpenChange guard)",
  /if \(!switching\) setPending\(null\)/.test(selectorSource)
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

console.log("");
console.log(`X.216 network selector verify: ${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);
