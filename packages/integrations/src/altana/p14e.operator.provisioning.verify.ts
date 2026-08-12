/**
 * P14e operator testnet provisioning verification — TEST FIXTURES and
 * presence-only env probes only. No signer, no broadcast, no payment path.
 * The 11 checks below mirror the operator provisioning review gates from
 * docs/review/Main-Track-Activation-P14e-Operator-Provisioning.md.
 */

import { readFileSync } from "node:fs";
import { BNB_TESTNET } from "@altananetwork/sdk";
import { getAddress } from "viem";
import {
  ALTANA_ERC8183_CHAIN_ID,
  AltanaErc8183NetworkError,
  assertErc8183TestnetChainOnly,
  getErc8183Addresses,
} from "./erc8183.js";
import { X402_TESTNET_FIXTURE_PAYTO } from "./x402.testnet.js";
import {
  ALTANA_X402_CHAIN_ID,
  ALTANA_X402_NETWORK,
  AltanaX402ExecutionError,
  AltanaX402NetworkError,
  assertX402SellSideBoundary,
  checkX402Facilitator,
  getX402Network,
  X402_FACILITATOR_KEY_ENV,
  X402_SELL_SIDE_REQUIRES_FACILITATOR,
} from "./x402.js";

const TESTNET_CHAIN_ID = 97 as const;

const VERIFIED_COMMERCE = getAddress("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE");
const VERIFIED_ROUTER = getAddress("0xD7d36D66d2F1B608A0F943f722D27e3744f66F25");
const VERIFIED_POLICY = getAddress("0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6");
const VERIFIED_REGISTRY = getAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e");
const VERIFIED_U_TOKEN = getAddress("0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565");
const WRONG_CHAIN_TOKEN = getAddress("0x55d398326f99059fF775485246999027B3197955");

const SIGNER_ENV_NAMES = [
  "ALTANA_TESTNET_PRIVATE_KEY",
  "ALTANA_PRIVATE_KEY",
  "X402_PRIVATE_KEY",
  "WALLET_PRIVATE_KEY",
  "PRIVATE_KEY",
  "ALTANA_SIGNER",
  "SIGNER_KEY",
] as const;

const PAYTO_ENV_NAMES = ["ALTANA_PAYTO", "X402_PAYTO", "MERCHANT_PAYTO"] as const;

const STRUCTURAL_PAYTO = getAddress("0x2E2f3d16E2f5ACD4B9A67347D7a9a4D2362c59F5");

interface ProvisioningReview {
  readonly network: "BNB Smart Chain Testnet";
  readonly chainId: number;
  readonly operatorSigner: "present" | "missing";
  readonly payTo: string;
  readonly token: string;
  readonly facilitatorMode: "self-hosted" | "router.settle" | "missing";
}

function envPresent(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function probeSigner(): { present: boolean } {
  return { present: SIGNER_ENV_NAMES.some((name) => envPresent(name)) };
}

function probePayTo(): { present: boolean } {
  return { present: PAYTO_ENV_NAMES.some((name) => envPresent(name)) };
}

function renderReview(review: ProvisioningReview): Record<string, unknown> {
  return {
    network: review.network,
    chainId: review.chainId,
    operatorSigner: review.operatorSigner,
    payTo: review.payTo,
    token: review.token,
    facilitatorMode: review.facilitatorMode,
  };
}

function validateProvisioning(input: {
  chainId: number;
  signerPresent: boolean;
  payTo: string | undefined;
  facilitatorPresent: boolean;
  token: string;
}): string[] {
  const errors: string[] = [];
  if (input.chainId !== TESTNET_CHAIN_ID) {
    errors.push("chain");
  }
  if (!input.signerPresent) {
    errors.push("signer");
  }
  if (
    typeof input.payTo !== "string" ||
    !/^0x[a-fA-F0-9]{40}$/.test(input.payTo) ||
    input.payTo === "0x0000000000000000000000000000000000000000" ||
    input.payTo === X402_TESTNET_FIXTURE_PAYTO ||
    getAddress(input.payTo) !== input.payTo
  ) {
    errors.push("payTo");
  }
  if (!input.facilitatorPresent) {
    errors.push("facilitator");
  }
  if (input.chainId === TESTNET_CHAIN_ID && getAddress(input.token) !== VERIFIED_U_TOKEN) {
    errors.push("token");
  }
  return errors;
}

function isNonFixturePayTo(value: string | undefined): boolean {
  return (
    typeof value === "string" &&
    validateProvisioning({
      chainId: TESTNET_CHAIN_ID,
      signerPresent: true,
      payTo: value,
      facilitatorPresent: true,
      token: VERIFIED_U_TOKEN,
    }).length === 0
  );
}

const results: Array<{ ok: boolean; label: string }> = [];
function check(ok: boolean, label: string): void {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

const signer = probeSigner();
const payTo = probePayTo();
const facilitator = checkX402Facilitator();
console.log(`operator signer env present: ${signer.present ? "YES" : "NO"} (presence only)`);
console.log(`operator payTo env present: ${payTo.present ? "YES" : "NO"} (presence only)`);
console.log(
  `facilitator credential env: ${X402_FACILITATOR_KEY_ENV} (presence only, not rendered)`
);

check(
  getX402Network(TESTNET_CHAIN_ID).chainId === TESTNET_CHAIN_ID &&
    getX402Network(ALTANA_X402_NETWORK).chainId === TESTNET_CHAIN_ID &&
    BNB_TESTNET.chainId === TESTNET_CHAIN_ID &&
    ALTANA_X402_CHAIN_ID === TESTNET_CHAIN_ID &&
    ALTANA_ERC8183_CHAIN_ID === TESTNET_CHAIN_ID,
  "1 chain-97 accepted by x402 network guard, SDK preset, and ERC-8183 adapter"
);

let rejectedChain = false;
try {
  getX402Network(56);
} catch (error) {
  rejectedChain = error instanceof AltanaX402NetworkError;
}
try {
  getErc8183Addresses(56);
} catch (error) {
  rejectedChain = rejectedChain && error instanceof AltanaErc8183NetworkError;
}
let rejectedByAssert = false;
try {
  assertErc8183TestnetChainOnly(56);
} catch (error) {
  rejectedByAssert = error instanceof AltanaErc8183NetworkError;
}
let rejectedHex = false;
try {
  getX402Network("0x38");
} catch (error) {
  rejectedHex = error instanceof AltanaX402NetworkError;
}
check(
  rejectedChain && rejectedByAssert && rejectedHex,
  "2 chain-56 and hex 0x38 rejected by both x402 and ERC-8183 guards"
);

check(
  validateProvisioning({
    chainId: TESTNET_CHAIN_ID,
    signerPresent: false,
    payTo: STRUCTURAL_PAYTO,
    facilitatorPresent: true,
    token: VERIFIED_U_TOKEN,
  }).includes("signer"),
  "3 missing operator signer rejected by provisioning review"
);

const signerPresent = SIGNER_ENV_NAMES.some((name) => envPresent(name));
check(
  typeof signerPresent === "boolean" &&
    !("value" in signer) &&
    !("privateKey" in signer) &&
    !("key" in signer),
  "4 operator signer probe exposes presence only, never the credential"
);

check(
  validateProvisioning({
    chainId: TESTNET_CHAIN_ID,
    signerPresent: true,
    payTo: undefined,
    facilitatorPresent: true,
    token: VERIFIED_U_TOKEN,
  }).includes("payTo"),
  "5 missing operator payTo rejected by provisioning review"
);

check(
  validateProvisioning({
    chainId: TESTNET_CHAIN_ID,
    signerPresent: true,
    payTo: X402_TESTNET_FIXTURE_PAYTO,
    facilitatorPresent: true,
    token: VERIFIED_U_TOKEN,
  }).includes("payTo") && !isNonFixturePayTo(X402_TESTNET_FIXTURE_PAYTO),
  "6 fixture payTo rejected — never usable as operator payTo"
);

check(
  validateProvisioning({
    chainId: 56,
    signerPresent: true,
    payTo: STRUCTURAL_PAYTO,
    facilitatorPresent: true,
    token: VERIFIED_U_TOKEN,
  }).includes("chain") &&
    validateProvisioning({
      chainId: TESTNET_CHAIN_ID,
      signerPresent: true,
      payTo: "0x0000000000000000000000000000000000000000",
      facilitatorPresent: true,
      token: VERIFIED_U_TOKEN,
    }).includes("payTo"),
  "7 wrong-chain payTo rejected and zero-address payTo rejected"
);

check(
  validateProvisioning({
    chainId: TESTNET_CHAIN_ID,
    signerPresent: true,
    payTo: STRUCTURAL_PAYTO,
    facilitatorPresent: true,
    token: WRONG_CHAIN_TOKEN,
  }).includes("token"),
  "8 non-$U token rejected on chain 97 (mainnet USDT never accepted)"
);

check(
  validateProvisioning({
    chainId: TESTNET_CHAIN_ID,
    signerPresent: true,
    payTo: STRUCTURAL_PAYTO,
    facilitatorPresent: false,
    token: VERIFIED_U_TOKEN,
  }).includes("facilitator") &&
    facilitator.configured === false &&
    facilitator.env === X402_FACILITATOR_KEY_ENV &&
    (() => {
      try {
        assertX402SellSideBoundary("P14E-PROVISIONING-REVIEW");
        return false;
      } catch (error) {
        return (
          error instanceof AltanaX402ExecutionError &&
          error.message.includes(X402_SELL_SIDE_REQUIRES_FACILITATOR)
        );
      }
    })(),
  "9 missing facilitator configuration rejected and sell-side boundary always refuses"
);

const chain97 = getErc8183Addresses(TESTNET_CHAIN_ID);
check(
  getAddress(chain97.commerce) === VERIFIED_COMMERCE &&
    getAddress(chain97.router) === VERIFIED_ROUTER &&
    getAddress(chain97.policy) === VERIFIED_POLICY &&
    getAddress(chain97.registry) === VERIFIED_REGISTRY &&
    getAddress(chain97.paymentToken) === VERIFIED_U_TOKEN,
  "10 valid chain-97 router configuration accepted — single verified contract set"
);

const publicEnvNames = Object.keys(process.env).filter((name) => name.startsWith("NEXT_PUBLIC_"));
const leakedPublicEnv = publicEnvNames.filter((name) =>
  /(PAYTO|PRIVATE|FACILITATOR|SIGNER|X402|ALTANA|MERCHANT|KEY)/i.test(name)
);
const envExamplePath = new URL("../../../../.env.example", import.meta.url);
const envExampleLines = readFileSync(envExamplePath, "utf8").split(/\r?\n/);
const nonPlaceholder = envExampleLines.filter(
  (line) => line.trim() !== "" && !line.trim().startsWith("#") && !/^[A-Z0-9_]+=$/.test(line.trim())
);
const hexLeak = envExampleLines.filter((line) => /0x[0-9a-fA-F]{40,64}/.test(line));
const rendered = renderReview({
  network: "BNB Smart Chain Testnet",
  chainId: TESTNET_CHAIN_ID,
  operatorSigner: signer.present ? "present" : "missing",
  payTo: payTo.present ? "present" : "missing",
  token: VERIFIED_U_TOKEN,
  facilitatorMode: "missing",
});
check(
  leakedPublicEnv.length === 0 &&
    nonPlaceholder.length === 0 &&
    hexLeak.length === 0 &&
    ["network", "chainId", "operatorSigner", "payTo", "token", "facilitatorMode"].every(
      (key) => key in rendered
    ) &&
    !("value" in rendered) &&
    !("privateKey" in rendered) &&
    !("credential" in rendered),
  "11 secret values never rendered — no NEXT_PUBLIC operator keys, .env.example placeholders only, review carries presence flags only"
);

const failed = results.filter((entry) => !entry.ok);
console.log(
  `\nP14e operator provisioning: ${results.length - failed.length}/${results.length} checks passed`
);

if (failed.length > 0) {
  console.error("P14e gate FAILED — operator provisioning review refused.");
  process.exit(1);
}
