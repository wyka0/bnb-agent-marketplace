/**
 * ALTANA Phase X.2 — controlled BNB testnet x402 payment-flow verification.
 *
 * A KEYLESS, IN-PROCESS test merchant that proves the real HTTP 402 lifecycle
 * using ONLY the official @altananetwork/x402-server@0.2.0 primitives:
 *
 *   - `buildChallenge(cfg)`  -> the 402 body (B402 v2 wire shape)
 *   - `decodeXPayment(header)` -> parse/normalize the X-PAYMENT envelope
 *   - `verifyPayment(decoded, cfg, opts)` -> server-side verification boundary.
 *
 * It mirrors the official `createX402Merchant.requirePayment` flow EXCEPT that
 * it deliberately does NOT construct `createX402Merchant` (that needs a
 * facilitator `Account` + RPC + gas) and does NOT sign (that needs a Session).
 * Verification uses the pure EOA `verifyTypedData` from viem as
 * `VerifyOptions.verifySignature` because the testnet lay of the official
 * merchant (`verify.d.ts`) documents: "the pure `verifyTypedData` covers EOAs
 * only." `isContract` stays `() => false` — smart-account payers are deferred
 * to settlement (a facilitator boundary that is out of X.2 scope).
 *
 * SAFETY (unchanged from X.1):
 *   - TESTNET ONLY (chain 97). Mainnet (56) / unknown / wrong RPC are rejected.
 *   - No signing, no generated wallet/key, no transaction, no settlement, no
 *     on-chain nonce read, no facilitator, no funded wallet.
 *   - Every X-PAYMENT header you can construct here is a plain JSON payload
 *     (no private key). A forged signature NEVER verifies and is rejected by
 *     the official crypto path — the server never trusts client claims
 *     (`paid`, `paymentVerified`, txHash are ignored by decode/verify).
 *   - Fixtures are labeled TEST FIXTURE / NOT LIVE PAYMENT. A live, valid,
 *     payable payment requires an externally supplied funded BNB Testnet
 *     wallet; none exists, so the valid-payment branch is reported BLOCKED.
 *
 * This module is exercised by `x402.testnet.verify.ts` (the
 * `altana:x402:testnet:verify` runner) and is NOT exported as a public API.
 */

import {
  buildChallenge,
  decodeXPayment,
  verifyPayment,
  type ChallengeBody,
  type DecodedPayment,
  type HandleResult,
  type MerchantConfig,
} from "@altananetwork/x402-server";
import { verifyTypedData } from "viem";
import type { VerifyTypedDataParameters } from "viem";
import { selectX402Requirement } from "@altananetwork/sdk";
import type { X402Requirement } from "@altananetwork/sdk";
import {
  ALTANA_X402_CHAIN_ID as CHAIN_97,
  ALTANA_X402_NETWORK,
  AltanaX402ExecutionError,
  getX402Network,
  parsePaymentRequired,
  requestWithX402,
  X402_EXECUTION_REQUIRES_SESSION,
} from "./x402.js";
import { createX402Client } from "./x402.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Marker every fixture carries so nothing is ever mistaken for a live payment. */
export const X402_TESTNET_MARKER = "TEST FIXTURE / NOT LIVE PAYMENT" as const;

/** Protected resource served by the keyless test merchant. */
export const X402_TESTNET_RESOURCE_URL =
  "https://x402.test.example/testnet/x402/protected-resource" as const;

/**
 * TEST FIXTURE recipient — a checksummed 40-hex address that is NOT a real
 * wallet. It is used as `payTo` so the merchant config is structurally valid.
 * No funds ever move to it.
 */
export const X402_TESTNET_FIXTURE_PAYTO = "0x9bEb61C2a40D3e8bF0fe0E98ecf9A8C6E4a76543" as const;

/** Test price for one protected-resource request, in $U atomic units. */
export const X402_TESTNET_FIXTURE_PRICE = 100_000_000_000_000_000n;

// ---------------------------------------------------------------------------
// Test merchant config (pinned to chain 97 / eip3009 / $U — the confirmed
// official testnet configuration from X.1).
// ---------------------------------------------------------------------------

export interface X402TestnetMerchantConfigOptions {
  /** Override the test price (atomic units). CLI tests keep the fixture price. */
  price?: bigint;
  /** Override the quoted resource URL. */
  resourceUrl?: string;
}

/**
 * Build the validated `MerchantConfig` for the keyless test merchant. It is
 * the exact same shape `createX402Merchant` + `buildChallenge` consume, so the
 * 402 body is byte-for-byte the official challenge for this configuration.
 */
export function createX402TestnetMerchantConfig(
  opts: X402TestnetMerchantConfigOptions = {}
): MerchantConfig {
  const network = getX402Network(ALTANA_X402_NETWORK);
  if (network.chainId !== CHAIN_97) {
    throw new Error("X402 testnet merchant requires chain 97; configuration refused.");
  }
  return {
    chainId: CHAIN_97,
    payTo: X402_TESTNET_FIXTURE_PAYTO,
    price: opts.price ?? X402_TESTNET_FIXTURE_PRICE,
    rails: [
      {
        rail: "eip3009",
        token: {
          address: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
          name: "United Stables",
          version: "1",
          symbol: "U",
          decimals: 18,
        },
      },
    ],
    maxTimeoutSeconds: 300,
    resource: { url: opts.resourceUrl ?? X402_TESTNET_RESOURCE_URL },
    description: X402_TESTNET_MARKER,
  };
}

// ---------------------------------------------------------------------------
// Keyless test merchant (mirrors merchant.js requirePayment minus facilitator/)
// settlement/signing — same contract, same verdict sources).
// ---------------------------------------------------------------------------

export interface X402TestnetMerchant {
  /** Raw official `MerchantConfig` this merchant was built from. */
  config: MerchantConfig;
  /**
   * Build the current 402 challenge body (official `buildChallenge`). This is
   * what a buyer receives the first time it asks for the protected resource.
   */
  challenge(): ChallengeBody;
  /**
   * Server-side payment gate with the official 402 lifecycle contract:
   *   - missing header            -> { status: 402, body: challenge() }
   *   - undecodable header        -> { status: 402, body: 402 + "invalid X-PAYMENT" }
   *   - business / crypto fail    -> { status: 402, body: 402 + "payment rejected" }
   *   - all checks pass           -> { status: 200, receipt } (requires a real,
   *                                   externally supplied funded signer; BLOCKED
   *                                   in X.2 — never reachable from a fixture).
   */
  requirePayment(header: string | null): Promise<HandleResult>;
  /**
   * Merge of two documented official helpers into one contract used by the
   * loopback demo: normalize a Request's payment header, then gate it.
   */
  guard(request: { headers: Headers }): Promise<{ response: Response | null }>;
}

/** Deterministic, clearly-labeled body a *successful* payment would return. */
export function x402TestnetPaidBody(): Record<string, unknown> {
  return {
    resource: { url: X402_TESTNET_RESOURCE_URL },
    payment: "verified",
    marker: X402_TESTNET_MARKER,
  };
}

/**
 * Create the keyless test merchant. NO facilitator, NO account, NO RPC, NO
 * settlement. Verification uses the official `verifyPayment` with the pure EOA
 * `verifyTypedData`; the in-process `seen` set mirrors merchant.js's replay
 * guard (one authorization can't settle twice in a race) and the on-chain
 * nonce remains the durable source of truth once a facilitator exists.
 */
export function createX402TestnetMerchant(
  cfg: MerchantConfig = createX402TestnetMerchantConfig()
): X402TestnetMerchant {
  const seen = new Set<string>();

  const challenge = (): ChallengeBody => buildChallenge(cfg);

  async function requirePayment(xPaymentHeader: string | null): Promise<HandleResult> {
    if (!xPaymentHeader) {
      return { status: 402, body: challenge() as unknown as Record<string, unknown> };
    }
    let decoded: DecodedPayment;
    try {
      decoded = decodeXPayment(xPaymentHeader);
    } catch (error) {
      return {
        status: 402,
        body: {
          ...(challenge() as unknown as Record<string, unknown>),
          error: `invalid X-PAYMENT: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }

    const verdict = await verifyPayment(decoded, cfg, {
      // Official pure-EOA verifier (keyless; no RPC needed). This is the
      // documented `VerifyOptions.verifySignature` EOA path of the official
      // merchant (verify.d.ts: "the pure verifyTypedData covers EOAs only").
      verifySignature: (args: VerifyTypedDataParameters) => verifyTypedData(args),
      // No contract-account check without an RPC: smart-account payers are
      // deferred to settlement — the facilitator boundary out of X.2 scope.
      isContract: () => false,
    });

    if (!verdict.ok) {
      return {
        status: 402,
        body: {
          ...(challenge() as unknown as Record<string, unknown>),
          error: `payment rejected: ${verdict.reason}`,
        },
      };
    }

    // Mirrors merchant.js replay guard: in-process nonce key, with the
    // on-chain nonce as the durable source of truth.
    const nonceKey =
      decoded.rail === "eip3009"
        ? `3009:${decoded.payer}:${decoded.authorization?.nonce}`
        : `p2:${decoded.payer}:${decoded.permit?.nonce}`;
    if (seen.has(nonceKey)) {
      return {
        status: 402,
        body: {
          ...(challenge() as unknown as Record<string, unknown>),
          error: "payment rejected: replayed authorization",
        },
      };
    }
    seen.add(nonceKey);

    // Reachable only when a real, externally supplied funded signer produced a
    // genuine signature. No such signer exists in this environment — X.2 stops
    // here and reports the mandated message instead of reaching this branch.
    return {
      status: 200,
      receipt: {
        // X.2 performs no settlement (no facilitator); this branch is only
        // reachable with a real externally supplied signed payment.
        txHash: ("0x" + "00".repeat(32)) as `0x${string}`,
        payer: decoded.payer,
        amount: verdict.amount,
        token: verdict.token,
        rail: decoded.rail,
      },
    };
  }

  async function guard(request: { headers: Headers }): Promise<{ response: Response | null }> {
    const result = await requirePayment(
      request.headers.get("X-PAYMENT") ?? request.headers.get("PAYMENT-SIGNATURE")
    );
    if (result.status === 200) return { response: null };
    return {
      response: new Response(JSON.stringify(result.body), {
        status: 402,
        headers: { "content-type": "application/json" },
      }),
    };
  }

  return { config: cfg, challenge, requirePayment, guard };
}

// ---------------------------------------------------------------------------
// Buyer-side flow helpers (still fully keyless — stop at the session boundary)
// ---------------------------------------------------------------------------

export interface X402TestnetFlowResult {
  fetchStatus: number;
  challenge: ChallengeBody;
  requirements: X402Requirement[];
  selected?: X402Requirement;
  executionBoundary: string;
}

/**
 * Drive the buyer side of the 402 lifecycle WITHOUT a signer:
 *   1. Ask the keyless merchant for the protected resource → HTTP 402 + body.
 *   2. Parse the challenge body into normalized `accepts[]` requirements.
 *   3. Select the payable option (chain 97, eip3009/$U — the only rail).
 *   4. Attempt to execute the payment with `requestWithX402` → this is the
 *      enforcement boundary: no Session, so it must throw the mandated stop
 *      message. No signature, no approval, no transaction are ever produced.
 */
export async function runX402TestnetBuyerFlow(
  merchant: X402TestnetMerchant = createX402TestnetMerchant()
): Promise<X402TestnetFlowResult> {
  const handle = createX402Client();

  const first = await merchant.requirePayment(null);
  if (first.status !== 402) {
    throw new Error("X402 testnet merchant must answer 402 when no payment header is present.");
  }
  const challenge = first.body as unknown as ChallengeBody;

  const parsed = parsePaymentRequired(challenge);
  if (!parsed.ok) {
    throw new Error(`X402 challenge failed to parse: ${parsed.reason}`);
  }

  const selected = selectX402Requirement(parsed.requirements, {
    chainId: CHAIN_97,
    preferRail: "eip3009",
  });

  let executionBoundary: string;
  try {
    await requestWithX402(handle, {
      url: X402_TESTNET_RESOURCE_URL,
      session: undefined,
    });
    executionBoundary = "UNEXPECTED: requestWithX402 executed without a session";
  } catch (error) {
    if (!(error instanceof AltanaX402ExecutionError)) {
      throw new Error(`X402 boundary produced the wrong error: ${String(error)}`);
    }
    executionBoundary = X402_EXECUTION_REQUIRES_SESSION;
  }

  return {
    fetchStatus: 402,
    challenge,
    requirements: parsed.requirements,
    selected,
    executionBoundary,
  };
}
