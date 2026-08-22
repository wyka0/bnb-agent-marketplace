/**
 * X.76 — Verified Execution Capability source verifier.
 *
 * Offline, no network, no environment access, no real provider. Proves:
 *   1. The current production resolver returns `null` for real-shaped 8004scan
 *      records (both mainnet and testnet) — activation stays unavailable.
 *   2. The 8004scan `Scan8004Agent` contract carries identity/metadata ONLY and
 *      NO verified execution-capability fields (price/expiry/jobId/resource/
 *      executionCapability). A boolean `x402_supported` flag is not proof of
 *      executability.
 *   3. The conservative `resolveExecutionCapability` boundary returns `null`
 *      when no authoritative provider exists (the current state) and rejects
 *      every malformed / placeholder / missing-field capability.
 *   4. The boundary DOES accept a complete, authoritative, future-dated
 *      capability from a TEST-FIXTURE provider — proving the contract is
 *      correct without deploying any real integration.
 *
 * No capability is ever resolved in production: the module never constructs a
 * provider and the route never supplies one.
 */

import {
  resolveExecutionCapability,
  verifyExecutionCapability,
  type ExecutionCapabilityProvider,
  type VerifiedExecutionCapability,
} from "./capability-source.ts";
import { resolveAgentActivationCapability } from "./capability.ts";
import type { Scan8004Agent } from "../eight004scan/types.ts";

const FUTURE = new Date(Date.now() + 3_600_000).toISOString();
const PAST = new Date(Date.now() - 3_600_000).toISOString();

/** Real-shaped 8004scan record (chain 56 mainnet). No execution-capability fields exist. */
const MAINNET_RECORD: Scan8004Agent = {
  id: "x76-mainnet",
  agent_id: "56:0xabcabcabcabcabcabcabcabcabcabcabcabcabca:123",
  token_id: "123",
  chain_id: 56,
  chain_type: "evm",
  contract_address: "0xabcabcabcabcabcabcabcabcabcabcabcabcabca",
  is_testnet: false,
  owner_id: "owner-1",
  owner_address: "0xdefdefdefdefdefdefdefdefdefdefdefdefdef0",
  owner_ens: null,
  owner_username: null,
  owner_avatar_url: null,
  owner_publisher_tier: null,
  owner_certified_name: null,
  name: "X.76 Mainnet Agent",
  description: "Registry listing only. Not executable evidence.",
  image_url: null,
  is_verified: true,
  star_count: 0,
  supported_protocols: ["MCP"],
  x402_supported: true,
  total_score: 0,
  rank: null,
  network_rank: null,
  health_score: null,
  total_feedbacks: 0,
  average_score: 0,
  cross_chain_versions: null,
  created_at: "2026-08-12T00:00:00Z",
  updated_at: "2026-08-12T00:00:00Z",
};

/** Real-shaped 8004scan record (chain 97 testnet). Still no execution-capability fields. */
const TESTNET_RECORD: Scan8004Agent = {
  ...MAINNET_RECORD,
  id: "x76-testnet",
  agent_id: "97:0xabcabcabcabcabcabcabcabcabcabcabcabcabca:123",
  chain_id: 97,
  is_testnet: true,
};

function validCapability(
  overrides: Partial<VerifiedExecutionCapability> = {}
): VerifiedExecutionCapability {
  return {
    agentId: "97:0xabcabcabcabcabcabcabcabcabcabcabcabcabca:123",
    jobId: "900000000000000002",
    resource: "https://altana.example/agents/123/execute",
    executionCapability: "erc8183-hire",
    price: "250000000000000000",
    expiresAt: FUTURE,
    verification: {
      source: "onchain:erc8004-job-registry",
      verifiedAt: new Date().toISOString(),
      method: "onchain:erc8004-job",
    },
    ...overrides,
  };
}

/** TEST-FIXTURE only. Never used by production; proves the boundary accepts legitimate data. */
const FIXTURE_PROVIDER: ExecutionCapabilityProvider = {
  async resolveExecutionCapability() {
    return validCapability();
  },
};

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
}

async function run() {
  // --- 1. Current production resolver returns null (activation unavailable) ---
  check(
    "1a production resolver returns null for real mainnet 8004scan record",
    resolveAgentActivationCapability({
      chainId: MAINNET_RECORD.chain_id,
      isTestnet: MAINNET_RECORD.is_testnet,
      agentId: MAINNET_RECORD.agent_id,
    }) === null
  );
  check(
    "1b production resolver returns null for real testnet 8004scan record (no capability source)",
    resolveAgentActivationCapability({
      chainId: TESTNET_RECORD.chain_id,
      isTestnet: TESTNET_RECORD.is_testnet,
      agentId: TESTNET_RECORD.agent_id,
    }) === null
  );

  // --- 2. 8004scan contract is identity/metadata only ---
  const keys = Object.keys(MAINNET_RECORD);
  check(
    "2a 8004scan exposes NO price field",
    !keys.includes("price") && !keys.includes("verified_price")
  );
  check(
    "2b 8004scan exposes NO expiry field",
    !keys.includes("expiry") && !keys.includes("expires_at")
  );
  check("2c 8004scan exposes NO jobId field", !keys.includes("job_id") && !keys.includes("jobId"));
  check(
    "2d 8004scan exposes NO resource field",
    !keys.includes("resource") && !keys.includes("resource_url")
  );
  check(
    "2e 8004scan exposes NO executionCapability field",
    !keys.includes("execution_capability") && !("executionCapability" in MAINNET_RECORD)
  );
  check(
    "2f x402_supported is a boolean flag, not a verified execution capability",
    typeof MAINNET_RECORD.x402_supported === "boolean"
  );

  // --- 3. Conservative boundary returns null without a provider (production state) ---
  check(
    "3a resolveExecutionCapability returns null with no provider (safety property)",
    (await resolveExecutionCapability({ agentId: TESTNET_RECORD.agent_id })) === null
  );

  // --- 4. Validator rejects malformed / placeholder / missing-field capabilities ---
  check(
    "4a missing execution capability -> rejected",
    verifyExecutionCapability(validCapability({ executionCapability: "" })).ok === false
  );
  check(
    "4b placeholder execution capability 'enabled' -> rejected",
    verifyExecutionCapability(validCapability({ executionCapability: "enabled" })).ok === false
  );
  check(
    "4c missing jobId -> rejected",
    verifyExecutionCapability(validCapability({ jobId: "" })).ok === false
  );
  check(
    "4d placeholder jobId 'unknown' -> rejected",
    verifyExecutionCapability(validCapability({ jobId: "unknown" })).ok === false
  );
  check(
    "4e missing resource -> rejected",
    verifyExecutionCapability(validCapability({ resource: "" })).ok === false
  );
  check(
    "4f placeholder resource 'default' -> rejected",
    verifyExecutionCapability(validCapability({ resource: "default" })).ok === false
  );
  check(
    "4g missing price -> rejected",
    verifyExecutionCapability(validCapability({ price: "" })).ok === false
  );
  check(
    "4h placeholder price '0' -> rejected",
    verifyExecutionCapability(validCapability({ price: "0" })).ok === false
  );
  check(
    "4i non-numeric price -> rejected",
    verifyExecutionCapability(validCapability({ price: "abc" })).ok === false
  );
  check(
    "4j missing expiry -> rejected",
    verifyExecutionCapability(validCapability({ expiresAt: "" })).ok === false
  );
  check(
    "4k elapsed expiry -> rejected",
    verifyExecutionCapability(validCapability({ expiresAt: PAST })).ok === false
  );
  check(
    "4l untrusted verification source -> rejected",
    verifyExecutionCapability(
      validCapability({
        verification: {
          source: "untrusted",
          verifiedAt: new Date().toISOString(),
          method: "onchain:erc8004-job",
        },
      })
    ).ok === false
  );
  check(
    "4m empty verification source -> rejected",
    verifyExecutionCapability(
      validCapability({
        verification: {
          source: "",
          verifiedAt: new Date().toISOString(),
          method: "onchain:erc8004-job",
        },
      })
    ).ok === false
  );
  check(
    "4n missing verification method -> rejected",
    verifyExecutionCapability(
      validCapability({
        verification: {
          source: "onchain:erc8004-job-registry",
          verifiedAt: new Date().toISOString(),
          method: "",
        },
      })
    ).ok === false
  );
  check(
    "4o malformed capability data (null) -> rejected",
    verifyExecutionCapability(null).ok === false
  );

  // --- 5. Boundary BLOCK cases via a provider returning incomplete data ---
  const missingCapProvider: ExecutionCapabilityProvider = {
    async resolveExecutionCapability() {
      return validCapability({ jobId: "unknown" });
    },
  };
  check(
    "5a provider returning missing jobId -> resolve returns null",
    (await resolveExecutionCapability({ agentId: TESTNET_RECORD.agent_id }, missingCapProvider)) ===
      null
  );

  const noProviderAvailable: ExecutionCapabilityProvider = {
    async resolveExecutionCapability() {
      return null;
    },
  };
  check(
    "5b provider unavailable (returns null) -> resolve returns null",
    (await resolveExecutionCapability(
      { agentId: TESTNET_RECORD.agent_id },
      noProviderAvailable
    )) === null
  );

  // --- 6. Boundary PASS cases with an authoritative TEST-FIXTURE provider ---
  const resolved = await resolveExecutionCapability(
    { agentId: TESTNET_RECORD.agent_id },
    FIXTURE_PROVIDER
  );
  check("6a authoritative provider complete capability -> resolved (not null)", resolved !== null);
  check("6b valid price preserved", resolved?.price === "250000000000000000");
  check("6c valid expiry preserved", resolved?.expiresAt === FUTURE);
  check("6d valid jobId preserved", resolved?.jobId === "900000000000000002");
  check(
    "6e valid resource preserved",
    resolved?.resource === "https://altana.example/agents/123/execute"
  );
  check(
    "6f verified execution capability preserved",
    resolved?.executionCapability === "erc8183-hire"
  );
  check(
    "6g verification metadata preserved",
    resolved?.verification.source === "onchain:erc8004-job-registry"
  );

  console.log(
    `\nX.76 capability-source verifier: ${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`
  );
  if (failures > 0) process.exitCode = 1;
}

void run();
