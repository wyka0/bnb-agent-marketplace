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
 * X.22 — FINAL ERC-8004 REGISTRATION TRANSACTION REVIEW (read-only approval).
 *
 * Reuses the deterministic X.20 unsigned calldata (must hash-match the X.20
 * constant) and verifies every check mandated for the final review:
 *
 *   1. chainId (live RPC must be 97)
 *   2. registry bytecode (deployed contract on chain 97; EIP-1967 proxy slot
 *      must point at the verified implementation)
 *   3. provider EOA bytecode (must be 0x — an EOA, not a contract)
 *   4. provider balance (read-only snapshot)
 *   5. provider nonce (read-only pending snapshot)
 *   6. gas estimate (eth_estimateGas of the exact register() call)
 *   7. current gas/fee information (maxPriorityFeePerGas + gasPrice market)
 *   8. transaction target (to = verified registry, and only that address)
 *   9. transaction value (0)
 *  10. calldata hash (must equal X.20 constant)
 *  11. calldata decoding (must round-trip to the exact canonical metadata URI)
 *
 * It also confirms the transaction can ONLY target chain 97 + the verified
 * registry: the unsigned preview is built by the pure builder that pins
 * ERC8004_CHAIN_ID=97 and ERC8004_REGISTRY (any other target/chain is a
 * blocked preview), and the live chainId assertion re-confirms the network.
 *
 * Safety: NO signing, NO broadcast, NO network writes, NO private keys, NO
 * environment/secret access. All network calls are plain read methods on a
 * viem public client with no account/signer attached.
 */

const PUBLIC_HTTPS_ORIGIN = "https://bnb-agent-marketplace-web.vercel.app";
const CANONICAL_METADATA_URI = `${PUBLIC_HTTPS_ORIGIN}/.well-known/agent-registration.json`;
const CANONICAL_SERVICE_ENDPOINT = `${PUBLIC_HTTPS_ORIGIN}/api/agents/bnb-testnet-risk/service`;
const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const APPROVED_PRICE_RAW_U = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
/** X.20 verified calldata hash — used verbatim; must NOT be regenerated differently. */
const X20_CALLDATA_HASH = "0x00d53c8e13940e3a2e8361495fe9b3a6fcceab0ffd625f2beb200e102f5f81a4";
/** EIP-1967 implementation storage slot (read-only via eth_getStorageAt). */
const ERC1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

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
  console.log(`X.22 registration approval review verify: BLOCKED (${result.reasons.join(", ")})`);
  process.exit(1);
}
const preview = result.preview;
const calldataHash = keccak256(preview.calldata);

// Deterministic assertions — these never depend on network state and FAIL CLOSED.
check("to (registry) is verified registry", getAddress(preview.registry) === ERC8004_REGISTRY);
check("preview chainId is exactly 97", preview.chainId === 97);
check("calldata hash matches X.20", calldataHash === X20_CALLDATA_HASH);
const decoded = decodeFunctionData({ abi: VERIFIED_REGISTER_STRING_ABI, data: preview.calldata });
check(
  "calldata decodes to canonical agent URI",
  decoded.functionName === "register" &&
    Array.isArray(decoded.args) &&
    decoded.args[0] === CANONICAL_METADATA_URI
);
check("from (provider EOA) verified", getAddress(preview.from) === getAddress(PROVIDER_EOA));
check("transaction value is 0", preview.value === 0n);
check("preview is unsigned (no signature material)", preview.mode === "unsigned-preview");
check(
  "no secret material present in this review",
  !JSON.stringify({ ...preview, hash: calldataHash }, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  ).match(/private|secret|mnemonic|key/i)
);

// ---------------------------------------------------------------------------
// Read-only network verification (never signs, never broadcasts).
// ---------------------------------------------------------------------------
console.log("X.22 READ-ONLY CHAIN-97 VERIFICATION (no signer, no broadcast):");

// Read-only RPC via the repository-authorized Altana public RPC URL. Only
// read methods (getChainId, getCode, getBalance, getTransactionCount,
// estimateGas, fee reads, getStorageAt) are used — a viem public client has no
// account/signer attached and never writes.
let publicClient: ReturnType<typeof createPublicClient> | null = null;
const sdkClient = createAltanaClient() as unknown as {
  chains?: Array<{ chainId: number; publicRpcUrl: string }>;
};
const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
if (typeof publicRpcUrl === "string" && /^https?:\/\//i.test(publicRpcUrl)) {
  publicClient = createPublicClient({ transport: http(publicRpcUrl) });
} else {
  console.log("  note: SDK resolved no usable publicRpcUrl; network verification UNAVAILABLE");
}

interface ApprovalSnapshot {
  chainId?: bigint;
  registryBytecode?: string;
  registryBytecodeLength?: number;
  registryImplementationFromSlot?: `0x${string}` | null;
  providerBytecode?: string;
  providerBalance?: bigint;
  nonce?: bigint;
  gasEstimate?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint;
  blockNumber?: bigint;
  error?: string;
}
const snap: ApprovalSnapshot = {};

if (publicClient) {
  try {
    snap.chainId = BigInt(await publicClient.getChainId());
    snap.blockNumber = BigInt(await publicClient.getBlockNumber());
    const registryCode = await publicClient.getCode({ address: preview.registry });
    snap.registryBytecode = registryCode;
    snap.registryBytecodeLength =
      typeof registryCode === "string" && registryCode !== "0x"
        ? (registryCode.length - 2) / 2
        : 0;
    const slotRaw = await publicClient.getStorageAt({
      address: preview.registry,
      slot: ERC1967_IMPLEMENTATION_SLOT,
    });
    snap.registryImplementationFromSlot =
      slotRaw && slotRaw !== "0x" && slotRaw.length >= 66
        ? getAddress(`0x${slotRaw.slice(-40)}`)
        : null;
    const providerCode = await publicClient.getCode({ address: preview.from });
    snap.providerBytecode = providerCode;
    snap.providerBalance = await publicClient.getBalance({ address: preview.from });
    snap.nonce = BigInt(await publicClient.getTransactionCount({ address: preview.from }));
    snap.gasEstimate = await publicClient.estimateGas({
      account: preview.from,
      to: preview.registry,
      data: preview.calldata,
    });
    try {
      snap.maxPriorityFeePerGas = await publicClient.estimateMaxPriorityFeePerGas();
    } catch {
      snap.maxPriorityFeePerGas = undefined;
    }
    snap.gasPrice = await publicClient.getGasPrice();
  } catch (err) {
    snap.error = err instanceof Error ? String(err.message).slice(0, 200) : "unknown RPC error";
  }
} else {
  snap.error = "no public RPC URL available";
}

// Check 1 — chainId.
check(
  "live chainId is exactly 97",
  snap.chainId !== undefined && snap.chainId === 97n
);
// Check 2 — registry is a deployed contract on chain 97.
check(
  "registry has deployed bytecode on chain 97",
  typeof snap.registryBytecode === "string" && snap.registryBytecode !== "0x"
);
check(
  "registry proxy implementation slot matches verified implementation",
  snap.registryImplementationFromSlot === ERC8004_IMPLEMENTATION
);
// Check 3 — provider is an EOA (no bytecode). The Altana RPC returns
// undefined for EOAs (null -> undefined in viem), equivalent to "0x".
check(
  "provider EOA bytecode is empty (0x) — EOA confirmed",
  snap.providerBytecode === "0x" || snap.providerBytecode === undefined
);
// Check 4/5/6/7 — balance, nonce, gas, fees are snapshots (verified, re-derived at submission).
check(
  "provider balance read (read-only)",
  snap.providerBalance !== undefined
);
check("provider nonce read (read-only)", snap.nonce !== undefined);
check("gas estimate read (read-only)", snap.gasEstimate !== undefined);
check(
  "fee information read (read-only)",
  snap.gasPrice !== undefined || snap.maxPriorityFeePerGas !== undefined
);

const failed = checks.filter(([, ok]) => !ok);
console.log(
  `X.22 registration approval review: ${checks.length - failed.length}/${checks.length} checks passed`
);
if (failed.length > 0) process.exit(1);

console.log("");
console.log("X.22 READ-ONLY CHAIN-97 SNAPSHOT VALUES:");
console.log(`  chainId: ${snap.chainId !== undefined ? `${snap.chainId} (0x${snap.chainId.toString(16)})` : "UNAVAILABLE"}`);
console.log(`  blockNumber snapshot: ${snap.blockNumber !== undefined ? snap.blockNumber.toString() : "UNAVAILABLE"}`);
console.log(`  registry bytecode: ${snap.registryBytecode !== undefined ? `${snap.registryBytecode.length === 2 ? "empty" : `${snap.registryBytecodeLength} bytes deployed`}` : "UNAVAILABLE"}`);
console.log(`  registry implementation slot: ${snap.registryImplementationFromSlot ?? "UNAVAILABLE"}`);
console.log(`  provider EOA bytecode: ${snap.providerBytecode !== undefined ? (snap.providerBytecode === "0x" ? "0x (EOA)" : snap.providerBytecode) : "0x (EOA, node returned null)"}`);
console.log(`  provider balance: ${snap.providerBalance !== undefined ? snap.providerBalance.toString() : "UNAVAILABLE"}`);
console.log(`  provider nonce (pending): ${snap.nonce !== undefined ? snap.nonce.toString() : "UNAVAILABLE"}`);
console.log(`  gasLimit estimate: ${snap.gasEstimate !== undefined ? snap.gasEstimate.toString() : "UNAVAILABLE"}`);
console.log(`  maxPriorityFeePerGas: ${snap.maxPriorityFeePerGas !== undefined ? snap.maxPriorityFeePerGas.toString() : "UNAVAILABLE (chain may only expose gasPrice)"}`);
console.log(`  gasPrice (market): ${snap.gasPrice !== undefined ? snap.gasPrice.toString() : "UNAVAILABLE"}`);
if (snap.error) console.log(`  note: network verification partially unavailable (${snap.error})`);

console.log("");
console.log("X.22 FINAL UNSIGNED TRANSACTION REVIEW (nothing signed/broadcast):");
console.log(`  to: ${preview.registry}`);
console.log(`  chainId: ${preview.chainId} (live-confirmed ${snap.chainId !== undefined ? snap.chainId : "unavailable"})`);
console.log(`  from (signer/provider EOA): ${preview.from}`);
console.log(`  functionName: ${preview.functionName}`);
console.log(`  agentURI: ${preview.metadataUri}`);
console.log(`  data (calldata): ${preview.calldata}`);
console.log(`  dataHash (keccak256): ${calldataHash}`);
console.log(`  value: ${preview.value} (0x${preview.value.toString(16)})`);
console.log(`  type: eip1559 (chain 97 supports EIP-1559; final at submission)`);
console.log(`  accessList: []`);
console.log(`  signedTx: ABSENT (no envelope constructed)`);
console.log("  constraint: chain 97 only (ERPC8004_CHAIN_ID pinned + live-confirmed) and registry-only target");
console.log("SIGNING: NOT PERFORMED");
console.log("BROADCAST: NOT PERFORMED");
console.log("ERC-8004 REGISTRATION: NOT PERFORMED");
console.log("AGENT ID: NOT ASSIGNED");
console.log("ERC-8183 JOB: NOT CREATED");
console.log("PAYMENT: NOT PERFORMED");
console.log("MAINNET: NOT TOUCHED");
console.log("final verification: x22 registration approval review PASS");