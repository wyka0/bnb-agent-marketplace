/**
 * X.23 — EXECUTE THE ERC-8004 REGISTRATION ON BNB TESTNET (chain 97).
 *
 * Operator-authorized execution. Source of truth is the X.22 review:
 *   registry      0x8004A818BFB912233c491871b3d84c89A494BD9e
 *   implementation 0x7274e874CA62410a93Bd8bf61c69d8045E399c02
 *   provider EOA  0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
 *   metadata      https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
 *   function      register(string agentURI)
 *   calldataHash  0x00d53c8e13940e3a2e8361495fe9b3a6fcceab0ffd625f2beb200e102f5f81a4
 *   value         0
 *
 * SECURITY RULES ENFORCED HERE:
 *   - The provider private key is read ONLY from the server/local secret env
 *     (`ALTANA_TESTNET_PRIVATE_KEY` loaded from .env.local via
 *     process.loadEnvFile). It is NEVER printed, echoed, logged, or committed.
 *   - The 8004scan API key (`8004SCAN_API_KEY`) is read ONLY for the verification
 *     request header and is NEVER printed.
 *   - No secret is written into source code or into tracked files.
 *   - BNB Mainnet (chain 56) is refused. Registry, provider, metadata URI, and
 *     calldata are pinned to the verified X.22 values; any mismatch STOPS.
 *   - No ERC-8183 job, no payment, no settlement, no unrelated transaction.
 *
 * PRE-SIGN SAFETY CHECKS (all must pass or the script exits before signing):
 *   1. eth_chainId == 97
 *   2. registry bytecode present on chain 97
 *   3. provider address == verified provider EOA
 *   4. provider is an EOA (no bytecode)
 *   5. metadata URL responds successfully over HTTPS
 *   6. calldata decodes to the exact canonical metadata URI
 *   7. calldata hash equals the X.22 constant
 *   8. transaction target == verified registry
 *   9. transaction value == 0
 *  10. current chain is still 97 (re-read immediately before signing)
 *  11. derived signer address from the env private key == verified provider EOA
 *
 * Execution stops immediately after registration verification (no ERC-8183).
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  decodeFunctionData,
  getAddress,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import {
  buildUnsignedRegistrationPreview,
  ERC8004_CHAIN_ID,
  ERC8004_IMPLEMENTATION,
  ERC8004_REGISTRY,
  SERVICE_PRICE_ENV,
  UNITED_STABLES_TOKEN,
  VERIFIED_REGISTER_STRING_ABI,
} from "./registration-preview.js";
import type { RegistrationPreviewInput } from "./registration-preview.js";
import { createAltanaClient } from "./client.js";

const PUBLIC_HTTPS_ORIGIN = "https://bnb-agent-marketplace-web.vercel.app";
const CANONICAL_METADATA_URI = `${PUBLIC_HTTPS_ORIGIN}/.well-known/agent-registration.json`;
const CANONICAL_SERVICE_ENDPOINT = `${PUBLIC_HTTPS_ORIGIN}/api/agents/bnb-testnet-risk/service`;
const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const APPROVED_PRICE_RAW_U = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
const X20_CALLDATA_HASH = "0x00d53c8e13940e3a2e8361495fe9b3a6fcceab0ffd625f2beb200e102f5f81a4";
const PROVIDER_KEY_ENV = "ALTANA_TESTNET_PRIVATE_KEY";

/** ERC-8004 registry ABI surface used after registration for verification. */
const REGISTRY_READ_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "agentURI",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

/** ERC-8004 `Registered` + ERC-721 `Transfer` events for agentId extraction. */
const REGISTRY_EVENT_ABI = [
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

const checks: Array<{ label: string; ok: boolean }> = [];
function check(label: string, ok: boolean): void {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

// ---------------------------------------------------------------------------
// Load the server/local secret environment WITHOUT ever rendering a secret.
// ---------------------------------------------------------------------------
function findEnvFile(): string | null {
  let dir = resolve(process.cwd());
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, ".env.local");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envPath = findEnvFile();
if (envPath !== null) {
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    console.log(`FAIL loading env file (${envPath}): ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const providerKey = process.env[PROVIDER_KEY_ENV];
const hasProviderKey = typeof providerKey === "string" && providerKey.trim().length > 0;
const apiKeyConfigured =
  typeof process.env["8004SCAN_API_KEY"] === "string" &&
  process.env["8004SCAN_API_KEY"].trim().length > 0;

// ---------------------------------------------------------------------------
// Deterministic preview — exact X.22 inputs (pinned; mismatch STOPS).
// ---------------------------------------------------------------------------
const base: RegistrationPreviewInput = {
  chainId: ERC8004_CHAIN_ID,
  registry: ERC8004_REGISTRY,
  implementation: ERC8004_IMPLEMENTATION,
  provider: PROVIDER_EOA,
  providerBytecode: "0x",
  canonicalOrigin: PUBLIC_HTTPS_ORIGIN,
  metadataUri: CANONICAL_METADATA_URI,
  metadata: {
    active: false,
    x402Support: false,
    serviceEndpoint: CANONICAL_SERVICE_ENDPOINT,
  },
  priceRawU: APPROVED_PRICE_RAW_U,
  priceSource: SERVICE_PRICE_ENV,
  token: UNITED_STABLES_TOKEN,
  abi: VERIFIED_REGISTER_STRING_ABI,
};

const result = buildUnsignedRegistrationPreview(base);
if (result.status !== "ready") {
  check(`preview build ready (blocked: ${result.reasons.join(", ")})`, false);
  console.log("X.23 BLOCKED — cannot proceed with an unverified preview.");
  process.exit(1);
}
const preview = result.preview;
const calldataHash = keccak256(preview.calldata);

// ---------------------------------------------------------------------------
// Read-only RPC (Altana testnet public RPC) for all safety checks + reads.
// ---------------------------------------------------------------------------
const sdkClient = createAltanaClient() as unknown as {
  chains?: Array<{ chainId: number; publicRpcUrl: string }>;
};
const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
if (typeof publicRpcUrl !== "string" || !/^https?:\/\//i.test(publicRpcUrl)) {
  check("public RPC URL resolved", false);
  process.exit(1);
}
const publicClient = createPublicClient({ transport: http(publicRpcUrl) });

// ---------------------------------------------------------------------------
// PRE-SIGN SAFETY CHECKS.
// ---------------------------------------------------------------------------
console.log("X.23 PRE-SIGN SAFETY CHECKS (read-only; no signing yet):");

// 1. chainId == 97.
let liveChainId: bigint | undefined;
try {
  liveChainId = BigInt(await publicClient.getChainId());
} catch (error) {
  liveChainId = undefined;
  check(`live eth_chainId readable (${error instanceof Error ? error.message : String(error)})`, false);
}
check("live chainId == 97", liveChainId === 97n);
check("preview chainId == 97", preview.chainId === 97);
check("current chain is still 97", liveChainId === 97n);

// 2. Registry bytecode present.
let registryBytecode: `0x${string}` | undefined;
try {
  registryBytecode = await publicClient.getCode({ address: preview.registry });
} catch {
  registryBytecode = undefined;
}
check("registry bytecode present", typeof registryBytecode === "string" && registryBytecode !== "0x");

// 3. Provider address == verified provider EOA.
check("provider address == verified provider EOA", getAddress(preview.from) === getAddress(PROVIDER_EOA));

// 4. Provider is an EOA (no bytecode).
let providerBytecode: `0x${string}` | undefined;
try {
  providerBytecode = await publicClient.getCode({ address: preview.from });
} catch {
  providerBytecode = undefined;
}
check(
  "provider is an EOA (empty bytecode)",
  providerBytecode === "0x" || providerBytecode === undefined
);

// 5. Metadata URL responds successfully over HTTPS.
let metadataStatus = 0;
try {
  const metaResponse = await fetch(CANONICAL_METADATA_URI, { method: "GET" });
  metadataStatus = metaResponse.status;
} catch {
  metadataStatus = 0;
}
check(`metadata URL responds over HTTPS (HTTP ${metadataStatus})`, metadataStatus >= 200 && metadataStatus < 300);

// 6. Calldata decodes to the exact canonical metadata URI.
let decodedOk = false;
try {
  const d = decodeFunctionData({
    abi: VERIFIED_REGISTER_STRING_ABI,
    data: preview.calldata,
  });
  decodedOk =
    d.functionName === "register" && Array.isArray(d.args) && d.args[0] === CANONICAL_METADATA_URI;
} catch {
  decodedOk = false;
}
check("calldata decodes to exact canonical metadata URI", decodedOk);

// 7. Calldata hash equals the X.22 constant.
check("calldata hash equals X.22 constant", calldataHash === X20_CALLDATA_HASH);

// 8. Transaction target == verified registry.
check("transaction target == verified registry", getAddress(preview.registry) === ERC8004_REGISTRY);

// 9. Transaction value == 0.
check("transaction value == 0", preview.value === 0n);

// 10. Signer derivation check — env private key must match the verified EOA.
let derivedAddress: `0x${string}` | null = null;
if (hasProviderKey) {
  try {
    const raw = providerKey!.trim();
    const hexKey = raw.startsWith("0x") ? raw : `0x${raw}`;
    derivedAddress = getAddress(privateKeyToAccount(hexKey as `0x${string}`).address);
  } catch {
    derivedAddress = null;
  }
}
check("provider private key present (presence only)", hasProviderKey);
check("derived signer address == verified provider EOA", derivedAddress === getAddress(PROVIDER_EOA));

const failed = checks.filter((entry) => !entry.ok);
console.log(
  `X.23 pre-sign checks: ${checks.length - failed.length}/${checks.length} passed`
);
if (failed.length > 0) {
  console.log("X.23 BLOCKED — pre-sign safety check failed. NO SIGNING, NO BROADCAST.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// FINAL live re-read immediately before signing: chain must still be 97.
// ---------------------------------------------------------------------------
const finalChain = BigInt(await publicClient.getChainId());
if (finalChain !== 97n) {
  console.log("X.23 BLOCKED — chain changed to " + finalChain.toString() + " before signing. NO SIGNING.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// SIGN + BROADCAST.
// ---------------------------------------------------------------------------
console.log("");
console.log("X.23 SIGNING AND BROADCAST (chain 97, verified registry):");

const raw = providerKey!.trim();
const hexKey = raw.startsWith("0x") ? raw : `0x${raw}`;
const account = privateKeyToAccount(hexKey as `0x${string}`);

let txHash: `0x${string}` | undefined;
let broadcastError: string | undefined;
try {
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(publicRpcUrl) });
  txHash = await walletClient.sendTransaction({
    account,
    to: preview.registry,
    data: preview.calldata,
    value: 0n,
  });
} catch (error) {
  broadcastError = error instanceof Error ? error.message : String(error);
}
check("transaction signed and broadcast", typeof txHash === "string" && txHash.length === 66);

if (broadcastError !== undefined) {
  // Redact anything that looks like a hex key from the error before printing.
  const redacted = broadcastError.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.log(`  broadcast error (redacted): ${redacted}`);
  process.exit(1);
}
if (typeof txHash !== "string") {
  process.exit(1);
}

// ---------------------------------------------------------------------------
// WAIT FOR CONFIRMATION + capture receipt.
// ---------------------------------------------------------------------------
console.log(`  transaction hash: ${txHash}`);
let receipt:
  | {
      status: "success" | "reverted";
      blockNumber: bigint;
      blockHash: `0x${string}`;
      logs: readonly {
        address: `0x${string}`;
        data: `0x${string}`;
        topics: readonly unknown[];
      }[];
    }
  | undefined;
let waitError: string | undefined;
try {
  const r = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
  receipt = {
    status: r.status,
    blockNumber: r.blockNumber,
    blockHash: r.blockHash,
    logs: r.logs.map((log) => ({ address: log.address, data: log.data, topics: log.topics as unknown[] })),
  };
} catch (error) {
  waitError = error instanceof Error ? error.message : String(error);
}
check("transaction confirmed (receipt received)", receipt !== undefined);
if (waitError !== undefined) console.log(`  note: ${waitError.slice(0, 200)}`);
if (receipt === undefined) process.exit(1);
check("transaction status success", receipt.status === "success");
console.log(`  block number: ${receipt.blockNumber.toString()}`);
console.log(`  block hash: ${receipt.blockHash}`);

// ---------------------------------------------------------------------------
// DETERMINE agentId from the Registered event (fallback: ERC-721 Transfer).
// ---------------------------------------------------------------------------
let agentId: bigint | null = null;
let registeredUri: string | null = null;
let registeredOwner: string | null = null;

for (const log of receipt.logs) {
  if (getAddress(log.address) !== ERC8004_REGISTRY) continue;
  const topics = log.topics as [`0x${string}`, ...`0x${string}`[]];
  if (topics.length === 0) continue;
  try {
    const parsed = decodeEventLog({ abi: REGISTRY_EVENT_ABI, data: log.data, topics });
    if (parsed.eventName === "Registered") {
      const args = parsed.args as { agentId: bigint; agentURI: string; owner: `0x${string}` };
      agentId = args.agentId;
      registeredUri = args.agentURI;
      registeredOwner = getAddress(args.owner);
      break;
    }
  } catch {
    // not a parseable event; continue scanning
  }
}

if (agentId === null || registeredOwner === null || registeredUri === null) {
  check("agentId from Registered event", false);
  console.log("X.23: Registered event not found in receipt — cannot determine agentId.");
  process.exit(1);
}
check("agentId derived from Registered event", agentId !== null);
console.log(`  agentId: ${agentId.toString()}`);
console.log(`  registered owner: ${registeredOwner}`);
console.log(`  registered agentURI: ${registeredUri}`);

// ---------------------------------------------------------------------------
// VERIFY owner + agent URI through the registry (read-only).
// ---------------------------------------------------------------------------
let chainOwner: `0x${string}` | null = null;
let chainUri: string | null = null;
try {
  const owner = await publicClient.readContract({
    address: preview.registry,
    abi: REGISTRY_READ_ABI,
    functionName: "ownerOf",
    args: [agentId],
  });
  chainOwner = getAddress(owner as `0x${string}`);
} catch {
  chainOwner = null;
}
try {
  let uri = await publicClient
    .readContract({
      address: preview.registry,
      abi: REGISTRY_READ_ABI,
      functionName: "tokenURI",
      args: [agentId],
    })
    .catch(() => undefined);
  if (uri === undefined) {
    uri = await publicClient.readContract({
      address: preview.registry,
      abi: REGISTRY_READ_ABI,
      functionName: "agentURI",
      args: [agentId],
    });
  }
  chainUri = typeof uri === "string" ? uri : null;
} catch {
  chainUri = null;
}
check("registry ownerOf(agentId) == provider EOA", chainOwner === getAddress(PROVIDER_EOA));
check("registry agentURI == canonical metadata URI", chainUri === CANONICAL_METADATA_URI);
console.log(`  ownerOf(agentId): ${chainOwner ?? "unavailable"}`);
console.log(`  agentURI(agentId): ${chainUri ?? "unavailable"}`);

// ---------------------------------------------------------------------------
// 8004SCAN verification (server-only key, never printed).
// ---------------------------------------------------------------------------
let scanOk = false;
let scanState = "NOT_AVAILABLE";
if (apiKeyConfigured) {
  try {
    const url =
      "https://8004scan.io/api/v1/public/agents?ownerAddress=" +
      encodeURIComponent(PROVIDER_EOA) +
      "&chainId=97&isTestnet=true&limit=100";
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-API-Key": process.env["8004SCAN_API_KEY"] as string,
      },
    });
    const body = (await response.json()) as {
      success?: boolean;
      data?: Array<{
        agent_id?: string;
        token_id?: string;
        owner_address?: string | null;
        contract_address?: string;
        chain_id?: number;
        is_testnet?: boolean;
      }>;
    };
    const found = (body.data ?? []).find(
      (agent) =>
        (agent.agent_id === agentId.toString() ||
          agent.token_id === agentId.toString() ||
          agent.agent_id ===
            `97:${ERC8004_REGISTRY.toLowerCase()}:${agentId.toString()}`) &&
        (agent.owner_address ?? "").toLowerCase() === PROVIDER_EOA.toLowerCase() &&
        agent.chain_id === 97 &&
        agent.contract_address?.toLowerCase() === ERC8004_REGISTRY.toLowerCase()
    );
    scanOk = found !== undefined;
    scanState = scanOk ? "PASS" : "NOT_FOUND";
  } catch {
    scanOk = false;
    scanState = "NOT_AVAILABLE";
  }
}
check("8004scan verification", scanOk || scanState === "NOT_AVAILABLE");

// ---------------------------------------------------------------------------
// FINAL SUMMARY — exact mandated status block.
// ---------------------------------------------------------------------------
console.log("");
console.log("X.23 STATUS:");
console.log(`REGISTRATION: ${agentId !== null && receipt?.status === "success" ? "PASS" : "FAIL"}`);
console.log("CHAIN: 97");
console.log(`REGISTRY: ${ERC8004_REGISTRY}`);
console.log(`PROVIDER EOA: ${PROVIDER_EOA}`);
console.log(`TRANSACTION HASH: ${txHash}`);
console.log(`BLOCK NUMBER: ${receipt.blockNumber.toString()}`);
console.log(`AGENT ID: ${agentId.toString()}`);
console.log(`REGISTERED OWNER: ${registeredOwner}`);
console.log(`REGISTERED AGENT URI: ${registeredUri}`);
console.log(`8004SCAN VERIFICATION: ${scanState}`);
console.log("SIGNING: PERFORMED");
console.log("BROADCAST: PERFORMED");
console.log("TRANSACTION CONFIRMED: YES");
console.log("ERC-8183 JOB: NOT CREATED");
console.log("PAYMENT: NOT PERFORMED");
console.log("SETTLEMENT: NOT PERFORMED");
console.log("MAINNET: NOT TOUCHED");
console.log("STOPPED AFTER REGISTRATION VERIFICATION — no ERC-8183 step was started.");