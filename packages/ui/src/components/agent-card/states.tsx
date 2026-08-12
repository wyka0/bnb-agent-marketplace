"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Skeleton } from "../skeleton.js";
import { EmptyState } from "../empty-state.js";
import type { AgentCardVariant } from "./types.js";

/**
 * Skeleton loading representations for each card variant.
 * Never renders fake data — only non-semantic placeholder shapes.
 */

export function SkeletonAgentCard({
  variant = "standard",
  className,
}: {
  variant?: AgentCardVariant;
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3.5",
          className
        )}
        aria-hidden="true"
      >
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div
        className={cn("rounded-xl border border-border/60 bg-card/60 p-5", className)}
        aria-hidden="true"
      >
        <div className="flex items-start gap-3">
          <Skeleton className="h-11 w-11 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border border-border/50 p-2.5"
            >
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-xl border border-border/60 bg-card/60 p-5", className)}
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
      <div className="mt-4 flex gap-2 border-t border-border/50 pt-4">
        <Skeleton className="h-8 flex-1 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

/** Grid wrapper rendering N skeletons — use while the registry is loading. */
export function AgentCardLoadingState({
  count = 6,
  variant = "standard",
  label = "Loading agents from registry",
  className,
}: {
  count?: number;
  variant?: AgentCardVariant;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div
        className={cn(
          "grid gap-4",
          variant === "compact" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonAgentCard key={i} variant={variant} />
        ))}
      </div>
    </div>
  );
}

/** Empty registry state — shown when a query returns no agents. */
export function AgentCardEmptyState({
  title = "No agents in this view yet",
  description = "Agents will appear here once the live ERC-8004 registry is connected to the marketplace.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <EmptyState title={title} description={description} action={action} className={className} />
  );
}

/** Inline status row reused by all card variants when a slot is pending. */
export function PendingHint({ text = "Waiting for registry sync" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
      {text}
    </span>
  );
}
