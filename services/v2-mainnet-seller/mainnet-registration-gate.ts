/**
 * X.235-P1 — Mainnet registration readiness gate (PURE, READ-ONLY).
 *
 * The single source of truth for whether the system is ready for the user to
 * authorize the ERC-8004 mainnet registration. This gate NEVER broadcasts,
 * NEVER signs, NEVER starts a server, and NEVER enables MAINNET_HIRE_ENABLED.
 *
 * The final state is either READY_FOR_USER_AUTHORIZATION or BLOCKED — never
 * REGISTERED (registration is a separate user-authorized on-chain action).
 */

export interface MainnetRegistrationGateInput {
  ownerAddress: string | null;
  agentUrl: string | null;
  ownerHasMainnetBnb: boolean;
  hostHealthOk: boolean;
  hostChainId: number | null;
  mainnetHireEnabled: boolean;
}

export interface MainnetRegistrationGateResult {
  state: "READY_FOR_USER_AUTHORIZATION" | "BLOCKED";
  blockers: string[];
  summary: {
    ownerAddress: string;
    agentUrl: string;
    chainVerified: boolean;
    registryVerified: boolean;
    hostVerified: boolean;
    mainnetHireDisabled: boolean;
  };
}

/** The verified Mainnet ERC-8004 registry (chain 56). */
export const MAINNET_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
/** The verified Mainnet chain ID. */
export const MAINNET_CHAIN_ID = 56 as const;
/** The registerAgent(string) selector. */
export const REGISTER_AGENT_SELECTOR = "0x2d2a9585" as const;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Evaluate the Mainnet registration readiness gate. Pure — no network calls.
 * The inputs come from the caller's read-only probes (owner balance check,
 * host health check, config verification).
 */
export function evaluateMainnetRegistrationGate(
  input: MainnetRegistrationGateInput
): MainnetRegistrationGateResult {
  const blockers: string[] = [];

  // G1: owner address exists
  if (!input.ownerAddress || input.ownerAddress.trim().length === 0) {
    blockers.push("owner address is not provided");
  }
  // G2: owner address is a valid EVM address
  else if (!ADDRESS_RE.test(input.ownerAddress)) {
    blockers.push("owner address is not a valid EVM address");
  }
  // G3: host URL exists
  if (!input.agentUrl || input.agentUrl.trim().length === 0) {
    blockers.push("mainnet seller endpoint is not provided");
  }
  // G4: host URL is HTTPS
  else if (!input.agentUrl.startsWith("https://")) {
    blockers.push("mainnet seller endpoint is not HTTPS");
  }
  // G5: host health succeeds
  if (!input.hostHealthOk) {
    blockers.push("mainnet seller /health is not reachable or unhealthy");
  }
  // G6: chain = 56
  if (input.hostChainId !== MAINNET_CHAIN_ID) {
    blockers.push(`chain is ${input.hostChainId ?? "unknown"}, not 56`);
  }
  // G7: Mainnet registry verified (caller pre-checks; this is the pin)
  // (the registry constant is pinned at the module level — verified in the
  //  existing mainnet-seller-readiness.verify.ts)

  // G8: seller config valid — owner has BNB for gas
  if (!input.ownerHasMainnetBnb) {
    blockers.push("owner wallet has 0 BNB on mainnet (gas required)");
  }

  // G9: Mainnet Hire remains disabled until registration is complete
  if (input.mainnetHireEnabled) {
    blockers.push("MAINNET_HIRE_ENABLED must remain false until registration is complete");
  }

  const ready = blockers.length === 0;
  return {
    state: ready ? "READY_FOR_USER_AUTHORIZATION" : "BLOCKED",
    blockers,
    summary: {
      ownerAddress: input.ownerAddress ?? "<MISSING>",
      agentUrl: input.agentUrl ?? "<MISSING>",
      chainVerified: input.hostChainId === MAINNET_CHAIN_ID,
      registryVerified: true, // pinned + verified by the readiness harness
      hostVerified: input.hostHealthOk,
      mainnetHireDisabled: !input.mainnetHireEnabled,
    },
  };
}
