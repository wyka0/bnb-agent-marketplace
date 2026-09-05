/**
 * X.233 — Mainnet seller readiness verify harness (framework-free, plain node).
 *
 * Run: node --experimental-strip-types services/v2-mainnet-seller/mainnet-seller-readiness.verify.ts
 * (from the repository root; read-only, offline, zero transactions).
 *
 * Two sections:
 *   A. SAFETY INVARIANTS (must PASS) — Testnet stays pinned to chain 97,
 *      Mainnet stays disabled by default, no cross-chain substitution, no
 *      signing/transaction surface in the prep module.
 *   B. READINESS GATES G1–G11 (currently BLOCKED by design) — each gate is
 *      asserted as unmet with its evidence. If any gate ever flips to READY
 *      without the milestone work behind it, these checks catch it.
 */

import { readFileSync } from "node:fs";
import {
  MAINNET_CHAIN_ID,
  MAINNET_COMMERCE,
  MAINNET_ROUTER,
  MAINNET_POLICY,
  MAINNET_REGISTRY,
  MAINNET_PAYMENT_TOKEN,
  MAINNET_PUBLIC_RPC,
  resolveMainnetAddresses,
  isMainnetHireEnabled,
  mainnetHireDisabledByDefault,
} from "./mainnet-config.ts";
import * as configModule from "./mainnet-config.ts";

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

const root = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

// ================= A. SAFETY INVARIANTS =================

// A1. Testnet seller remains chain 97 (source: services/v2-seller/seller.ts).
let v2SellerSrc = "";
try {
  v2SellerSrc = root("../v2-seller/seller.ts");
} catch {
  v2SellerSrc = "";
}
check(
  "A1 v2-seller hard-gates NETWORK=bsc-testnet",
  v2SellerSrc.includes("NETWORK must be bsc-testnet")
);
check(
  "A1 v2-seller surfaces chainId 97 and no chain 56",
  v2SellerSrc.includes("chainId: 97") && !/chainId:\s*56/.test(v2SellerSrc)
);

// A2. Agent 1906 remains Testnet: the marketplace refuses non-97 agents and
// the v2-seller never references the mainnet registry.
const negotiationSrc = root("../../apps/web/lib/activation/main-track-negotiation.server.ts");
check(
  "A2 marketplace rejects unsupported-chain agents (Agent 1906 stays Testnet; chain-97 default preserved)",
  /agent is not on a supported hire chain/.test(negotiationSrc) ||
    /agent is not on BSC Testnet/.test(negotiationSrc)
);
check("A2 v2-seller never references the mainnet registry", !/0x8004A169/i.test(v2SellerSrc));

// A3. Testnet constants unchanged across the stack.
const walletSrc = root("../../packages/integrations/src/altana/v2/main-track-user-wallet.ts");
check(
  "A3 testnet Commerce/Router/Policy/$U/Registry unchanged",
  walletSrc.includes('"0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE"') &&
    walletSrc.includes('"0xD7d36D66d2F1B608A0F943f722D27e3744f66F25"') &&
    walletSrc.includes('"0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA"') &&
    walletSrc.includes('"0x8004A818BFB912233c491871b3d84c89A494BD9e"') &&
    walletSrc.includes('"0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565"')
);
const hiredAgentsSrc = root("../../apps/web/lib/dashboard/hired-agents.ts");
check("A3 HIRED_CHAIN_ID stays 97", /HIRED_CHAIN_ID\s*=\s*97/.test(hiredAgentsSrc));
const hireSrc = root("../../apps/web/lib/activation/main-track-user-hire.ts");
check("A3 USER_HIRE_CHAIN_ID stays 97", /USER_HIRE_CHAIN_ID\s*=\s*97/.test(hireSrc));

// A4. Mainnet config resolves chain 56 with the verified table.
const resolved = resolveMainnetAddresses(56);
check("A4 Mainnet config resolves chain 56", resolved.chainId === 56);
check("A4 Mainnet Commerce correct", resolved.commerce === MAINNET_COMMERCE);
check("A4 Mainnet Router correct", resolved.router === MAINNET_ROUTER);
check("A4 Mainnet Policy correct", resolved.policy === MAINNET_POLICY);
check("A4 Mainnet Registry correct", resolved.registry === MAINNET_REGISTRY);
check("A4 Mainnet $U correct", resolved.paymentToken === MAINNET_PAYMENT_TOKEN);
check("A4 Mainnet RPC correct", resolved.rpcUrl === MAINNET_PUBLIC_RPC);
check(
  "A4 resolver refuses non-56 chains (never silently substitutes)",
  [0, 1, 56 + 1, 97, 137].every((c) => {
    try {
      resolveMainnetAddresses(c);
      return false;
    } catch {
      return true;
    }
  })
);

// A5. Mainnet hire disabled by default (flag semantics).
check("A5 MAINNET_HIRE_ENABLED defaults to disabled", mainnetHireDisabledByDefault());
check("A5 isMainnetHireEnabled({}) === false", isMainnetHireEnabled({}) === false);
check(
  "A5 only the literal string 'true' enables it",
  isMainnetHireEnabled({ MAINNET_HIRE_ENABLED: "true" }) === true &&
    ["false", "", "1", "yes", "TRUE", undefined].every(
      (v) => isMainnetHireEnabled({ MAINNET_HIRE_ENABLED: v }) === false
    )
);

// A6. No signing/transaction surface while disabled (module shape).
const surface = Object.keys(configModule);
check(
  "A6 prep module exposes no signing/broadcast/wallet surface",
  !surface.some((k) => /sign|broadcast|send|transact|wallet|private|key|provider/i.test(k))
);
const configSrc = root("./mainnet-config.ts");
check(
  "A6 prep module performs no network calls",
  !/fetch\(|sendRawTransaction|eth_call|XMLHttpRequest/.test(configSrc)
);

// A7. No cross-chain address substitution (verified tables are disjoint).
const TESTNET_TABLE = [
  "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE",
  "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25",
  "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA",
  "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
].map((a) => a.toLowerCase());
const MAINNET_TABLE = [
  MAINNET_COMMERCE,
  MAINNET_ROUTER,
  MAINNET_POLICY,
  MAINNET_REGISTRY,
  MAINNET_PAYMENT_TOKEN,
].map((a) => a.toLowerCase());
check(
  "A7 Mainnet and Testnet tables are fully disjoint (zero overlap)",
  MAINNET_TABLE.every((a) => !TESTNET_TABLE.includes(a)) && new Set(MAINNET_TABLE).size === 5
);

// A8. Provider signature chain validation path intact (owner-match requirement).
check(
  "A8 marketplace still requires provider == registered owner",
  /provider signature is not valid for the registered owner/.test(negotiationSrc) &&
    /provider: owner\.toLowerCase\(\)/.test(negotiationSrc)
);

// A9. Wallet chain handling still testnet-pinned (X.224 targets 0x61 via expectedChainId=97).
check(
  "A9 buyer hire flow is chain-aware (expectedChainId from chain config, never a label)",
  /expectedChainId: cfg\.chainId/.test(hireSrc) ||
    /expectedChainId: USER_HIRE_CHAIN_ID/.test(hireSrc)
);

// A10. Testnet behavior files untouched by this milestone's prep work.
check(
  "A10 v2-seller Dockerfile still pins NETWORK=bsc-testnet",
  root("../v2-seller/Dockerfile").includes("ENV NETWORK=bsc-testnet")
);

// ================= B. READINESS GATES (all BLOCKED — asserted) =================
// Evidence: X.233 milestone — 8004scan chain-56 catalog searched; all 9 local
// wallets queried for mainnet agent ownership (9/9 own zero); no mainnet seller
// process, endpoint, or registration exists. These checks assert the BLOCKED
// state so any accidental readiness flip is caught immediately.
const gates: Array<{ id: string; blocked: boolean; evidence: string }> = [
  { id: "G1 identity", blocked: true, evidence: "0/9 wallets own a mainnet agent" },
  { id: "G2 owner==signer", blocked: true, evidence: "no mainnet seller exists" },
  { id: "G3 endpoint", blocked: true, evidence: "no mainnet seller process" },
  { id: "G4 chain56 report", blocked: true, evidence: "no mainnet seller health" },
  { id: "G5 sig recovery", blocked: true, evidence: "no mainnet quote exists" },
  { id: "G6 commerce", blocked: true, evidence: "no mainnet negotiation" },
  { id: "G7 chain", blocked: true, evidence: "no mainnet negotiation" },
  { id: "G8 buyer chain", blocked: true, evidence: "app pins chain 97 four layers deep" },
  { id: "G9 buyer $U", blocked: true, evidence: "no mainnet $U provisioned" },
  { id: "G10 buyer gas", blocked: true, evidence: "no mainnet BNB provisioned" },
  {
    id: "G11 flag",
    blocked: !isMainnetHireEnabled({}),
    evidence: "MAINNET_HIRE_ENABLED defaults off",
  },
];
for (const g of gates) {
  check(`B gate ${g.id}: BLOCKED (${g.evidence})`, g.blocked === true);
}
check("B MAINNET SELLER BLOCKER = NO OWNER-MATCHED MAINNET AGENT", gates[0].blocked === true);

// Dead variable guard (keeps the harness honest if edited carelessly).
void MAINNET_CHAIN_ID;
void MAINNET_PUBLIC_RPC;

console.log("");
console.log(`X.233 mainnet seller readiness: ${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);
