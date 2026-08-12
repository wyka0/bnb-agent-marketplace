import { BNB_TESTNET } from "@altananetwork/sdk";

export const BNB_TESTNET_RISK_SERVICE_NAME = "BNB Testnet Wallet Snapshot" as const;
export const BNB_TESTNET_RISK_CHAIN_ID = 97 as const;

export type RiskServiceResult =
  | {
      state: "ready";
      chainId: 97;
      wallet: `0x${string}`;
      nativeBalanceWei: string;
    }
  | {
      state: "unavailable";
      chainId: 97;
      reason: "rpc-unavailable" | "invalid-rpc-response";
    };

export type RpcTransport = (url: string, init: RequestInit) => Promise<Response>;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function parseWallet(input: unknown): `0x${string}` | null {
  if (typeof input !== "string" || !ADDRESS_RE.test(input)) return null;
  return input.toLowerCase() === "0x0000000000000000000000000000000000000000"
    ? null
    : (input as `0x${string}`);
}

export function parseRiskRequest(
  input: unknown
):
  | { ok: true; wallet: `0x${string}` }
  | { ok: false; reason: "invalid-wallet" | "unsupported-chain" } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "invalid-wallet" };
  }
  const record = input as Record<string, unknown>;
  if (record.chainId !== undefined && record.chainId !== BNB_TESTNET_RISK_CHAIN_ID) {
    return { ok: false, reason: "unsupported-chain" };
  }
  const wallet = parseWallet(record.wallet);
  return wallet === null ? { ok: false, reason: "invalid-wallet" } : { ok: true, wallet };
}

export async function readBnbTestnetWalletSnapshot(
  wallet: `0x${string}`,
  transport: RpcTransport = fetch,
  rpcUrl = BNB_TESTNET.publicRpcUrl
): Promise<RiskServiceResult> {
  try {
    const response = await transport(rpcUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [wallet, "latest"],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { state: "unavailable", chainId: 97, reason: "rpc-unavailable" };
    const body = (await response.json()) as unknown;
    if (!isRecord(body) || typeof body.result !== "string" || !/^0x[0-9a-f]+$/i.test(body.result)) {
      return { state: "unavailable", chainId: 97, reason: "invalid-rpc-response" };
    }
    return {
      state: "ready",
      chainId: 97,
      wallet,
      nativeBalanceWei: BigInt(body.result).toString(),
    };
  } catch {
    return { state: "unavailable", chainId: 97, reason: "rpc-unavailable" };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
