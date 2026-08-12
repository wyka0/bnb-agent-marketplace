/**
 * X.4C — real-action consent-flow verification. TEST FIXTURES only, offline.
 * Proves the LIVE review boundary: fixture actions cannot enter live signing,
 * every field is mandatory, chain/$U/payTo/destination/calldata are pinned,
 * consent digests invalidate on any change, secrets never render, and no
 * signing/broadcast surface exists in this phase.
 */

import { getAddress } from "viem";
import * as x402reviewModule from "./x402.review.js";
import {
  buildX402LiveReview,
  isX402FixtureCalldata,
  isX402StructuralFixture,
  pinX402Consent,
  verifyX402Consent,
  X402_FIXTURE_CALLDATA,
  X402_REVIEW_CHAIN_ID,
  X402_REVIEW_TOKEN,
  X402ReviewError,
  x402ReviewToJson,
} from "./x402.review.js";
import { getErc8183Addresses } from "./erc8183.js";

const REAL_FX_PAYTO = getAddress("0x" + "aa".repeat(20));
const REAL_FX_OPERATOR = getAddress("0x" + "bb".repeat(20));
const REAL_FX_FACILITATOR = getAddress("0x" + "cc".repeat(20));
const REAL_FX_AMOUNT = 250_000_000_000_000_000n;
const REAL_FX_JOB = 9_000_000_000_000_000_001n;
const REAL_FX_CALLDATA = ("0x" +
  "12345678" +
  "11".repeat(20) +
  "22".repeat(20) +
  "33".repeat(8)) as `0x${string}`;

const results: Array<{ ok: boolean; label: string }> = [];
function check(ok: boolean, label: string): void {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

function liveAction(overrides: Record<string, unknown> = {}) {
  return buildX402LiveReview({
    kind: (overrides.kind as x402reviewModule.X402LiveActionKind) ?? "erc8183-settle",
    chainId: (overrides.chainId as number | string) ?? X402_REVIEW_CHAIN_ID,
    token: (overrides.token as string) ?? X402_REVIEW_TOKEN,
    amount: (overrides.amount as bigint) ?? REAL_FX_AMOUNT,
    payTo: (overrides.payTo as string) ?? REAL_FX_PAYTO,
    destination:
      (overrides.destination as string) ?? getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
    calldata: (overrides.calldata as string) ?? REAL_FX_CALLDATA,
    facilitator: (overrides.facilitator as string) ?? REAL_FX_FACILITATOR,
    operator: (overrides.operator as string) ?? REAL_FX_OPERATOR,
    jobId: (overrides.jobId as bigint) ?? REAL_FX_JOB,
    configuredPayTo: (overrides.configuredPayTo as string) ?? REAL_FX_PAYTO,
  });
}

let fixtureBlockedFromLive = false;
try {
  buildX402LiveReview({
    kind: "erc8183-settle",
    chainId: X402_REVIEW_CHAIN_ID,
    token: X402_REVIEW_TOKEN,
    amount: REAL_FX_AMOUNT,
    payTo: REAL_FX_PAYTO,
    destination: getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
    calldata: X402_FIXTURE_CALLDATA,
    facilitator: REAL_FX_FACILITATOR,
    operator: REAL_FX_OPERATOR,
    jobId: REAL_FX_JOB,
    configuredPayTo: REAL_FX_PAYTO,
  });
} catch (error) {
  fixtureBlockedFromLive =
    error instanceof X402ReviewError && error.message.includes("fixture calldata");
}
let structuralBlockedFromLive = false;
try {
  buildX402LiveReview({
    kind: "erc8183-settle",
    chainId: X402_REVIEW_CHAIN_ID,
    token: X402_REVIEW_TOKEN,
    amount: REAL_FX_AMOUNT,
    payTo: getAddress("0x2E2f3d16E2f5ACD4B9A67347D7a9a4D2362c59F5"),
    destination: getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
    calldata: REAL_FX_CALLDATA,
    facilitator: REAL_FX_FACILITATOR,
    operator: REAL_FX_OPERATOR,
    jobId: REAL_FX_JOB,
    configuredPayTo: REAL_FX_PAYTO,
  });
} catch (error) {
  structuralBlockedFromLive =
    error instanceof X402ReviewError && error.message.includes("structural fixture");
}
check(
  fixtureBlockedFromLive &&
    structuralBlockedFromLive &&
    isX402FixtureCalldata(X402_FIXTURE_CALLDATA) &&
    isX402StructuralFixture(getAddress("0x1B6658DdF95E87A3d56a4b609d058C0EEcEb3588")),
  "1 fixture action cannot enter LIVE signing — fixture calldata and structural addresses refused"
);

let missingFieldRejected = false;
try {
  buildX402LiveReview({
    kind: "erc8183-settle",
    chainId: X402_REVIEW_CHAIN_ID,
    token: X402_REVIEW_TOKEN,
    amount: REAL_FX_AMOUNT,
    payTo: REAL_FX_PAYTO,
    destination: getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
    calldata: REAL_FX_CALLDATA,
    facilitator: REAL_FX_FACILITATOR,
    operator: REAL_FX_OPERATOR,
    jobId: undefined as unknown as bigint,
    configuredPayTo: REAL_FX_PAYTO,
  });
} catch (error) {
  missingFieldRejected = error instanceof X402ReviewError && error.message.includes("jobId");
}
let zeroJobRejected = false;
try {
  liveAction({ jobId: 0n });
} catch (error) {
  zeroJobRejected = error instanceof X402ReviewError;
}
check(
  missingFieldRejected && zeroJobRejected,
  "2 real action requires all fields (jobId mandatory, >= 1)"
);

let mainnetRejected = false;
try {
  liveAction({ chainId: 56 });
} catch (error) {
  mainnetRejected = error instanceof X402ReviewError;
}
let missingChainRejected = false;
try {
  buildX402LiveReview({
    kind: "erc8183-settle",
    chainId: undefined as unknown as number,
    token: X402_REVIEW_TOKEN,
    amount: REAL_FX_AMOUNT,
    payTo: REAL_FX_PAYTO,
    destination: getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
    calldata: REAL_FX_CALLDATA,
    facilitator: REAL_FX_FACILITATOR,
    operator: REAL_FX_OPERATOR,
    jobId: REAL_FX_JOB,
    configuredPayTo: REAL_FX_PAYTO,
  });
} catch (error) {
  missingChainRejected = error instanceof X402ReviewError && error.message.includes("chainId");
}
check(
  mainnetRejected && missingChainRejected,
  "3 chain 97 is mandatory — 56 and missing chain refused"
);

let wrongTokenRejected = false;
try {
  liveAction({ token: getAddress("0x55d398326f99059fF775485246999027B3197955") });
} catch (error) {
  wrongTokenRejected = error instanceof X402ReviewError && error.message.includes("token");
}
check(wrongTokenRejected, "4 verified chain-97 $U is mandatory — mainnet USDT refused");

let payToMismatchRejected = false;
try {
  liveAction({ payTo: getAddress("0x" + "dd".repeat(20)) });
} catch (error) {
  payToMismatchRejected =
    error instanceof X402ReviewError && error.message.includes("configured operator merchant");
}
let payToTableRejected = false;
try {
  liveAction({ configuredPayTo: getAddress("0x" + "dd".repeat(20)) });
} catch (error) {
  payToTableRejected =
    error instanceof X402ReviewError && error.message.includes("configured operator merchant");
}
check(
  payToMismatchRejected && payToTableRejected,
  "5 payTo is pinned to the configured operator merchant address — mismatches refused"
);

check(
  (() => {
    const review = liveAction();
    return review.amount === REAL_FX_AMOUNT;
  })(),
  "6 amount pinned exactly (atomic units)"
);

let arbitraryDestinationRejected = false;
try {
  liveAction({ destination: getAddress("0x" + "dd".repeat(20)) });
} catch (error) {
  arbitraryDestinationRejected =
    error instanceof X402ReviewError && error.message.includes("destination");
}
check(arbitraryDestinationRejected, "7 destination pinned to the verified router allowlist");

let calldataPreserved = false;
try {
  const review = liveAction();
  calldataPreserved = review.calldata === REAL_FX_CALLDATA.toLowerCase();
} catch {
  calldataPreserved = false;
}
let badCalldataRejected = false;
try {
  liveAction({ calldata: "0x1234" });
} catch (error) {
  badCalldataRejected = error instanceof X402ReviewError;
}
check(
  calldataPreserved && badCalldataRejected,
  "8 calldata pinned exactly — malformed calldata refused"
);

let allMutationsInvalidate = false;
try {
  const review = liveAction();
  const consent = pinX402Consent(review);
  const base = liveAction();
  const mutations: Array<Record<string, unknown>> = [
    { amount: REAL_FX_AMOUNT + 1n },
    { payTo: getAddress("0x" + "dd".repeat(20)) },
    { destination: getErc8183Addresses(X402_REVIEW_CHAIN_ID).commerce },
    { calldata: "0x" + "abcdef01" + "1".repeat(40) + "2".repeat(44) },
  ];
  const changedFieldsInvalidate = mutations.every((patch) => {
    let mutated: x402reviewModule.X402TransactionReview;
    try {
      mutated = liveAction(patch);
    } catch {
      return true;
    }
    return !verifyX402Consent(mutated, consent);
  });
  const changedChainRefused = (() => {
    try {
      liveAction({ chainId: 56 });
      return false;
    } catch {
      return true;
    }
  })();
  const changedTokenRefused = (() => {
    try {
      liveAction({ token: getAddress("0x55d398326f99059fF775485246999027B3197955") });
      return false;
    } catch {
      return true;
    }
  })();
  allMutationsInvalidate =
    changedFieldsInvalidate &&
    changedChainRefused &&
    changedTokenRefused &&
    verifyX402Consent(base, consent);
} catch {
  allMutationsInvalidate = false;
}
check(
  allMutationsInvalidate,
  "9 changing any pinned field (chain/token/amount/payTo/destination/calldata) invalidates the consent"
);

let noSecretRender = false;
try {
  const review = liveAction();
  const rendered = JSON.stringify(x402ReviewToJson(review));
  const banned = [
    "privateKey",
    "secret",
    "credential",
    "mnemonic",
    "ALTANA_PRIVATE_KEY",
    "FACILITATOR_KEY",
    "ALTANA_PAYTO",
    "X402_PRIVATE_KEY",
  ];
  noSecretRender = banned.every((term) => !rendered.toLowerCase().includes(term.toLowerCase()));
} catch {
  noSecretRender = false;
}
check(noSecretRender, "10 no private key reaches the browser — render is a public-data whitelist");

let noBroadcastSurface = false;
try {
  const moduleKeys = Object.keys(x402reviewModule);
  const bannedExports = [
    "broadcast",
    "broadcastTransaction",
    "sendTransaction",
    "signTransaction",
    "signTypedData",
    "signMessage",
  ];
  noBroadcastSurface = bannedExports.every((name) => !moduleKeys.includes(name));
} catch {
  noBroadcastSurface = false;
}
check(
  noBroadcastSurface && X402_REVIEW_CHAIN_ID === 97,
  "11 no transaction is broadcast during X.4C — no broadcast/sign surface exists on the module"
);

const failed = results.filter((entry) => !entry.ok);
console.log(
  `\nX.4C real-action consent flow: ${results.length - failed.length}/${results.length} checks passed`
);
console.log("SIGNING: NOT PERFORMED   BROADCAST: NOT PERFORMED   CONFIRMATION: NOT PERFORMED");

if (failed.length > 0) {
  console.error("X.4C consent flow FAILED.");
  process.exit(1);
}
