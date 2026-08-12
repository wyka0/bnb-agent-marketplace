/**
 * BNB Agent Studio — agent registry integration contract.
 *
 * The official Agent Studio is the source of truth for agent identity and
 * disposition. This defines the read/write surface the marketplace expects.
 * Interface-only; SDK wiring is deferred to a later phase.
 */

import type { AgentCategory } from "@bnb-marketplace/config";

export interface StudioAgentStatus {
  id: string;
  slug: string;
  name: string;
  category: AgentCategory;
  description: string;
  publisherId: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
}

export interface StudioPublishInput {
  slug: string;
  name: string;
  category: AgentCategory;
  description: string;
  publisherId: string;
}

export interface StudioAdapter {
  readonly providerName: "bnb-agent-studio";

  listAgents(query?: { category?: AgentCategory }): Promise<StudioAgentStatus[]>;
  getAgent(agentId: string): Promise<StudioAgentStatus | null>;
  publish(input: StudioPublishInput): Promise<StudioAgentStatus>;
}

export const STUDIO_ADAPTER_NOT_IMPLEMENTED =
  "BNB Agent Studio adapter is not implemented yet." as const;
