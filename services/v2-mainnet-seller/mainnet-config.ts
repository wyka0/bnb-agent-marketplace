/**
 * X.233 — BNB Chain Mainnet (chain 56) ERC-8183 chain configuration.
 *
 * PREPARATION ONLY. This module contains DATA (verified addresses) and pure
 * resolvers. It performs NO network calls, holds NO keys, signs NOTHING, and
 * broadcasts NOTHING. Mainnet hiring is DISABLED by default
 * (`MAINNET_HIRE_ENABLED` env must be explicitly `"true"`), and no code path
 * in this repository consumes this table for execution yet.
 *
 * Address provenance: verified live on BSC mainnet (X.218, re-verified
 * X.233 via `eth_getCode` + view reads): proxies resolve Commerce→
 * commerceImpl 0xd5f9…, Router→routerImpl 0xf0cf…, Policy is a direct
 * contract, Registry and $U are live proxies; `paymentToken()` returns the
 * listed $U; Router.commerce() and Policy.commerce()/router() all resolve
 * to the listed Commerce/Router. Mainnet `jobCounter()=56,691` (live kernel).
 */

export const MAINNET_CHAIN_ID = 56 as const;

/** Verified BNB Chain Mainnet ERC-8183 address table (X.218/X.233). */
export const MAINNET_COMMERCE = "0xEa4DAa3100A767e86FDed867729ae7446476EBA6" as const;
export const MAINNET_ROUTER = "0x51895229E12F9876011789B04f8698af06cCD6DA" as const;
export const MAINNET_POLICY = "0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5" as const;
export const MAINNET_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
export const MAINNET_PAYMENT_TOKEN = "0xcE24439F2D9C6a2289F741120FE202248B666666" as const;

/** Reliable BNB Chain Mainnet public RPC for read-only verification. */
export const MAINNET_PUBLIC_RPC = "https://bsc-rpc.publicnode.com" as const;

export interface MainnetAddresses {
  chainId: 56;
  commerce: string;
  router: string;
  policy: string;
  registry: string;
  paymentToken: string;
  rpcUrl: string;
}

/** Resolve the Mainnet address table. Throws for any non-56 chain (never silently substitutes). */
export function resolveMainnetAddresses(chainId: number): MainnetAddresses {
  if (chainId !== MAINNET_CHAIN_ID) {
    throw new Error(
      `Mainnet seller config refuses chain ${chainId}; Mainnet ERC-8183 is chain 56 only.`
    );
  }
  return {
    chainId: MAINNET_CHAIN_ID,
    commerce: MAINNET_COMMERCE,
    router: MAINNET_ROUTER,
    policy: MAINNET_POLICY,
    registry: MAINNET_REGISTRY,
    paymentToken: MAINNET_PAYMENT_TOKEN,
    rpcUrl: MAINNET_PUBLIC_RPC,
  };
}

/**
 * Mainnet hire feature flag. Defaults to DISABLED. Only the literal string
 * "true" enables it; anything else (unset, empty, "1", "yes") stays disabled.
 * No code in this repository gates execution on it yet — it exists so the
 * first Mainnet execution path has an explicit, auditable switch.
 */
export function isMainnetHireEnabled(env: Record<string, string | undefined> = {}): boolean {
  return env["MAINNET_HIRE_ENABLED"] === "true";
}

export function mainnetHireDisabledByDefault(): boolean {
  return isMainnetHireEnabled({}) === false;
}
