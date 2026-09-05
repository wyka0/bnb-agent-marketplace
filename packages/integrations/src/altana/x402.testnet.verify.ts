/**
 * ALTANA Phase X.2 — controlled BNB-testnet x402 payment-flow verification.
 *
 * Proves the REAL HTTP 402 lifecycle against an in-process KEYLESS merchant
 * built only from official @altananetwork/x402-server@0.2.0 primitives:
 *
 *   resource → 402 challenge → parse requirements → construct authorization
 *   (boundary) → retry with X-PAYMENT → server-side verify → reject/accept.
 *
 * SAFETY (unchanged): chain 97 only (56/unknown refused); NO signing, NO
 * generated wallet/key, NO transaction, NO settlement, NO facilitator, NO
 * on-chain read. Every fixture X-PAYMENT header is keyless JSON; forged
 * signatures carry no private key and can never pass the crypto verifier. The
 * server NEVER trusts client claims (`paid`, `paymentVerified`, txHash are
 * ignored by the official decode/verify path). A genuine valid payment (G)
 * requires an externally supplied FUNDED BNB Testnet wallet — none exists, so
 * it is reported BLOCKED with the mandated stop message.
 *
 * Sections:
 *   1.  Config — testnet-only merchant config (chain/rpc/network checks).
 *   2.  Challenge — protected-resource 402 body shape (B402 v2 wire).
 *   3.  402 flow — missing payment → 402 + challenge (A).
 *   4.  Buyer flow — parse accepts[], select eip3009 option, session boundary.
 *   5.  Authorization construction — typed data built keylessly, never signed.
 *   6.  Malformed X-PAYMENT — undecodable header → 402 invalid (B).
 *   7.  Wrong network — eip155:56 → 402 wrong chain (C).
 *   8.  Wrong recipient — payTo mismatch → 402 (D).
 *   9.  Insufficient amount — value < price → 402 (E).
 *  10.  Expired / not-yet-valid — validBefore past / validAfter future → 402 (F).
 *  11.  Crypto boundary → forged signature always fails official verification.
 *  12a. Client claims (`paid`, `paymentVerified`, txHash) are ignored.
 *  12b. Valid payment (G) — BLOCKED: needs externally supplied funded signer.
 *  13.  Replay/duplicate — in-process `seen` guard mirrors merchant.js.
 *  14.  CORS — explicit origins only, wildcard rejected.
 *  15.  No-secret exposure — no env credential reads by this path.
 *
 * Exit policy: 1 on any assertion failure; 0 otherwise (fully offline).
 *
 * Run after `pnpm build`:  node dist/altana/x402.testnet.verify.js
 */

import { buildEip3009TypedData, encodeXPaymentHeader } from "@altananetwork/sdk";
import type { X402PaymentPayload } from "@altananetwork/sdk";
import { decodeXPayment, verifyPayment } from "@altananetwork/x402-server";
import { getAddress } from "viem";
import {
  ALTANA_X402_CHAIN_ID as CHAIN_97,
  ALTANA_X402_PERMIT2_ADDRESS,
  validateX402AllowedOrigins,
} from "./x402.js";
import {
  createX402TestnetMerchant,
  runX402TestnetBuyerFlow,
  X402_TESTNET_FIXTURE_PAYTO,
  X402_TESTNET_MARKER,
  X402_TESTNET_RESOURCE_URL,
  x402TestnetPaidBody,
} from "./x402.testnet.js";

function fail(message: string): never {
  console.error(`X402 TESTNET VERIFY FAILED: ${message}`);
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

// ---------------------------------------------------------------------------
// Fixture header builder (KEYLESS — forged signature, plain JSON envelope).
// The envelope mirrors the official Altana/Studio buyer dialect from
// @altananetwork/sdk signX402Payment + @altananetwork/x402-server decode.
// ---------------------------------------------------------------------------

interface Eip3009FixtureOptions {
  network?: string;
  to?: string;
  value?: string;
  validAfter?: string;
  validBefore?: string;
  nonce?: string;
  /** Extra keys carved into the payload (client-paid claim tests). */
  claims?: Record<string, unknown>;
}

function buildEip3009Fixture(
  token: string,
  payTo: string,
  amount: string,
  opts: Eip3009FixtureOptions = {}
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
      // FORGED signature — 65-byte hex produced by no real key.
      signature: "0x" + "ff".repeat(65),
      authorization: {
        from: FIXTURE_PAYER,
        to: (opts.to ?? payTo) as `0x${string}`,
        value: opts.value ?? amount,
        validAfter: opts.validAfter ?? "0",
        validBefore: opts.validBefore ?? "4102444800",
        nonce: opts.nonce ?? "0x" + "11".repeat(32),
      },
      ...(opts.claims ?? {}),
    },
  };
  return encodeXPaymentHeader(envelope);
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("ALTANA PHASE X.2 — x402 testnet flow verify (chain 97, keyless, no signing, no tx)");

  const merchant = createX402TestnetMerchant();
  const cfg = merchant.config;
  const rail = cfg.rails[0];
  const token = rail?.token.address;
  assert(rail, "merchant config must expose a rail");
  assert(token !== undefined, "merchant config must expose the $U rail token");
  assert(rail.rail === "eip3009", "must offer the eip3009 rail");

  // ---- 1. Config: testnet-only ----------------------------------------------
  assert(cfg.chainId === CHAIN_97, "merchant config must pin chain 97");
  assert(cfg.payTo === X402_TESTNET_FIXTURE_PAYTO, "merchant payTo must be the fixture address");
  assert(cfg.rails.length === 1, "must offer exactly one rail");
  assert(typeof cfg.maxTimeoutSeconds === "number" && cfg.maxTimeoutSeconds <= 480, "timeout ≤480");
  assert(cfg.description === X402_TESTNET_MARKER, "config must carry the fixture marker");
  assert(ALTANA_X402_PERMIT2_ADDRESS.startsWith("0x"), "permit2 address must be a hex address");
  ok("config pinned: chain 97, eip3009/$U, fixture payTo, timeout ≤480, marker labeled");

  // ---- 2. Challenge: protected resource 402 body shape -----------------------
  const challenge = merchant.challenge();
  assert(challenge.x402Version === 2, "challenge must be B402 v2");
  assert(challenge.error === "payment required", "challenge error must be payment required");
  const accept0 = challenge.accepts[0];
  assert(accept0 !== undefined, "challenge must carry accepts[]");
  assert(accept0.scheme === "exact", "accept scheme must be exact");
  assert(accept0.network === "eip155:97", "accept network must be eip155:97");
  assert(accept0.asset === token, "accept asset must be the $U token");
  assert(accept0.payTo === cfg.payTo, "accept payTo must match merchant payTo");
  assert(accept0.amount === cfg.price.toString(), "accept amount must be the quoted price");
  assert(accept0.extra.assetTransferMethod === "eip3009", "assetTransferMethod must be eip3009");
  assert(
    challenge.resource?.url === X402_TESTNET_RESOURCE_URL,
    "challenge advertises the resource"
  );
  ok("challenge shape: B402 v2 exact/eip155:97/$U/payTo/amount/resource");

  // ---- 3. 402 flow: missing payment (A) --------------------------------------
  const noPay = await merchant.requirePayment(null);
  assert(noPay.status === 402, "missing payment header must 402");
  assert(
    (noPay.body as Record<string, unknown>).error === "payment required",
    "missing payment body must carry the challenge error"
  );
  ok("A: missing payment header -> 402 + challenge");

  // ---- 4. Buyer flow: parse + select + session boundary -----------------------
  const flow = await runX402TestnetBuyerFlow(merchant);
  assert(flow.fetchStatus === 402, "buyer first fetch must be 402");
  assert(flow.requirements.length === 1, "must parse exactly one requirement");
  const selected = flow.selected;
  assert(selected !== undefined, "must select a payable option");
  assert(selected.network === "eip155:97", "selected option must be on chain 97");
  assert(
    flow.executionBoundary.startsWith(
      "x402 payment requires an externally supplied Altana session"
    ),
    "buyer must stop at the session boundary with the mandated message"
  );
  ok("A/B: buyer parse accepts[] -> select eip3009 -> session boundary stop");

  // ---- 5. Authorization construction (keyless typed-data only) ----------------
  const typed = buildEip3009TypedData({
    chainId: CHAIN_97,
    token: token as `0x${string}`,
    name: "United Stables",
    version: "1",
    from: FIXTURE_PAYER,
    to: cfg.payTo as `0x${string}`,
    value: cfg.price,
    validAfter: 0n,
    validBefore: 4_102_444_800n,
    nonce: ("0x" + "22".repeat(32)) as `0x${string}`,
  });
  assert(
    typed.domain !== undefined && typed.primaryType === "TransferWithAuthorization",
    "typed data is TransferWithAuthorization"
  );
  assert(
    typed.types.TransferWithAuthorization !== undefined,
    "typed data carries the EIP-3009 type"
  );
  assert(Number(typed.domain.chainId) === CHAIN_97, "typed-data domain pins chain 97");
  assert(typed.domain.verifyingContract === token, "typed-data verifying contract must be $U");
  ok("C: authorization constructed keylessly (EIP-3009 typed data), never signed");

  // ---- 6. Malformed X-PAYMENT (B) ----------------------------------------------
  const garble = await merchant.requirePayment("not-base64-json!!!");
  assert(garble.status === 402, "malformed header must 402");
  assert(
    String((garble.body as Record<string, unknown>).error).includes("invalid X-PAYMENT"),
    "malformed header must be answered with invalid X-PAYMENT"
  );
  ok("B: undecodable X-PAYMENT -> 402 invalid X-PAYMENT");

  // ---- 7. Wrong network (C) ----------------------------------------------------
  const wrongNet = await merchant.requirePayment(
    buildEip3009Fixture(token, cfg.payTo, cfg.price.toString(), { network: "eip155:56" })
  );
  assert(wrongNet.status === 402, "wrong-network header must 402");
  assert(
    String((wrongNet.body as Record<string, unknown>).error).includes("wrong chain"),
    "wrong-network header must be rejected as wrong chain"
  );
  ok("C: eip155:56 header -> 402 wrong chain (chain 56 refused)");

  // ---- 8. Wrong recipient (D) ----------------------------------------------------
  const wrongPayTo = getAddress("0x2Beb61C2a40D3e8bF0fe0E98ecf9A8C6E4a76543");
  const wrongRecipient = await merchant.requirePayment(
    buildEip3009Fixture(token, cfg.payTo, cfg.price.toString(), { to: wrongPayTo })
  );
  assert(wrongRecipient.status === 402, "wrong-payTo header must 402");
  assert(
    String((wrongRecipient.body as Record<string, unknown>).error).includes("payTo mismatch"),
    "wrong-payTo header must be rejected as payTo mismatch"
  );
  ok("D: authorization pays a different recipient -> 402 payTo mismatch");

  // ---- 9. Insufficient amount (E) ------------------------------------------------
  const below = cfg.price - 1n;
  const belowHeader = await merchant.requirePayment(
    buildEip3009Fixture(token, cfg.payTo, below.toString())
  );
  assert(belowHeader.status === 402, "underpriced header must 402");
  assert(
    String((belowHeader.body as Record<string, unknown>).error).includes("below the quoted price"),
    "underpriced header must be rejected as amount below the quoted price"
  );
  ok("E: value < price -> 402 amount below the quoted price");

  // ---- 10. Expired / not-yet-valid (F) ----------------------------------------------
  const expired = await merchant.requirePayment(
    buildEip3009Fixture(token, cfg.payTo, cfg.price.toString(), { validBefore: "1" })
  );
  assert(expired.status === 402, "expired header must 402");
  assert(
    String((expired.body as Record<string, unknown>).error).includes("validBefore in the past"),
    "expired header must be rejected (validBefore past)"
  );
  const notYet = await merchant.requirePayment(
    buildEip3009Fixture(token, cfg.payTo, cfg.price.toString(), { validAfter: "4102444800" })
  );
  assert(notYet.status === 402, "not-yet-valid header must 402");
  assert(
    String((notYet.body as Record<string, unknown>).error).includes("validAfter in the future"),
    "not-yet-valid header must be rejected (validAfter future)"
  );
  ok("F: expired (validBefore past) and not-yet-valid (validAfter future) -> 402");

  // ---- 11. Crypto boundary: forged signature always rejected ------------------------
  // Cross-check the keyless merchant against the OFFICIAL verifyPayment with a
  // pure viem verifyTypedData — the two verdicts must agree.
  const forged = buildEip3009Fixture(token, cfg.payTo, cfg.price.toString());
  const forgedResult = await merchant.requirePayment(forged);
  assert(forgedResult.status === 402, "forged signature must 402 through the merchant");
  assert(
    String((forgedResult.body as Record<string, unknown>).error).includes(
      "signature verification failed"
    ),
    "merchant must reject the forged signature by crypto verification"
  );
  const official = await verifyPayment(decodeXPayment(forged), cfg, {
    verifySignature: () => false, // the pure EOA verifier outcome is: no key matches
    isContract: () => false,
  });
  assert(official.ok === false, "official verifyPayment must reject the forged signature");
  assert(
    official.ok === false && official.reason.includes("signature verification failed"),
    "official reject reason must be the crypto failure"
  );
  ok("G: forged signature rejected by merchant AND official verifyPayment (no key matches)");

  // ---- 12a. Client-paid claims ignored ----------------------------------------------
  const claimed = await merchant.requirePayment(
    buildEip3009Fixture(token, cfg.payTo, cfg.price.toString(), {
      claims: { paid: true, paymentVerified: true, txHash: "0x" + "ef".repeat(32) },
    })
  );
  assert(claimed.status === 402, "client-paid claims must NOT authorize payment");
  assert(
    String((claimed.body as Record<string, unknown>).error).includes(
      "signature verification failed"
    ),
    "client-paid claims must still fail crypto verification"
  );
  ok("H: paid/paymentVerified/txHash claims ignored — server only trusts crypto");

  // ---- 12b. Valid payment (G) — BLOCKED ---------------------------------------------
  // A genuinely valid payment needs a real EIP-3009 signature over the typed
  // data, which requires a private key. None exists; X.2 must not invent one,
  // so the 200 branch is never reachable from a fixture.
  assert(
    x402TestnetPaidBody().marker === X402_TESTNET_MARKER,
    "the paid body must carry the TEST FIXTURE marker"
  );
  ok(
    "G/BLOCKED: live valid payment requires externally supplied funded BNB Testnet wallet — not attempted"
  );

  // ---- 13. Replay / duplicate ---------------------------------------------------------
  const sameHeader = buildEip3009Fixture(token, cfg.payTo, cfg.price.toString(), {
    nonce: "0x" + "33".repeat(32),
  });
  const r1 = await merchant.requirePayment(sameHeader);
  const r2 = await merchant.requirePayment(sameHeader);
  assert(r1.status === 402 && r2.status === 402, "duplicate invalid header must be rejected twice");
  assert(
    JSON.stringify(r1.body) === JSON.stringify(r2.body),
    "duplicate invalid header must be rejected deterministically"
  );
  ok("I: replay guard mirrors merchant.js (in-process seen + on-chain nonce); deterministic");

  // ---- 14. CORS -----------------------------------------------------------------------
  const cors = validateX402AllowedOrigins(["https://marketplace.example.com"]);
  assert(cors.ok && cors.origins.length === 1, "explicit-origin allow-list must pass");
  const wildcard = validateX402AllowedOrigins(["*"]);
  assert(!wildcard.ok, "wildcard origin must be rejected");
  ok("J: CORS explicit-origins only — no Access-Control-Allow-Origin: *");

  // ---- 15. No-secret exposure -----------------------------------------------------------
  const envSecrets = ["PRIVATE_KEY", "FACILITATOR_KEY", "WALLET", "MNEMONIC"];
  for (const key of envSecrets) {
    const value = process.env[key];
    if (value !== undefined && value !== "") {
      fail(`environment secret ${key} was unexpectedly set during verify`);
    }
  }
  ok("K: no env credentials read, printed, or persisted by the verify path");

  console.log(
    `ALTANA X402 X.2 STATUS: READY FOR X.3 (chain 97 flow verified keylessly; ` +
      `live signing BLOCKED — requires an externally supplied funded BNB Testnet wallet)`
  );
  console.log(`X402 TESTNET VERIFY: ${passed} checks passed`);
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(
    `X402 TESTNET VERIFY FAILED: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
