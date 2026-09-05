/**
 * ALTANA Phase 3A — ERC-8183 integration verification + BNB testnet lifecycle
 * harness.
 *
 * Safe by construction (mirrors Phase 2): NO signing, NO transaction
 * submission, NO session, NO wallet funding, NO private keys, NO mainnet
 * (chain 56) writes. Every ERC-8183 execution path funnels through
 * `assertErc8183SigningBoundary` and MUST stop.
 *
 * Sections:
 *   1. Testnet-only address resolution (chain 97 accepted; 56/unknown rejected).
 *   2. Client NetworkConfig extraction for ERC-8183 (97 ok, 56 rejected).
 *   3. Hire input validation (pure, offline).
 *   4. Hire call construction — the SDK's atomic 5-call batch (pure).
 *   5. Deliverable manifest parsing (pure).
 *   6. Settlement/dispute action derivation (pure).
 *   7. ClaimRefund call construction (testnet-gated).
 *   8. Signing boundary — every submit path must stop.
 *   9. BNB testnet job lifecycle read (best-effort): reads job 1 through the
 *      kernel; "no jobs yet" is informational (expected until a funded hire
 *      exists), an unreachable RPC downgrades to SKIPPED (network read).
 *
 * Exit policy:
 *   - 1  any offline assertion or construction fails (the integration gate).
 *   - 0  otherwise; a missing/unreliable testnet RPC only downgrades the
 *        network read to SKIP/INFO.
 *
 * Run after `pnpm build`:  node dist/altana/erc8183.verify.js
 */

import { BNB, BNB_TESTNET, ERC8183_ADDRESSES } from "@altananetwork/sdk";
import type { Call, Erc8183Job } from "@altananetwork/sdk";
import type { Address } from "viem";
import { createAltanaClient } from "./client.js";
import {
  ALTANA_ERC8183_CHAIN_ID,
  ALTANA_ERC8183_NETWORK,
  ERC8183_EXECUTION_REQUIRES_SIGNER,
  AltanaErc8183Error,
  AltanaErc8183ExecutionError,
  AltanaErc8183JobNotFoundError,
  AltanaErc8183JobParamError,
  AltanaErc8183JobStateError,
  AltanaErc8183NetworkError,
  assertErc8183SigningBoundary,
  buildErc8183ClaimRefundCall,
  erc8183NetworkFromClient,
  getErc8183Addresses,
  getErc8183Deliverable,
  getErc8183Job,
  getErc8183SettlementStatus,
  parseErc8183Deliverable,
  prepareErc8183Hire,
  resolveErc8183Config,
  validateErc8183HireInput,
} from "./erc8183.js";
import type { Erc8183HireJobInput } from "./erc8183.js";

function fail(message: string): never {
  console.error(`ERC8183 VERIFY FAILED: ${message}`);
  process.exit(1);
}

function expectThrows<T>(
  label: string,
  fn: () => T,
  ctor: new (message: string) => AltanaErc8183Error
): void {
  try {
    fn();
    fail(`${label}: expected ${ctor.name} to be thrown`);
  } catch (error) {
    if (error instanceof ctor) {
      console.log(`ok   ${label} -> ${ctor.name}`);
      return;
    }
    fail(`${label}: expected ${ctor.name}, got ${String(error)}`);
  }
}

function expectCall(label: string, call: Call, expectedTo: string): void {
  if (call.to !== expectedTo || call.data === undefined || call.data.length < 10) {
    fail(`${label}: expected a non-empty call to ${expectedTo}`);
  }
}

/** TEST FIXTURE / NOT LIVE DATA — synthetic ERC-8183 job (never on-chain). */
function jobFixture(overrides: Partial<Erc8183Job> = {}): Erc8183Job {
  const soon = BigInt(Math.floor(Date.now() / 1000));
  return {
    id: 1n,
    client: "0xAe0E5E6E5e8e7e67656565676767676767676767",
    provider: "0x9BeB61C2a40d3E8Bf0fE0e98ECf9a8C6E4a76543",
    evaluator: "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25",
    description: "TEST FIXTURE — build a landing page",
    budget: 1_000_000n,
    expiredAt: soon + 10_000n,
    status: 4,
    statusName: "COMPLETED",
    hook: "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25",
    submittedAt: soon - 10_000n,
    deliverable: "0x0000000000000000000000000000000000000000000000000000000000000000",
    ...overrides,
  };
}

async function main(): Promise<void> {
  console.log("ALTANA PHASE 3A — ERC-8183 verify + BNB testnet lifecycle (testnet, no tx)");

  // 1. Testnet-only address resolution.
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  if (config.chainId !== 97) fail("resolved ERC-8183 config must be chain 97");
  const expected = ERC8183_ADDRESSES[97];
  if (expected === undefined) fail("SDK has no ERC-8183 table for chain 97");
  if (
    config.commerce !== expected.commerce ||
    config.router !== expected.router ||
    config.policy !== expected.policy ||
    config.registry !== expected.registry ||
    config.paymentToken !== expected.paymentToken
  ) {
    fail("resolved config must equal the SDK's ERC-8183 chain-97 table");
  }
  if (config.commerce !== "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE") {
    fail("commerce address does not match the SDK deployment table");
  }
  if (config.router !== "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25") {
    fail("router address does not match the SDK deployment table");
  }
  if (config.policy !== "0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6") {
    fail("policy address does not match the SDK deployment table");
  }
  if (config.registry !== "0x8004A818BFB912233c491871b3d84c89A494BD9e") {
    fail("registry address does not match the SDK deployment table");
  }
  if (config.paymentToken !== "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565") {
    fail("paymentToken address does not match the SDK deployment table");
  }
  if (getErc8183Addresses(97) !== (config.addresses as unknown)) {
    fail("getErc8183Addresses(97) must resolve the same table");
  }
  console.log("ok   chain 97 resolves commerce/router/policy/registry/paymentToken from SDK table");

  expectThrows(
    "getErc8183Addresses rejects chain 56 (mainnet)",
    () => getErc8183Addresses(56),
    AltanaErc8183NetworkError
  );
  expectThrows(
    "resolveErc8183Config rejects chain 56 (mainnet)",
    () => resolveErc8183Config(56),
    AltanaErc8183NetworkError
  );
  expectThrows(
    "getErc8183Addresses rejects unknown chain 999",
    () => getErc8183Addresses(999),
    AltanaErc8183NetworkError
  );

  // 2. Client NetworkConfig extraction for ERC-8183.
  const client = createAltanaClient({ network: "bnb-testnet" });
  const snapshot = erc8183NetworkFromClient(client);
  if (snapshot.network !== ALTANA_ERC8183_NETWORK || snapshot.chainId !== 97) {
    fail("client snapshot must report bnb-testnet / 97");
  }
  console.log(`ok   client -> network=bnb-testnet chainId=97 keystore=${snapshot.keyStore}`);

  const mainnetClient = createAltanaClient({ network: "bnb" });
  expectThrows(
    "erc8183NetworkFromClient rejects a chain-56 client",
    () => erc8183NetworkFromClient(mainnetClient),
    AltanaErc8183NetworkError
  );

  // 3. Hire input validation (pure, offline).
  const future = BigInt(Math.floor(Date.now() / 1000) + 3 * 3600);
  const validInput: Erc8183HireJobInput = {
    provider: "0x9beb61c2a40d3e8bf0fe0e98ecf9a8c6e4a76543",
    description: "TEST FIXTURE — draft a landing page and ship the deliverable URL",
    budget: 1_000_000n,
    expiredAt: future,
    jobId: 7n,
  };
  validateErc8183HireInput(validInput);
  console.log("ok   valid hire input passes validation");

  expectThrows(
    "hire input rejects zero provider",
    () =>
      validateErc8183HireInput({
        ...validInput,
        provider: "0x0000000000000000000000000000000000000000",
      }),
    AltanaErc8183JobParamError
  );
  expectThrows(
    "hire input rejects malformed provider",
    () => validateErc8183HireInput({ ...validInput, provider: "not-an-address" as Address }),
    AltanaErc8183JobParamError
  );
  expectThrows(
    "hire input rejects empty description",
    () => validateErc8183HireInput({ ...validInput, description: "" }),
    AltanaErc8183JobParamError
  );
  expectThrows(
    "hire input rejects description over 4096 bytes",
    () =>
      validateErc8183HireInput({
        ...validInput,
        description: "x".repeat(4097),
      }),
    AltanaErc8183JobParamError
  );
  expectThrows(
    "hire input rejects non-positive budget",
    () => validateErc8183HireInput({ ...validInput, budget: 0n }),
    AltanaErc8183JobParamError
  );
  expectThrows(
    "hire input rejects past expiredAt",
    () =>
      validateErc8183HireInput({
        ...validInput,
        expiredAt: BigInt(Math.floor(Date.now() / 1000) - 60),
      }),
    AltanaErc8183JobParamError
  );
  expectThrows(
    "hire input rejects non-positive predicted jobId",
    () => validateErc8183HireInput({ ...validInput, jobId: 0n }),
    AltanaErc8183JobParamError
  );

  // 4. Hire call construction — the SDK's atomic 5-call batch (pure).
  const draft = prepareErc8183Hire(BNB_TESTNET, validInput);
  if (draft.network.chainId !== 97) fail("hire draft must target chain 97");
  if (draft.config.commerce !== expected.commerce) fail("hire draft misloaded the address table");
  if (draft.calls.length !== 5) {
    fail(`expected the SDK atomic 5-call hire batch, got ${draft.calls.length}`);
  }
  const createJob = draft.calls[0];
  const registerJob = draft.calls[1];
  const setBudget = draft.calls[2];
  const approve = draft.calls[3];
  const fund = draft.calls[4];
  if (
    createJob === undefined ||
    registerJob === undefined ||
    setBudget === undefined ||
    approve === undefined ||
    fund === undefined
  ) {
    fail("hire batch is missing a call");
  }
  expectCall("call 1 createJob", createJob, config.commerce);
  expectCall("call 2 registerJob", registerJob, config.router);
  expectCall("call 3 setBudget", setBudget, config.commerce);
  expectCall("call 4 approve $U", approve, config.paymentToken);
  expectCall("call 5 fund", fund, config.commerce);
  console.log(
    "ok   hire draft = 5-call atomic batch (createJob/registerJob/setBudget/approve/fund), chain 97"
  );

  expectThrows(
    "prepareErc8183Hire rejects a mainnet (chain 56) NetworkConfig",
    () => prepareErc8183Hire(BNB, validInput),
    AltanaErc8183NetworkError
  );
  expectThrows(
    "prepareErc8183Hire propagates job-param validation",
    () => prepareErc8183Hire(BNB_TESTNET, { ...validInput, budget: -1n }),
    AltanaErc8183JobParamError
  );

  // 5. Deliverable manifest parsing (pure, untrusted input).
  const okDeliverable = parseErc8183Deliverable('{"deliverable_url":"https://ipfs.io/QmX"}');
  if (!okDeliverable.ok || okDeliverable.url !== "https://ipfs.io/QmX") {
    fail("valid deliverable manifest must parse to its URL");
  }
  const emptyJson = parseErc8183Deliverable("{ }");
  if (emptyJson.ok || emptyJson.kind !== "missing-field")
    fail("empty manifest must be missing-field");
  const noField = parseErc8183Deliverable('{"other": 1}');
  if (noField.ok || noField.kind !== "missing-field")
    fail("manifest without deliverable_url must be missing-field");
  const ftp = parseErc8183Deliverable('{"deliverable_url":"ftp://x"}');
  if (ftp.ok || ftp.kind !== "not-http-url") fail("non-http(s) URL must be rejected");
  const garbage = parseErc8183Deliverable("not-json###");
  if (garbage.ok || garbage.kind !== "malformed-json")
    fail("garbage manifest must be malformed-json");
  const trailingNulls = parseErc8183Deliverable('{"deliverable_url":"https://x.dev"}\0\0\0');
  if (!trailingNulls.ok || trailingNulls.url !== "https://x.dev")
    fail("trailing NUL padding must be tolerated");
  console.log("ok   deliverable parse accepts http(s) URL, rejects garbage/missing/non-http");

  // 6. Settlement/dispute action derivation (pure).
  const approveReady = getErc8183SettlementStatus(jobFixture());
  if (approveReady.action !== "approve" || !approveReady.available) {
    fail("COMPLETED + elapsed window must allow approve");
  }
  const insideWindow = getErc8183SettlementStatus(
    jobFixture({ submittedAt: BigInt(Math.floor(Date.now() / 1000)) + 500n })
  );
  if (insideWindow.action !== "approve" || insideWindow.available) {
    fail("COMPLETED + inside window must NOT be approvable yet");
  }
  const dispute = getErc8183SettlementStatus(jobFixture({ status: 3, statusName: "SUBMITTED" }));
  if (dispute.action !== "dispute" || !dispute.available) {
    fail("SUBMITTED must allow dispute inside the optimistic window");
  }
  const open = getErc8183SettlementStatus(jobFixture({ status: 0, statusName: "OPEN" }));
  if (open.action !== "none" || open.available) fail("OPEN must expose no settlement action");
  expectThrows(
    "settlement derivation rejects unknown status",
    () =>
      getErc8183SettlementStatus(
        jobFixture({ status: 42, statusName: "WEIRD" as Erc8183Job["statusName"] })
      ),
    AltanaErc8183JobStateError
  );
  console.log("ok   settlement: COMPLETED->approve, SUBMITTED->dispute, OPEN->none");

  // 7. ClaimRefund call construction (testnet-gated).
  const refund = buildErc8183ClaimRefundCall(97, 7n);
  expectCall("claimRefund call", refund, config.commerce);
  expectThrows(
    "buildErc8183ClaimRefundCall rejects chain 56",
    () => buildErc8183ClaimRefundCall(56, 7n),
    AltanaErc8183NetworkError
  );
  expectThrows(
    "buildErc8183ClaimRefundCall rejects non-positive jobId",
    () => buildErc8183ClaimRefundCall(97, 0n),
    AltanaErc8183JobParamError
  );
  console.log("ok   claimRefund call builds on chain 97; chain 56 rejected");

  // 8. Signing boundary — every submit path must stop, never submit.
  for (const op of ["hire", "settle", "dispute", "claim-refund"] as const) {
    expectThrows(
      `signing boundary stops "${op}" submission`,
      () => assertErc8183SigningBoundary(op),
      AltanaErc8183ExecutionError
    );
  }
  try {
    assertErc8183SigningBoundary("hire");
  } catch (error) {
    if (!(error instanceof AltanaErc8183ExecutionError)) fail("boundary must throw ExecutionError");
    if (!error.message.startsWith(ERC8183_EXECUTION_REQUIRES_SIGNER)) {
      fail("boundary message must carry the required stop message");
    }
  }
  console.log(
    `ok   signing boundary enforced for every submit operation ("${ERC8183_EXECUTION_REQUIRES_SIGNER}")`
  );

  // 9. BNB testnet job lifecycle read (best-effort; no write is possible).
  try {
    const job = await getErc8183Job(BNB_TESTNET, 1n);
    if (job.id !== 1n)
      throw new AltanaErc8183JobNotFoundError("kernel returned a different job id");
    console.log(
      `ok   testnet kernel read job 1: status=${job.statusName} client=${job.client} budget=${job.budget.toString()}`
    );
    const settlement = getErc8183SettlementStatus(job);
    const deliverable = await getErc8183Deliverable(BNB_TESTNET, 1n);
    console.log(
      `ok   testnet job lifecycle: settlement=${settlement.action}(${settlement.reason}) deliverable=${deliverable.ok ? deliverable.url : deliverable.kind}`
    );
  } catch (error) {
    if (error instanceof AltanaErc8183ExecutionError) {
      console.warn(
        `SKIP testnet job read unreachable (${error.message}). ` +
          "All offline construction/validation is verified; this is a network read, not a failure."
      );
    } else if (error instanceof AltanaErc8183JobNotFoundError) {
      console.log(
        "INFO testnet kernel has no job 1 yet (expected until a funded hire exists). " +
          "Read path, shape validation and settlement derivation are proven offline."
      );
    } else {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  console.log("ALTANA ERC8183 STATUS: READY FOR IMPLEMENTATION (testnet-only, no tx submitted)");
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(`ERC8183 VERIFY FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
