/**
 * X.24 — POST-REGISTRATION ERC-8004 VERIFICATION (READ-ONLY).
 *
 * Verified registration inputs (from X.23):
 *   chain       97 (BNB Smart Chain Testnet)
 *   agentId     1816
 *   registry    0x8004A818BFB912233c491871b3d84c89A494BD9e
 *   owner       0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
 *   agentURI    https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
 *   txHash      0xba7f8e61…3f265a83
 *
 * This script performs ONLY read-only checks:
 *   1. Read Agent ID 1816 from the ERC-8004 registry.
 *   2. Confirm the registered owner is the verified provider EOA.
 *   3. Confirm the registered agent URI exactly matches the canonical URI.
 *   4. Fetch the metadata URI → HTTP 200 + valid JSON.
 *   5. Verify the metadata serviceEndpoint.
 *   6. POST a safe test request to the existing X.13 service endpoint.
 *   7. Confirm the service returns the expected structured response.
 *   8. Query 8004scan for Agent ID 1816 using the server-only API key.
 *   9. Confirm 8004scan returns the registered agent.
 *
 * SAFETY — no ERC-8183 job, no payment, no settlement, no new transaction, no
 * signing, no mainnet, no agent modification, no secret rendering.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
} from "viem";
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
const APPROVED_PRICE_RAW_U = 1_000_000_000_000_000_000n;
const X20_CALLDATA_HASH = "0x00d53c8e13940e3a2e8361495fe9b3a6fcceab0ffd625f2beb200e102f5f81a4";
const AGENT_ID = 1816n;

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

const checks: Array<{ label: string; ok: boolean }> = [];
function check(label: string, ok: boolean): void {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

// Load the server-only secret environment (never rendered).
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
  } catch {
    check("load server env", false);
    process.exit(1);
  }
}

// Deterministic preview still pinned to X.22/X.23 (the registered txn used it).
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
const previewResult = buildUnsignedRegistrationPreview(base);
if (previewResult.status !== "ready") {
  check(`preview pinned (blocked: ${previewResult.reasons.join(", ")})`, false);
  process.exit(1);
}
const preview = previewResult.preview;
check("pinned calldata hash still matches X.22/X.23", keccak256(preview.calldata) === X20_CALLDATA_HASH);

const sdkClient = createAltanaClient() as unknown as {
  chains?: Array<{ chainId: number; publicRpcUrl: string }>;
};
const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
if (typeof publicRpcUrl !== "string" || !/^https?:\/\//i.test(publicRpcUrl)) {
  check("public RPC URL resolved", false);
  process.exit(1);
}
const publicClient = createPublicClient({ transport: http(publicRpcUrl) });

console.log("X.24 READ-ONLY ERC-8004 POST-REGISTRATION VERIFICATION:");

// 1. Chain + registry read of Agent ID 1816.
let chainIdOk = false;
try {
  chainIdOk = BigInt(await publicClient.getChainId()) === 97n;
} catch {
  chainIdOk = false;
}
check(`current chain is 97${chainIdOk ? " (confirmed)" : ""}`, chainIdOk);

let owner: `0x${string}` | null = null;
try {
  const ownerRaw = await publicClient.readContract({
    address: preview.registry,
    abi: REGISTRY_READ_ABI,
    functionName: "ownerOf",
    args: [AGENT_ID],
  });
  owner = getAddress(ownerRaw as `0x${string}`);
} catch {
  owner = null;
}
check("Agent ID 1816 readable from registry (ownerOf)", owner !== null);

// 2. Owner match.
check("registered owner == verified provider EOA", owner === getAddress(PROVIDER_EOA));

// 3. Agent URI match.
let agentUri: string | null = null;
try {
  let uri = await publicClient
    .readContract({
      address: preview.registry,
      abi: REGISTRY_READ_ABI,
      functionName: "tokenURI",
      args: [AGENT_ID],
    })
    .catch(() => undefined);
  if (uri === undefined) {
    uri = await publicClient.readContract({
      address: preview.registry,
      abi: REGISTRY_READ_ABI,
      functionName: "agentURI",
      args: [AGENT_ID],
    });
  }
  agentUri = typeof uri === "string" ? uri : null;
} catch {
  agentUri = null;
}
check("registered agent URI == canonical metadata URI", agentUri === CANONICAL_METADATA_URI);

// 4. Fetch metadata URI → HTTP 200 + valid JSON.
let metadataStatus = 0;
let metadataJson: Record<string, unknown> | null = null;
try {
  const metaResponse = await fetch(CANONICAL_METADATA_URI, { method: "GET" });
  metadataStatus = metaResponse.status;
  const text = await metaResponse.text();
  const parsed = JSON.parse(text);
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    metadataJson = parsed as Record<string, unknown>;
  }
} catch {
  metadataStatus = 0;
  metadataJson = null;
}
check(`metadata URI HTTP 200 + valid JSON (HTTP ${metadataStatus})`, metadataStatus >= 200 && metadataStatus < 300 && metadataJson !== null);

// 5. Verify the metadata serviceEndpoint.
const metadataServices = Array.isArray(metadataJson?.services) ? metadataJson.services : [];
const serviceEndpoint =
  metadataServices.length > 0 &&
  typeof metadataServices[0] === "object" &&
  metadataServices[0] !== null
    ? (metadataServices[0] as { endpoint?: unknown })?.endpoint
    : undefined;
check("metadata serviceEndpoint == canonical service", serviceEndpoint === CANONICAL_SERVICE_ENDPOINT);

// 6 + 7. POST a safe test request to the X.13 service endpoint.
const SAFE_TEST_WALLET = "0x0000000000000000000000000000000000000001" as const;
interface RiskServiceShape {
  state?: string;
  chainId?: number;
  wallet?: string;
  nativeBalanceWei?: string;
}
let serviceResponse: RiskServiceShape | null = null;
try {
  const svcResponse = await fetch(CANONICAL_SERVICE_ENDPOINT, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ wallet: SAFE_TEST_WALLET }),
  });
  if (svcResponse.ok) {
    serviceResponse = (await svcResponse.json()) as RiskServiceShape;
  } else {
    serviceResponse = null;
  }
} catch {
  serviceResponse = null;
}
const serviceOk =
  serviceResponse !== null &&
  serviceResponse.state === "ready" &&
  serviceResponse.chainId === 97 &&
  serviceResponse.wallet?.toLowerCase() === SAFE_TEST_WALLET.toLowerCase() &&
  typeof serviceResponse.nativeBalanceWei === "string";
check("X.13 service structured ready response", serviceOk);

// 8 + 9. Query 8004scan for Agent ID 1816 (server-only key, never printed).
const apiKeyConfigured =
  typeof process.env["8004SCAN_API_KEY"] === "string" && process.env["8004SCAN_API_KEY"].trim().length > 0;
let scanFound = false;
let scanMatch: Record<string, unknown> | null = null;
if (apiKeyConfigured) {
  try {
    const url =
      "https://8004scan.io/api/v1/public/agents?ownerAddress=" +
      encodeURIComponent(PROVIDER_EOA) +
      "&chainId=97&isTestnet=true&limit=100";
    const response = await fetch(url, {
      headers: { Accept: "application/json", "X-API-Key": process.env["8004SCAN_API_KEY"] as string },
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
        name?: string | null;
      }>;
    };
    scanMatch =
      (body.data ?? []).find(
        (agent) =>
          (agent.agent_id === AGENT_ID.toString() ||
            agent.token_id === AGENT_ID.toString() ||
            agent.agent_id === `97:${ERC8004_REGISTRY.toLowerCase()}:${AGENT_ID.toString()}`) &&
          (agent.owner_address ?? "").toLowerCase() === PROVIDER_EOA.toLowerCase() &&
          agent.chain_id === 97 &&
          agent.contract_address?.toLowerCase() === ERC8004_REGISTRY.toLowerCase()
      ) ?? null;
    scanFound = scanMatch !== null;
  } catch {
    scanFound = false;
    scanMatch = null;
  }
}
check("8004scan agent lookup performed (key present)", apiKeyConfigured);
check("8004scan returns Agent ID 1816", scanFound);

const failed = checks.filter((entry) => !entry.ok);
console.log(`X.24 read-only verification: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length > 0) process.exit(1);

console.log("");
console.log("X.24 VERIFIED RECORD:");
console.log(`  agentId: ${AGENT_ID.toString()}`);
console.log(`  owner: ${owner ?? "unavailable"}`);
console.log(`  agentURI: ${agentUri ?? "unavailable"}`);
console.log(`  metadata HTTP: ${metadataStatus}`);
console.log(`  metadata serviceEndpoint: ${serviceEndpoint === CANONICAL_SERVICE_ENDPOINT ? CANONICAL_SERVICE_ENDPOINT : "MISMATCH"}`);
console.log(`  service state: ${serviceResponse?.state ?? "unavailable"}`);
console.log(`  8004scan: ${scanFound ? "PASS" : "NOT_AVAILABLE"}`);
if (scanMatch !== null) console.log(`  8004scan record: ${JSON.stringify(scanMatch)}`);
console.log("ERC-8183 JOB: NOT CREATED");
console.log("PAYMENT: NOT PERFORMED");
console.log("SETTLEMENT: NOT PERFORMED");
console.log("NEW TRANSACTION: NOT PERFORMED");
console.log("SIGNING: NOT PERFORMED");
console.log("MAINNET: NOT TOUCHED");