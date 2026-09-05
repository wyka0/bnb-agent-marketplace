/**
 * ALTANA Phase X.3 — marketplace service integration verification.
 *
 * Proves the marketplace service abstraction (server-side, headless):
 *
 *   1. Agent identity — typed not-found for unknown slugs; existing identity
 *      fields (slug/name/category/chains/partner/updatedAt) are reused, never
 *      fabricated.
 *   2. Configuration-blocked state — a service with no sell-side payment
 *      config answers `unconfigured`, never a substituted requirement.
 *   3. Payment requirement generation — derived ONLY from the configured/
 *      verified x402 merchant config (chain 97, eip3009/$U, fixture payTo,
 *      price, resource).
 *   4. Invalid payment rejected — forged/undecodable X-PAYMENT never maps to
 *      payment-verified.
 *   5. Verified payment accepted — the state machine accepts a real server-side
 *      verification verdict (TEST-FIXTURE verified receipt) and reports
 *      payment-verified; the underlying keyless x402 gate re-verifies on
 *      request (a live signature stays BLOCKED — no signer exists).
 *   6. Service execution boundary — every response is `not-implemented` with
 *      the mandated message; no fabricated agent result or transaction hash.
 *   7. No client-side trust — `paid`/`paymentVerified`/`transactionHash` in the
 *      request are ignored; only the verifier verdict decides.
 *   8. No cross-chain payment — mainnet/unknown networks are refused (network
 *      error), and a wrong-chain header maps to payment-invalid.
 *
 * SAFETY (unchanged from X.1/X.2): chain 97 only; NO signing, NO generated
 * wallet/key, NO transaction, NO settlement, NO facilitator, NO on-chain read.
 * Fixtures are labeled TEST FIXTURE / NOT LIVE MARKETPLACE DATA.
 *
 * Exit policy: 1 on any assertion failure; 0 otherwise (fully offline).
 *
 * Run after `pnpm build`:  node dist/altana/marketplace.verify.js
 */

import { encodeXPaymentHeader } from "@altananetwork/sdk";
import type { X402PaymentPayload } from "@altananetwork/sdk";
import { getAddress } from "viem";
import {
  ALTANA_MARKETPLACE_EXECUTION_BOUNDARY,
  AltanaMarketplaceAgentNotFoundError,
  AltanaMarketplaceNetworkError,
  marketplaceVerdictFromX402Handle,
} from "./marketplace.js";
import type { MarketplacePaymentVerifier } from "./marketplace.js";
import {
  buildFixtureVerifiedResult,
  createMarketplaceTestnetService,
  createMarketplaceTestnetVerifier,
  MARKETPLACE_TESTNET_AGENTS,
  MARKETPLACE_TESTNET_PAYTO,
  marketplaceTestnetMerchantConfig,
  marketplaceTestnetRequirement,
} from "./marketplace.testnet.js";
import { ALTANA_X402_CHAIN_ID as CHAIN_97 } from "./x402.js";
import { X402_TESTNET_FIXTURE_PAYTO, X402_TESTNET_RESOURCE_URL } from "./x402.testnet.js";

function fail(message: string): never {
  console.error(`MARKETPLACE VERIFY FAILED: ${message}`);
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

/** TEST FIXTURE payer — a 40-hex address that is NOT a real wallet. */
const FIXTURE_PAYER = getAddress("0x1B6658DdF95E87A3d56a4b609d058C0EEcEb3588");

/** Keyless forged EIP-3009 envelope (mirrors the X.2 verify harness). */
function buildEip3009Fixture(
  token: string,
  payTo: string,
  amount: string,
  opts: { network?: string } = {}
): string {
  const network = opts.network ?? "eip155:97";
  const envelope: X402PaymentPayload = {
    x402Version: 2,
    scheme: "exact",
    network,
    accepted: {
      scheme: "exact",
      network,
      asset: token as `0x${string}`,
      payTo: payTo as `0x${string}`,
      amount,
      maxTimeoutSeconds: 300,
      extra: { name: "United Stables", version: "1", assetTransferMethod: "eip3009" },
    },
    resource: { url: X402_TESTNET_RESOURCE_URL },
    payload: {
      signature: "0x" + "ff".repeat(65),
      authorization: {
        from: FIXTURE_PAYER,
        to: payTo as `0x${string}`,
        value: amount,
        validAfter: "0",
        validBefore: "4102444800",
        nonce: "0x" + "44".repeat(32),
      },
      paid: true,
      paymentVerified: true,
      transactionHash: "0x" + "aa".repeat(32),
    },
  };
  return encodeXPaymentHeader(envelope);
}

async function main(): Promise<void> {
  console.log(
    "ALTANA PHASE X.3 — marketplace service verify (chain 97, headless, no signing, no tx)"
  );

  const merchantConfig = marketplaceTestnetMerchantConfig();
  const requirement = marketplaceTestnetRequirement();
  const rail = merchantConfig.rails[0];
  assert(
    rail !== undefined && rail.rail === "eip3009",
    "fixture merchant must offer the eip3009 rail"
  );
  const token = rail.token.address;

  // ---- 1. Agent identity: typed not-found + identity reuse -------------------
  const svc = createMarketplaceTestnetService();
  let notFoundThrown = false;
  try {
    svc.describe("definitely-not-a-listed-agent");
  } catch (error) {
    notFoundThrown = error instanceof AltanaMarketplaceAgentNotFoundError;
  }
  assert(notFoundThrown, "unknown agent slug must throw AltanaMarketplaceAgentNotFoundError");
  const known = svc.describe(MARKETPLACE_TESTNET_AGENTS[0]!.slug);
  assert(
    known.agent.slug === MARKETPLACE_TESTNET_AGENTS[0]!.slug,
    "agent identity must reuse the registry slug"
  );
  assert(
    known.agent.name.startsWith("Altana Test Fixture"),
    "fixture agent identity must be explicitly labeled"
  );
  assert(typeof known.agent.updatedAt === "string", "identity must carry updatedAt");
  assert(known.agent.category !== undefined, "identity must carry category");
  ok("1: unknown slug -> typed not-found; identity reused from registry (no fabrication)");

  // ---- 2. Configuration-blocked: no sell-side payment config ------------------
  const blocked = createMarketplaceTestnetService({ merchant: null });
  const blockedDescribe = blocked.describe(MARKETPLACE_TESTNET_AGENTS[0]!.slug);
  assert(
    blockedDescribe.payment.status === "unconfigured",
    "missing merchant config must be unconfigured"
  );
  assert(
    blockedDescribe.payment.reason.includes(
      "No configured/verified sell-side x402 payment configuration"
    ),
    "unconfigured reason must state nothing was substituted"
  );
  const blockedRequest = await blocked.requestService({
    agentSlug: MARKETPLACE_TESTNET_AGENTS[0]!.slug,
    clientClaims: { paid: true, paymentVerified: true },
  });
  assert(
    blockedRequest.payment.status === "unconfigured",
    "request with claims still unconfigured (config-blocked)"
  );
  ok("2: missing sell-side config -> configuration-blocked (unconfigured), no substituted values");

  // ---- 3. Payment requirement generation (configured/verified values only) ------
  assert(requirement.chainId === CHAIN_97, "requirement must pin chain 97");
  assert(requirement.network === "bnb-testnet", "requirement network must be bnb-testnet");
  assert(requirement.rail === "eip3009", "requirement rail must be eip3009");
  assert(requirement.asset === token, "requirement asset must equal the configured rail token");
  assert(
    requirement.payTo === X402_TESTNET_FIXTURE_PAYTO,
    "requirement payTo must equal the configured payTo"
  );
  assert(
    requirement.amount === merchantConfig.price.toString(),
    "requirement amount must equal the configured price"
  );
  assert(
    requirement.resourceUrl === X402_TESTNET_RESOURCE_URL,
    "requirement resource must equal the configured resource"
  );
  const described = svc.describe(MARKETPLACE_TESTNET_AGENTS[0]!.slug);
  assert(
    described.payment.status === "payment-required",
    "describe with configured merchant must be payment-required"
  );
  assert(
    described.payment.status === "payment-required" &&
      described.payment.requirement.payTo === requirement.payTo,
    "described requirement must carry the verified payTo"
  );
  ok(
    "3: requirement generated from configured/verified values only (chain 97/eip3009/$U/payTo/price/resource)"
  );

  // ---- 4. Invalid payment rejected --------------------------------------------
  const forged = await svc.requestService({
    agentSlug: MARKETPLACE_TESTNET_AGENTS[0]!.slug,
    xPaymentHeader: buildEip3009Fixture(token, requirement.payTo, requirement.amount),
  });
  assert(
    forged.payment.status === "payment-rejected" || forged.payment.status === "payment-invalid",
    "forged signature must never map to payment-verified"
  );
  ok("4: forged/invalid X-PAYMENT -> rejected (never payment-verified)");

  // ---- 5. Verified payment accepted (server-side verdict state machine) --------
  const fixtureVerifiedVerifier: MarketplacePaymentVerifier = async () =>
    buildFixtureVerifiedResult();
  const acceptedSvc = createMarketplaceTestnetService({ verifier: fixtureVerifiedVerifier });
  const accepted = await acceptedSvc.requestService({
    agentSlug: MARKETPLACE_TESTNET_AGENTS[0]!.slug,
    xPaymentHeader: "TEST FIXTURE verified-header",
  });
  assert(
    accepted.payment.status === "payment-verified",
    "server-side verified verdict must map to payment-verified"
  );
  assert(
    accepted.payment.status === "payment-verified" &&
      accepted.payment.verification.payer === MARKETPLACE_TESTNET_PAYTO,
    "verified receipt must carry the verified payer"
  );
  assert(
    accepted.payment.status === "payment-verified" &&
      accepted.payment.verification.amount === merchantConfig.price.toString(),
    "verified receipt must carry the verified amount"
  );
  ok(
    "5: server-side verified verdict -> payment-verified (live signature still BLOCKED — no signer)"
  );

  // ---- 6. Service execution boundary -------------------------------------------
  assert(accepted.service.status === "not-implemented", "service must be not-implemented");
  assert(
    accepted.service.detail === ALTANA_MARKETPLACE_EXECUTION_BOUNDARY,
    "service detail must be the mandated execution boundary message"
  );
  assert(known.service.status === "not-implemented", "describe service must be not-implemented");
  // No fabricated result or transaction hash may appear anywhere.
  const serialized = JSON.stringify(accepted);
  assert(!serialized.includes("serviceResult"), "no fabricated service result may exist");
  assert(!serialized.includes('"txHash"'), "no fabricated transaction hash may exist");
  ok("6: execution boundary = not-implemented; no fabricated result / tx hash");

  // ---- 7. No client-side trust --------------------------------------------------
  // The forged fixture embeds paid/paymentVerified/transactionHash=true and is
  // still rejected (verifier decides).
  const claims = await svc.requestService({
    agentSlug: MARKETPLACE_TESTNET_AGENTS[0]!.slug,
    xPaymentHeader: buildEip3009Fixture(token, requirement.payTo, requirement.amount),
    clientClaims: { paid: true, paymentVerified: true, transactionHash: "0x" + "aa".repeat(32) },
  });
  assert(
    claims.payment.status !== "payment-verified",
    "client claims must never authorize payment"
  );
  // And a verified verdict wins even if the client claims otherwise.
  const acceptedDespite = await acceptedSvc.requestService({
    agentSlug: MARKETPLACE_TESTNET_AGENTS[0]!.slug,
    xPaymentHeader: "TEST FIXTURE verified-header",
    clientClaims: { paid: false, paymentVerified: false },
  });
  assert(
    acceptedDespite.payment.status === "payment-verified",
    "server verdict governs, client claims ignored"
  );
  ok("7: paid/paymentVerified/transactionHash claims ignored — only the server verifier decides");

  // ---- 8. No cross-chain payment ------------------------------------------------
  let mainnetThrown = false;
  try {
    await svc.requestService({
      agentSlug: MARKETPLACE_TESTNET_AGENTS[0]!.slug,
      network: "bsc",
    });
  } catch (error) {
    mainnetThrown = error instanceof AltanaMarketplaceNetworkError;
  }
  assert(mainnetThrown, "mainnet network must be refused with a marketplace network error");

  const wrongChainHeader = await svc.requestService({
    agentSlug: MARKETPLACE_TESTNET_AGENTS[0]!.slug,
    xPaymentHeader: buildEip3009Fixture(token, requirement.payTo, requirement.amount, {
      network: "eip155:56",
    }),
  });
  assert(
    wrongChainHeader.payment.status === "payment-invalid",
    "wrong-chain header must map to payment-invalid"
  );
  ok(
    "8: mainnet refused (network error) + wrong-chain header -> payment-invalid; no cross-chain payment"
  );

  // ---- 9. Tests only against real (keyless) verification verdicts ----------------
  // `createMarketplaceTestnetVerifier` drives the Phase-X.2 keyless merchant: a
  // forged header yields kind "rejected", never ok — re-confirming offline reuse.
  const realVerifier = createMarketplaceTestnetVerifier();
  const verdict = await realVerifier(
    buildEip3009Fixture(token, requirement.payTo, requirement.amount)
  );
  assert(verdict.ok === false, "keyless merchant must reject every forged fixture");
  assert(
    verdict.ok === false && verdict.kind === "rejected",
    "forged fixture must normalize to rejected"
  );
  const mapped = marketplaceVerdictFromX402Handle({
    status: 200,
    receipt: {
      txHash: ("0x" + "00".repeat(32)) as `0x${string}`,
      payer: MARKETPLACE_TESTNET_PAYTO as `0x${string}`,
      amount: BigInt(requirement.amount),
      token: requirement.asset,
      rail: "eip3009",
    },
  });
  assert(mapped.ok === true, "a genuine verified receipt must normalize to ok");
  ok("9: offline reuse of the keyless x402 gate (forged rejected; genuine receipt normalizes)");

  // ---- 10. No-secret exposure -----------------------------------------------------
  const envSecrets = ["PRIVATE_KEY", "FACILITATOR_KEY", "WALLET", "MNEMONIC", "X402_API_KEY"];
  for (const key of envSecrets) {
    const value = process.env[key];
    if (value !== undefined && value !== "") {
      fail(`environment secret ${key} was unexpectedly set during verify`);
    }
  }
  ok("10: no env credentials read, printed, or persisted by the verify path");

  console.log(
    "ALTANA X402 X.3 STATUS: READY FOR X.4 (marketplace service integration verified " +
      "headlessly; live signing BLOCKED — requires an externally supplied funded BNB Testnet wallet)"
  );
  console.log(`MARKETPLACE VERIFY: ${passed} checks passed`);
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(
    `MARKETPLACE VERIFY FAILED: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
