/**
 * X.149 — marketplace-owned receipt verification for the browser-wallet Hire.
 *
 * The marketplace (server) reads transaction receipts through the established
 * Main Track read RPC (PublicNode) using the reliable reader (X.142/X.144).
 * The browser NEVER submits raw transactions; it only broadcasts via its own
 * EIP-1193 wallet. This module is the read-only receipt boundary the client
 * polls between Hire steps.
 */

import {
  createMainTrackPublicClient,
  createMainTrackReceiptReader,
} from "@bnb-marketplace/integrations/altana";

export type MainTrackReceiptRead =
  | { status: "confirmed" }
  | { status: "reverted" }
  | { status: "pending" }
  | { status: "unavailable"; reason: string };

/**
 * Read a transaction receipt (bounded, read-only, never rebroadcasts).
 * `confirmed` = success; `reverted` = STOP; `pending` = keep polling;
 * `unavailable` = STOP (verification could not be completed).
 */
export async function readMainTrackReceipt(txHash: string): Promise<MainTrackReceiptRead> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { status: "unavailable", reason: "invalid transaction hash" };
  }
  try {
    const client = createMainTrackPublicClient();
    const reader = createMainTrackReceiptReader({ publicClient: client });
    const receipt = await reader(txHash);
    if (receipt === null) return { status: "pending" };
    const status = (receipt as { status?: string }).status;
    if (status === "success") return { status: "confirmed" };
    if (status === "reverted") return { status: "reverted" };
    return { status: "unavailable", reason: "malformed receipt status" };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
