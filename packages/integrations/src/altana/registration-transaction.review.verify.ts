import { createPublicClient, decodeFunctionData, getAddress, http, keccak256 } from "viem";
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

/**
 * X.21 read-only registration transaction review.
 *
 * Reuses the deterministic X.20 unsigned calldata (must hash-match the X.20
 * constant), verifies it decodes to the exact canonical agent URI, and takes a
 * read-only chain-97 snapshot (chainId, signer nonce, eth_estimateGas, fee
 * market, block height) via the repository-authorized Altana testnet client.
 *
 * Safety: NO signing, NO broadcast, NO network writes, NO private keys, NO
 * environment/secret access. RPC unavailability only downgrades the *network
 * snapshot* ("UNAVAILABLE"); deterministic assertions always fail closed.
 */

const PUBLIC_HTTPS_ORIGIN = "https://bnb-agent-marketplace-web.vercel.app";
const CANONICAL_METADATA_URI = `${PUBLIC_HTTPS_ORIGIN}/.well-known/agent-registration.json`;
const CANONICAL_SERVICE_ENDPOINT = `${PUBLIC_HTTPS_ORIGIN}/api/agents/bnb-testnet-risk/service`;
const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const APPROVED_PRICE_RAW_U = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
/** X.20 verified calldata hash — used verbatim; must NOT be regenerated differently. */
const X20_CALLDATA_HASH = "0x00d53c8e13940e3a2e8361495fe9b3a6fcceab0ffd625f2beb200e102f5f81a4";

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

const checks: Array<[string, boolean]> = [];
function check(label: string, value: boolean): void {
  checks.push([label, value]);
  console.log(`${value ? "PASS" : "FAIL"} ${label}`);
}

const result = buildUnsignedRegistrationPreview(base);
if (result.status !== "ready") {
  check("deterministic preview build ready", false);
  console.log(`X.21 registration transaction review verify: BLOCKED (${result.reasons.join(", ")})`);
  process.exit(1);
}
const preview = result.preview;
const calldataHash = keccak256(preview.calldata);

// 1. Target is exactly the verified registry.
check("to (registry) is verified registry", getAddress(preview.registry) === ERC8004_REGISTRY);
// 2. Chain id is exactly 97.
check("chainId is exactly 97", preview.chainId === 97);
// 3. Calldata hash matches X.20 exactly.
check("calldata hash matches X.20", calldataHash === X20_CALLDATA_HASH);
// 4. Calldata decodes to the exact canonical metadata URI.
const decoded = decodeFunctionData({ abi: VERIFIED_REGISTER_STRING_ABI, data: preview.calldata });
check(
  "calldata decodes to canonical agent URI",
  decoded.functionName === "register" &&
    Array.isArray(decoded.args) &&
    decoded.args[0] === CANONICAL_METADATA_URI
);
// 5. Provider EOA is the expected EOA.
check("from (provider EOA) verified", getAddress(preview.from) === getAddress(PROVIDER_EOA));
// 6/7/8 (no sign, no broadcast) are enforced by this script containing no signer,
// no account, and no sendTransport/write path; they are re-asserted below.
check("preview is unsigned (no signature material)", preview.mode === "unsigned-preview");
check(
  "no secret material present in this review",
  !JSON.stringify({ ...preview, hash: calldataHash }, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  ).match(/private|secret|mnemonic|key/i)
);

const failed = checks.filter(([, ok]) => !ok);
console.log(
  `X.21 deterministic assertions: ${checks.length - failed.length}/${checks.length} passed`
);
if (failed.length > 0) process.exit(1);

// ---------------------------------------------------------------------------
// Read-only network snapshot (never signs, never broadcasts).
// ---------------------------------------------------------------------------
console.log("X.21 READ-ONLY CHAIN-97 SNAPSHOT (no signer, no broadcast):");

// Read-only RPC via the repository-authorized Altana public RPC URL. Only
// read methods (chainId, blockNumber, tx count, estimateGas, gasPrice) are
// used; viem's public client has no account/signer attached and never writes.
let publicClient: ReturnType<typeof createPublicClient> | null = null;
// Minimal structural access to the resolved SDK network config (chainId, RPC URL).
const sdkClient = createAltanaClient() as unknown as {
  chains?: Array<{ chainId: number; publicRpcUrl: string }>;
};
const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
if (typeof publicRpcUrl === "string" && /^https?:\/\//i.test(publicRpcUrl)) {
  publicClient = createPublicClient({ transport: http(publicRpcUrl) });
} else {
  console.log("  note: SDK resolved no usable publicRpcUrl; network snapshot UNAVAILABLE");
}

interface Snapshot {
  chainId?: bigint;
  nonce?: bigint;
  gasEstimate?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint;
  blockNumber?: bigint;
  error?: string;
}
const snapshot: Snapshot = {};

if (publicClient) {
  try {
    snapshot.chainId = BigInt(await publicClient.getChainId());
    snapshot.blockNumber = BigInt(await publicClient.getBlockNumber());
    snapshot.nonce = BigInt(await publicClient.getTransactionCount({ address: preview.from }));
    snapshot.gasEstimate = await publicClient.estimateGas({
      account: preview.from,
      to: preview.registry,
      data: preview.calldata,
    });
    try {
      const priority = await publicClient.estimateMaxPriorityFeePerGas();
      snapshot.maxPriorityFeePerGas = priority;
    } catch {
      snapshot.maxPriorityFeePerGas = undefined;
    }
    snapshot.gasPrice = await publicClient.getGasPrice();
  } catch (err) {
    snapshot.error = err instanceof Error ? String(err.message).slice(0, 200) : "unknown RPC error";
  }
} else {
  snapshot.error = "no public RPC URL available";
}

console.log(`  chainId: ${snapshot.chainId !== undefined ? `${snapshot.chainId} (0x${snapshot.chainId.toString(16)})` : "UNAVAILABLE"}`);
console.log(`  nonce (pending): ${snapshot.nonce !== undefined ? snapshot.nonce.toString() : "UNAVAILABLE"}`);
console.log(`  gasLimit estimate: ${snapshot.gasEstimate !== undefined ? snapshot.gasEstimate.toString() : "UNAVAILABLE"}`);
console.log(`  maxPriorityFeePerGas: ${snapshot.maxPriorityFeePerGas !== undefined ? snapshot.maxPriorityFeePerGas.toString() : "UNAVAILABLE (chain may only expose gasPrice)"}`);
console.log(`  gasPrice (market): ${snapshot.gasPrice !== undefined ? snapshot.gasPrice.toString() : "UNAVAILABLE"}`);
console.log(`  blockNumber snapshot: ${snapshot.blockNumber !== undefined ? snapshot.blockNumber.toString() : "UNAVAILABLE"}`);
if (snapshot.error) console.log(`  note: network snapshot partially unavailable (${snapshot.error})`);

console.log("X.21 UNSIGNED TRANSACTION REVIEW (nothing signed/broadcast):");
console.log(`  to: ${preview.registry}`);
console.log(`  chainId: ${preview.chainId}`);
console.log(`  from (signer/provider EOA): ${preview.from}`);
console.log(`  functionName: ${preview.functionName}`);
console.log(`  agentURI: ${preview.metadataUri}`);
console.log(`  data (calldata): ${preview.calldata}`);
console.log(`  dataHash (keccak256): ${calldataHash}`);
console.log(`  value: ${preview.value} (0x${preview.value.toString(16)})`);
console.log(`  type: eip1559 (chain 97 supports EIP-1559; final at submission)`);
console.log(`  accessList: []`);
if (snapshot.nonce !== undefined) console.log(`  nonce: ${snapshot.nonce.toString()} (read-only pending snapshot; re-derive at submission)`);
if (snapshot.gasEstimate !== undefined) console.log(`  gasLimit: ${snapshot.gasEstimate.toString()} (eth_estimateGas; re-derive at submission)`);
if (snapshot.maxPriorityFeePerGas !== undefined) console.log(`  maxPriorityFeePerGas: ${snapshot.maxPriorityFeePerGas.toString()} (snapshot; re-derive at submission)`);
if (snapshot.gasPrice !== undefined) console.log(`  maxFeePerGas: >= ${snapshot.gasPrice.toString()} (gasPrice market snapshot; chosen at submission)`);
console.log("SIGNING: NOT PERFORMED");
console.log("BROADCAST: NOT PERFORMED");
console.log("final verification: x21 transaction review assertions passed");