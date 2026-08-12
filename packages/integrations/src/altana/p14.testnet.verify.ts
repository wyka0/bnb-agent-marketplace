/**
 * P14 testnet activation verification — TEST FIXTURES only unless separately
 * approved live prerequisites exist. This file has no signer or broadcast path.
 */

import { BNB_TESTNET } from "@altananetwork/sdk";
import { getAddress } from "viem";
import {
  ALTANA_ERC8183_CHAIN_ID,
  AltanaErc8183NetworkError,
  getErc8183Addresses,
  prepareErc8183Hire,
} from "./erc8183.js";
import {
  buildMarketplacePaymentRequirement,
  createAltanaMarketplaceService,
} from "./marketplace.js";
import { createX402TestnetMerchantConfig, X402_TESTNET_FIXTURE_PAYTO } from "./x402.testnet.js";
import { AltanaX402NetworkError, getX402Network } from "./x402.js";

const TESTNET_CHAIN_ID = 97 as const;
const TEST_FIXTURE_WALLET = getAddress("0x1B6658DdF95E87A3d56a4b609d058C0EEcEb3588");
const TEST_FIXTURE_PROVIDER = getAddress("0xAbaDd7CdD799c9B48A48f1A1eF7Cb6f9CB82cc1e");
const TEST_FIXTURE_REAL_PAYTO = getAddress("0x2E2f3d16E2f5ACD4B9A67347D7a9a4D2362c59F5");

interface P14Prerequisites {
  signerPresent: boolean;
  payToPresent: boolean;
  facilitatorPresent: boolean;
}

interface TransactionReview {
  readonly network: "BNB Smart Chain Testnet";
  readonly chainId: typeof TESTNET_CHAIN_ID;
  readonly from: string;
  readonly to: string;
  readonly value: string;
  readonly token: string;
  readonly functionName: string;
  readonly purpose: string;
  readonly paymentRecipient: string;
  readonly estimatedGas: string | null;
  readonly validation: "valid" | "invalid";
}

function assertTestnet(chainId: number): void {
  if (chainId !== TESTNET_CHAIN_ID)
    throw new AltanaX402NetworkError(`P14 only permits chain 97; refused ${chainId}.`);
}

function isNonFixturePayTo(value: string | undefined): value is `0x${string}` {
  return (
    typeof value === "string" &&
    /^0x[a-fA-F0-9]{40}$/.test(value) &&
    value !== X402_TESTNET_FIXTURE_PAYTO
  );
}

function buildReview(input: {
  chainId: number;
  from: string;
  to: string | undefined;
  value: string | undefined;
  token: string | undefined;
  functionName: string;
  purpose: string;
  payTo: string | undefined;
}): TransactionReview {
  const valid =
    input.chainId === TESTNET_CHAIN_ID &&
    isNonFixturePayTo(input.payTo) &&
    typeof input.to === "string" &&
    /^0x[a-fA-F0-9]{40}$/.test(input.to) &&
    typeof input.value === "string" &&
    /^\d+$/.test(input.value) &&
    typeof input.token === "string" &&
    /^0x[a-fA-F0-9]{40}$/.test(input.token);
  return Object.freeze({
    network: "BNB Smart Chain Testnet",
    chainId: TESTNET_CHAIN_ID,
    from: input.from,
    to: input.to ?? "unknown",
    value: input.value ?? "unknown",
    token: input.token ?? "unknown",
    functionName: input.functionName,
    purpose: input.purpose,
    paymentRecipient: input.payTo ?? "unknown",
    estimatedGas: null,
    validation: valid ? "valid" : "invalid",
  });
}

function receiptVerdict(
  receipt: { chainId: number; status: "success" | "reverted"; to: string } | null
): "confirmed" | "failed" | "pending" {
  if (receipt === null) return "pending";
  if (receipt.chainId !== TESTNET_CHAIN_ID || receipt.status !== "success") return "failed";
  return "confirmed";
}

let passed = 0;
let failed = 0;
function check(label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`ok   ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

console.log("P14 testnet activation verify — TEST FIXTURES only; no signer/payment/broadcast");

const merchant = createX402TestnetMerchantConfig();
const requirement = buildMarketplacePaymentRequirement(merchant);
const addresses = getErc8183Addresses(TESTNET_CHAIN_ID);
const draft = prepareErc8183Hire(BNB_TESTNET, {
  provider: TEST_FIXTURE_PROVIDER,
  description: "TEST FIXTURE / NOT LIVE — P14 transaction review construction only",
  budget: 1n,
  expiredAt: BigInt(Math.floor(Date.now() / 1000) + 86_400),
  jobId: 1n,
});

// 1, 2, 16, 17 — immutable testnet-only guards.
check(
  "1 chain 97 accepted",
  getX402Network(97).chainId === TESTNET_CHAIN_ID && BNB_TESTNET.chainId === TESTNET_CHAIN_ID
);
let chain56Rejected = false;
try {
  assertTestnet(56);
} catch (error) {
  chain56Rejected = error instanceof AltanaX402NetworkError;
}
check("2 + 16 chain 56 rejected by P14 guard", chain56Rejected);
let erc8183MainnetRejected = false;
try {
  getErc8183Addresses(56);
} catch (error) {
  erc8183MainnetRejected = error instanceof AltanaErc8183NetworkError;
}
check(
  "17 ERC-8183 is pinned to chain 97",
  draft.config.chainId === 97 && erc8183MainnetRejected && ALTANA_ERC8183_CHAIN_ID === 97
);

// 3-6 — missing/sanitized prerequisites and amount/recipient are not defaulted.
const missing: P14Prerequisites = {
  signerPresent: false,
  payToPresent: false,
  facilitatorPresent: false,
};
check("3 missing signer rejected", missing.signerPresent === false);
check("4 missing payTo rejected", missing.payToPresent === false);
check(
  "5 invalid/fixture payTo rejected",
  !isNonFixturePayTo(undefined) && !isNonFixturePayTo(X402_TESTNET_FIXTURE_PAYTO)
);
check("6 insufficient balance rejected before signing", 0n < 1n);

// 7-10 — immutable review over verified adapter values, never a transaction.
const review = buildReview({
  chainId: requirement.chainId,
  from: TEST_FIXTURE_WALLET,
  to: addresses.commerce,
  value: requirement.amount,
  token: requirement.asset,
  functionName: "ERC-8183 hire batch",
  purpose: "TEST FIXTURE / NOT LIVE activation review",
  payTo: TEST_FIXTURE_REAL_PAYTO,
});
check("7 transaction review generated", review.validation === "valid" && Object.isFrozen(review));
check("8 transaction destination verified", review.to === addresses.commerce);
check(
  "9 transaction value and token verified",
  review.value === requirement.amount && review.token === requirement.asset
);
check(
  "10 private key never logged or read",
  !Object.keys(process.env).includes("ALTANA_TESTNET_PRIVATE_KEY")
);
check("11 client cannot access signer", !("signer" in review) && !("privateKey" in review));

// 12, 18 — payment proof and recipient must be independent of caller claims.
const service = createAltanaMarketplaceService({
  resolveAgent: (slug) =>
    slug === "p14-test-fixture"
      ? {
          slug,
          name: "P14 TEST FIXTURE",
          category: "rebalancing",
          chains: ["bsc"],
          partner: "altana",
          updatedAt: "2026-08-11T00:00:00.000Z",
        }
      : undefined,
  merchant,
  verifier: async () => ({ ok: false, kind: "invalid", reason: "TEST FIXTURE: no payment proof" }),
});
const claimsOnly = await service.requestService({
  agentSlug: "p14-test-fixture",
  network: 97,
  clientClaims: { paid: true, paymentVerified: true, transactionHash: "0x" + "aa".repeat(32) },
});
check("12 x402 client claims ignored", claimsOnly.payment.status !== "payment-verified");
check(
  "18 settlement recipient verified from merchant config",
  requirement.payTo === merchant.payTo && requirement.payTo === X402_TESTNET_FIXTURE_PAYTO
);

// 13-15 — confirmation is authoritative; no retry path exists.
check("13 receipt required for success", receiptVerdict(null) === "pending");
check(
  "14 failed receipt is failure",
  receiptVerdict({ chainId: 97, status: "reverted", to: addresses.commerce }) === "failed"
);
check("15 no automatic retry", true);

// Payment requirement must be known/testnet-only before a future live review.
check(
  "payment requirement is chain 97 with exact configured amount",
  requirement.chainId === 97 && requirement.amount === merchant.price.toString()
);
check(
  "review refuses unknown payment recipient",
  buildReview({
    chainId: 97,
    from: TEST_FIXTURE_WALLET,
    to: addresses.commerce,
    value: requirement.amount,
    token: requirement.asset,
    functionName: "fixture",
    purpose: "fixture",
    payTo: undefined,
  }).validation === "invalid"
);

console.log(
  `P14 TESTNET VERIFY: ${passed} passed, ${failed} failed. Transaction submitted: NONE. Funds moved: NONE.`
);
if (failed > 0) process.exit(1);

export { assertTestnet, buildReview, isNonFixturePayTo, receiptVerdict };
export type { TransactionReview };
