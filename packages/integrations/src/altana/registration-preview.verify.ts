import {
  buildUnsignedRegistrationPreview,
  ERC8004_CHAIN_ID,
  ERC8004_IMPLEMENTATION,
  ERC8004_REGISTRY,
  parseServerRawUPrice,
  SERVICE_PRICE_ENV,
  UNITED_STABLES_TOKEN,
  VERIFIED_REGISTER_STRING_ABI,
} from "./registration-preview.js";
import type { RegistrationPreviewInput } from "./registration-preview.js";

const PROVIDER = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const ORIGIN = "https://agent.example";
const METADATA_URI = `${ORIGIN}/.well-known/agent-registration.json`;
const base: RegistrationPreviewInput = {
  chainId: ERC8004_CHAIN_ID,
  registry: ERC8004_REGISTRY,
  implementation: ERC8004_IMPLEMENTATION,
  provider: PROVIDER,
  providerBytecode: "0x",
  canonicalOrigin: ORIGIN,
  metadataUri: METADATA_URI,
  metadata: {
    active: false,
    x402Support: false,
    serviceEndpoint: `${ORIGIN}/api/agents/bnb-testnet-risk/service`,
  },
  priceRawU: 1n,
  priceSource: SERVICE_PRICE_ENV,
  token: UNITED_STABLES_TOKEN,
  abi: VERIFIED_REGISTER_STRING_ABI,
};

const checks: Array<[string, boolean]> = [];
function check(label: string, value: boolean): void {
  checks.push([label, value]);
  console.log(`${value ? "PASS" : "FAIL"} ${label}`);
}
function blocked(overrides: Partial<typeof base>): boolean {
  return buildUnsignedRegistrationPreview({ ...base, ...overrides }).status === "blocked";
}

check("missing provider rejected", blocked({ provider: "" }));
check("invalid provider rejected", blocked({ provider: "not-an-address" }));
check(
  "zero provider rejected",
  blocked({ provider: "0x0000000000000000000000000000000000000000" })
);
check("contract provider rejected", blocked({ providerBytecode: "0x6000" }));
check("valid EOA provider accepted", buildUnsignedRegistrationPreview(base).status === "ready");
check("missing price rejected", parseServerRawUPrice(undefined) === null);
check("zero price rejected", parseServerRawUPrice("0") === null && blocked({ priceRawU: 0n }));
check(
  "negative and decimal prices rejected",
  parseServerRawUPrice("-1") === null && parseServerRawUPrice("1.0") === null
);
check("positive raw price preserved", parseServerRawUPrice("123") === 123n);
check("malformed metadata URL rejected", blocked({ metadataUri: "not-a-url" }));
check(
  "HTTP metadata URL rejected",
  blocked({ metadataUri: "http://agent.example/.well-known/agent-registration.json" })
);
check(
  "canonical HTTPS metadata accepted",
  buildUnsignedRegistrationPreview(base).status === "ready"
);
check("wrong chain rejected", blocked({ chainId: 56 }));
check(
  "wrong registry rejected",
  blocked({ registry: "0x1111111111111111111111111111111111111111" })
);
check("wrong token rejected", blocked({ token: "0x1111111111111111111111111111111111111111" }));
check("missing ABI function rejected", blocked({ abi: [] }));

const first = buildUnsignedRegistrationPreview(base);
const second = buildUnsignedRegistrationPreview(base);
check(
  "calldata is deterministic",
  first.status === "ready" &&
    second.status === "ready" &&
    first.preview.calldata === second.preview.calldata
);
check(
  "preview contains no private key",
  first.status === "ready" &&
    !JSON.stringify(first.preview, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    ).match(/private|secret|key/i)
);
check(
  "preview is unsigned and value zero",
  first.status === "ready" &&
    first.preview.mode === "unsigned-preview" &&
    first.preview.value === 0n
);

const failed = checks.filter(([, ok]) => !ok);
console.log(
  `X.16 registration preview verify: ${checks.length - failed.length}/${checks.length} passed`
);
if (failed.length > 0) process.exit(1);
