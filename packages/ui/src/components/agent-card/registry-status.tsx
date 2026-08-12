"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils.js";
import type { RegistryStatus } from "./types.js";

/**
 * Registry sync status indicator.
 * Future mapping:
 * - `loading`  → initial registry roundtrip in flight (8004scan poll)
 * - `pending`  → agent row exists, fields not fully hydrated
 * - `live`     → fully hydrated from 8004scan
 * - `offline`  → registry unreachable / agent unlisted
 * - `updating` → resync in flight (poll or revalidation)
 */

const STATUS_META: Record<RegistryStatus, { label: string; className: string; dot: string }> = {
  loading: {
    label: "Syncing registry",
    className: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60 animate-pulse",
  },
  pending: {
    label: "Pending registry sync",
    className: "border-primary/30 bg-primary/10 text-amber-600 dark:text-amber-400",
    dot: "bg-primary animate-pulse",
  },
  live: {
    label: "Live",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  offline: {
    label: "Offline",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  updating: {
    label: "Updating",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500 animate-pulse",
  },
};

export function RegistryStatus({
  status,
  className,
}: {
  status?: RegistryStatus;
  className?: string;
}) {
  const meta = STATUS_META[status ?? "loading"];
  const isUpdating = status === "updating";
  return (
    <span
      role="status"
      aria-label={`Registry status: ${meta.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        meta.className,
        className
      )}
    >
      {isUpdating ? (
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden="true" />
      )}
      <span className="whitespace-nowrap">{meta.label}</span>
    </span>
  );
}
