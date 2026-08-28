"use client";

import * as React from "react";
import { ArrowRight, CalendarClock, GitCompareArrows, ShieldCheck, Star, User } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Avatar } from "../avatar.js";
import { AgentBadge, CapabilityTag, ProtocolChip, VerificationBadge } from "./agent-badges.js";
import { RegistryStatus } from "./registry-status.js";
import { FavoriteButton, CompareCheckbox } from "./favorite-compare.js";
import type { AgentCardData, AgentCardActions } from "./types.js";

/**
 * Detailed variant — dashboard / favorites view.
 * Full metadata: builder, verification, reputation, capabilities,
 * protocols, registry status, last updated, and all actions.
 */
export function AgentCardDetailed({
  agent,
  favorite,
  compare,
  onViewDetails,
  className,
}: { agent: AgentCardData } & AgentCardActions & { className?: string }) {
  const badges = agent.badges ?? [];
  const capabilities = agent.capabilities ?? [];
  const protocols = agent.protocols ?? [];

  const builder = agent.builder?.name ?? agent.builder?.address ?? "Builder pending";
  const shortAddr = agent.builder?.address
    ? `${agent.builder.address.slice(0, 6)}…${agent.builder.address.slice(-4)}`
    : null;
  const erc8004Verified = badges.some((b) => b.kind === "erc8004-verified");

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border border-border/70 bg-card/60 p-5 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-[0_12px_32px_-16px_hsl(var(--primary)/0.45)]",
        className
      )}
    >
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
            <VerificationBadge
              variant={agent.builder?.verified ? "builder" : erc8004Verified ? "erc8004" : "none"}
            />
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

      <div className="mt-4 flex flex-wrap gap-1.5">
        {badges.slice(0, 4).map((b, i) => (
          <AgentBadge key={i} badge={b} />
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <User className="h-3 w-3" aria-hidden="true" />
            Builder
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{builder}</p>
              {shortAddr ? (
                <p className="truncate text-xs text-muted-foreground">{shortAddr}</p>
              ) : null}
            </div>
            {agent.builder?.verified ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Verified
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Star className="h-3 w-3" aria-hidden="true" />
            Reputation
          </div>
          <div className="mt-1 flex items-center gap-2">
            {agent.reputation?.score !== undefined ? (
              <>
                <span className="text-sm font-semibold text-foreground">
                  {agent.reputation.score}/5
                </span>
                <span className="text-xs text-muted-foreground">
                  {agent.reputation.reviews !== undefined
                    ? `${agent.reputation.reviews} reviews`
                    : "no reviews yet"}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground/70">Awaiting registry feedback</span>
            )}
          </div>
        </div>
      </div>

      {capabilities.length > 0 || protocols.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Capabilities & protocols
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {capabilities.slice(0, 5).map((c) => (
              <CapabilityTag key={c.id} label={c.label} />
            ))}
            {protocols.slice(0, 5).map((p) => (
              <ProtocolChip key={p.id} protocol={p} />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground/70">
          Capabilities & protocols sync with the registry.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
          Token #{agent.registry.tokenId}
        </span>
        {agent.updatedAt ? (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatUpdated(agent.updatedAt)}
          </span>
        ) : (
          <span>Last updated — registry sync</span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {compare ? (
          <CompareCheckbox
            checked={compare.selected}
            onToggle={compare.onToggle}
            agentName={agent.name}
          />
        ) : null}
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
            agent.hireable ? (agent.hireLabel ?? "Review activation") : agent.hireUnavailableReason
          }
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.7)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {agent.hireable ? (agent.hireLabel ?? "Activate") : "Unavailable"}
        </button>
      </div>
    </article>
  );
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `Updated ${days}d ago`;
  return `Updated ${d.toLocaleDateString()}`;
}
