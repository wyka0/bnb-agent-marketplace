/**
 * X.234 — authoritative typed chain configuration seam for commercial hire.
 *
 * Exactly two chains are supported:
 *   - BSC Testnet (chain 97): the proven, live commercial-hire chain.
 *   - BSC Mainnet (chain 56): verified on-chain (X.218/X.230), NOT enabled
 *     for hiring (`MAINNET_HIRE_ENABLED` defaults to false).
 *
 * This module is PURE (no network, no signing, no env reads of its own —
 * callers pass env explicitly). Testnet values are byte-identical to the
 * pinned `MAIN_TRACK_*` constants they mirror; a drift test in the web
 * harness pins that agreement. Mainnet values are the X.218-verified table.
 *
 * "Do NOT delete Testnet safety": every consumer resolves through
 * `resolveHireChainConfig`, which fails closed on any other chain id.
 */
import type { MainTrackNetworkConfig } from "./v2/main-track-user-wallet.js";

export const HIRE_CHAIN_TESTNET = 97 as const;
export const HIRE_CHAIN_MAINNET = 56 as const;

/** Authoritative per-chain ERC-8183 configuration for commercial hire. */
export interface HireChainConfig {
  chainId: 56 | 97;
  /** SDK network preset name. */
  name: "bsc" | "bsc-testnet";
  /** Human network label for review UX (verified display copy). */
  networkLabel: string;
  /** Compact chain label for review UX (matches existing testnet copy). */
  chainDisplayName: string;
  commerce: `0x${string}`;
  router: `0x${string}`;
  policy: `0x${string}`;
  registry: `0x${string}`;
  paymentToken: `0x${string}`;
  /** Verified token display label (name/symbol read live on both chains). */
  paymentTokenLabel: string;
  rpcUrl: string;
}

/** BSC Testnet (chain 97) — the live commercial-hire configuration. */
export const TESTNET_HIRE_CHAIN_CONFIG: HireChainConfig = {
  chainId: HIRE_CHAIN_TESTNET,
  name: "bsc-testnet",
  networkLabel: "BNB Smart Chain Testnet",
  chainDisplayName: "BSC Testnet (chain 97)",
  commerce: "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE",
  router: "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25",
  policy: "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA",
  registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  paymentToken: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
  paymentTokenLabel: "United Stables ($U)",
  rpcUrl: "https://bsc-testnet-rpc.publicnode.com",
};

/** BSC Mainnet (chain 56) — verified on-chain, NOT enabled for hiring. */
export const MAINNET_HIRE_CHAIN_CONFIG: HireChainConfig = {
  chainId: HIRE_CHAIN_MAINNET,
  name: "bsc",
  networkLabel: "BNB Smart Chain Mainnet",
  chainDisplayName: "BNB Smart Chain Mainnet (chain 56)",
  commerce: "0xEa4DAa3100A767e86FDed867729ae7446476EBA6",
  router: "0x51895229E12F9876011789B04f8698af06cCD6DA",
  policy: "0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5",
  registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  paymentToken: "0xcE24439F2D9C6a2289F741120FE202248B666666",
  paymentTokenLabel: "United Stables ($U)",
  rpcUrl: "https://bsc-rpc.publicnode.com",
};

/**
 * Resolve the hire configuration for a chain. Fails closed on anything
 * other than 56 or 97 (never substitutes one chain's addresses for another).
 */
export function resolveHireChainConfig(chainId: number): HireChainConfig {
  if (chainId === HIRE_CHAIN_TESTNET) return TESTNET_HIRE_CHAIN_CONFIG;
  if (chainId === HIRE_CHAIN_MAINNET) return MAINNET_HIRE_CHAIN_CONFIG;
  throw new Error(`unsupported hire chain ${chainId} (expected 56 or 97)`);
}

/**
 * Derive the chain from a canonical registry identity
 * (`chainId:0xcontract:tokenId`). Returns null for malformed identities or
 * chains outside the hire surface. Never infers from display labels.
 */
export function chainIdFromAgentId(agentId: string): 56 | 97 | null {
  const m = /^(\d+):0x[0-9a-fA-F]{40}:\d+$/.exec(agentId);
  if (!m) return null;
  const n = Number(m[1]);
  return n === 56 || n === 97 ? n : null;
}

/** Human chain label. Exact testnet copy preserved for existing UX. */
export function chainDisplayName(chainId: number): string {
  if (chainId === HIRE_CHAIN_TESTNET) return "BSC Testnet (chain 97)";
  if (chainId === HIRE_CHAIN_MAINNET) return "BNB Smart Chain Mainnet (chain 56)";
  return `Chain ${chainId}`;
}

/**
 * Mainnet hire feature flag. Defaults to DISABLED: only the literal string
 * "true" enables it. Callers pass env explicitly (server passes
 * `process.env`); nothing here reads the environment itself.
 */
export function isMainnetHireEnabled(env: Record<string, string | undefined> = {}): boolean {
  return env["MAINNET_HIRE_ENABLED"] === "true";
}

/** Build an SDK-compatible network config from a hire chain config. */
export function createHireNetworkConfig(cfg: HireChainConfig): MainTrackNetworkConfig {
  return {
    name: cfg.name,
    chainId: cfg.chainId,
    rpcUrl: cfg.rpcUrl,
    usePaymaster: false,
    registryContract: cfg.registry,
    commerceContract: cfg.commerce,
    routerContract: cfg.router,
    policyContract: cfg.policy,
    paymentTokenContract: cfg.paymentToken,
  };
}
