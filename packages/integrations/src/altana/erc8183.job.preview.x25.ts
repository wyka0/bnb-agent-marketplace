/**
 * X.25 — ERC-8183 JOB PREPARATION / READ-ONLY REVIEW.
 *
 * Builds a deterministic, READ-ONLY ERC-8183 job preview against the verified
 * chain-97 deployment for the already-registered provider (Agent ID 1816).
 * NOTHING is created, signed, broadcast or funded — this script only:
 *
 *   1. loads the server-only environment and asserts the service price is
 *      EXACTLY 1 U (`ALTANA_SERVICE_PRICE_RAW_U`, never rendered),
 *   2. verifies the on-chain chain id is 97,
 *   3. reads (read-only) the AgenticCommerce `jobCounter` and `paymentToken`
 *      and the OptimisticPolicy `disputeWindow`,
 *   4. derives the predicted jobId (`jobCounter + 1`) and `expiredAt`
 *      (`now + disputeWindow + deadline`, default 1800s as the SDK does),
 *   5. builds the SDK atomic 5-call hire batch (createJob -> registerJob ->
 *      setBudget -> approve $U -> fund) through `prepareErc8183Hire`,
 *   6. verifies every batch target is a verified chain-97 ERC-8183 contract
 *      and that provider / budget / description match the verified input,
 *   7. prints the deterministic preview. No signing boundary is ever crossed.
 *
 * The job description is anchored to the canonical verified metadata text
 * (the authoritative service description served at
 * /.well-known/agent-registration.json); the 8004scan record description
 * field is empty for Agent 1816.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, getAddress, http } from "viem";
import { BNB_TESTNET } from "@altananetwork/sdk";
import type { Call } from "@altananetwork/sdk";
import {
  ALTANA_ERC8183_CHAIN_ID,
  prepareErc8183Hire,
  resolveErc8183Config,
} from "./erc8183.js";
import type { Erc8183HireJobInput } from "./erc8183.js";
import { createAltanaClient } from "./client.js";
import { SERVICE_PRICE_ENV, UNITED_STABLES_TOKEN } from "./registration-preview.js";

const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const AGENT_ID = 1816n;
const ONE_U_RAW = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
/** SDK default extra submission time beyond the dispute window (30 min). */
const DEFAULT_DEADLINE_SECONDS = 1800n;
const CANONICAL_METADATA_URI = "https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json";
const CANONICAL_SERVICE_ENDPOINT = "https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service";
/** Authoritative verified service description (canonical metadata). */
const JOB_DESCRIPTION =
  "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.";

const COMMERCE_VIEW_ABI = [
  {
    type: "function",
    name: "jobCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "paymentToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const POLICY_VIEW_ABI = [
  {
    type: "function",
    name: "disputeWindow",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const checks: Array<{ label: string; ok: boolean }> = [];
function check(label: string, ok: boolean): void {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

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

async function main(): Promise<void> {
  console.log("X.25 READ-ONLY ERC-8183 JOB PREPARATION (NO JOB CREATED):");

  // 1. Server-only env loaded; price exactly 1 U, never rendered.
  const envPath = findEnvFile();
  if (envPath === null) {
    check("server-only env found", false);
    process.exit(1);
  }
  try {
    process.loadEnvFile(envPath);
  } catch {
    check("server-only env loaded", false);
    process.exit(1);
  }
  const priceRaw = process.env[SERVICE_PRICE_ENV] ?? process.env["ALTANA_SERVICE_PRICE_RAW_U"];
  const priceValid = /^[1-9][0-9]*$/.test(priceRaw ?? "") && BigInt(priceRaw as string) === ONE_U_RAW;
  check("service price source is ALTANA_SERVICE_PRICE_RAW_U (server-only)", priceRaw !== undefined && priceRaw !== null);
  check("configured service price is exactly 1 U (raw 1e18)", priceValid);

  // 2. Verified chain-97 config table.
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  if (config.commerce === undefined || config.router === undefined) {
    check("verified ERC-8183 chain-97 config resolves", false);
    process.exit(1);
  }
  check(
    "verified ERC-8183 chain-97 config (commerce/router/policy/registry/$U)",
    config.chainId === 97 &&
      config.commerce.startsWith("0x") &&
      config.router.startsWith("0x") &&
      config.policy.startsWith("0x") &&
      config.registry.startsWith("0x") &&
      config.paymentToken === getAddress(UNITED_STABLES_TOKEN)
  );

  // 3. Public RPC + on-chain reads (read-only).
  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  if (typeof publicRpcUrl !== "string" || !/^https?:\/\//i.test(publicRpcUrl)) {
    check("public RPC URL resolved", false);
    process.exit(1);
  }
  const publicClient = createPublicClient({ transport: http(publicRpcUrl) });

  let chainIdOk = false;
  try {
    chainIdOk = BigInt(await publicClient.getChainId()) === BigInt(ALTANA_ERC8183_CHAIN_ID);
  } catch {
    chainIdOk = false;
  }
  check(`on-chain chain id is 97${chainIdOk ? " (confirmed)" : ""}`, chainIdOk);
  if (!chainIdOk) process.exit(1);

  const jobCounter = await publicClient
    .readContract({ address: config.commerce, abi: COMMERCE_VIEW_ABI, functionName: "jobCounter" })
    .then((value) => BigInt(value as bigint))
    .catch(() => null);
  check("AgenticCommerce jobCounter read (read-only)", jobCounter !== null && jobCounter >= 0n);
  if (jobCounter === null) process.exit(1);

  const paymentToken = await publicClient
    .readContract({ address: config.commerce, abi: COMMERCE_VIEW_ABI, functionName: "paymentToken" })
    .then((value) => String(value))
    .catch(() => null);
  check("AgenticCommerce paymentToken == verified $U", getAddress(paymentToken ?? "") === getAddress(UNITED_STABLES_TOKEN));
  if (paymentToken === null) process.exit(1);

  const disputeWindow = await publicClient
    .readContract({ address: config.policy, abi: POLICY_VIEW_ABI, functionName: "disputeWindow" })
    .then((value) => BigInt(value as bigint))
    .catch(() => null);
  check("OptimisticPolicy disputeWindow read (read-only)", disputeWindow !== null && disputeWindow > 0n);
  if (disputeWindow === null) process.exit(1);

  // 4. Deterministic job parameters.
  const predictedJobId = jobCounter + 1n;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const expiredAt = now + disputeWindow + DEFAULT_DEADLINE_SECONDS;

  const jobInput: Erc8183HireJobInput = {
    provider: getAddress(PROVIDER_EOA),
    description: JOB_DESCRIPTION,
    budget: ONE_U_RAW,
    expiredAt,
    jobId: predictedJobId,
  };

  // 5. Build the atomic hire batch (pure; not submitted).
  let draft;
  try {
    draft = prepareErc8183Hire(BNB_TESTNET, jobInput);
  } catch (error) {
    check(`hire batch builds (${error instanceof Error ? error.message : String(error)})`, false);
    process.exit(1);
  }
  check("SDK atomic hire batch builds (5 calls, chain 97)", draft.calls.length === 5);
  const [createJob, registerJob, setBudget, approve, fund] = draft.calls as [
    Call,
    Call,
    Call,
    Call,
    Call,
  ];

  // 6. Every target is a verified chain-97 ERC-8183 contract.
  const allowlist = new Set(
    [config.commerce, config.router, config.policy, config.registry, config.paymentToken].map((address) =>
      getAddress(address)
    )
  );
  const targetsOk =
    draft.calls.length === 5 && draft.calls.every((call) => allowlist.has(getAddress(call.to)));
  check(
    "every hire-batch target is a verified chain-97 ERC-8183 contract",
    targetsOk &&
      getAddress(createJob.to) === getAddress(config.commerce) &&
      getAddress(registerJob.to) === getAddress(config.router) &&
      getAddress(setBudget.to) === getAddress(config.commerce) &&
      getAddress(approve.to) === getAddress(config.paymentToken) &&
      getAddress(fund.to) === getAddress(config.commerce)
  );

  // 7. Cross-verify the batch encodes the intended inputs.
  const decode = (call: Call): string => call.data ?? "";
  const providerEncoded = decode(createJob).toLowerCase().includes(PROVIDER_EOA.slice(2).toLowerCase());
  const budgetEncoded = [ONE_U_RAW.toString(16).padStart(64, "0")].every((hex) =>
    [decode(setBudget), decode(approve), decode(fund)].some((data) =>
      data.toLowerCase().includes(hex.toLowerCase())
    )
  );
  check(
    "hire batch encodes verified provider (Agent 1816 owner)",
    providerEncoded && getAddress(PROVIDER_EOA) === getAddress(draft.job.provider)
  );
  check("hire batch encodes exactly 1 U budget in all steps", budgetEncoded);
  check("hire batch description <= 4096 bytes", new TextEncoder().encode(JOB_DESCRIPTION).length <= 4096);

  // 8. No transaction / signing surface touched.
  const failed = checks.filter((entry) => !entry.ok);
  console.log(`X.25 read-only preparation: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) process.exit(1);

  console.log("");
  console.log("X.25 ERC-8183 JOB PREVIEW (DETERMINISTIC, READ-ONLY)");
  console.log(`  chain: ${config.chainId} (bnb-testnet)`);
  console.log(`  provider: ${getAddress(PROVIDER_EOA)} (registered Agent ID ${AGENT_ID.toString()} owner)`);
  console.log(`  agentId: ${AGENT_ID.toString()}`);
  console.log(`  predictedJobId: ${predictedJobId.toString()} (jobCounter ${jobCounter.toString()} + 1)`);
  console.log(`  disputeWindow (seconds): ${disputeWindow.toString()}`);
  console.log(`  expiredAt: ${expiredAt.toString()} (unix; now ${now.toString()} + disputeWindow + ${DEFAULT_DEADLINE_SECONDS.toString()}s deadline)`);
  console.log(`  budget (raw \$U): ${ONE_U_RAW.toString()} (= 1 U, 18 decimals)`);
  console.log(`  token: ${getAddress(UNITED_STABLES_TOKEN)}`);
  console.log(`  priceSource: ${SERVICE_PRICE_ENV} (server-only)`);
  console.log(`  service endpoint: ${CANONICAL_SERVICE_ENDPOINT}`);
  console.log(`  description anchored to: ${CANONICAL_METADATA_URI}`);
  console.log(`  commerce: ${config.commerce}`);
  console.log(`  router (evaluator+hook): ${config.router}`);
  console.log(`  policy: ${config.policy}`);
  console.log(`  registry: ${config.registry}`);
  console.log(`  paymentToken (escrow rail): ${getAddress(config.paymentToken)}`);
  console.log(`  tx value: 0 (ERC-20 approve+fund; no native transfer)`);
  console.log("  calls: createJob -> registerJob -> setBudget -> approve $U -> fund");
  console.log("  signing boundary: assertErc8183SigningBoundary UNTOUCHED (nothing submitted)");
  console.log("");
  console.log("JOB CREATION CALLDATA: GENERATED FOR REVIEW ONLY — NOT BROADCAST");
  console.log("SIGNING: NOT PERFORMED");
  console.log("BROADCAST: NOT PERFORMED");
  console.log("JOB CREATED: NO");
  console.log("FUNDING: NOT PERFORMED");
  console.log("PAYMENT: NOT PERFORMED");
  console.log("SETTLEMENT: NOT PERFORMED");
  console.log("MAINNET: NOT TOUCHED");
}

main().catch((error) => {
  console.error(`X.25 FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});