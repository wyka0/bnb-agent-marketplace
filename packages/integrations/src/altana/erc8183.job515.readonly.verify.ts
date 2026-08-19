/**
 * READ-ONLY verification of ERC-8183 job 515 on BNB testnet (chain 97).
 * No signing, no broadcast, no env secrets read.
 *
 * Purpose: confirm what the X.26 createJob call actually persisted on-chain
 * after the broadcast script halted at its post-create "ours" check.
 */

import { createPublicClient, getAddress, http } from "viem";
import { BNB_TESTNET, getErc8183Job } from "@altananetwork/sdk";
import { ALTANA_ERC8183_CHAIN_ID, resolveErc8183Config } from "./erc8183.js";
import { createAltanaClient } from "./client.js";

const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const JOB_ID = 515n;
const ONE_U_RAW = 1_000_000_000_000_000_000n;

async function main(): Promise<void> {
  console.log("READ-ONLY JOB 515 VERIFICATION (chain 97, no broadcast):");

  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  console.log(`commerce: ${config.commerce}`);
  console.log(`router:   ${config.router}`);
  console.log(`policy:   ${config.policy}`);
  console.log(`registry: ${config.registry}`);
  console.log(`token:    ${config.paymentToken}`);

  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  if (typeof publicRpcUrl !== "string" || !/^https?:\/\//i.test(publicRpcUrl)) {
    console.log("FAIL public RPC URL resolved");
    process.exit(1);
  }
  const publicClient = createPublicClient({ transport: http(publicRpcUrl) });

  const liveChainId = BigInt(await publicClient.getChainId());
  console.log(`chainId: ${liveChainId.toString()}`);
  if (liveChainId !== 97n) {
    console.log("FAIL chain is not 97 — STOP.");
    process.exit(1);
  }

  const job = await getErc8183Job(BNB_TESTNET, JOB_ID);
  console.log("");
  console.log(`jobId:        ${job.id.toString()}`);
  console.log(`status:       ${job.statusName} (code ${job.status.toString()})`);
  console.log(`client:       ${job.client}`);
  console.log(`provider:     ${job.provider}`);
  console.log(`evaluator:    ${job.evaluator}`);
  console.log(`description:  ${job.description}`);
  console.log(`budget:       ${job.budget.toString()} raw`);
  console.log(`expiredAt:    ${job.expiredAt.toString()}`);
  console.log(`hook:         ${job.hook}`);
  console.log(`submittedAt:  ${job.submittedAt.toString()}`);
  console.log(`deliverable:  ${job.deliverable}`);
  console.log("");

  const clientOk =
    job.client !== undefined &&
    getAddress(String(job.client)) === getAddress(PROVIDER_EOA);
  const providerOk =
    job.provider !== undefined &&
    getAddress(String(job.provider)) === getAddress(PROVIDER_EOA);
  const budgetOk = job.budget !== undefined && BigInt(job.budget) === ONE_U_RAW;
  const statusOpen = job.statusName === "OPEN";
  const unsigned = job.submittedAt === 0n;

  console.log(`client == provider EOA (ours):     ${clientOk ? "PASS" : "FAIL"}`);
  console.log(`provider == provider EOA:           ${providerOk ? "PASS" : "FAIL"}`);
  console.log(`budget == 1 U raw 1e18:             ${budgetOk ? "PASS" : "FAIL (NOTE: budget is set by setBudget, not createJob)"}`);
  console.log(`status OPEN:                        ${statusOpen ? "PASS" : "FAIL"}`);
  console.log(`submittedAt == 0 (never submitted): ${unsigned ? "PASS" : "FAIL"}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`READ-ONLY CHECK FAILED: ${redacted}`);
  process.exit(1);
});