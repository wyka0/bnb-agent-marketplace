"use client";

import * as React from "react";
import type { AgentCardData, AgentCardActions, AgentCardVariant } from "./types.js";
import { AgentCardCompact } from "./agent-card-compact.js";
import { AgentCardStandard } from "./agent-card-standard.js";
import { AgentCardDetailed } from "./agent-card-detailed.js";

/**
 * Compound entry point: pick the layout via `variant` and get the right
 * composition. All three variants share the same data + actions props, so
 * consumers can switch density without touching any data plumbing.
 */
export function AgentCard({
  agent,
  variant = "standard",
  favorite,
  compare,
  onViewDetails,
  className,
}: { agent: AgentCardData; variant?: AgentCardVariant; className?: string } & AgentCardActions) {
  switch (variant) {
    case "compact":
      return (
        <AgentCardCompact
          agent={agent}
          favorite={favorite}
          compare={compare}
          onViewDetails={onViewDetails}
          className={className}
        />
      );
    case "detailed":
      return (
        <AgentCardDetailed
          agent={agent}
          favorite={favorite}
          compare={compare}
          onViewDetails={onViewDetails}
          className={className}
        />
      );
    case "standard":
    default:
      return (
        <AgentCardStandard
          agent={agent}
          favorite={favorite}
          compare={compare}
          onViewDetails={onViewDetails}
          className={className}
        />
      );
  }
}
