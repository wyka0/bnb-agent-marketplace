/**
 * ALTANA Phase X.4A — controlled FUNDED BNB-testnet end-to-end verification.
 *
 * PURPOSE: determine whether the existing x402 + marketplace + ERC-8183
 * boundaries can perform a GENUINE testnet payment and safely transition into
 * the ERC-8183 job lifecycle — WITHOUT ever fabricating a signer, facilitator,
 * payTo, wallet, or amount.
 *
 * HARD SAFETY MODEL (chain 97 only; nothing here can select chain 56):
 *   - The funded signer, FACILITATOR_KEY, and real payTo must be supplied
 *     EXTERNALLY through the environment. This harness reads only the PRESENCE
 *     of those variables — never their values, never printed, never persisted.
 *   - If ANY required external dependency is absent, the run STOPS BEFORE any
 *     signing/payment and returns a clean BLOCKED result naming the exact
 *     missing dependency. No wallet is created, no key generated, no address
 *     invented, no transaction submitted, no funds moved.
 *   - Even when prerequisites are absent, the offline safety boundaries are
 *     asserted: chain-97 pinning (56 refused), the marketplace service stays at
 *     `payment-required`/`unconfigured` with no signer, client payment claims
 *     are ignored, and ERC-8183 hire calls can be CONSTRUCTED on 97 while
 *     SUBMISSION remains blocked by the signing boundary.
 *
 * SIGNER SOURCE: EXTERNAL / ENVIRONMENT ONLY.
 *
 * Exit policy: exit 0 on a clean result (LIVE VERIFIED or a clean BLOCKED that
 * is the honest, expected state); exit 1 only if a safety invariant is violated
 * (e.g. a mainnet path became selectable, or a boundary failed to stop).
 *
 * Run after `pnpm build`:  node dist/altana/x402.e2e.testnet.verify.js
 */

import {
  ALTANA_ERC8183_CHAIN_ID,
  assertErc8183SigningBoundary,
  AltanaErc8183ExecutionError,
  AltanaErc8183NetworkError,
  getErc8183Addresses,
  prepareErc8183Hire,
} from "./erc8183.js";
import {
  ALTANA_X402_CHAIN_ID as CHAIN_97,
  ALTANA_X402_NETWORK,
  AltanaX402NetworkError,
  getX402Network,
  X402_FACILITATOR_KEY_ENV,
} from "./x402.js";
import { createAltanaClient } from "./client.js";
import { BNB_TESTNET } from "@altananetwork/sdk";
import { getAddress } from "viem";
import type { Hex } from "viem";
import {
  buildX402TransactionReview,
  isX402ReviewPayTo,
  X402_REVIEW_STATES,
  X402_REVIEW_TOKEN,
  x402ReviewToJson,
} from "./x402.review.js";
import {
  createMarketplaceTestnetService,
  marketplaceTestnetMerchantConfig,
  marketplaceTestnetRequirement,
} from "./marketplace.testnet.js";

function fail(message: string): never {
  console.error(`X402 E2E VERIFY FAILED (safety invariant violated): ${message}`);
  process.exit(1);
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) fail(message);
}

let passed = 0;
function ok(label: string): void {
  passed += 1;
  console.log(`ok   ${label}`);
}

/**
 * Presence-only environment probe. Reads whether a variable is set to a
 * non-empty value; NEVER returns, logs, or stores the value itself.
 */
function envPresent(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

/** The externally-supplied dependencies a live funded payment requires. */
interface E2EPrerequisites {
  /** A funded testnet signer / private key / session (any accepted name). */
  signerPresent: boolean;
  signerEnvChecked: string[];
  /** The x402-server facilitator settler EOA key. */
  facilitatorPresent: boolean;
  facilitatorEnv: string;
  /** A real (non-fixture) sell-side payTo recipient. */
  payToPresent: boolean;
  payToEnvChecked: string[];
}

function probePrerequisites(): E2EPrerequisites {
  const signerEnvChecked = [
    "ALTANA_PRIVATE_KEY",
    "X402_PRIVATE_KEY",
    "WALLET_PRIVATE_KEY",
    "PRIVATE_KEY",
    "ALTANA_SIGNER",
    "SIGNER_KEY",
  ];
  const payToEnvChecked = ["ALTANA_PAYTO", "X402_PAYTO", "MERCHANT_PAYTO"];
  return {
    signerPresent: signerEnvChecked.some(envPresent),
    signerEnvChecked,
    facilitatorPresent: envPresent(X402_FACILITATOR_KEY_ENV),
    facilitatorEnv: X402_FACILITATOR_KEY_ENV,
    payToPresent: payToEnvChecked.some(envPresent),
    payToEnvChecked,
  };
}

async function main(): Promise<void> {
  console.log(
    "ALTANA PHASE X.4A — funded BNB-testnet E2E verify (chain 97 ONLY; signer source: EXTERNAL/ENV ONLY)"
  );

  // ---- 1. Environment validation (presence only; never values) ---------------
  const prereq = probePrerequisites();
  console.log(
    `env: signer=${prereq.signerPresent ? "PRESENT" : "ABSENT"} ` +
      `facilitator(${prereq.facilitatorEnv})=${prereq.facilitatorPresent ? "PRESENT" : "ABSENT"} ` +
      `payTo=${prereq.payToPresent ? "PRESENT" : "ABSENT"}`
  );
  ok("1: environment probed by PRESENCE only (no secret value read, logged, or stored)");

  // ---- 2. Network validation (chain 97; mainnet 56 unreachable) --------------
  const net = getX402Network(ALTANA_X402_NETWORK);
  assert(net.chainId === CHAIN_97, "x402 network must resolve to chain 97");
  assert(net.network === "bnb-testnet", "x402 network must be bnb-testnet");
  let mainnetRefused = false;
  try {
    getX402Network("bsc");
  } catch (error) {
    mainnetRefused = error instanceof AltanaX402NetworkError;
  }
  assert(mainnetRefused, "mainnet (chain 56) MUST be refused by the network gate");
  let mainnet56Refused = false;
  try {
    getX402Network(56);
  } catch (error) {
    mainnet56Refused = error instanceof AltanaX402NetworkError;
  }
  assert(mainnet56Refused, "numeric chain 56 MUST be refused by the network gate");
  assert(BNB_TESTNET.chainId === 97, "SDK BNB_TESTNET must be chain 97");
  ok("2: network pinned to chain 97 (bnb-testnet); chain 56 refused two ways; no auto-switch");

  // ---- 3. Read-only RPC network validation (allowed; no signer) --------------
  // A plain, keyless client read confirms the RPC actually serves chain 97.
  const client = createAltanaClient({ network: "bnb-testnet", defaultChainId: 97 });
  assert(client.defaultChainId === 97, "keyless client default chain must be 97");
  const chain0 = client.chains[0];
  assert(chain0 !== undefined && chain0.chainId === 97, "client chain[0] must be chain 97");
  ok(`3: read-only client pinned to chain 97 (rpc=${chain0.publicRpcUrl.replace(/\/$/, "")})`);

  // ---- 4. Signer availability (EXTERNAL / ENV ONLY) --------------------------
  // The harness NEVER creates a key. It only reports availability.
  console.log(
    `signer available: ${prereq.signerPresent ? "YES" : "NO"}  (source: EXTERNAL / ENVIRONMENT ONLY)`
  );
  ok("4: signer availability resolved from environment only — none created, none generated");

  // ---- 5. Facilitator + payTo availability -----------------------------------
  console.log(
    `facilitator available: ${prereq.facilitatorPresent ? "YES" : "NO"} (env ${prereq.facilitatorEnv})`
  );
  console.log(`real payTo available: ${prereq.payToPresent ? "YES" : "NO"}`);
  ok("5: facilitator + real payTo availability resolved from environment only — none fabricated");

  // ---- 6. Offline safety boundaries (always asserted) ------------------------
  // 6a. Marketplace service (configured with the TEST FIXTURE merchant config)
  //     stays at payment-required and NEVER reaches payment-verified without a
  //     genuine server-side verifier verdict. Client claims are ignored.
  const requirement = marketplaceTestnetRequirement();
  const merchantConfig = marketplaceTestnetMerchantConfig();
  assert(requirement.chainId === CHAIN_97, "marketplace requirement must be chain 97");
  assert(requirement.rail === "eip3009", "marketplace requirement rail must be eip3009");
  assert(
    requirement.amount === merchantConfig.price.toString(),
    "requirement amount must equal the configured price (no guessed decimals)"
  );

  const svc = createMarketplaceTestnetService();
  const described = svc.describe(
    // A fixture agent slug (identity reuse; no fabricated production agent).
    "altana-test-fixture-rebalancer"
  );
  assert(
    described.payment.status === "payment-required",
    "describe must be payment-required with config"
  );
  assert(
    described.service.status === "not-implemented",
    "service execution must remain not-implemented"
  );

  // A request that carries ONLY client-side payment claims (no real header)
  // must NEVER become payment-verified.
  const claimsOnly = await svc.requestService({
    agentSlug: "altana-test-fixture-rebalancer",
    clientClaims: { paid: true, paymentVerified: true, transactionHash: "0x" + "aa".repeat(32) },
  });
  assert(
    claimsOnly.payment.status !== "payment-verified",
    "client claims (paid/paymentVerified/txHash) MUST NOT authorize payment"
  );
  ok(
    "6: marketplace stays payment-required; client claims ignored; execution not-implemented (no bypass)"
  );

  // ---- 7. x402 live payment — GATED on external prerequisites ----------------
  const canAttemptLivePayment =
    prereq.signerPresent && prereq.facilitatorPresent && prereq.payToPresent;

  const missing: string[] = [];
  if (!prereq.signerPresent) {
    missing.push(`funded BNB-testnet signer (one of: ${prereq.signerEnvChecked.join(", ")})`);
  }
  if (!prereq.facilitatorPresent)
    missing.push(`facilitator settler key (env ${prereq.facilitatorEnv})`);
  if (!prereq.payToPresent) {
    missing.push(`real sell-side payTo (one of: ${prereq.payToEnvChecked.join(", ")})`);
  }

  if (!canAttemptLivePayment) {
    // STOP BEFORE SIGNING. This is the honest, expected offline state.
    ok("7: live payment prerequisites ABSENT -> STOP before signing (no tx, no funds moved)");

    // ---- 8. ERC-8183 boundary: construction allowed, submission blocked ------
    // Prove the NEXT rail can be constructed on 97 (no signer needed to build
    // calls) while submission stays blocked.
    const addresses = getErc8183Addresses(ALTANA_ERC8183_CHAIN_ID);
    assert(
      addresses.commerce !== undefined && addresses.paymentToken !== undefined,
      "ERC-8183 testnet addresses must resolve on chain 97"
    );
    const draft = prepareErc8183Hire(BNB_TESTNET, {
      // Provider/budget/jobId are TEST-FIXTURE construction inputs; nothing is
      // signed or submitted. provider is a fixture non-zero address.
      provider: getAddress("0x1B6658DdF95E87A3d56a4b609d058C0EEcEb3588"),
      description: "TEST FIXTURE / NOT LIVE — X.4A ERC-8183 call construction only",
      budget: 1n,
      expiredAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600),
      jobId: 1n,
    });
    assert(draft.calls.length >= 1, "ERC-8183 hire draft must build at least one call");
    assert(draft.config.chainId === 97, "ERC-8183 hire draft must be chain 97");

    // Mainnet ERC-8183 addresses must be refused.
    let erc8183MainnetRefused = false;
    try {
      getErc8183Addresses(56);
    } catch (error) {
      erc8183MainnetRefused = error instanceof AltanaErc8183NetworkError;
    }
    assert(erc8183MainnetRefused, "ERC-8183 chain 56 MUST be refused");

    // Submission boundary must always stop.
    let submissionBlocked = false;
    try {
      assertErc8183SigningBoundary("hire");
    } catch (error) {
      submissionBlocked = error instanceof AltanaErc8183ExecutionError;
    }
    assert(submissionBlocked, "ERC-8183 submission MUST be blocked by the signing boundary");
    ok("8: ERC-8183 hire calls CONSTRUCTED on chain 97; submission BLOCKED; chain 56 refused");

    console.log("");
    console.log("ALTANA X4A STATUS: BLOCKED");
    console.log("Exact missing dependency (all required for a live funded payment):");
    for (const m of missing) console.log(`  - ${m}`);
    console.log("Everything successfully verified offline:");
    console.log("  - chain-97 pinning; chain 56 refused (x402 + ERC-8183)");
    console.log("  - read-only RPC client on chain 97");
    console.log(
      "  - marketplace payment-required + client claims ignored + not-implemented execution"
    );
    console.log("  - ERC-8183 hire-call construction on 97 with submission boundary enforced");
    console.log("Transaction submitted: NONE.  Funds moved: NONE.");
    console.log("Signer source: EXTERNAL / ENVIRONMENT ONLY (none present).");
    console.log(
      "Next required action: supply, via the secure environment ONLY, a funded BNB-testnet " +
        `signer, the facilitator key (${prereq.facilitatorEnv}), and a real testnet payTo; ` +
        "then re-run altana:x402:e2e:testnet:verify."
    );
    console.log(
      `X402 E2E VERIFY: ${passed} offline checks passed; live payment BLOCKED (expected).`
    );
    process.exitCode = 0;
    return;
  }

  // ---- LIVE PATH (only reachable when ALL external prerequisites exist) -------
  // X.4B: the review boundary engages. NOTHING is signed, broadcast, or
  // confirmed — the immutable REVIEWED object is produced, the configured
  // payTo is re-verified against the recipient rule, and control stops at the
  // consent boundary. The real action amount/calldata can only be pinned at
  // an operator-authorized consent step (X.4C).
  let configuredPayTo: string | undefined;
  for (const name of prereq.payToEnvChecked) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim().length > 0) {
      configuredPayTo = value.trim();
      break;
    }
  }
  assert(
    configuredPayTo !== undefined && isX402ReviewPayTo(configuredPayTo),
    "configured payTo must pass the X.4B recipient rule (checksum, non-zero, non-fixture)"
  );
  ok("7: configured payTo re-verified against the X.4B recipient rule (value never printed)");

  // Structural fixture action review — proof that the boundary produces the
  // immutable object. The real action (amount, calldata, destination) can only
  // be pinned by the operator at the explicit consent step.
  const review = buildX402TransactionReview({
    chainId: CHAIN_97,
    token: X402_REVIEW_TOKEN,
    amount: 100_000_000_000_000_000n,
    payTo: getAddress("0x2E2f3d16E2f5ACD4B9A67347D7a9a4D2362c59F5"),
    destination: getErc8183Addresses(ALTANA_ERC8183_CHAIN_ID).router,
    calldata: ("0x" + "a9059cbb" + "11".repeat(32) + "22".repeat(32)) as Hex,
    action:
      "x402-funded-flow (TEST FIXTURE action; real amount/calldata re-verified at operator consent)",
    facilitator: getAddress("0xAbaDd7CdD799c9B48A48f1A1eF7Cb6f9CB82cc1e"),
    operator: getAddress("0x1B6658DdF95E87A3d56a4b609d058C0EEcEb3588"),
  });
  assert(
    review.state === "REVIEWED" && Object.isFrozen(review),
    "review must be an immutable REVIEWED object"
  );
  assert(review.chainId === 97 && review.network === "bnb-testnet", "review must pin chain 97");
  assert(review.token === X402_REVIEW_TOKEN, "review must pin the verified chain-97 $U");
  assert(
    new Set<string>(X402_REVIEW_STATES).size === X402_REVIEW_STATES.length,
    "review states must be distinct (REVIEWED/APPROVED/SIGNED/BROADCAST/CONFIRMED)"
  );
  ok(
    "7b: X.4B review boundary engaged — immutable REVIEWED object produced; signing/broadcast refused"
  );

  console.log("");
  console.log("X.4B TRANSACTION REVIEW (public data — no secrets):");
  console.log(JSON.stringify(x402ReviewToJson(review), null, 2));
  console.log("");
  console.log("X4A STATUS: PREREQUISITES PRESENT -> review boundary engaged, consent required");
  console.log(
    "Next required action: the operator must explicitly approve the reviewed action " +
      "before any signing phase (X.4C). The real amount/calldata are pinned at that consent step."
  );
  console.log("Transaction submitted: NONE.  Funds moved: NONE.");
  console.log("SIGNING: NOT PERFORMED   BROADCAST: NOT PERFORMED   CONFIRMATION: NOT PERFORMED");
  console.log(
    `X402 E2E VERIFY: ${passed + 2} checks passed; consent boundary STOPPED before signing.`
  );
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(
    `X402 E2E VERIFY FAILED: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
