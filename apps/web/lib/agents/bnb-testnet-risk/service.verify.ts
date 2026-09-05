import { bnbTestnetRiskMetadata } from "./metadata.ts";
import { parseRiskRequest, readBnbTestnetWalletSnapshot } from "./service.ts";

const WALLET = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C" as const;
const checks: Array<[string, boolean]> = [];
function check(label: string, value: boolean): void {
  checks.push([label, value]);
  console.log(`${value ? "PASS" : "FAIL"} ${label}`);
}

check("valid wallet accepted", parseRiskRequest({ wallet: WALLET }).ok);
check("invalid wallet rejected", !parseRiskRequest({ wallet: "not-an-address" }).ok);
check(
  "zero wallet rejected",
  !parseRiskRequest({ wallet: "0x0000000000000000000000000000000000000000" }).ok
);
check(
  "mainnet chain input rejected",
  parseRiskRequest({ wallet: WALLET, chainId: 56 }).reason === "unsupported-chain"
);
check("explicit chain 97 accepted", parseRiskRequest({ wallet: WALLET, chainId: 97 }).ok);

const response = await readBnbTestnetWalletSnapshot(
  WALLET,
  async () =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x2a" }), { status: 200 }),
  "https://bsc-testnet-rpc.example"
);
check("read-only response is chain 97", response.chainId === 97);
check(
  "response is deterministic for fixed RPC result",
  response.state === "ready" && response.nativeBalanceWei === "42"
);

const unavailable = await readBnbTestnetWalletSnapshot(
  WALLET,
  async () => new Response("", { status: 503 }),
  "https://bsc-testnet-rpc.example"
);
check(
  "RPC unavailable is honest",
  unavailable.state === "unavailable" && unavailable.reason === "rpc-unavailable"
);

const metadata = bnbTestnetRiskMetadata("https://example.test/api/agents/bnb-testnet-risk/service");
const metadataAgain = bnbTestnetRiskMetadata(
  "https://example.test/api/agents/bnb-testnet-risk/service"
);
check("metadata is inactive until registration", metadata.active === false);
check("metadata advertises only implemented read-only service", metadata.x402Support === false);
check(
  "metadata has no price or private key",
  !JSON.stringify(metadata).match(/price|private|secret|key/i)
);
check("metadata is deterministic", JSON.stringify(metadata) === JSON.stringify(metadataAgain));

const failed = checks.filter(([, ok]) => !ok);
console.log(`X.13 service verify: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length > 0) process.exit(1);
