/**
 * Server-safe Altana adapter facade (Phase 2).
 *
 * SCOPE — setup + adapter + read-only verification only:
 *   - createAltanaClient       initialize the @altananetwork/sdk client
 *   - validateAltanaConfiguration   defensive runtime input validation
 *   - getAltanaStatus          resolved network/config snapshot (+ optional probe)
 *   - checkAltanaReadonly      minimal on-chain read (plain eth_call, no signer)
 *
 * INTENTIONALLY ABSENT in this phase (documented boundaries, not implemented):
 * sessions (grantSession/execute/revokeSession), ERC-8183 jobs, x402, skills,
 * and any signer/private-key handling. Nothing here submits a transaction,
 * creates a session, escrows funds, or requires a private key.
 */

import { createClient as createAltanaSdkClient, BNB, BNB_TESTNET } from "@altananetwork/sdk";
import type { Client, NetworkConfig } from "@altananetwork/sdk";
import type { Address } from "viem";
import { env } from "@bnb-marketplace/config";

/** Package identity mirrored from the workspace dependency. */
export const ALTANA_SDK_PACKAGE = "@altananetwork/sdk";
/** SDK version pinned in packages/integrations/package.json — keep in sync. */
export const ALTANA_SDK_VERSION = "0.7.0";

/** Networks the adapter is allowed to target. Testnet is the default. */
export type AltanaNetworkName = "bnb" | "bnb-testnet";

export interface AltanaClientOptions {
  /** Execution network. Defaults to `bnb-testnet` (chain 97). */
  network?: AltanaNetworkName;
  /** Override the network's public RPC URL (server-side provider). */
  rpcUrl?: string;
  /** Per-operation default chain id; must match the selected network. */
  defaultChainId?: number;
}

/** Resolved read snapshot of the target Altana network (derived from the SDK). */
export interface AltanaResolvedConfig {
  network: AltanaNetworkName;
  chainId: number;
  keyStore: string;
  keyStoreController: string;
  publicRpcUrl: string;
  explorer: string;
  relayUrl?: string;
}

export interface AltanaReadonlyProbe {
  ok: boolean;
  network: AltanaNetworkName;
  chainId: number;
  /** Address read (plain eth_getBalance; the zero address never implies funds). */
  probeAddress: Address;
  /** Native balance in wei, stringified (bigint-safe). Null when the probe failed. */
  nativeBalanceWei: string | null;
  checkedAt: string;
  error?: string;
}

export interface AltanaStatus {
  sdk: { packageName: string; version: string };
  configured: boolean;
  network: AltanaNetworkName;
  chainId: number;
  defaultChainId: number;
  keyStore: string;
  keyStoreController: string;
  publicRpcUrl: string;
  explorer: string;
  relayUrl?: string;
  /** Present only when `probe: true`. */
  probe?: AltanaReadonlyProbe;
}

export type AltanaValidation =
  { ok: true; client: Client; config: AltanaResolvedConfig } | { ok: false; errors: string[] };

/** Canonical zero address used for the read-only balance probe. */
export const ALTANA_READONLY_PROBE_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export class AltanaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AltanaConfigError";
  }
}

function networkNameToConfig(name: AltanaNetworkName): NetworkConfig {
  switch (name) {
    case "bnb":
      return BNB;
    case "bnb-testnet":
      return BNB_TESTNET;
  }
}

function networkNameForChainId(chainId: number): AltanaNetworkName {
  if (chainId === 56) return "bnb";
  if (chainId === 97) return "bnb-testnet";
  throw new AltanaConfigError(`Unsupported Altana chain id ${chainId} (expected 56 or 97).`);
}

function resolveConfig(client: Client): AltanaResolvedConfig {
  const chain = client.chains[0];
  if (chain === undefined) {
    throw new AltanaConfigError("Altana client has no configured chains.");
  }
  return {
    network: networkNameForChainId(chain.chainId),
    chainId: chain.chainId,
    keyStore: chain.keyStore,
    keyStoreController: chain.keyStoreController,
    publicRpcUrl: chain.publicRpcUrl,
    explorer: chain.explorer,
    relayUrl: chain.relayUrl,
  };
}

/**
 * Create an Altana SDK client.
 *
 * Defaults to BNB testnet (chain 97) — never mainnet. An `rpcUrl` override
 * clones the network config so reads honor the environment RPC. Throws
 * `AltanaConfigError` on invalid input; it performs no network calls.
 */
export function createAltanaClient(opts: AltanaClientOptions = {}): Client {
  const network = opts.network ?? env?.ALTANA_NETWORK ?? "bnb-testnet";
  const base = networkNameToConfig(network);
  const config: NetworkConfig =
    opts.rpcUrl !== undefined ? { ...base, publicRpcUrl: opts.rpcUrl } : base;

  if (opts.defaultChainId !== undefined && opts.defaultChainId !== config.chainId) {
    throw new AltanaConfigError(
      `defaultChainId ${opts.defaultChainId} does not match Altana network "${network}" (chainId ${config.chainId}).`
    );
  }

  return createAltanaSdkClient({ chains: [config] });
}

/**
 * Defensively validate Altana configuration (raw/JSON/env-derived input).
 * Returns a created client on success; collects human-readable errors on
 * failure instead of throwing. No network calls.
 */
export function validateAltanaConfiguration(input: unknown): AltanaValidation {
  const errors: string[] = [];
  const options: AltanaClientOptions = {};

  if (input != null) {
    if (typeof input !== "object" || Array.isArray(input)) {
      return { ok: false, errors: ["Altana configuration must be an object."] };
    }
    const raw = input as Record<string, unknown>;

    if (raw.network !== undefined) {
      if (raw.network === "bnb" || raw.network === "bnb-testnet") {
        options.network = raw.network;
      } else {
        errors.push(
          `altana.network must be "bnb" (56) or "bnb-testnet" (97), got ${String(raw.network)}.`
        );
      }
    }

    if (raw.rpcUrl !== undefined) {
      if (typeof raw.rpcUrl === "string" && /^https?:\/\//i.test(raw.rpcUrl)) {
        options.rpcUrl = raw.rpcUrl;
      } else {
        errors.push("altana.rpcUrl must be an http(s) URL.");
      }
    }

    if (raw.defaultChainId !== undefined) {
      const value = typeof raw.defaultChainId === "number" ? raw.defaultChainId : Number.NaN;
      if (Number.isInteger(value) && (value === 56 || value === 97)) {
        options.defaultChainId = value;
      } else {
        errors.push("altana.defaultChainId must be 56 (bnb) or 97 (bnb-testnet).");
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  try {
    const client = createAltanaClient(options);
    return { ok: true, client, config: resolveConfig(client) };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Read-only on-chain probe: reads the native balance of `probeAddress` (a
 * plain `eth_getBalance` via the SDK `balances` read — no signer, no userOp,
 * no relay, no transaction). Network failures return `{ ok: false, error }`
 * rather than throwing, so callers can downgrade to "SKIPPED".
 */
export async function checkAltanaReadonly(
  client: Client,
  opts: { probeAddress?: Address } = {}
): Promise<AltanaReadonlyProbe> {
  const config = resolveConfig(client);
  const chainId = client.defaultChainId;
  const probeAddress = opts.probeAddress ?? ALTANA_READONLY_PROBE_ADDRESS;
  const base = {
    network: config.network,
    chainId,
    probeAddress,
    checkedAt: new Date().toISOString(),
  };

  try {
    const result = await client.balances({ wallet: probeAddress, chainId });
    return { ok: true, ...base, nativeBalanceWei: result.native.toString() };
  } catch (error) {
    return {
      ok: false,
      ...base,
      nativeBalanceWei: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Snapshot of the Altana integration state for a configured client. Pure
 * config resolution (no network) unless `probe: true` runs the read-only
 * balance check.
 */
export async function getAltanaStatus(
  client: Client,
  opts: { probe?: boolean; probeAddress?: Address } = {}
): Promise<AltanaStatus> {
  const config = resolveConfig(client);
  const status: AltanaStatus = {
    sdk: { packageName: ALTANA_SDK_PACKAGE, version: ALTANA_SDK_VERSION },
    configured: true,
    ...config,
    defaultChainId: client.defaultChainId,
  };
  if (opts.probe === true) {
    status.probe = await checkAltanaReadonly(client, { probeAddress: opts.probeAddress });
  }
  return status;
}
