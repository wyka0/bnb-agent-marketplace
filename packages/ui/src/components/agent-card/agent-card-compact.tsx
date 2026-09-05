"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Avatar } from "../avatar.js";
import { AgentBadge } from "./agent-badges.js";
import { RegistryStatus } from "./registry-status.js";
import { FavoriteButton, CompareCheckbox } from "./favorite-compare.js";
import type { AgentCardData, AgentCardActions } from "./types.js";

/**
 * Compact variant — for search result lists.
 * Horizontal, low-chrome: logo · name · badges · status · favorite.
 * Empty/`--` values are rendered as muted dashes; never fabricated data.
 */
export function AgentCardCompact({
  agent,
  favorite,
  compare,
  onViewDetails,
  className,
}: { agent: AgentCardData } & AgentCardActions & { className?: string }) {
  const badges = (agent.badges ?? []).slice(0, 2);
  const meta = [
    agent.category ? { label: "Category", value: agent.category } : null,
    agent.reputation?.score !== undefined
      ? {
          label: "Score",
          value: `${agent.reputation.score ?? "—"}${agent.reputation.score !== undefined ? "/5" : ""}`,
        }
      : null,
  ]
    .filter(Boolean)
    .map((m) => m as { label: string; value: string });

  return (
    <article
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.35)]",
        className
      )}
    >
      {compare ? (
        <CompareCheckbox
          checked={compare.selected}
          onToggle={compare.onToggle}
          agentName={agent.name}
          className="absolute -left-3 -top-3 bg-background/90"
        />
      ) : null}

      <Avatar
        src={agent.logoUrl}
        alt={`${agent.name} logo`}
        fallback={agent.name.charAt(0).toUpperCase()}
        size="md"
        className="rounded-lg"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold tracking-tight">{agent.name}</h3>
          {favorite ? (
            <FavoriteButton
              active={favorite.active}
              onToggle={favorite.onToggle}
              agentName={agent.name}
              size="sm"
            />
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {badges.map((b, i) => (
            <AgentBadge key={i} badge={b} size="sm" />
          ))}
          <RegistryStatus status={agent.registryStatus} />
        </div>
        {meta.length > 0 ? (
          <dl className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
            {meta.map((m) => (
              <div key={m.label} className="flex items-baseline gap-1">
                <dt className="font-medium text-muted-foreground/80">{m.label}:</dt>
                <dd className="font-medium text-foreground/90">{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <ChevronRight
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary",
          !onViewDetails && !agent.href && "opacity-30"
        )}
        aria-hidden="true"
      />
    </article>
  );
}
