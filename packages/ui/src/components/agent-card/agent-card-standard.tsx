"use client";

import * as React from "react";
import { ArrowRight, Star } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Avatar } from "../avatar.js";
import { AgentBadge, CapabilityTag, ProtocolChip, RiskBadge } from "./agent-badges.js";
import { RegistryStatus } from "./registry-status.js";
import { FavoriteButton, CompareCheckbox } from "./favorite-compare.js";
import type { AgentCardData, AgentCardActions } from "./types.js";

/**
 * Standard variant — the primary marketplace card.
 * Header (logo · name · badges) / body (description · category) /
 * capabilities · protocols · reputation · risk · footer actions.
 */
export function AgentCardStandard({
  agent,
  favorite,
  compare,
  onViewDetails,
  className,
}: { agent: AgentCardData } & AgentCardActions & { className?: string }) {
  const badges = agent.badges ?? [];
  const capabilities = agent.capabilities ?? [];
  const protocols = agent.protocols ?? [];

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border border-border/70 bg-card/60 p-5 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-[0_12px_32px_-16px_hsl(var(--primary)/0.45)]",
        className
      )}
    >
      {compare ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <CompareCheckbox
              checked={compare.selected}
              onToggle={compare.onToggle}
              agentName={agent.name}
            />
            Compare
          </label>
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <Avatar
          src={agent.logoUrl}
          alt={`${agent.name} agent logo`}
          fallback={agent.name.charAt(0).toUpperCase()}
          size="lg"
          className="rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold tracking-tight">{agent.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <RegistryStatus status={agent.registryStatus} />
            {badges.slice(0, 2).map((b, i) => (
              <AgentBadge key={i} badge={b} size="sm" />
            ))}
          </div>
        </div>
        {favorite ? (
          <FavoriteButton
            active={favorite.active}
            onToggle={favorite.onToggle}
            agentName={agent.name}
          />
        ) : null}
      </div>

      {agent.description ? (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {agent.description}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground/70">
          No description yet — waiting for registry sync.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <RiskBadge risk={agent.risk} />
        {agent.reputation?.score !== undefined ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <Star className="h-3 w-3 fill-primary text-primary" aria-hidden="true" />
            {agent.reputation.score / 1}/5
            {agent.reputation.reviews !== undefined ? (
              <span className="text-muted-foreground/70">· {agent.reputation.reviews} reviews</span>
            ) : null}
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground/70">
            no reputation yet
          </span>
        )}
      </div>

      {capabilities.length > 0 || protocols.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {capabilities.slice(0, 3).map((c) => (
            <CapabilityTag key={c.id} label={c.label} />
          ))}
          {protocols.slice(0, 3).map((p) => (
            <ProtocolChip key={p.id} protocol={p} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground/70">
          Capabilities & protocols sync with the registry.
        </p>
      )}

      <div className="mt-auto">
        <div className="mt-5 flex items-center gap-2 border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={() => onViewDetails?.(agent)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background/60 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            View Details
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!agent.hireable}
            onClick={() => onViewDetails?.(agent)}
            title={
              agent.hireable
                ? (agent.hireLabel ?? "Review activation")
                : agent.hireUnavailableReason
            }
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.7)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {agent.hireable ? (agent.hireLabel ?? "Activate") : "Unavailable"}
          </button>
        </div>
      </div>
    </article>
  );
}
