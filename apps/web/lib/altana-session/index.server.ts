/**
 * X.45 server-only entry. The ONLY module Altana session consumers (route
 * handlers, server components) may import from lib/altana-session. Wires the
 * Prisma store, the real chain-97 SDK adapter, X.44 custody, and the
 * X.36 demonstrated policy. The admin private key is read from the server
 * environment and held in memory only.
 */

import "server-only";
import { getErc8183Addresses } from "@bnb-marketplace/integrations/altana";
import { buildAltanaSessionPolicy } from "@bnb-marketplace/integrations/altana";
import { createAltanaCustody } from "../custody/index.ts";
import { createSdkAltanaSessionAdapter } from "./adapter.ts";
import {
  createAltanaSession,
  executeAllowedOperation,
  loadActiveSession,
  revokeActiveSession,
} from "./service.ts";
import { prismaSessionStore } from "./store.prisma.server.ts";
import type { AltanaSessionServiceDeps } from "./service.ts";
import type { SessionOwner } from "./types.ts";

export type { LoadedSessionResult, ExecuteOutcome, RevokeOutcome } from "./types.ts";
export { toPublicSessionView } from "./view.ts";
export type { PublicSessionView } from "./view.ts";

type SessionService = ReturnType<typeof buildSessionService>;
let cachedSessionService: SessionService | null = null;

function requiredEnv(name: string, env: Record<string, string | undefined>): string {
  const value = env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`X.45 server entry: missing required environment variable ${name}.`);
  }
  return value;
}

function buildSessionService(env: Record<string, string | undefined>): {
  deps: AltanaSessionServiceDeps;
  loadActiveSession(owner: SessionOwner): ReturnType<typeof loadActiveSession>;
  createAltanaSession(
    owner: SessionOwner,
    options?: Parameters<typeof createAltanaSession>[2]
  ): ReturnType<typeof createAltanaSession>;
  executeAllowedOperation(owner: SessionOwner): ReturnType<typeof executeAllowedOperation>;
  revokeActiveSession(owner: SessionOwner): ReturnType<typeof revokeActiveSession>;
} {
  if ((env.ALTANA_NETWORK ?? "bnb-testnet") === "bnb") {
    throw new Error("X.49 web entry: BNB Mainnet is not permitted; chain 97 is required.");
  }
  const addresses = getErc8183Addresses(97);
  const adminPrivateKey = requiredEnv("ALTANA_TESTNET_PRIVATE_KEY", env);
  const deps: AltanaSessionServiceDeps = {
    store: prismaSessionStore,
    adapter: createSdkAltanaSessionAdapter({
      adminPrivateKey,
      rpcUrl: env.ALTANA_RPC_URL,
    }),
    custody: createAltanaCustody(env),
    policyProvider: () => buildAltanaSessionPolicy(addresses.paymentToken),
  };
  return {
    deps,
    loadActiveSession: (owner) => loadActiveSession(deps, owner),
    createAltanaSession: (owner, options) => createAltanaSession(deps, owner, options),
    executeAllowedOperation: (owner) => executeAllowedOperation(deps, owner),
    revokeActiveSession: (owner) => revokeActiveSession(deps, owner),
  };
}

/**
 * X.49 L-9: stable per-process service wiring. Reuses the SDK/viem/KMS
 * clients and signer instead of rebuilding them for every request. Explicit
 * env overrides (offline tests/operator probes) always get an isolated
 * instance; the production process env path is cached.
 */
export function createSessionService(env: Record<string, string | undefined> = process.env): SessionService {
  if (env !== process.env) return buildSessionService(env);
  cachedSessionService ??= buildSessionService(env);
  return cachedSessionService;
}
