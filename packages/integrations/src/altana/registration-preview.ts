import { encodeFunctionData, getAddress, isAddress } from "viem";

export const ERC8004_CHAIN_ID = 97 as const;
export const ERC8004_REGISTRY = getAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e");
export const ERC8004_IMPLEMENTATION = getAddress("0x7274e874ca62410a93bd8bf61c69d8045e399c02");
export const UNITED_STABLES_TOKEN = getAddress("0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565");
export const SERVICE_PRICE_ENV = "ALTANA_SERVICE_PRICE_RAW_U" as const;

export const VERIFIED_REGISTER_STRING_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

export interface RegistrationMetadataEvidence {
  active: false;
  x402Support: false;
  serviceEndpoint: string;
}

export interface RegistrationPreviewInput {
  chainId: number;
  registry: string;
  implementation: string;
  provider: string;
  providerBytecode: string;
  canonicalOrigin: string;
  metadataUri: string;
  metadata: RegistrationMetadataEvidence;
  priceRawU: bigint;
  priceSource: typeof SERVICE_PRICE_ENV;
  token: string;
  abi?: typeof VERIFIED_REGISTER_STRING_ABI | readonly unknown[];
}

export interface UnsignedRegistrationPreview {
  chainId: typeof ERC8004_CHAIN_ID;
  registry: typeof ERC8004_REGISTRY;
  implementation: typeof ERC8004_IMPLEMENTATION;
  from: `0x${string}`;
  functionName: "register";
  args: readonly [string];
  metadataUri: string;
  calldata: `0x${string}`;
  value: 0n;
  token: typeof UNITED_STABLES_TOKEN;
  priceRawU: bigint;
  priceSource: typeof SERVICE_PRICE_ENV;
  mode: "unsigned-preview";
}

export type RegistrationPreviewResult =
  | { status: "ready"; preview: UnsignedRegistrationPreview }
  | { status: "blocked"; reasons: string[] };

export function parseServerRawUPrice(value: string | undefined): bigint | null {
  if (value === undefined || !/^[1-9][0-9]*$/.test(value)) return null;
  return BigInt(value);
}

export function buildUnsignedRegistrationPreview(
  input: RegistrationPreviewInput
): RegistrationPreviewResult {
  const reasons: string[] = [];
  const registry = normalizeAddress(input.registry, "registry", reasons);
  const implementation = normalizeAddress(input.implementation, "implementation", reasons);
  const provider = normalizeAddress(input.provider, "provider", reasons);
  const token = normalizeAddress(input.token, "token", reasons);

  if (input.chainId !== ERC8004_CHAIN_ID) reasons.push("unsupported-chain");
  if (registry !== ERC8004_REGISTRY) reasons.push("wrong-registry");
  if (implementation !== ERC8004_IMPLEMENTATION) reasons.push("wrong-implementation");
  if (provider === getAddress("0x0000000000000000000000000000000000000000")) {
    reasons.push("zero-provider");
  }
  if (input.providerBytecode !== "0x") reasons.push("provider-is-contract");
  if (token !== UNITED_STABLES_TOKEN) reasons.push("wrong-token");
  if (input.priceRawU <= 0n) reasons.push("invalid-price");
  if (input.priceSource !== SERVICE_PRICE_ENV) reasons.push("untrusted-price-source");

  const canonicalOrigin = parseCanonicalOrigin(input.canonicalOrigin, reasons);
  const metadataUri = parseHttpsUrl(input.metadataUri, "invalid-metadata-uri", reasons);
  const endpoint = parseHttpsUrl(
    input.metadata.serviceEndpoint,
    "invalid-service-endpoint",
    reasons
  );
  if (canonicalOrigin !== null && metadataUri !== null) {
    if (
      metadataUri.origin !== canonicalOrigin ||
      metadataUri.pathname !== "/.well-known/agent-registration.json"
    ) {
      reasons.push("noncanonical-metadata-uri");
    }
  }
  if (canonicalOrigin !== null && endpoint !== null) {
    if (
      endpoint.origin !== canonicalOrigin ||
      endpoint.pathname !== "/api/agents/bnb-testnet-risk/service"
    ) {
      reasons.push("noncanonical-service-endpoint");
    }
  }
  if (input.metadata.active !== false || input.metadata.x402Support !== false) {
    reasons.push("unsupported-capability-claim");
  }

  const abi = input.abi ?? VERIFIED_REGISTER_STRING_ABI;
  if (!hasVerifiedRegisterString(abi)) reasons.push("missing-register-string-abi");
  if (reasons.length > 0 || provider === null || metadataUri === null) {
    return { status: "blocked", reasons: [...new Set(reasons)] };
  }

  const calldata = encodeFunctionData({
    abi: VERIFIED_REGISTER_STRING_ABI,
    functionName: "register",
    args: [metadataUri.href],
  });
  return {
    status: "ready",
    preview: {
      chainId: ERC8004_CHAIN_ID,
      registry: ERC8004_REGISTRY,
      implementation: ERC8004_IMPLEMENTATION,
      from: provider,
      functionName: "register",
      args: [metadataUri.href],
      metadataUri: metadataUri.href,
      calldata,
      value: 0n,
      token: UNITED_STABLES_TOKEN,
      priceRawU: input.priceRawU,
      priceSource: SERVICE_PRICE_ENV,
      mode: "unsigned-preview",
    },
  };
}

function normalizeAddress(value: string, label: string, reasons: string[]): `0x${string}` | null {
  if (!isAddress(value)) {
    reasons.push(`invalid-${label}`);
    return null;
  }
  return getAddress(value);
}

function parseCanonicalOrigin(value: string, reasons: string[]): string | null {
  const url = parseHttpsUrl(value, "invalid-canonical-origin", reasons);
  if (url === null) return null;
  if (url.href !== `${url.origin}/`) reasons.push("canonical-origin-has-path");
  return url.origin;
}

function parseHttpsUrl(value: string, reason: string, reasons: string[]): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== ""
    ) {
      reasons.push(reason);
      return null;
    }
    return url;
  } catch {
    reasons.push(reason);
    return null;
  }
}

function hasVerifiedRegisterString(abi: readonly unknown[]): boolean {
  return abi.some((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const item = entry as { type?: unknown; name?: unknown; inputs?: unknown };
    return (
      item.type === "function" &&
      item.name === "register" &&
      Array.isArray(item.inputs) &&
      item.inputs.length === 1 &&
      typeof item.inputs[0] === "object" &&
      item.inputs[0] !== null &&
      (item.inputs[0] as { type?: unknown }).type === "string"
    );
  });
}
