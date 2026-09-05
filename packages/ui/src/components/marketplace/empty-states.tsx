"use client";

import * as React from "react";
import { Clock3, Database, Inbox, SearchX, Sparkles, Star, WifiOff } from "lucide-react";
import { cn } from "../../lib/utils.js";

/**
 * Marketplace empty states.
 *
 * A single `MarketplaceEmptyState` primitive backs six named presets so every
 * "nothing here" moment is honest and consistent. None fabricate data; each
 * explains *why* the view is empty and offers an optional action.
 */

export interface MarketplaceEmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Tone tints the icon chip. */
  tone?: "neutral" | "primary" | "destructive";
  /** Announce to assistive tech (loading/offline are polite status regions). */
  role?: "status";
  className?: string;
}

export function MarketplaceEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  tone = "neutral",
  role,
  className,
}: MarketplaceEmptyStateProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 p-10 text-center",
        className
      )}
    >
      <div
        className={cn(
          "mb-3 flex h-12 w-12 items-center justify-center rounded-full",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "destructive" && "bg-destructive/10 text-destructive",
          tone === "neutral" && "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ------------------------- named presets ------------------------- */

export function NoSearchResults({
  query,
  action,
  className,
}: {
  query?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <MarketplaceEmptyState
      icon={SearchX}
      title="No results found"
      description={
        query
          ? `No agents match “${query}”. Try different keywords or clear some filters.`
          : "No agents match your search. Try different keywords or clear some filters."
      }
      action={action}
      className={className}
    />
  );
}

export function NoAgents({ action, className }: { action?: React.ReactNode; className?: string }) {
  return (
    <MarketplaceEmptyState
      icon={Inbox}
      title="No agents to show"
      description="There are no agents in this view yet. They will appear here once the registry is populated."
      action={action}
      className={className}
    />
  );
}

export function RegistryOffline({
  action,
  className,
}: {
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <MarketplaceEmptyState
      icon={WifiOff}
      tone="destructive"
      role="status"
      title="Registry offline"
      description="We can’t reach the ERC-8004 registry right now. Data shown may be incomplete — please retry shortly."
      action={action}
      className={className}
    />
  );
}

export function LoadingRegistry({ className }: { className?: string }) {
  return (
    <MarketplaceEmptyState
      icon={Database}
      tone="primary"
      role="status"
      title="Loading registry…"
      description="Fetching the latest agents from the ERC-8004 registry."
      className={className}
    />
  );
}

export function NoFavorites({
  action,
  className,
}: {
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <MarketplaceEmptyState
      icon={Star}
      title="No favorites yet"
      description="Agents you favorite will collect here for quick access and comparison."
      action={action}
      className={className}
    />
  );
}

export function ComingSoon({
  title = "Coming soon",
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <MarketplaceEmptyState
      icon={Sparkles}
      tone="primary"
      title={title}
      description={description ?? "This part of the marketplace is on the way. Check back shortly."}
      className={className}
    />
  );
}

/** Small inline "waiting for sync" hint reused across the marketplace. */
export function WaitingHint({
  text = "Waiting for registry sync",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary",
        className
      )}
    >
      <Clock3 className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
      {text}
    </span>
  );
}
