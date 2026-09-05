import { decodeFunctionData, keccak256, toFunctionSelector } from "viem";
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

/**
 * X.20 focused verification for the REAL canonical unsigned registration
 * preview. Operates purely on public / operator-approved constants; reads NO
 * environment, private keys, or secrets. Fail-closed with no signature.
 */

const PUBLIC_HTTPS_ORIGIN = "https://bnb-agent-marketplace-web.vercel.app";
const CANONICAL_METADATA_URI = `${PUBLIC_HTTPS_ORIGIN}/.well-known/agent-registration.json`;
const CANONICAL_SERVICE_ENDPOINT = `${PUBLIC_HTTPS_ORIGIN}/api/agents/bnb-testnet-risk/service`;
const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const APPROVED_PRICE_RAW_U = 1_000_000_000_000_000_000n; // 1 U at 18 decimals

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
const ready = result.status === "ready";
check("canonical inputs produce a ready preview", ready);

if (!ready) {
  console.log(
    `X.20 canonical registration preview verify: BLOCKED${ready ? "" : ` (${result.status === "blocked" && result.reasons.join(", ")})`}`
  );
  process.exit(1);
}

const preview = result.preview;
check("chainId is 97", preview.chainId === 97);
check("registry is verified registry", preview.registry === ERC8004_REGISTRY);
check("implementation is verified implementation", preview.implementation === ERC8004_IMPLEMENTATION);
check("from is verified provider EOA", preview.from === PROVIDER_EOA);
check("function name is register", preview.functionName === "register");
check("agentURI is canonical metadata URI", preview.metadataUri === CANONICAL_METADATA_URI);
check("mode is unsigned-preview", preview.mode === "unsigned-preview");
check("transaction value is 0", preview.value === 0n);
check("token is United Stables U", preview.token === UNITED_STABLES_TOKEN);
check("price source is ALTANA_SERVICE_PRICE_RAW_U", preview.priceSource === SERVICE_PRICE_ENV);

const selector = toFunctionSelector(
  VERIFIED_REGISTER_STRING_ABI[0] as Extract<
    (typeof VERIFIED_REGISTER_STRING_ABI)[number],
    { type: "function" }
  >
);
check(
  "calldata selector is register(string)",
  preview.calldata.startsWith(selector) && selector.length === 10
);

const decoded = decodeFunctionData({ abi: VERIFIED_REGISTER_STRING_ABI, data: preview.calldata });
check("decoded function is register", decoded.functionName === "register");
check(
  "decoded agentURI round-trips exactly",
  Array.isArray(decoded.args) && decoded.args[0] === CANONICAL_METADATA_URI
);

const calldataHash = keccak256(preview.calldata);
check("calldata hash computed (32 bytes)", calldataHash.length === 66);

const second = buildUnsignedRegistrationPreview(base);
check(
  "calldata is deterministic",
  second.status === "ready" && second.preview.calldata === preview.calldata
);
check(
  "preview contains no secret material",
  !JSON.stringify(preview, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  ).match(/private|secret|mnemonic|key/i)
);

const failed = checks.filter(([, ok]) => !ok);
console.log(
  `X.20 canonical registration preview verify: ${checks.length - failed.length}/${checks.length} passed`
);
if (failed.length > 0) process.exit(1);

console.log("X.20 UNSIGNED REGISTRATION PREVIEW (canonical, redacted to public fields):");
console.log(`  chainId: ${preview.chainId}`);
console.log(`  registry: ${preview.registry}`);
console.log(`  implementation: ${preview.implementation}`);
console.log(`  from (provider EOA): ${preview.from}`);
console.log(`  functionName: ${preview.functionName}`);
console.log(`  agentURI: ${preview.metadataUri}`);
console.log(`  calldata: ${preview.calldata}`);
console.log(`  calldataHash: ${calldataHash}`);
console.log(`  value: ${preview.value}`);
console.log(`  token: ${preview.token}`);
console.log(`  priceSource: ${preview.priceSource}`);
console.log(`  mode: ${preview.mode}`);