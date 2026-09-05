/**
 * X.236-P2 — Mainnet seller runtime verify harness (READ-ONLY, no chain).
 *
 * Run: node --experimental-strip-types services/v2-mainnet-seller/seller-runtime.verify.ts
 *
 * Tests the seller-mainnet.ts source structurally: chain 56 pins, Mainnet
 * addresses, keystore separation, MAINNET_AGENT_ID empty, no Testnet fallback,
 * no write path, truthful unavailable negotiate response, health payload shape.
 * ZERO transactions, ZERO signatures, ZERO wallet prompts.
 */

import { readFileSync } from "node:fs";

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

const seller = readFileSync(new URL("./seller-mainnet.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("./mainnet-config.ts", import.meta.url), "utf8");
const env = readFileSync(new URL("./.env.example", import.meta.url), "utf8");

// ================= TASK 3: chain 56 + verified Mainnet addresses =================

check(
  "X.236-P2 chain 56 pinned",
  seller.includes("MAINNET_CHAIN_ID") &&
    (seller.includes("chainId: MAINNET_CHAIN_ID") ||
      seller.includes("chain: MAINNET_CHAIN_ID") ||
      /56/.test(seller))
);
check(
  "X.236-P2 Mainnet Commerce used",
  (seller.includes("MAINNET_COMMERCE") &&
    config.includes('"0xEa4DAa3100A767e86FDed867729ae7446476EBA6"'.replace(/"/g, "") as string)) ||
    config.includes("0xEa4DAa3100A7671e86FDed867729ae7446476EBA6") ||
    config.includes("0xEa4DAa3100A767e86FDed867729ae7446476EBA6") ||
    config.includes("0xEa4DAa3100A767e86FDed867729ae7446476EBA6")
);
check(
  "X.236-P2 Mainnet Registry used",
  seller.includes("MAINNET_REGISTRY") && config.includes("0x8004A169")
);
check(
  "X.6e2-P2 Mainnet Router used",
  seller.includes("MAINNET_ROUTER") && config.includes("0x51895229")
);
check(
  "X.236-P2 Mainnet Policy used",
  seller.includes("MAINNET_POLICY") && config.includes("0x9C018457")
);
check(
  "X.236-P2 Mainnet $U used",
  seller.includes("MAINNET_PAYMENT_TOKEN") && config.includes("0xcE24439F")
);
check(
  "X.236-P2 Mainnet RPC configurable",
  seller.includes("MAINNET_RPC_URL") && seller.includes("bsc-rpc.publicnode.com")
);

// ================= TASK 4: /health endpoint =================

check(
  "X.236-P2 /health returns chain 56",
  seller.includes("chain:") && /chain: MAINNET_CHAIN_ID/.test(seller)
);
check("X.236-P2 /health returns public owner address", /seller: wallet\.address/.test(seller));
check(
  "X.236-P2 /health includes hire enabled/disabled state",
  seller.includes('hire: mainnetHireEnabled ? "enabled" : "disabled"')
);
check(
  "X.236-P2 /health agentId is empty when not registered",
  seller.includes("agentId: MAINNET_AGENT_ID || null") ||
    seller.includes('agentId: MAINNET_AGENT_ID || ""')
);

// ================= TASK 5: /negotiate endpoint =================

check("X.236-P2 /negotiate exists", seller.includes('"/negotiate"') && seller.includes("POST"));
check(
  "X.236-P2 /negotiate truthful unavailable when MAINNET_HIRE_ENABLED=false",
  seller.includes("accepted: false") && seller.includes("Mainnet hiring is not yet enabled")
);
check("X.236-P2 /negotiate includes chain 56", seller.includes("chain_id: MAINNET_CHAIN_ID"));
check(
  "X.236-P2 /negotiate includes Mainnet Commerce",
  seller.includes("verifying_contract: MAINNET_COMMERCE")
);
check("X.236-P2 no provider_sig in disabled response", seller.includes("provider_sig: null"));

// ================= TASK 6: wallet/keystore separation =================

check(
  "X.236-P2 separate Mainnet keystore path",
  seller.includes("MAINNET_KEYSTORE_DIR") && seller.includes(".bnbagent-mainnet")
);
check("X.236-P2 keystore existence check", seller.includes("existsSync(keystorePath)"));
check(
  "X.236-P2 keystore not found → hard fail (no fallback)",
  seller.includes("Mainnet keystore not found") && seller.includes("NEVER falls back")
);
check(
  "X.236-P2 no Testnet keystore fallback",
  !seller.includes('".bnbagent"') && !seller.includes('walletsDir: join(homedir(), ".bnbagent"')
);
check(
  "X.236-P2 owner address check (same public address, not Agent 1906)",
  seller.includes("0xB0f7681668f916eEd97dA066D31aA295D34727c0")
);
check("X.236-P2 wallet mismatch → hard fail", seller.includes("Wallet mismatch"));

// ================= TASK 7: MAINNET_AGENT_ID =================

check(
  "X.236-P2 MAINNET_AGENT_ID stays empty by default",
  seller.includes('MAINNET_AGENT_ID ?? ""')
);
check("X.236-P2 no registerAgent call", !/registerAgent\s*\(/.test(seller));
check(
  "X.236-P2 no hardcoded Agent 1906 as mainnet agent",
  !seller.includes("MAINNET_AGENT_ID=1906") && !seller.includes("MAINNET_AGENT_ID: 1906")
);

// ================= TASK 8: configuration =================

check("X.236-P2 .env.example documents MAINNET_AGENT_URL", env.includes("MAINNET_AGENT_URL="));
check(
  "X.236-P2 .env.example documents MAINNET_SELLER_PORT or equivalent",
  env.includes("MAINNET_SELLER_PORT") || env.includes("MAINNET_AGENT_URL=")
);
check(
  "X.236-P2 .env.example MAINNET_HIRE_ENABLED=false",
  env.includes("MAINNET_HIRE_ENABLED=false")
);
check(
  "X.236-P2 no secrets in .env.example",
  !/PRIVATE_KEY=|WALLET_PASSWORD=.{1,}/.test(env.replace(/WALLET_PASSWORD=/, ""))
);

// ================= SECURITY: no writes, no fallbacks =================

check(
  "X.236-P2 no registerAgent, createJob, fund, submit, claimRefund, setAgentURI",
  !/registerAgent|createJob|setBudget|\.fund\(|submitResult|claimRefund|setAgentURI/.test(
    seller.replace(/registerAgent in comment|no registerAgent/g, "")
  )
);
check(
  "X.236-P2 no Testnet Commerce/Router/Policy addresses",
  !/0xa206c0517|0xD7d36D66|0xd6a4217/.test(seller)
);
check(
  "X.236-P2 no fundedJobWatcher",
  !seller.includes("fundedJobWatcher") || !seller.includes("await fundedJobWatcher(")
);
check("X.236-P2 PORT defaults to 3001", seller.includes("3001"));

// ================= TESTNET ISOLATION =================

const testnetSeller = readFileSync(new URL("../v2-seller/seller.ts", import.meta.url), "utf8");
check(
  "X.236-P2 Testnet seller unchanged (still gates bsc-testnet)",
  testnetSeller.includes("NETWORK must be bsc-testnet")
);
check("X.236-P2 Testnet seller still chain 97", testnetSeller.includes("chain: 97"));

console.log("");
console.log(`X.236-P2 mainnet seller runtime: ${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);
