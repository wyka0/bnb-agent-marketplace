"use client";

import * as React from "react";
import {
  BadgeCheck,
  Clock3,
  FlaskConical,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { cn } from "../../lib/utils.js";
import type { AgentBadge, AgentBadgeKind, RiskLevel } from "./types.js";

/**
 * Future data mapping:
 * - `TrendingWave | Sparkles | Shine` → registry/platform discoverability flags
 * - `BadgeCheck` → verified: ERC-8004 registry record is official
 * - builder verified → owner wallet vetted by registry/fan
 * - `Audited` → audit report id (TBD: 8004scan or a3m audit)
 * Badges are presentational: the consumer builds AgentBadge[] from real data.
 */

const KIND_META: Record<
  AgentBadgeKind,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  "erc8004-verified": {
    label: "ERC-8004 Verified",
    icon: BadgeCheck,
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  "builder-verified": {
    label: "Verified Builder",
    icon: UserCheck,
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  audited: {
    label: "Audited",
    icon: ShieldCheck,
    className: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  trending: {
    label: "Trending",
    icon: TrendingUp,
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  featured: {
    label: "Featured",
    icon: Sparkles,
    className: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  new: {
    label: "New",
    icon: Plus,
    className: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  experimental: {
    label: "Experimental",
    icon: FlaskConical,
    className: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  "coming-soon": {
    label: "Coming Soon",
    icon: Clock3,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
};

export function AgentBadge({
  badge,
  size = "md",
  className,
}: {
  badge: AgentBadge;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = KIND_META[badge.kind];
  const Icon = meta.icon;
  return (
    <span
      aria-label={badge.label ?? meta.label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium tracking-tight transition-colors",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        meta.className,
        className
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      <span className="whitespace-nowrap">{badge.label ?? meta.label}</span>
    </span>
  );
}

/* ----------------------- Risk ----------------------- */

const RISK_META: Record<RiskLevel, { label: string; className: string; dot: string }> = {
  low: {
    label: "Low risk",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  medium: {
    label: "Medium risk",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  high: {
    label: "High risk",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  critical: {
    label: "Critical risk",
    className: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  unknown: {
    label: "Risk pending",
    className: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50 animate-pulse",
  },
};

export function RiskBadge({
  risk = "unknown",
  className,
}: {
  risk?: RiskLevel;
  className?: string;
}) {
  const meta = RISK_META[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        meta.className,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/* ----------------------- verification ----------------------- */

export function VerificationBadge({
  variant,
  className,
}: {
  variant: "erc8004" | "builder" | "none";
  className?: string;
}) {
  if (variant === "none") return null;
  const isErc = variant === "erc8004";
  const label = isErc ? "ERC-8004 Ready" : "Verified Builder";
  const Icon = isErc ? BadgeCheck : UserCheck;
  const cls = isErc
    ? "border-primary/40 bg-primary/10 text-amber-600 dark:text-amber-400"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        cls,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

/* ----------------------- capability tag ----------------------- */

export function CapabilityTag({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}

/* ----------------------- protocol chip ----------------------- */

export function ProtocolChip({
  protocol,
  className,
}: {
  protocol: { id: string; label: string };
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground",
        className
      )}
    >
      <ShieldCheck className="mr-1 h-3 w-3 text-primary" aria-hidden="true" />
      {protocol.label}
    </span>
  );
}
