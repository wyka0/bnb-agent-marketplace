/**
 * X.81 — Production read-only wiring for the ERC-8183 capability provider.
 *
 * SERVER-ONLY. Reuses the existing, testnet-gated, read-only
 * `getErc8183Job` integration and the trusted 8004scan `owner_address` lookup.
 * Performs NO network writes, NO signing, NO custody. Intentionally NOT yet
 * wired into the activation route — the route stays fail-closed (X.80) until the
 * trusted capability-binding source (the ERC-8183-missing resource/capability
 * fields) is configured. This module only makes the provider *available*.
 */

import {
  ALTANA_ERC8183_CHAIN_ID,
  getErc8183Addresses,
  getErc8183Job,
} from "@bnb-marketplace/integrations/altana";
import { BNB_TESTNET } from "@altananetwork/sdk";
import { fetchAgentRows, findAgentByIdentity } from "./hire.server.ts";
import { createErc8183CapabilityProvider } from "./erc8183-capability-provider.ts";
import {
  makeSignedQuoteBindingResolver,
  type SignedQuoteReader,
} from "./signed-quote-capability.ts";

export interface ProductionErc8183ProviderOptions {
  /** Marketplace ERC-8183 client address (defaults to env ALTANA_ERC8183_CLIENT). */
  expectedClient?: string;
  /**
   * Trusted signed-quote reader (X.85). When supplied, a valid provider-signed
   * quote (provider == job.provider == registry owner, job-bound, unexpired)
   * supplies the `resource`/`executionCapability` ERC-8183 lacks. The
   * marketplace currently publishes NO signed quotes, so production leaves this
   * null => the provider returns null and the gate stays fail-closed (X.80/X.83).
   */
  signedQuoteReader?: SignedQuoteReader | null;
}

/**
 * Construct the production read-only ERC-8183 capability provider.
 *
 * The reader is `getErc8183Job(BNB_TESTNET, jobId)` — a pure, testnet-only view
 * read (the integration asserts chain 97 and rejects mainnet). The owner
 * resolver reads the trusted 8004scan `owner_address`. The capability binding
 * defaults to null because the ERC-8183 schema lacks resource/capability, so
 * the provider returns null until a trusted binding is supplied.
 */
export function createProductionErc8183CapabilityProvider(
  options: ProductionErc8183ProviderOptions = {}
): ReturnType<typeof createErc8183CapabilityProvider> {
  const expectedClient = options.expectedClient ?? process.env["ALTANA_ERC8183_CLIENT"] ?? "";
  const verificationSource = getErc8183Addresses(ALTANA_ERC8183_CHAIN_ID).commerce;

  return createErc8183CapabilityProvider({
    reader: {
      // Read-only view call only; no submission, no signing.
      readJob: (jobId) => getErc8183Job(BNB_TESTNET, jobId),
    },
    expectedChainId: ALTANA_ERC8183_CHAIN_ID,
    expectedClient,
    resolveAgentOwner: async (agentId) => {
      try {
        const rows = await fetchAgentRows(agentId);
        const agent = findAgentByIdentity(rows, agentId);
        return agent?.owner_address ?? null;
      } catch {
        return null;
      }
    },
    // X.85: a valid signed quote is the ONLY trusted source that can supply the
    // job-bound resource/executionCapability. No reader => null => gate closed.
    resolveCapabilityBinding: makeSignedQuoteBindingResolver(
      options.signedQuoteReader ?? null,
      async (agentId) => {
        try {
          const rows = await fetchAgentRows(agentId);
          const agent = findAgentByIdentity(rows, agentId);
          return agent?.owner_address ?? null;
        } catch {
          return null;
        }
      }
    ),
    verificationSource,
  });
}
