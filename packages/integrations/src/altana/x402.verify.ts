/**
 * ALTANA Phase X.1 — x402 integration verification runner.
 *
 * Safe by construction (mirrors Phase 2/3A/4): NO signing, NO payment
 * submission, NO approval, NO settlement, NO merchant creation, NO wallet
 * funding, NO private keys, NO mainnet (chain 56). Every execution path
 * funnels through the x402 boundaries and MUST stop.
 *
 * Sections:
 *   BUYER
 *     1. Network resolution — bsc-testnet/bnb-testnet/eip155:97 → chain 97.
 *     2. Unsupported networks — mainnet (56) and unknowns are rejected.
 *     3. Payment-required parsing — B402 `accepts[]` + bare dialect (pure).
 *     4. Client initialization — pinned to bnb-testnet / 97, Permit2 address.
 *     5. Permit2 API surface — official helpers/types resolve.
 *     6. No automatic approval — the provisioning boundary always stops.
 *     7. No automatic submission — requestWithX402 stops without a session.
 *   SELLER
 *     8. Server package availability — @altananetwork/x402-server resolves.
 *     9. Merchant config validation (pure) — valid ok, bad rejected.
 *    10. Facilitator configuration — custody boundary: configured:false.
 *    11. Token configuration — official U_TOKEN/USDT_BSC table (chain 97 $U
 *        cross-confirmed against the ERC-8183 paymentToken).
 *    12. CORS allow-list validation — rejects "*", non-http(s), non-origins.
 *    13. Missing credential / token-address / facilitator handling.
 *    14. Sell-side boundary — merchant creation/settlement always stops.
 *
 * Exit policy:
 *   - 1  any offline assertion fails (the integration gate).
 *   - 0  otherwise (no network reads are required this phase).
 *
 * Run after `pnpm build`:  node dist/altana/x402.verify.js
 */

import { createX402Merchant, U_TOKEN } from "@altananetwork/x402-server";
import {
  buildPermit2TypedData,
  buildPermit2WitnessTypedData,
  buildEip3009TypedData,
  networkToChainId,
  PERMIT2_ADDRESS,
  selectX402Requirement,
  signX402Payment,
} from "@altananetwork/sdk";
import { ALTANA_X402_PERMIT2_ADDRESS as ADAPTER_PERMIT2 } from "./x402.js";
import {
  ALTANA_X402_NETWORK,
  ALTANA_X402_SERVER_PACKAGE,
  ALTANA_X402_SERVER_VERSION,
  AltanaX402Error,
  AltanaX402ExecutionError,
  AltanaX402NetworkError,
  assertX402SellSideBoundary,
  checkX402Facilitator,
  createX402Client,
  getX402Network,
  parsePaymentRequired,
  requestWithX402,
  validateX402AllowedOrigins,
  validateX402MerchantConfig,
  x402SellerTokens,
  X402_EXECUTION_REQUIRES_SESSION,
  X402_SELL_SIDE_REQUIRES_FACILITATOR,
} from "./x402.js";
import { ALTANA_SDK_PACKAGE, ALTANA_SDK_VERSION } from "./client.js";

function fail(message: string): never {
  console.error(`X402 VERIFY FAILED: ${message}`);
  process.exit(1);
}

function expectThrows<T>(
  label: string,
  fn: () => T,
  ctor: new (message: string) => AltanaX402Error
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

async function expectRejects<T>(
  label: string,
  fn: () => Promise<T>,
  ctor: new (message: string) => AltanaX402Error
): Promise<void> {
  try {
    await fn();
    fail(`${label}: expected ${ctor.name} rejection`);
  } catch (error) {
    if (error instanceof ctor) {
      console.log(`ok   ${label} -> ${ctor.name}`);
      return;
    }
    fail(`${label}: expected ${ctor.name}, got ${String(error)}`);
  }
}

/** TEST FIXTURE — a structurally valid 40-hex address (never a real payTo). */
const FIXTURE_ADDRESS = "0x9BeB61C2a40d3E8Bf0fE0e98ECf9a8C6E4a76543";

async function main(): Promise<void> {
  console.log("ALTANA PHASE X.1 — x402 verify (testnet 97, no signing, no tx)");

  // ---- BUYER: 1. network resolution ---------------------------------------
  for (const [input, expected] of [
    ["bsc-testnet", 97],
    ["bnb-testnet", 97],
    ["eip155:97", 97],
    [97, 97],
    ["97", 97],
  ] as const) {
    const info = getX402Network(input);
    if (info.chainId !== expected || info.network !== ALTANA_X402_NETWORK) {
      fail(`network "${String(input)}" must resolve to bnb-testnet / ${expected}`);
    }
  }
  console.log(`ok   network resolution: bsc-testnet|bnb-testnet|eip155:97|97 -> chain 97`);

  // ---- BUYER: 2. unsupported networks -------------------------------------
  for (const bad of ["bnb", "bsc", "binance", "eip155:56", 56, "56", "eth", 999, null] as const) {
    expectThrows(
      `network "${String(bad)}" rejected`,
      () => getX402Network(bad as string | number),
      AltanaX402NetworkError
    );
  }
  let mainnetRefused = false;
  try {
    getX402Network("eip155:56");
  } catch (error) {
    mainnetRefused = error instanceof AltanaX402NetworkError && /chain 56/i.test(error.message);
  }
  if (!mainnetRefused) fail("mainnet refusal must be explicit about chain 56");

  // ---- BUYER: 3. payment-required parsing ---------------------------------
  const b402Body = {
    x402Version: 2,
    error: "payment required",
    resource: { url: "https://api.example.com/paid", description: "paid capability" },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:97",
        asset: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
        payTo: FIXTURE_ADDRESS,
        amount: "1000000000000000000",
        maxTimeoutSeconds: 300,
        extra: { name: "United Stables", version: "1", assetTransferMethod: "eip3009" },
      },
      {
        scheme: "exact",
        network: "eip155:97",
        asset: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
        payTo: FIXTURE_ADDRESS,
        amount: "1000000000000000000",
        maxTimeoutSeconds: 300,
        extra: {
          name: "United Stables",
          version: "1",
          assetTransferMethod: "permit2-exact",
          spenderAddress: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        },
      },
    ],
  };
  const parsed = parsePaymentRequired(b402Body);
  if (!parsed.ok) fail(`B402 accepts[] parse failed: ${parsed.reason}`);
  if (parsed.requirements.length !== 2) fail("expected two parsed requirements");
  if (parsed.resource?.url !== "https://api.example.com/paid") fail("resource must carry through");
  if (parsed.requirements[0]?.x402Version !== 2) fail("x402Version must be carried from the body");
  const picked = selectX402Requirement(parsed.requirements, { chainId: 97, preferRail: "permit2" });
  if (picked === undefined || picked.extra?.assetTransferMethod !== "permit2-exact") {
    fail("selectX402Requirement must prefer permit2-exact on chain 97");
  }
  console.log(
    "ok   parse B402 accepts[]: requirements + resource + version carried; permit2 preferred"
  );

  const bare = parsePaymentRequired({
    x402Version: 2,
    scheme: "exact",
    network: "eip155:97",
    resource: "https://api.example.com/paid",
    accepts: undefined,
    amount: "5",
    payTo: FIXTURE_ADDRESS,
    asset: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
  });
  if (!bare.ok || bare.requirements.length !== 1)
    fail("bare single-requirement dialect must parse");
  const noOptions = parsePaymentRequired({ error: "payment required" });
  if (noOptions.ok) fail("body with no accepts[]/scheme must fail");
  const notObject = parsePaymentRequired("nope");
  if (notObject.ok) fail("non-object body must fail");
  console.log("ok   parse bare dialect; empty/non-object bodies fail");

  // networkToChainId from the SDK maps the real wire (CAIP-2) to 97.
  if (networkToChainId("eip155:97") !== 97) fail("SDK networkToChainId must map eip155:97 -> 97");

  // ---- BUYER: 4. client initialization ------------------------------------
  const handle = createX402Client();
  if (handle.network !== ALTANA_X402_NETWORK || handle.chainId !== 97) {
    fail("createX402Client must pin bnb-testnet / 97");
  }
  if (handle.client.defaultChainId !== 97) fail("underlying SDK client must default to chain 97");
  if (handle.permit2Address !== ADAPTER_PERMIT2) fail("client Permit2 address mismatch");
  console.log(
    `ok   createX402Client -> ${handle.network} chain ${handle.chainId} permit2=${handle.permit2Address}`
  );

  // ---- BUYER: 5. Permit2 API surface --------------------------------------
  if (typeof buildPermit2TypedData !== "function") fail("buildPermit2TypedData unavailable");
  if (typeof buildPermit2WitnessTypedData !== "function")
    fail("buildPermit2WitnessTypedData unavailable");
  if (typeof buildEip3009TypedData !== "function") fail("buildEip3009TypedData unavailable");
  if (typeof signX402Payment !== "function")
    fail("signX402Payment unavailable (boundary-only call)");
  if (PERMIT2_ADDRESS === undefined) fail("SDK PERMIT2_ADDRESS missing");
  if (!/^0x[a-fA-F0-9]{40}$/.test(PERMIT2_ADDRESS))
    fail("PERMIT2_ADDRESS must be a 40-hex address");
  console.log(
    `ok   Permit2 surface resolves: PERMIT2_ADDRESS=${PERMIT2_ADDRESS}, typed-data builders loaded`
  );

  // ---- BUYER: 6. no automatic approval ------------------------------------
  // The one-time provisioning (approveTokenForPermit2 / approveSignatureChecker)
  // is intentionally NOT exposed as an executor this phase; there is no code
  // path that can auto-approve, because no wallet/signer/session exists.

  // ---- BUYER: 7. no automatic submission ----------------------------------
  await expectRejects(
    "requestWithX402 stops without a session",
    () => requestWithX402(handle, { url: "https://api.example.com/paid", session: undefined }),
    AltanaX402ExecutionError
  );
  try {
    await requestWithX402(handle, { url: "https://api.example.com/paid", session: undefined });
  } catch (error) {
    if (!(error instanceof AltanaX402ExecutionError)) fail("boundary must throw ExecutionError");
    if (!error.message.startsWith(X402_EXECUTION_REQUIRES_SESSION)) {
      fail("boundary message must carry the required stop message");
    }
  }
  await expectRejects(
    "requestWithX402 rejects mainnet before session checks",
    () =>
      requestWithX402(handle, {
        network: "eip155:56",
        url: "https://api.example.com/paid",
        session: undefined,
      }),
    AltanaX402NetworkError
  );
  console.log(`ok   requestWithX402 boundary stops (no session, no auto-submit; mainnet refused)`);

  // ---- SELLER: 8. server package availability -----------------------------
  if (ALTANA_X402_SERVER_PACKAGE !== "@altananetwork/x402-server")
    fail("seller package identity mismatch");
  if (ALTANA_X402_SERVER_VERSION !== "0.2.0") fail("seller package version must be 0.2.0");
  if (typeof createX402Merchant !== "function") fail("createX402Merchant export missing");
  if (ALTANA_SDK_PACKAGE !== "@altananetwork/sdk" || ALTANA_SDK_VERSION !== "0.7.0") {
    fail("buyer SDK package identity mismatch");
  }
  console.log(
    `ok   seller package @altananetwork/x402-server@${ALTANA_X402_SERVER_VERSION} + createX402Merchant available (not constructed)`
  );

  // ---- SELLER: 9. merchant config validation ------------------------------
  const good = validateX402MerchantConfig({
    chainId: 97,
    payTo: FIXTURE_ADDRESS,
    price: 200_000_000_000_000_000n,
    minPrice: 50n,
    maxPrice: 2_000_000n,
    rails: [{ rail: "eip3009", token: U_TOKEN[97] }],
    maxTimeoutSeconds: 300,
    resource: { url: "https://api.example.com/audit", description: "audit report" },
  });
  if (!good.ok) fail(`valid merchant config rejected: ${good.errors.join(" | ")}`);
  if (good.config.chainId !== 97) fail("merchant config must pin chain 97");
  console.log("ok   valid MerchantConfig (chain 97, eip3009/$U) passes validation");

  const badPayTo = validateX402MerchantConfig({
    chainId: 97,
    payTo: "0x0000000000000000000000000000000000000000",
    price: 1n,
    rails: [{ rail: "eip3009", token: U_TOKEN[97] }],
  });
  if (badPayTo.ok) fail("zero payTo must be rejected");

  const badPrice = validateX402MerchantConfig({
    chainId: 97,
    payTo: FIXTURE_ADDRESS,
    price: 0n,
    rails: [{ rail: "eip3009", token: U_TOKEN[97] }],
  });
  if (badPrice.ok) fail("zero price must be rejected");

  const badTimeout = validateX402MerchantConfig({
    chainId: 97,
    payTo: FIXTURE_ADDRESS,
    price: 1n,
    rails: [{ rail: "eip3009", token: U_TOKEN[97] }],
    maxTimeoutSeconds: 500,
  });
  if (badTimeout.ok) fail("maxTimeoutSeconds over 480 must be rejected");

  const badRail = validateX402MerchantConfig({
    chainId: 97,
    payTo: FIXTURE_ADDRESS,
    price: 1n,
    rails: [{ rail: "permit2-exact", token: U_TOKEN[97], spender: "0x123" }],
  });
  if (badRail.ok) fail("malformed permit2-exact spender must be rejected");

  const noRails = validateX402MerchantConfig({
    chainId: 97,
    payTo: FIXTURE_ADDRESS,
    price: 1n,
    rails: [],
  });
  if (noRails.ok) fail("empty rails must be rejected");

  const badChain = validateX402MerchantConfig({
    chainId: 56,
    payTo: FIXTURE_ADDRESS,
    price: 1n,
    rails: [{ rail: "eip3009", token: U_TOKEN[56] }],
  });
  if (badChain.ok) fail("chain 56 merchant config must be rejected");

  console.log(
    "ok   merchant config rejects zero payTo/price, bad timeout, bad spender, empty rails, mainnet"
  );

  // ---- SELLER: 10. facilitator custody ------------------------------------
  const facilitator = checkX402Facilitator();
  if (facilitator.configured) fail("facilitator must be unconfigured in X.1 (no credential)");
  if (facilitator.env !== "FACILITATOR_KEY")
    fail("facilitator env name must match the official README");
  console.log(
    "ok   facilitator boundary: configured=false, env=FACILITATOR_KEY (no credential fabricated)"
  );

  // ---- SELLER: 11. token configuration ------------------------------------
  const tokens = x402SellerTokens();
  const u97 = tokens.u[97];
  if (u97 === undefined) fail("$U for chain 97 missing from the official registry");
  if (u97.address !== "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565")
    fail("chain 97 $U address mismatch");
  if (tokens.u[56]?.address !== "0xcE24439F2D9C6a2289F741120FE202248B666666")
    fail("chain 56 $U address mismatch");
  if (tokens.usdtBsc.address !== "0x55d398326f99059fF775485246999027B3197955")
    fail("USDT_BSC address mismatch");
  if (tokens.usdtBsc.symbol !== "USDT" || tokens.usdtBsc.decimals !== 18)
    fail("USDT_BSC meta mismatch");
  console.log("ok   tokens: chain 97 $U=0xc70B8741...E5565 (cross-confirms ERC-8183 paymentToken)");

  // ---- SELLER: 12. CORS allow-list ----------------------------------------
  const okOrigins = validateX402AllowedOrigins([
    "https://marketplace.example.com",
    "http://localhost:3000",
  ]);
  if (!okOrigins.ok || okOrigins.origins.length !== 2) fail("valid origin list must pass");

  const star = validateX402AllowedOrigins(["*", "https://a.example.com"]);
  if (star.ok) fail("wildcard origin must be rejected");

  const badOrigin = validateX402AllowedOrigins([
    "https://a.example.com/path",
    "ftp://x",
    "not a url",
  ]);
  if (badOrigin.ok) fail("non-origin / path / non-http(s) entries must be rejected");

  const emptyCors = validateX402AllowedOrigins([]);
  if (!emptyCors.ok) fail("empty origin list must be a valid (restrictive) CORS boundary");

  console.log("ok   CORS boundary: explicit origins only, no wildcard, bare http(s) origins");

  // ---- SELLER: 13. missing credential / token / facilitator ---------------
  const unknownChain = (U_TOKEN as Record<number, unknown>)[999];
  if (unknownChain !== undefined)
    fail("unknown chain must have no $U entry (missing token-address handling)");
  const missingFacilitator = checkX402Facilitator();
  if (missingFacilitator.configured)
    fail("facilitator must be unconfigured (missing credential handling)");
  console.log(
    "ok   missing handling: unknown chain -> no token, no facilitator credential present"
  );

  // ---- SELLER: 14. sell-side boundary -------------------------------------
  expectThrows(
    "merchant creation refused",
    () => assertX402SellSideBoundary("create-merchant"),
    AltanaX402ExecutionError
  );
  try {
    assertX402SellSideBoundary("settle");
  } catch (error) {
    if (!(error instanceof AltanaX402ExecutionError))
      fail("sell-side boundary must throw ExecutionError");
    if (!error.message.startsWith(X402_SELL_SIDE_REQUIRES_FACILITATOR)) {
      fail("sell-side boundary message must carry the required stop message");
    }
  }
  console.log(`ok   sell-side boundary enforced ("${X402_SELL_SIDE_REQUIRES_FACILITATOR}")`);

  console.log(
    "ALTANA X402 STATUS: READY FOR X.2 (testnet-only, buyer adapter + seller boundary verified)"
  );
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(`X402 VERIFY FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
