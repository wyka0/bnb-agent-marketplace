/**
 * X.4B transaction-review boundary — pure, immutable, offline.
 * Builds the single canonical review object for any proposed on-chain action
 * against the verified chain-97 pin set. NEVER signs, NEVER broadcasts, NEVER
 * reads the environment, NEVER touches credentials. States are distinct and
 * one-step only: REVIEWED -> APPROVED -> SIGNED -> BROADCAST -> CONFIRMED.
 * Raising a review to SIGNED (or beyond) requires the explicit operator
 * consent boundary that lives outside this module (X.4C).
 */

import { getAddress, keccak256, stringToHex } from "viem";
import type { Address, Hex } from "viem";
import { getErc8183Addresses } from "./erc8183.js";
import { getX402Network } from "./x402.js";
import { X402_TESTNET_FIXTURE_PAYTO } from "./x402.testnet.js";

export const X402_REVIEW_CHAIN_ID = 97 as const;
export const X402_REVIEW_NETWORK = "bnb-testnet" as const;
export const X402_REVIEW_TOKEN = getAddress("0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565");

export const X402_REVIEW_STATES = [
  "REVIEWED",
  "APPROVED",
  "SIGNED",
  "BROADCAST",
  "CONFIRMED",
] as const;

export type X402ReviewState = (typeof X402_REVIEW_STATES)[number];

export class X402ReviewError extends Error {}

export interface X402TransactionReview {
  readonly state: X402ReviewState;
  readonly chainId: typeof X402_REVIEW_CHAIN_ID;
  readonly network: typeof X402_REVIEW_NETWORK;
  readonly token: Address;
  readonly amount: bigint;
  readonly payTo: Address;
  readonly destination: Address;
  readonly calldata: Hex;
  readonly calldataDigest: Hex;
  readonly action: string;
  readonly facilitator: Address;
  readonly operator: Address;
  readonly reviewedAt: number;
}

export interface X402ReviewInput {
  chainId: number | string;
  token: string;
  amount: bigint;
  payTo: string;
  destination: string;
  calldata: string;
  action: string;
  facilitator: string;
  operator: string;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function assertAddress(value: string, errors: string[], what: string): Address | null {
  if (
    typeof value !== "string" ||
    !ADDRESS_RE.test(value) ||
    value === "0x0000000000000000000000000000000000000000"
  ) {
    errors.push(`${what} must be a non-zero 40-hex address`);
    return null;
  }
  try {
    return getAddress(value);
  } catch {
    errors.push(`${what} is not a valid Ethereum address`);
    return null;
  }
}

/** Pure recipient rule: a real-ish non-fixture non-contract payTo on chain 97. */
export function isX402ReviewPayTo(value: string | undefined): boolean {
  if (
    typeof value !== "string" ||
    !ADDRESS_RE.test(value) ||
    value === "0x0000000000000000000000000000000000000000"
  ) {
    return false;
  }
  if (value === X402_TESTNET_FIXTURE_PAYTO) return false;
  if (getAddress(value) !== value) return false;
  if (getAddress(value) === X402_REVIEW_TOKEN) return false;
  return true;
}

export function buildX402TransactionReview(input: X402ReviewInput): X402TransactionReview {
  const errors: string[] = [];

  let network: typeof X402_REVIEW_NETWORK = X402_REVIEW_NETWORK;
  try {
    const resolved = getX402Network(input.chainId);
    if (resolved.chainId !== X402_REVIEW_CHAIN_ID) {
      errors.push(`chain must be ${X402_REVIEW_CHAIN_ID}; refused ${resolved.chainId}`);
    }
    network = X402_REVIEW_NETWORK;
  } catch {
    errors.push(`chain must be ${X402_REVIEW_CHAIN_ID}`);
  }

  const token = assertAddress(input.token, errors, "token");
  if (token !== null && token !== X402_REVIEW_TOKEN) {
    errors.push("token must be the verified chain-97 $U");
  }

  if (typeof input.amount !== "bigint" || input.amount <= 0n) {
    errors.push("amount must be a positive bigint (atomic units)");
  }

  const payTo = assertAddress(input.payTo, errors, "payTo");
  if (payTo !== null && payTo === X402_TESTNET_FIXTURE_PAYTO) {
    errors.push("payTo must not be the fixture payTo");
  }

  const destination = assertAddress(input.destination, errors, "destination");
  if (destination !== null) {
    const verified = getErc8183Addresses(X402_REVIEW_CHAIN_ID);
    const verifiedSet = new Set<string>([
      verified.commerce,
      verified.router,
      verified.policy,
      verified.registry,
      verified.paymentToken,
    ]);
    if (!verifiedSet.has(destination)) {
      errors.push("destination must be a verified ERC-8183 contract on chain 97");
    }
  }

  if (
    typeof input.calldata !== "string" ||
    !/^0x(?:[0-9a-fA-F]{2})+$/.test(input.calldata) ||
    input.calldata.length < 10
  ) {
    errors.push("calldata must be 0x-prefixed hex with at least a 4-byte function selector");
  }

  if (typeof input.action !== "string" || input.action.trim().length === 0) {
    errors.push("action must be a non-empty label");
  }

  const facilitator = assertAddress(input.facilitator, errors, "facilitator");
  const operator = assertAddress(input.operator, errors, "operator");
  if (payTo !== null && facilitator !== null && facilitator === payTo) {
    errors.push("facilitator must be distinct from payTo");
  }
  if (operator !== null && facilitator !== null && facilitator === operator) {
    errors.push("facilitator must be distinct from the operator signer");
  }
  if (payTo !== null && operator !== null && payTo === operator) {
    errors.push("payTo must be distinct from the operator signer");
  }

  if (errors.length > 0) {
    throw new X402ReviewError(`X.4B review refused: ${errors.join("; ")}`);
  }

  const calldata = input.calldata.toLowerCase() as Hex;
  const review: X402TransactionReview = {
    state: "REVIEWED",
    chainId: X402_REVIEW_CHAIN_ID,
    network,
    token: token as Address,
    amount: input.amount,
    payTo: payTo as Address,
    destination: destination as Address,
    calldata,
    calldataDigest: keccak256(calldata),
    action: input.action.trim(),
    facilitator: facilitator as Address,
    operator: operator as Address,
    reviewedAt: Math.floor(Date.now() / 1000),
  };
  return deepFreeze(review);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
  }
  return value;
}

export interface X402ReviewReassert {
  chainId: number | string;
  token: string;
  amount: bigint;
  payTo: string;
  destination: string;
  calldata: string;
}

export function advanceX402TransactionReview(
  review: X402TransactionReview,
  to: X402ReviewState,
  reassert?: X402ReviewReassert
): X402TransactionReview {
  const fromIndex = X402_REVIEW_STATES.indexOf(review.state);
  const toIndex = X402_REVIEW_STATES.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) {
    throw new X402ReviewError(`unknown review state`);
  }
  if (toIndex !== fromIndex + 1) {
    throw new X402ReviewError(
      `review must advance one state at a time; cannot go ${review.state} -> ${to}`
    );
  }
  if (fromIndex === 0 && reassert !== undefined) {
    const errors: string[] = [];
    const safeAddress = (value: string): string | null => {
      try {
        return ADDRESS_RE.test(value) ? getAddress(value) : null;
      } catch {
        return null;
      }
    };
    try {
      if (getX402Network(reassert.chainId).chainId !== review.chainId) errors.push("chain");
    } catch {
      errors.push("chain");
    }
    if (safeAddress(reassert.token) !== review.token) errors.push("token");
    if (reassert.amount !== review.amount) errors.push("amount");
    if (safeAddress(reassert.payTo) !== review.payTo) errors.push("payTo");
    if (safeAddress(reassert.destination) !== review.destination) errors.push("destination");
    if (
      typeof reassert.calldata !== "string" ||
      reassert.calldata.toLowerCase() !== review.calldata
    ) {
      errors.push("calldata");
    }
    if (errors.length > 0) {
      throw new X402ReviewError(
        `consent re-verification refused — action changed since review: ${errors.join(", ")}`
      );
    }
  }
  if (to === "SIGNED" || to === "BROADCAST" || to === "CONFIRMED") {
    throw new X402ReviewError(
      `state ${to} requires the explicit operator consent boundary that lives outside this module`
    );
  }
  return deepFreeze({ ...review, state: to });
}

export function x402ReviewToJson(review: X402TransactionReview): Record<string, string | number> {
  return {
    state: review.state,
    chainId: review.chainId,
    network: review.network,
    token: review.token,
    amount: review.amount.toString(),
    payTo: review.payTo,
    destination: review.destination,
    calldata: review.calldata,
    calldataDigest: review.calldataDigest,
    action: review.action,
    facilitator: review.facilitator,
    operator: review.operator,
    reviewedAt: review.reviewedAt,
  };
}

/**
 * X.4C — REAL-ACTION consent boundary. LIVE reviews are built from the real
 * action only: every field is mandatory, fixture values are rejected, and the
 * consent digest binds chain/token/amount/payTo/destination/calldata so any
 * later change invalidates the consent. This module never signs or broadcasts.
 */

export const X402_FIXTURE_CALLDATA = ("0x" + "a9059cbb" + "11".repeat(32) + "22".repeat(32)) as Hex;

export const X402_STRUCTURAL_FIXTURES: readonly Address[] = [
  getAddress("0x2E2f3d16E2f5ACD4B9A67347D7a9a4D2362c59F5"),
  getAddress("0x1B6658DdF95E87A3d56a4b609d058C0EEcEb3588"),
  getAddress("0xAbaDd7CdD799c9B48A48f1A1eF7Cb6f9CB82cc1e"),
];

export function isX402StructuralFixture(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  try {
    return X402_STRUCTURAL_FIXTURES.includes(getAddress(value));
  } catch {
    return false;
  }
}

export function isX402FixtureCalldata(value: string | undefined): boolean {
  return typeof value === "string" && value.toLowerCase() === X402_FIXTURE_CALLDATA;
}

export type X402LiveActionKind =
  "erc8183-settle" | "erc8183-dispute" | "erc8183-claim-refund" | "erc8183-hire";

export interface X402LiveAction {
  kind: X402LiveActionKind;
  chainId: number | string;
  token: string;
  amount: bigint;
  payTo: string;
  destination: string;
  calldata: string;
  facilitator: string;
  operator: string;
  jobId: bigint;
  configuredPayTo: string;
}

export function buildX402LiveReview(action: X402LiveAction): X402TransactionReview {
  const required: Array<[string, unknown]> = [
    ["kind", action.kind],
    ["chainId", action.chainId],
    ["token", action.token],
    ["amount", action.amount],
    ["payTo", action.payTo],
    ["destination", action.destination],
    ["calldata", action.calldata],
    ["facilitator", action.facilitator],
    ["operator", action.operator],
    ["jobId", action.jobId],
    ["configuredPayTo", action.configuredPayTo],
  ];
  const missing = required
    .filter(([, value]) => value === undefined || value === null)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new X402ReviewError(`live action requires all fields; missing: ${missing.join(", ")}`);
  }
  if (!X402LiveActionKindList.includes(action.kind)) {
    throw new X402ReviewError(
      `live action kind must be one of: ${X402LiveActionKindList.join(", ")}`
    );
  }
  if (
    typeof action.jobId !== "bigint" ||
    action.jobId < 1n ||
    action.jobId > 9_223_372_036_854_775_807n
  ) {
    throw new X402ReviewError("jobId must be a positive bigint job id");
  }
  if (isX402FixtureCalldata(action.calldata)) {
    throw new X402ReviewError("live review refuses fixture calldata");
  }
  if (
    isX402StructuralFixture(action.payTo) ||
    isX402StructuralFixture(action.facilitator) ||
    isX402StructuralFixture(action.operator)
  ) {
    throw new X402ReviewError("live review refuses structural fixture addresses");
  }

  let configured: Address | null = null;
  try {
    if (ADDRESS_RE.test(action.configuredPayTo)) configured = getAddress(action.configuredPayTo);
  } catch {
    configured = null;
  }
  const review = buildX402TransactionReview({
    chainId: action.chainId,
    token: action.token,
    amount: action.amount,
    payTo: action.payTo,
    destination: action.destination,
    calldata: action.calldata,
    action: `${action.kind} (LIVE/REAL action, job ${action.jobId})`,
    facilitator: action.facilitator,
    operator: action.operator,
  });
  if (configured === null || review.payTo !== configured) {
    throw new X402ReviewError("payTo must equal the configured operator merchant address");
  }
  return review;
}

const X402LiveActionKindList: readonly X402LiveActionKind[] = [
  "erc8183-settle",
  "erc8183-dispute",
  "erc8183-claim-refund",
  "erc8183-hire",
];

export interface X402Consent {
  readonly consentDigest: Hex;
  readonly reviewRef: Hex;
  readonly grantedAt: number | undefined;
  readonly state: "PINNED";
}

export function x402ConsentCanonical(review: X402TransactionReview): string {
  return [
    String(review.chainId),
    review.token,
    review.amount.toString(),
    review.payTo,
    review.destination,
    review.calldata,
  ].join("|");
}

export function pinX402Consent(review: X402TransactionReview): X402Consent {
  if (review.state !== "REVIEWED") {
    throw new X402ReviewError("consent can only be pinned to a REVIEWED live review");
  }
  const reviewRef = keccak256(stringToHex(`${review.calldataDigest}|${review.payTo}`));
  return {
    consentDigest: keccak256(stringToHex(x402ConsentCanonical(review))),
    reviewRef,
    grantedAt: undefined,
    state: "PINNED",
  };
}

export function verifyX402Consent(review: X402TransactionReview, consent: X402Consent): boolean {
  if (consent === null || typeof consent !== "object") return false;
  if (consent.state !== "PINNED" || typeof consent.consentDigest !== "string") return false;
  const currentDigest = keccak256(stringToHex(x402ConsentCanonical(review)));
  const currentRef = keccak256(stringToHex(`${review.calldataDigest}|${review.payTo}`));
  if (currentDigest !== consent.consentDigest) return false;
  if (typeof consent.reviewRef === "string" && currentRef !== consent.reviewRef) return false;
  return true;
}
