/**
 * ALTANA Phase X.3 — deterministic TEST-FIXTURE marketplace service.
 *
 * This is the runner-only fixture for the marketplace service verification
 * (`altana:x402:marketplace:verify`). It wires `createAltanaMarketplaceService`
 * to:
 *
 *   - A fixture agent registry whose entries are EXPLICITLY labeled
 *     `TEST FIXTURE / NOT LIVE MARKETPLACE DATA`. No real production agent is
 *     invented; the slugs cannot collide with any live listing requirements.
 *   - The existing keyless x402 testnet merchant config (chain 97, eip3009,
 *     $U `0xc70B…E5565`, TEST FIXTURE payTo/price/resource) so the payment
 *     requirement is derived ONLY from configured/verified values.
 *   - A `MarketplacePaymentVerifier` that delegates to the existing keyless
 *     x402 merchant's `requirePayment` through the official `HandleResult`
 *     mapping. This is REUSE of the Phase X.2 adapter — no duplicate
 *     challenge/parse/verify code lives here.
 *
 * The fixture verifier only ever returns `ok` for a clearly-labeled
 * TEST-FIXTURE verified receipt shape (see `buildFixtureVerifiedResult`); a
 * genuinely signed live payment stays BLOCKED (no signer, no key) exactly as in
 * X.2. The runner proves the acceptance path deterministically without ever
 * fabricating a live payment claim.
 */

import {
  buildMarketplacePaymentRequirement,
  createAltanaMarketplaceService,
} from "./marketplace.js";
import type {
  MarketplaceAgent,
  MarketplacePaymentVerifier,
  MarketplaceService,
  MarketplaceVerificationResult,
} from "./marketplace.js";
import { createX402TestnetMerchant, createX402TestnetMerchantConfig } from "./x402.testnet.js";
import { marketplaceVerdictFromX402Handle } from "./marketplace.js";
import { X402_TESTNET_FIXTURE_PAYTO } from "./x402.testnet.js";

/** Marker all marketplace fixtures carry — never mistaken for live data. */
export const MARKETPLACE_TESTNET_MARKER = "TEST FIXTURE / NOT LIVE MARKETPLACE DATA" as const;

/** A synthetic *already-verified* receipt shape mirroring the official path. */
export const MARKETPLACE_TESTNET_RESOURCE_URL =
  "https://x402.test.example/testnet/marketplace/protected-service" as const;

// ---------------------------------------------------------------------------
// Fixture agent registry (explicitly labeled, no fake production agents)
// ---------------------------------------------------------------------------

/** TEST FIXTURE agents — not real listings, slugs intentionally test-scoped. */
export const MARKETPLACE_TESTNET_AGENTS: readonly MarketplaceAgent[] = [
  {
    slug: "altana-test-fixture-rebalancer",
    name: "Altana Test Fixture Rebalancer (TEST FIXTURE / NOT LIVE MARKETPLACE DATA)",
    category: "rebalancing",
    chains: ["bsc"],
    partner: "altana",
    updatedAt: "2026-08-10T00:00:00.000Z",
  },
  {
    slug: "altana-test-fixture-yield",
    name: "Altana Test Fixture Yield (TEST FIXTURE / NOT LIVE MARKETPLACE DATA)",
    category: "yield",
    chains: ["opbnb"],
    partner: "altana",
    updatedAt: "2026-08-10T00:00:00.000Z",
  },
];

/** Resolver for the fixture registry (undefined ⇒ typed not-found upstream). */
export function resolveMarketplaceTestnetAgent(slug: string): MarketplaceAgent | undefined {
  return MARKETPLACE_TESTNET_AGENTS.find((agent) => agent.slug === slug);
}

// ---------------------------------------------------------------------------
// Verifier wiring (REUSE the keyless x402 merchant gate)
// ---------------------------------------------------------------------------

/**
 * The *production-shaped* verifier dependency: drives the existing keyless
 * x402 testnet merchant's `requirePayment` and normalizes the official
 * `HandleResult`. With only forged/offline fixtures this never returns `ok`
 * (no signer) — exactly the honest offline behavior.
 */
export function createMarketplaceTestnetVerifier(): MarketplacePaymentVerifier {
  const merchant = createX402TestnetMerchant();
  return async (header) =>
    marketplaceVerdictFromX402Handle(await merchant.requirePayment(header ?? null));
}

/**
 * A deterministic TEST-FIXTURE *verified* verdict for the acceptance check.
 * Mirrors what the official x402 gate returns when a genuine signature has
 * been verified server-side (a `status:200` receipt). It is NOT a live payment
 * and carries the fixture marker; it proves the acceptance state machine.
 */
export function buildFixtureVerifiedResult(): MarketplaceVerificationResult {
  return {
    ok: true,
    payer: X402_TESTNET_FIXTURE_PAYTO,
    amount: createX402TestnetMerchantConfig().price,
    token: createX402TestnetMerchantConfig().rails[0]?.token.address ?? "0x",
    rail: "eip3009",
  };
}

// ---------------------------------------------------------------------------
// Test-service factory
// ---------------------------------------------------------------------------

export interface MarketplaceTestnetServiceOptions {
  /**
   * Explicit sell-side config control:
   *   - omitted            → the default TEST FIXTURE merchant config
   *   - a MerchantConfig   → that config
   *   - `null`             → NO sell-side config (proves the `unconfigured`
   *                          configuration-blocked state; no value substituted)
   */
  merchant?: ReturnType<typeof createX402TestnetMerchantConfig> | null;
  /** Override the verifier (defaults to the keyless x402 merchant gate). */
  verifier?: MarketplacePaymentVerifier;
}

/**
 * Deterministic marketplace service for the verify runner. When `merchant` is
 * omitted the configured/verified TEST FIXTURE config is used so `describe`/
 * `requestService` produce a real requirement; pass `merchant: null` for the
 * configuration-blocked (`unconfigured`) checks — the sell-side config is then
 * genuinely absent and nothing is substituted.
 */
export function createMarketplaceTestnetService(
  opts: MarketplaceTestnetServiceOptions = {}
): MarketplaceService {
  const merchant =
    opts.merchant === null ? undefined : (opts.merchant ?? createX402TestnetMerchantConfig());
  return createAltanaMarketplaceService({
    resolveAgent: resolveMarketplaceTestnetAgent,
    ...(merchant !== undefined ? { merchant } : {}),
    verifier: opts.verifier ?? createMarketplaceTestnetVerifier(),
  });
}

/** The TEST-FIXTURE merchant config used by the fixture service. */
export function marketplaceTestnetMerchantConfig() {
  return createX402TestnetMerchantConfig();
}

/** The payment requirement the fixture merchant yields (for assertions). */
export function marketplaceTestnetRequirement() {
  return buildMarketplacePaymentRequirement(createX402TestnetMerchantConfig());
}

export { X402_TESTNET_FIXTURE_PAYTO as MARKETPLACE_TESTNET_PAYTO };
