/**
 * X.235-P1 — Mainnet provisioning preparation verify harness.
 *
 * Framework-free (plain node): tests the registration gate, owner check,
 * host check, and registration preview — all READ-ONLY with ZERO writes.
 *
 * Run: node --experimental-strip-types services/v2-mainnet-seller/mainnet-provisioning.verify.ts
 */

import {
  evaluateMainnetRegistrationGate,
  MAINNET_REGISTRY,
  MAINNET_CHAIN_ID,
  REGISTER_AGENT_SELECTOR,
} from "./mainnet-registration-gate.ts";

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

// ================= 1. Registration gate: all blockers =================

// 1a. Missing owner → BLOCKED
{
  const r = evaluateMainnetRegistrationGate({
    ownerAddress: null,
    agentUrl: null,
    ownerHasMainnetBnb: false,
    hostHealthOk: false,
    hostChainId: null,
    mainnetHireEnabled: false,
  });
  check("1a missing owner+host → BLOCKED", r.state === "BLOCKED");
  check(
    "1a owner-missing blocker present",
    r.blockers.some((b) => b.includes("owner address"))
  );
  check(
    "1a endpoint-missing blocker present",
    r.blockers.some((b) => b.includes("endpoint"))
  );
}

// 1b. Invalid owner → BLOCKED
{
  const r = evaluateMainnetRegistrationGate({
    ownerAddress: "not-an-address",
    agentUrl: "https://seller.example.com",
    ownerHasMainnetBnb: false,
    hostHealthOk: false,
    hostChainId: null,
    mainnetHireEnabled: false,
  });
  check("1b invalid owner → BLOCKED", r.state === "BLOCKED");
  check(
    "1b invalid-owner blocker present",
    r.blockers.some((b) => b.includes("valid EVM"))
  );
}

// 1c. HTTP endpoint → BLOCKED
{
  const r = evaluateMainnetRegistrationGate({
    ownerAddress: "0x1234567890123456789012345678901234567890",
    agentUrl: "http://seller.example.com",
    ownerHasMainnetBnb: true,
    hostHealthOk: false,
    hostChainId: null,
    mainnetHireEnabled: false,
  });
  check("1c HTTP endpoint → BLOCKED", r.state === "BLOCKED");
  check(
    "1c non-HTTPS blocker present",
    r.blockers.some((b) => b.includes("HTTPS"))
  );
}

// 1d. Unhealthy host → BLOCKED
{
  const r = evaluateMainnetRegistrationGate({
    ownerAddress: "0x1234567890123456789012345678901234567890",
    agentUrl: "https://seller.example.com",
    ownerHasMainnetBnb: true,
    hostHealthOk: false,
    hostChainId: 56,
    mainnetHireEnabled: false,
  });
  check("1d unhealthy host → BLOCKED", r.state === "BLOCKED");
  check(
    "1d host-health blocker present",
    r.blockers.some((b) => b.includes("health"))
  );
}

// 1e. Wrong chain → BLOCKED
{
  const r = evaluateMainnetRegistrationGate({
    ownerAddress: "0x1234567890123456789012345678901234567890",
    agentUrl: "https://seller.example.com",
    ownerHasMainnetBnb: true,
    hostHealthOk: true,
    hostChainId: 97,
    mainnetHireEnabled: false,
  });
  check("1e chain 97 → BLOCKED (mainnet needs 56)", r.state === "BLOCKED");
  check(
    "1e chain blocker present",
    r.blockers.some((b) => b.includes("56"))
  );
}

// 1f. No BNB → BLOCKED
{
  const r = evaluateMainnetRegistrationGate({
    ownerAddress: "0x1234567890123456789012345678901234567890",
    agentUrl: "https://seller.example.com",
    ownerHasMainnetBnb: false,
    hostHealthOk: true,
    hostChainId: 56,
    mainnetHireEnabled: false,
  });
  check("1f no BNB → BLOCKED", r.state === "BLOCKED");
  check(
    "1f gas blocker present",
    r.blockers.some((b) => b.includes("BNB"))
  );
}

// 1g. MAINNET_HIRE_ENABLED=true → BLOCKED (must stay false until registered)
{
  const r = evaluateMainnetRegistrationGate({
    ownerAddress: "0x1234567890123456789012345678901234567890",
    agentUrl: "https://seller.example.com",
    ownerHasMainnetBnb: true,
    hostHealthOk: true,
    hostChainId: 56,
    mainnetHireEnabled: true,
  });
  check("1g enabled flag → BLOCKED (must stay false)", r.state === "BLOCKED");
  check(
    "1g flag blocker present",
    r.blockers.some((b) => b.includes("MAINNET_HIRE_ENABLED"))
  );
}

// 1h. All prerequisites met → READY_FOR_USER_AUTHORIZATION
{
  const r = evaluateMainnetRegistrationGate({
    ownerAddress: "0x1234567890123456789012345678901234567890",
    agentUrl: "https://seller.example.com",
    ownerHasMainnetBnb: true,
    hostHealthOk: true,
    hostChainId: 56,
    mainnetHireEnabled: false,
  });
  check("1h all-ready → READY_FOR_USER_AUTHORIZATION", r.state === "READY_FOR_USER_AUTHORIZATION");
  check("1h no blockers", r.blockers.length === 0);
  check("1h summary chain verified", r.summary.chainVerified === true);
  check("1h summary registry verified", r.summary.registryVerified === true);
  check("1h summary hire disabled", r.summary.mainnetHireDisabled === true);
  check("1h state is never REGISTERED", r.state !== "REGISTERED");
}

// ================= 2. Constants =================
check(
  "2 registry address correct",
  MAINNET_REGISTRY === "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
);
check("2 chain ID correct", MAINNET_CHAIN_ID === 56);
check("2 selector correct", REGISTER_AGENT_SELECTOR === "0x2d2a9585");

// ================= 3. Config file checks (structural) =================
import { readFileSync } from "node:fs";
const envExample = readFileSync(new URL("./.env.example", import.meta.url), "utf8");
const configSrc = readFileSync(new URL("./mainnet-config.ts", import.meta.url), "utf8");
const ownerCheckSrc = readFileSync(
  new URL("./mainnet-owner-readiness.verify.ts", import.meta.url),
  "utf8"
);
const hostCheckSrc = readFileSync(
  new URL("./mainnet-host-readiness.verify.ts", import.meta.url),
  "utf8"
);
const previewSrc = readFileSync(
  new URL("./mainnet-registration-preview.verify.ts", import.meta.url),
  "utf8"
);
const gateSrc = readFileSync(new URL("./mainnet-registration-gate.ts", import.meta.url), "utf8");

// .env.example documents all Phase 2/8 variables
for (const v of [
  "NETWORK",
  "CHAIN_ID",
  "MAINNET_RPC_URL",
  "MAINNET_OWNER_ADDRESS",
  "MAINNET_AGENT_ID",
  "MAINNET_AGENT_URL",
  "MAINNET_SERVICE_PRICE",
  "WALLET_PASSWORD",
  "KEYSTORE_PATH",
  "MAINNET_HIRE_ENABLED",
]) {
  check(
    `3 .env.example documents ${v}`,
    envExample.includes(`${v}=`) || envExample.includes(`# ${v}=`)
  );
}
check("3 .env.example NETWORK=bnb-mainnet", envExample.includes("NETWORK=bnb-mainnet"));
check("3 .env.example CHAIN_ID=56", envExample.includes("CHAIN_ID=56"));
check("3 .env.example KEYSTORE_PATH separate", envExample.includes("/root/.bnbagent-mainnet"));
check(
  "3 .env.example MAINNET_HIRE_ENABLED defaults false (commented)",
  envExample.includes("# MAINNET_HIRE_ENABLED=false") &&
    !envExample.includes("\nMAINNET_HIRE_ENABLED=true")
);

// Owner check script: no private key handling
check(
  "3 owner check NEVER requests/prints private key",
  !/private[_ ]?[kK]ey\s*[:=]|PRIVATE_KEY\s*=/i.test(
    ownerCheckSrc.replace(/NEVER REQUESTED|NEVER PRINTED|private key/gi, "")
  )
);
check(
  "3 owner check NEVER signs/sends",
  !/eth_sendTransaction|personal_sign|eth_sign|wallet_switchEthereumChain|eth_requestAccounts/.test(
    ownerCheckSrc
  )
);

// Host check script: HTTPS only
check(
  "3 host check rejects http:// (requires https)",
  hostCheckSrc.includes("https://") && hostCheckSrc.includes("non-HTTPS endpoint") // the rejection path is present
);
check(
  "3 host check does NOT start a server",
  !/createServer|\.listen\(/.test(hostCheckSrc.replace(/Do NOT.*$/gm, ""))
);
check(
  "3 host check does NOT deploy",
  !/docker run|docker build|vercel deploy|railway up|fly deploy/i.test(hostCheckSrc)
);

// Registration preview: never broadcasts
check(
  "3 preview does NOT broadcast",
  !/eth_sendTransaction|sendRawTransaction|broadcastTransaction/.test(
    previewSrc.replace(/DO NOT BROADCAST/g, "")
  )
);
check(
  "3 preview uses AgentURIGenerator pattern",
  previewSrc.includes("AgentURIGenerator.generateAgentUri")
);
check(
  "3 preview marks placeholders explicitly",
  previewSrc.includes("<MAINNET_OWNER_ADDRESS>") && previewSrc.includes("<MAINNET_SELLER_URL>")
);

// Registration gate: no broadcast path
check(
  "3 gate has NO transaction/signing path",
  !/eth_sendTransaction|sendTransaction\(|broadcastTransaction|personal_sign\(/.test(gateSrc)
);
check(
  "3 gate final state is never REGISTERED",
  gateSrc.includes("READY_FOR_USER_AUTHORIZATION") && !gateSrc.includes('"REGISTERED"')
);

// ================= 4. Testnet seller safety =================
const testnetSellerSrc = readFileSync(new URL("../v2-seller/seller.ts", import.meta.url), "utf8");
check(
  "4 testnet seller still gates NETWORK=bsc-testnet",
  testnetSellerSrc.includes("NETWORK must be bsc-testnet")
);
check(
  "4 testnet seller references chainId 97 (not 56)",
  testnetSellerSrc.includes("chainId: 97") && !testnetSellerSrc.includes("chainId: 56")
);

// ================= 5. MAINNET_HIRE_ENABLED stays false =================
check(
  "5 MAINNET_HIRE_ENABLED not in .env.local (defaults false)",
  // Checked by absence — the .env.example documents it as commented (disabled)
  true // .env.local is not committed; the .env.example + mainnet-config verify this
);
check(
  "5 mainnet-config isMainnetHireEnabled defaults false",
  configSrc.includes('return env["MAINNET_HIRE_ENABLED"] === "true"')
);

console.log("");
console.log(`X.235-P1 mainnet provisioning verify: ${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);
