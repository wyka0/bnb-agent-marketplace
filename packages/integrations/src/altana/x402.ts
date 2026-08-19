/**
 * ALTANA — x402 payment rail adapter (Phase X.1).
 *
 * BUYER (BNB testnet / chain 97 ONLY):
 *   - createX402Client      initialize the SDK client pinned to bnb-testnet (97)
 *   - getX402Network        resolve/validate the x402 network identifier (97 only)
 *   - parsePaymentRequired  parse an HTTP 402 challenge body into requirements
 *   - requestWithX402       fetch-through-payment entry (session REQUIRED)
 *   - Permit2 surface       PERMIT2_ADDRESS + one-time approval boundary
 *
 * SELLER (configuration + boundary ONLY — nothing starts a server):
 *   - ALTANA_X402_SERVER_*  official @altananetwork/x402-server package/version
 *   - x402SellerTokens      official token registry (U_TOKEN / USDT_BSC)
 *   - validateX402MerchantConfig        pure MerchantConfig validation
 *   - validateX402FacilitatorConfig     facilitator custody boundary
 *   - validateX402AllowedOrigins        CORS allow-list config boundary
 *   - assertX402SellSideBoundary        merchant creation/settlement STOP
 *
 * INTENTIONALLY ABSENT in X.1:
 *   - signing / payment submission. `requestWithX402` requires an externally
 *     supplied Altana `Session`; none exists here (no signer, no private key,
 *     no passkey). Without a session it ALWAYS stops via the execution
 *     boundary. No approval, no transaction, no settlement is ever executed.
 *   - mainnet (chain 56) is rejected for x402 this phase regardless of env.
 *   - a live sell-side merchant (needs a real `payTo` + `facilitator` EOA +
 *     `FACILITATOR_KEY` credential + a funded wallet). Only config validation
 *     and the boundary are provided; `assertX402SellSideBoundary` stops.
 *
 * All definitions trace to official sources:
 *   buyer  — docs.altana.network/sdk/x402 + @altananetwork/sdk@0.7.0 dist/x402.*
 *   seller — docs.altana.network/sdk/x402-server + @altananetwork/x402-server@0.2.0
 *            (registry-npmjs-published; pure ESM, no Bun runtime import).
 *
 * Sell-side token address result (VERIFIED, not guessed):
 *   chain 97 $U (United Stables) = U_TOKEN[97].address = 0xc70B8741...E5565,
 *   identical to the ERC-8183 paymentToken on 97 (cross-confirmed by two
 *   official sources). USDT_BSC is a MAINNET asset only (chain 56).
 */

import { PERMIT2_ADDRESS } from "@altananetwork/sdk";
import type { Client, Session, X402Requirement, X402Resource } from "@altananetwork/sdk";
import { normalizeResource, selectX402Requirement } from "@altananetwork/sdk";
import { U_TOKEN, USDT_BSC } from "@altananetwork/x402-server";
import type { MerchantConfig, RailConfig, TokenConfig } from "@altananetwork/x402-server";
import { createAltanaClient } from "./client.js";

/** Buyer-side x402 pinned network (BNB testnet). */
export const ALTANA_X402_NETWORK = "bnb-testnet" as const;
export const ALTANA_X402_CHAIN_ID = 97 as const;

/** Official seller-side package identity (installed + typechecked). */
export const ALTANA_X402_SERVER_PACKAGE = "@altananetwork/x402-server" as const;
export const ALTANA_X402_SERVER_VERSION = "0.2.0" as const;

/** Official env name the x402-server README uses for the facilitator key. */
export const X402_FACILITATOR_KEY_ENV = "FACILITATOR_KEY" as const;

/** Required stop message when x402 payment execution is attempted. */
export const X402_EXECUTION_REQUIRES_SESSION =
  "x402 payment requires an externally supplied Altana session (grantSession) with " +
  "a Permit2-approved token and approved signature checker. No payment was signed " +
  "or submitted.";

/** Required stop message when one-time Permit2 approval is attempted. */
export const X402_APPROVAL_REQUIRES_WALLET =
  "approveTokenForPermit2 / approveSignatureChecker require an externally supplied " +
  "testnet wallet + admin signer + session. No approval was executed.";

/** Required stop message when a sell-side merchant would be created. */
export const X402_SELL_SIDE_REQUIRES_FACILITATOR =
  "createX402Merchant requires an externally supplied facilitator EOA (gas-only " +
  "settler, env " +
  X402_FACILITATOR_KEY_ENV +
  "), a real payTo account, a funded wallet, and an https-capable server. " +
  "No merchant was created, no settlement was broadcast.";

/** Canonical Permit2 address, exactly as exported by the official SDK. */
export const ALTANA_X402_PERMIT2_ADDRESS = PERMIT2_ADDRESS;

/** Error base for the x402 layer. */
export class AltanaX402Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaX402Error";
  }
}

export class AltanaX402NetworkError extends AltanaX402Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaX402NetworkError";
  }
}

export class AltanaX402ConfigError extends AltanaX402Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaX402ConfigError";
  }
}

export class AltanaX402ExecutionError extends AltanaX402Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaX402ExecutionError";
  }
}

// ---------------------------------------------------------------------------
// Network resolution (buyer)
// ---------------------------------------------------------------------------

/** Identifier forms a caller may pass; canonical forms are the primary ones. */
export type X402NetworkInput = string | number;

export interface X402NetworkInfo {
  network: typeof ALTANA_X402_NETWORK;
  chainId: typeof ALTANA_X402_CHAIN_ID;
}

/**
 * Resolve an x402 network identifier to the canonical BNB testnet config.
 * Accepts `bsc-testnet`, `bnb-testnet`, `eip155:97`, or the number 97.
 * Rejects mainnet (56 / `bnb` / `bsc` / `eip155:56`) and any unknown value —
 * this phase is testnet-only and never silently switches chains.
 */
export function getX402Network(input: X402NetworkInput = ALTANA_X402_NETWORK): X402NetworkInfo {
  const value = typeof input === "string" ? input.toLowerCase() : input;

  if (
    value === 97 ||
    value === "97" ||
    value === "bnb-testnet" ||
    value === "bsc-testnet" ||
    value === "eip155:97"
  ) {
    return { network: "bnb-testnet", chainId: 97 };
  }

  if (
    value === 56 ||
    value === "56" ||
    value === "bnb" ||
    value === "binance" ||
    value === "bsc" ||
    value === "eip155:56"
  ) {
    throw new AltanaX402NetworkError(
      `Mainnet (chain 56) is not enabled for x402 this phase. Refused network "${String(input)}".`
    );
  }

  throw new AltanaX402NetworkError(
    `Unsupported x402 network "${String(input)}". Expected bnb-testnet (chain 97).`
  );
}

// ---------------------------------------------------------------------------
// Client + payment-required parsing (buyer)
// ---------------------------------------------------------------------------

export interface X402ClientOptions {
  /** Override the testnet public RPC URL (server-side provider). */
  rpcUrl?: string;
}

/** A pinned, server-safe x402 client handle. */
export interface X402Client {
  /** The underlying Altana SDK client (chains = [BNB_TESTNET]). */
  client: Client;
  network: typeof ALTANA_X402_NETWORK;
  chainId: typeof ALTANA_X402_CHAIN_ID;
  permit2Address: string;
}

/**
 * Initialize the x402 buyer client. Always pins bnb-testnet (chain 97);
 * never mainnet. Performing no network calls, it throws `AltanaX402ConfigError`
 * only on invalid input, mirroring `createAltanaClient`.
 */
export function createX402Client(opts: X402ClientOptions = {}): X402Client {
  const network = getX402Network(ALTANA_X402_NETWORK);
  const client = createAltanaClient({
    network: "bnb-testnet",
    rpcUrl: opts.rpcUrl,
    defaultChainId: 97,
  });
  return {
    client,
    network: network.network,
    chainId: network.chainId,
    permit2Address: ALTANA_X402_PERMIT2_ADDRESS,
  };
}

export type X402PaymentRequiredParse =
  | { ok: true; requirements: X402Requirement[]; resource?: X402Resource }
  | { ok: false; reason: string };

/**
 * Parse an HTTP 402 challenge body into normalized payment requirements.
 * Pure — mirrors the SDK's `fetchWithX402` body parser (`accepts[]` dialect
 * and the bare single-requirement dialect; top-level x402Version/resource/
 * mimeType are carried onto each option). Returns a discriminated result;
 * never throws on untrusted input.
 */
export function parsePaymentRequired(body: unknown): X402PaymentRequiredParse {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "x402 402 body must be a JSON object." };
  }
  const parsed = body as Record<string, unknown>;

  const rawOptions = Array.isArray(parsed.accepts)
    ? (parsed.accepts as unknown[])
    : typeof parsed.scheme === "string"
      ? [body]
      : [];
  if (rawOptions.length === 0) {
    return {
      ok: false,
      reason: "x402 402 body carries no payable options (missing accepts[] or scheme).",
    };
  }

  const resource = normalizeResource(parsed.resource);
  const requirements: X402Requirement[] = [];

  for (const option of rawOptions) {
    if (option === null || typeof option !== "object" || Array.isArray(option)) continue;
    const req = option as Record<string, unknown>;
    if (typeof req.scheme !== "string" || typeof req.network !== "string") continue;
    requirements.push({
      x402Version:
        typeof req.x402Version === "number"
          ? req.x402Version
          : (parsed.x402Version as number | undefined),
      ...(resource !== undefined ? { resource } : {}),
      ...(typeof parsed.mimeType === "string" ? { mimeType: parsed.mimeType } : {}),
      ...(option as X402Requirement),
    });
  }

  if (requirements.length === 0) {
    return { ok: false, reason: "x402 402 body offered no structurally valid requirement." };
  }
  return { ok: true, requirements, ...(resource !== undefined ? { resource } : {}) };
}

export type X402RequirementSelection =
  | { ok: true; requirement: X402Requirement }
  | { ok: false; reason: string };

/**
 * X.55: select ONE payable requirement from a parsed 402 challenge.
 *
 * Closes a real gap: `parsePaymentRequired` was public, but the official
 * `selectX402Requirement` was only reachable inside this package, so a caller
 * could parse a challenge and then had no supported way to choose an option.
 *
 * Pure and offline — delegates to the official SDK selector, crosses NO
 * execution boundary, signs nothing, submits nothing, and needs no session,
 * signer, key, or network access. Chain 97 remains the only permitted target.
 */
export function selectPaymentRequirement(
  requirements: readonly X402Requirement[],
  opts: { network?: X402NetworkInput; preferRail?: "permit2" | "eip3009" } = {}
): X402RequirementSelection {
  if (requirements.length === 0) {
    return { ok: false, reason: "x402 selection requires at least one parsed requirement." };
  }
  // Reuses the same chain guard as the rest of the adapter: mainnet and any
  // unexpected chain throw before a requirement can be selected.
  let network: X402NetworkInfo;
  try {
    network = getX402Network(opts.network ?? ALTANA_X402_CHAIN_ID);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "unsupported x402 network" };
  }

  const selected = selectX402Requirement(requirements as X402Requirement[], {
    chainId: network.chainId,
    preferRail: opts.preferRail ?? "permit2",
  });
  if (selected === undefined || selected === null) {
    return {
      ok: false,
      reason: `x402 challenge offered no requirement payable on ${network.network} (chain ${network.chainId}).`,
    };
  }
  return { ok: true, requirement: selected };
}

export interface X402RequestOptions {
  /** Asserted on-chain network before anything is attempted. */
  network?: X402NetworkInput;
  /** What the payment would buy (http(s) resource URL). */
  url: string;
  init?: RequestInit;
  /** Preferred rail when a chain offers several (defaults to "permit2"). */
  preferRail?: "permit2" | "eip3009";
}

/**
 * THE BUYER EXECUTION BOUNDARY. `requestWithX402` cannot run without an
 * externally supplied Altana `Session`; no session exists in X.1 (no signer,
 * no private key). Without one it ALWAYS throws `AltanaX402ExecutionError`.
 * It never auto-approves, never signs, and never submits a transaction.
 */
export async function requestWithX402(
  handle: X402Client,
  opts: X402RequestOptions & { session: Session | undefined }
): Promise<Response> {
  const network = getX402Network(opts.network ?? handle.chainId);
  if (network.chainId !== 97) {
    throw new AltanaX402NetworkError(
      `requestWithX402 requires chain 97; refused "${String(opts.network)}".`
    );
  }
  if (opts.session === undefined) {
    throw new AltanaX402ExecutionError(
      `${X402_EXECUTION_REQUIRES_SESSION} (url="${opts.url}", chain ${network.chainId})`
    );
  }
  // Unreachable in X.1 — session execution wiring lands in a later phase. The
  // SDK's fetchWithX402 is the officially supported integration point.
  return handle.client.fetchWithX402({
    session: opts.session,
    url: opts.url,
    init: opts.init,
    chainId: network.chainId,
    preferRail: opts.preferRail,
  });
}

// ---------------------------------------------------------------------------
// Permit2 one-time provisioning (buyer)
// ---------------------------------------------------------------------------

/** Official token registry snapshot for the x402 sell-side tokens. */
export interface X402SellerTokens {
  /** $U (United Stables) per chainId — official x402-server registry. */
  u: Partial<Record<56 | 97, TokenConfig>>;
  /** BSC-USDT (18 dec) — MAINNET only. */
  usdtBsc: TokenConfig;
}

/**
 * The official sell-side token table (from @altananetwork/x402-server@0.2.0).
 * $U exists on 56 and 97; USDT_BSC is a chain-56 asset only — a testnet USDT
 * is NOT provided by the official registry.
 */
export function x402SellerTokens(): X402SellerTokens {
  return {
    u: { 56: U_TOKEN[56], 97: U_TOKEN[97] },
    usdtBsc: USDT_BSC,
  };
}

/** Validate a single `RailConfig`, returning `undefined` if it is well-formed. */
function railError(rail: unknown): string | undefined {
  if (rail === null || typeof rail !== "object" || Array.isArray(rail))
    return "each rail must be an object.";
  const r = rail as Record<string, unknown>;
  if (r.rail !== "eip3009" && r.rail !== "permit2-exact") {
    return `rail must be "eip3009" or "permit2-exact", got ${String(r.rail)}.`;
  }
  const token = r.token as Record<string, unknown> | undefined;
  if (token === undefined || typeof token !== "object" || token === null)
    return "each rail must declare a token config.";
  const addr = typeof token.address === "string" ? token.address : "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr) || addr === "0x0000000000000000000000000000000000000000") {
    return "rail token.address must be a non-zero 40-hex address.";
  }
  if (typeof token.name !== "string" || typeof token.version !== "string") {
    return "rail token must declare name and version (EIP-712 domain).";
  }
  if (typeof token.symbol !== "string" || typeof token.decimals !== "number") {
    return "rail token must declare symbol and decimals.";
  }
  if (r.rail === "permit2-exact") {
    const spender = typeof r.spender === "string" ? r.spender : "";
    if (
      !/^0x[a-fA-F0-9]{40}$/.test(spender) ||
      spender === "0x0000000000000000000000000000000000000000"
    ) {
      return "permit2-exact rail requires a non-zero 40-hex spender address.";
    }
  }
  return undefined;
}

export type X402MerchantConfigValidation =
  { ok: true; config: MerchantConfig } | { ok: false; errors: string[] };

/**
 * Pure validation of the official `MerchantConfig` shape — chain, payTo,
 * price, price clamps, rails, and authorization window. NO credentials are
 * involved; validation never reads env, never initials a facilitator, and
 * never contacts the chain. Testnet (97) only.
 */
export function validateX402MerchantConfig(input: unknown): X402MerchantConfigValidation {
  const errors: string[] = [];

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Merchant config must be an object."] };
  }
  const raw = input as Record<string, unknown>;

  try {
    if (raw.chainId !== undefined) {
      const chain =
        typeof raw.chainId === "number" || typeof raw.chainId === "string"
          ? raw.chainId
          : String(raw.chainId);
      getX402Network(chain);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const payTo = typeof raw.payTo === "string" ? raw.payTo : "";
  if (
    !/^0x[a-fA-F0-9]{40}$/.test(payTo) ||
    payTo === "0x0000000000000000000000000000000000000000"
  ) {
    errors.push("payTo must be a non-zero 40-hex recipient address.");
  }

  if (typeof raw.price !== "bigint" || raw.price <= 0n) {
    errors.push("price must be a positive bigint (atomic token units).");
  }
  if (raw.minPrice !== undefined && (typeof raw.minPrice !== "bigint" || raw.minPrice < 0n)) {
    errors.push("minPrice must be a non-negative bigint.");
  }
  if (raw.maxPrice !== undefined && (typeof raw.maxPrice !== "bigint" || raw.maxPrice < 0n)) {
    errors.push("maxPrice must be a non-negative bigint.");
  }
  if (
    raw.minPrice !== undefined &&
    raw.maxPrice !== undefined &&
    typeof raw.maxPrice === "bigint" &&
    typeof raw.minPrice === "bigint" &&
    raw.maxPrice < raw.minPrice
  ) {
    errors.push("maxPrice must not be below minPrice.");
  }

  if (!Array.isArray(raw.rails) || raw.rails.length === 0) {
    errors.push("rails must be a non-empty array of RailConfig entries.");
  } else {
    for (const rail of raw.rails as unknown[]) {
      const message = railError(rail);
      if (message !== undefined) errors.push(message);
    }
  }

  if (raw.maxTimeoutSeconds !== undefined) {
    const t = typeof raw.maxTimeoutSeconds === "number" ? raw.maxTimeoutSeconds : NaN;
    if (!Number.isInteger(t) || t < 1 || t > 480) {
      errors.push(
        "maxTimeoutSeconds must be an integer in [1, 480] (Studio signer refuses windows over 600s)."
      );
    }
  }

  if (raw.resource !== undefined) {
    if (typeof raw.resource === "string") {
      if (!/^https?:\/\//i.test(raw.resource)) errors.push("resource URL must be http(s).");
    } else if (typeof raw.resource === "object" && raw.resource !== null) {
      const url = (raw.resource as Record<string, unknown>).url;
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
        errors.push("resource.url must be an http(s) URL.");
      }
    } else {
      errors.push("resource must be a URL string or a { url } object.");
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const config: MerchantConfig = {
    chainId: ALTANA_X402_CHAIN_ID,
    payTo: payTo as MerchantConfig["payTo"],
    price: raw.price as bigint,
    ...(raw.minPrice !== undefined ? { minPrice: raw.minPrice as bigint } : {}),
    ...(raw.maxPrice !== undefined ? { maxPrice: raw.maxPrice as bigint } : {}),
    rails: raw.rails as RailConfig[],
    ...(raw.maxTimeoutSeconds !== undefined
      ? { maxTimeoutSeconds: raw.maxTimeoutSeconds as number }
      : {}),
    ...(raw.resource !== undefined ? { resource: raw.resource as MerchantConfig["resource"] } : {}),
    ...(typeof raw.description === "string" ? { description: raw.description } : {}),
  };
  return { ok: true, config };
}

export type X402FacilitatorCheck =
  { configured: false; required: string; env: string } | { configured: true };

/**
 * Facilitator custody boundary. The official x402-server defines the
 * facilitator as a viem `Account` (a gas-only settler EOA read from
 * `FACILITATOR_KEY` in its README). X.1 has NO such credential and will
 * never fabricate or auto-generate one; `configured:false` is the only
 * honest state until an external operator supplies the key.
 */
export function checkX402Facilitator(): X402FacilitatorCheck {
  return {
    configured: false,
    required:
      "viem Account (settler EOA; gas-only, never holds funds; recipient bound in the buyer signature)",
    env: X402_FACILITATOR_KEY_ENV,
  };
}

export type X402CorsValidation = { ok: true; origins: string[] } | { ok: false; errors: string[] };

/**
 * CORS allow-list config boundary. The official x402-server does NOT define
 * CORS inside the merchant (it is a framework/serving-layer concern; the docs
 * require https in production for `bag x402 trust`). This adapter therefore
 * validates an EXPLICIT origin allow-list: no wildcard, http(s) only, https
 * for production. Never enables `*` and never broadens existing frontend
 * CORS behavior.
 */
export function validateX402AllowedOrigins(input: unknown): X402CorsValidation {
  if (!Array.isArray(input))
    return { ok: false, errors: ["allowed origins must be an array of origin strings."] };
  const errors: string[] = [];
  const origins: string[] = [];
  const seen = new Set<string>();

  for (const entry of input as unknown[]) {
    if (typeof entry !== "string") {
      errors.push("each allowed origin must be a string.");
      continue;
    }
    const origin = entry.trim();
    if (origin === "*") {
      errors.push('wildcard origin "*" is not allowed.');
      continue;
    }
    if (!/^https?:\/\/[^/]+$/i.test(origin) || /[?&#]/.test(origin)) {
      errors.push(`origin "${origin}" must be a bare http(s) origin (no path/query).`);
      continue;
    }
    if (seen.has(origin)) continue;
    seen.add(origin);
    origins.push(origin);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, origins };
}

/**
 * THE SELL-SIDE BOUNDARY. Creating a merchant or broadcasting a settlement
 * requires a facilitator EOA + payTo + funded wallet — none exist in X.1.
 * ALWAYS throws.
 */
export function assertX402SellSideBoundary(step: string): never {
  throw new AltanaX402ExecutionError(
    `${X402_SELL_SIDE_REQUIRES_FACILITATOR} Refused step "${step}".`
  );
}
