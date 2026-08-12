/**
 * X.4B transaction-review boundary verification — TEST FIXTURES only, offline.
 * 16 fixtures prove the review boundary: chain 97 only, verified $U only,
 * exact amount/calldata/destination pinning, facilitator distinctness,
 * immutability, and zero secret exposure. No signing, no broadcast.
 */

import { getAddress, keccak256 } from "viem";
import type { Hex } from "viem";
import { getErc8183Addresses } from "./erc8183.js";
import { X402_TESTNET_FIXTURE_PAYTO } from "./x402.testnet.js";
import {
  advanceX402TransactionReview,
  buildX402TransactionReview,
  isX402ReviewPayTo,
  X402_REVIEW_CHAIN_ID,
  X402_REVIEW_STATES,
  X402_REVIEW_TOKEN,
  X402ReviewError,
  x402ReviewToJson,
} from "./x402.review.js";

const FX_PAYTO = getAddress("0x2E2f3d16E2f5ACD4B9A67347D7a9a4D2362c59F5");
const FX_PAYTO_ALT = getAddress("0x" + "ee".repeat(20));
const FX_OPERATOR = getAddress("0x1B6658DdF95E87A3d56a4b609d058C0EEcEb3588");
const FX_FACILITATOR = getAddress("0xAbaDd7CdD799c9B48A48f1A1eF7Cb6f9CB82cc1e");
const FX_DEST_ARBITRARY = getAddress("0x" + "dd".repeat(20));
const FX_CALDATA = ("0x" + "a9059cbb" + "11".repeat(32) + "22".repeat(32)) as Hex;
const FX_AMOUNT = 1_000_000_000_000_000_000n;

const results: Array<{ ok: boolean; label: string }> = [];
function check(ok: boolean, label: string): void {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

function fixtureReview(overrides: Record<string, unknown> = {}) {
  return buildX402TransactionReview({
    chainId: (overrides.chainId as number | string) ?? X402_REVIEW_CHAIN_ID,
    token: (overrides.token as string) ?? X402_REVIEW_TOKEN,
    amount: (overrides.amount as bigint) ?? FX_AMOUNT,
    payTo: (overrides.payTo as string) ?? FX_PAYTO,
    destination:
      (overrides.destination as string) ?? getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
    calldata: (overrides.calldata as string) ?? FX_CALDATA,
    action: (overrides.action as string) ?? "erc8183-router-settle (TEST FIXTURE)",
    facilitator: (overrides.facilitator as string) ?? FX_FACILITATOR,
    operator: (overrides.operator as string) ?? FX_OPERATOR,
  });
}

check(
  (() => {
    const review = fixtureReview();
    return (
      review.chainId === 97 &&
      review.network === "bnb-testnet" &&
      review.state === "REVIEWED" &&
      fixtureReview({ chainId: "97" }).chainId === 97
    );
  })(),
  "1 correct chain 97 accepted (numeric and string)"
);

let wrongChainRejected = false;
let wrongChainRejectedString = false;
let hexChainRejected = false;
try {
  fixtureReview({ chainId: 56 });
} catch (error) {
  wrongChainRejected = error instanceof X402ReviewError;
}
try {
  fixtureReview({ chainId: "bsc" });
} catch (error) {
  wrongChainRejectedString = error instanceof X402ReviewError;
}
try {
  fixtureReview({ chainId: "0x38" });
} catch (error) {
  hexChainRejected = error instanceof X402ReviewError;
}
check(
  wrongChainRejected && wrongChainRejectedString && hexChainRejected,
  "2 wrong chain rejected (56, bsc, 0x38)"
);

check(
  (() => {
    const review = fixtureReview();
    return review.token === X402_REVIEW_TOKEN;
  })(),
  "3 correct verified chain-97 $U accepted"
);

let wrongTokenRejected = false;
try {
  fixtureReview({ token: getAddress("0x55d398326f99059fF775485246999027B3197955") });
} catch (error) {
  wrongTokenRejected = error instanceof X402ReviewError;
}
let zeroTokenRejected = false;
try {
  fixtureReview({ token: "0x0000000000000000000000000000000000000000" });
} catch (error) {
  zeroTokenRejected = error instanceof X402ReviewError;
}
check(
  wrongTokenRejected && zeroTokenRejected,
  "4 wrong token rejected (mainnet USDT, zero address)"
);

check(
  (() => {
    const review = fixtureReview();
    return (
      review.payTo === FX_PAYTO && isX402ReviewPayTo(FX_PAYTO) && !isX402ReviewPayTo(undefined)
    );
  })(),
  "5 correct non-fixture payTo accepted"
);

let changedPayToRejected = false;
let pinningProved = false;
try {
  const reviewed = fixtureReview({ payTo: FX_PAYTO_ALT });
  pinningProved = reviewed.payTo === FX_PAYTO_ALT;
  advanceX402TransactionReview(reviewed, "APPROVED", {
    chainId: X402_REVIEW_CHAIN_ID,
    token: X402_REVIEW_TOKEN,
    amount: FX_AMOUNT,
    payTo: FX_PAYTO,
    destination: getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
    calldata: FX_CALDATA,
  });
} catch (error) {
  changedPayToRejected = error instanceof X402ReviewError && error.message.includes("payTo");
}
let fixturePayToRejected = false;
try {
  fixtureReview({ payTo: X402_TESTNET_FIXTURE_PAYTO });
} catch (error) {
  fixturePayToRejected =
    error instanceof X402ReviewError && error.message.includes("fixture payTo");
}
check(
  pinningProved && changedPayToRejected && fixturePayToRejected,
  "6 changed payTo refused at consent — recipient pinned at review, never silently swapped"
);

check(
  (() => {
    const review = fixtureReview();
    return review.amount === FX_AMOUNT;
  })(),
  "7 amount preserved exactly (atomic units)"
);

let zeroAmountRejected = false;
try {
  fixtureReview({ amount: 0n });
} catch (error) {
  zeroAmountRejected = error instanceof X402ReviewError;
}
let changedAmountRejectedAtConsent = false;
try {
  let refused = false;
  const reviewed = fixtureReview();
  try {
    advanceX402TransactionReview(reviewed, "APPROVED", {
      chainId: X402_REVIEW_CHAIN_ID,
      token: X402_REVIEW_TOKEN,
      amount: FX_AMOUNT * 2n,
      payTo: FX_PAYTO,
      destination: getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
      calldata: FX_CALDATA,
    });
  } catch (error) {
    refused = error instanceof X402ReviewError && error.message.includes("amount");
  }
  changedAmountRejectedAtConsent = refused && reviewed.amount === FX_AMOUNT;
} catch {
  changedAmountRejectedAtConsent = false;
}
check(
  zeroAmountRejected && changedAmountRejectedAtConsent,
  "8 changed amount refused at consent — amount preserved exactly, never silently altered"
);

check(
  (() => {
    const chain97 = getErc8183Addresses(X402_REVIEW_CHAIN_ID);
    const router = fixtureReview({ destination: chain97.router });
    const commerce = fixtureReview({ destination: chain97.commerce });
    const policy = fixtureReview({ destination: chain97.policy });
    const registry = fixtureReview({ destination: chain97.registry });
    const token = fixtureReview({ destination: chain97.paymentToken });
    return (
      router.destination === chain97.router &&
      commerce.destination === chain97.commerce &&
      policy.destination === chain97.policy &&
      registry.destination === chain97.registry &&
      token.destination === chain97.paymentToken
    );
  })(),
  "9 verified destinations preserved exactly (all five ERC-8183 contracts)"
);

let arbitraryDestinationRejected = false;
try {
  fixtureReview({ destination: FX_DEST_ARBITRARY });
} catch (error) {
  arbitraryDestinationRejected =
    error instanceof X402ReviewError && error.message.includes("destination");
}
let changedDestinationRejectedAtConsent = false;
try {
  const reviewed = fixtureReview();
  try {
    advanceX402TransactionReview(reviewed, "APPROVED", {
      chainId: X402_REVIEW_CHAIN_ID,
      token: X402_REVIEW_TOKEN,
      amount: FX_AMOUNT,
      payTo: FX_PAYTO,
      destination: FX_DEST_ARBITRARY,
      calldata: FX_CALDATA,
    });
  } catch (error) {
    changedDestinationRejectedAtConsent =
      error instanceof X402ReviewError && error.message.includes("destination");
  }
} catch {
  changedDestinationRejectedAtConsent = false;
}
check(
  arbitraryDestinationRejected && changedDestinationRejectedAtConsent,
  "10 unverified or changed destination rejected — verified contract set only, pinned at consent"
);

check(
  (() => {
    const review = fixtureReview();
    return review.calldata === FX_CALDATA && review.calldataDigest === keccak256(FX_CALDATA);
  })(),
  "11 calldata preserved exactly with pinned digest"
);

let changedCalldataDetected = false;
const FX_CALDATA_CHANGED = ("0x" + "a9059cbb" + "33".repeat(32) + "22".repeat(32)) as Hex;
try {
  const changed = fixtureReview({ calldata: FX_CALDATA_CHANGED });
  changedCalldataDetected =
    changed.calldata === FX_CALDATA_CHANGED && changed.calldataDigest !== keccak256(FX_CALDATA);
} catch {
  changedCalldataDetected = false;
}
let changedCalldataRejectedAtConsent = false;
try {
  const reviewed = fixtureReview();
  try {
    advanceX402TransactionReview(reviewed, "APPROVED", {
      chainId: X402_REVIEW_CHAIN_ID,
      token: X402_REVIEW_TOKEN,
      amount: FX_AMOUNT,
      payTo: FX_PAYTO,
      destination: getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
      calldata: FX_CALDATA_CHANGED,
    });
  } catch (error) {
    changedCalldataRejectedAtConsent =
      error instanceof X402ReviewError && error.message.includes("calldata");
  }
} catch {
  changedCalldataRejectedAtConsent = false;
}
let malformedCalldataRejected = false;
try {
  fixtureReview({ calldata: "0x1234" });
} catch (error) {
  malformedCalldataRejected = error instanceof X402ReviewError;
}
let oddHexRejected = false;
try {
  fixtureReview({ calldata: "0x1234567" });
} catch (error) {
  oddHexRejected = error instanceof X402ReviewError;
}
check(
  changedCalldataDetected &&
    changedCalldataRejectedAtConsent &&
    malformedCalldataRejected &&
    oddHexRejected,
  "12 changed or malformed calldata rejected — digest-pinned, no stale calldata reuse possible"
);

let facilitatorIsPayToRejected = false;
try {
  fixtureReview({ facilitator: FX_PAYTO });
} catch (error) {
  facilitatorIsPayToRejected =
    error instanceof X402ReviewError && error.message.includes("distinct from payTo");
}
check(
  facilitatorIsPayToRejected,
  "13 facilitator distinct from payTo enforced by the review builder"
);

let facilitatorIsOperatorRejected = false;
try {
  fixtureReview({ facilitator: FX_OPERATOR });
} catch (error) {
  facilitatorIsOperatorRejected =
    error instanceof X402ReviewError && error.message.includes("operator signer");
}
check(
  facilitatorIsOperatorRejected,
  "14 facilitator distinct from operator signer enforced by the review builder"
);

let immutable = false;
try {
  const review = fixtureReview();
  const frozen = Object.isFrozen(review);
  let mutationThrows = false;
  try {
    (review as unknown as { state: string }).state = "APPROVED";
  } catch {
    mutationThrows = true;
  }
  const advanced = advanceX402TransactionReview(review, "APPROVED");
  const advancedIsNew =
    advanced !== review && advanced.state === "APPROVED" && review.state === "REVIEWED";
  const advancedKeepsFields =
    advanced.chainId === review.chainId &&
    advanced.token === review.token &&
    advanced.amount === review.amount &&
    advanced.payTo === review.payTo &&
    advanced.destination === review.destination &&
    advanced.calldata === review.calldata &&
    advanced.facilitator === review.facilitator;
  let skippedRejected = false;
  try {
    advanceX402TransactionReview(review, "SIGNED");
  } catch (error) {
    skippedRejected = error instanceof X402ReviewError;
  }
  immutable = frozen && mutationThrows && advancedIsNew && advancedKeepsFields && skippedRejected;
} catch {
  immutable = false;
}
check(
  immutable && X402_REVIEW_STATES.length === 5 && new Set<string>(X402_REVIEW_STATES).size === 5,
  "15 immutable review — frozen, one-step state machine only, five distinct states never collapsed"
);

let noSecretExposure = false;
try {
  const review = fixtureReview();
  const rendered = JSON.stringify(x402ReviewToJson(review));
  const ownKeys = Object.keys(x402ReviewToJson(review)).sort().join(",");
  const allowedKeys = [
    "action",
    "amount",
    "calldata",
    "calldataDigest",
    "chainId",
    "destination",
    "facilitator",
    "network",
    "operator",
    "payTo",
    "reviewedAt",
    "state",
    "token",
  ]
    .sort()
    .join(",");
  const banned = [
    "privateKey",
    "secret",
    "credential",
    "ALTANA_PRIVATE_KEY",
    "FACILITATOR_KEY",
    "ALTANA_PAYTO",
    "mnemonic",
  ];
  noSecretExposure =
    ownKeys === allowedKeys &&
    banned.every((term) => !rendered.toLowerCase().includes(term.toLowerCase()));
} catch {
  noSecretExposure = false;
}
check(noSecretExposure, "16 no secret exposure — render is a strict public-data whitelist");

const failed = results.filter((entry) => !entry.ok);
console.log(
  `\nX.4B transaction review boundary: ${results.length - failed.length}/${results.length} checks passed`
);
console.log("SIGNING: NOT PERFORMED   BROADCAST: NOT PERFORMED   CONFIRMATION: NOT PERFORMED");

if (failed.length > 0) {
  console.error("X.4B boundary FAILED.");
  process.exit(1);
}
