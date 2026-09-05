"use client";

/**
 * Marketplace data-state design tokens.
 *
 * The single source of truth for the visual language of every agent data
 * state. Badges, cards, filters and future screens all read from these maps so
 * a `verified` agent looks identical everywhere.
 *
 * Colour approach: we lean on the app's semantic Tailwind tokens
 * (`primary`, `muted`, `border`, `destructive`, `ring`, …) plus a small set of
 * fixed colour scales (emerald / amber / orange / red / sky / violet). Each of
 * those scales already ships light + dark variants via Tailwind, and we pair a
 * `dark:` text colour with every tinted background so contrast holds in both
 * themes. No new CSS variables are introduced.
 *
 * Every token exposes the four required surfaces — background, border, icon,
 * text — as a single merged `className`, plus a `dot` colour for compact
 * indicators, an `icon` component, and a human `label`.
 */

import type * as React from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CircleSlash,
  Clock3,
  Database,
  FlaskConical,
  Gauge,
  Minus,
  Pause,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  WifiOff,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * State unions
 * ------------------------------------------------------------------ */

export type VerificationState = "verified" | "pending" | "unverified" | "deprecated";
export type RegistryState = "synced" | "updating" | "waiting" | "offline" | "unknown";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ReputationLevel = "excellent" | "good" | "average" | "unknown";
export type ActivityLevel = "trending" | "popular" | "new" | "stable" | "inactive";
export type BuilderStatus =
  "verified-builder" | "community-builder" | "unknown-builder" | "experimental";
export type AgentStatus = "live" | "paused" | "updating" | "coming-soon" | "retired";

/**
 * The visual descriptor shared by every state token.
 * `className` merges background + border + text (light & dark).
 */
export interface StateToken {
  /** Human-readable label. */
  readonly label: string;
  /** Icon component (lucide-react), sized by the consumer. */
  readonly icon: React.ComponentType<{ className?: string }>;
  /** Merged bg + border + text classes (light + dark). */
  readonly className: string;
  /** Standalone dot colour for compact indicators. */
  readonly dot: string;
  /** Whether the state is "in motion" — drives spinner / pulse affordances. */
  readonly animated?: boolean;
  /** Relative severity 0–3, useful for sorting / emphasis. */
  readonly weight: 0 | 1 | 2 | 3;
}

type TokenMap<K extends string> = Readonly<Record<K, StateToken>>;

/* ------------------------------------------------------------------ *
 * Shared palette fragments (bg + border + text, light & dark)
 * ------------------------------------------------------------------ */

const PALETTE = {
  neutral: "border-border bg-muted/60 text-muted-foreground",
  primary: "border-primary/40 bg-primary/10 text-amber-600 dark:text-amber-400",
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  sky: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  orange: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  red: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

const DOT = {
  neutral: "bg-muted-foreground/50",
  primary: "bg-primary",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  destructive: "bg-destructive",
} as const;

/* ------------------------------------------------------------------ *
 * Verification
 * ------------------------------------------------------------------ */

export const VERIFICATION_TOKENS: TokenMap<VerificationState> = {
  verified: {
    label: "Verified",
    icon: BadgeCheck,
    className: PALETTE.emerald,
    dot: DOT.emerald,
    weight: 0,
  },
  pending: {
    label: "Pending",
    icon: Clock3,
    className: PALETTE.amber,
    dot: DOT.amber,
    animated: true,
    weight: 1,
  },
  unverified: {
    label: "Unverified",
    icon: ShieldX,
    className: PALETTE.neutral,
    dot: DOT.neutral,
    weight: 2,
  },
  deprecated: {
    label: "Deprecated",
    icon: CircleSlash,
    className: PALETTE.destructive,
    dot: DOT.destructive,
    weight: 3,
  },
};

/* ------------------------------------------------------------------ *
 * Registry sync
 * ------------------------------------------------------------------ */

export const REGISTRY_TOKENS: TokenMap<RegistryState> = {
  synced: {
    label: "Synced",
    icon: Database,
    className: PALETTE.emerald,
    dot: DOT.emerald,
    weight: 0,
  },
  updating: {
    label: "Updating",
    icon: RefreshCw,
    className: PALETTE.sky,
    dot: DOT.sky,
    animated: true,
    weight: 1,
  },
  waiting: {
    label: "Waiting",
    icon: Clock3,
    className: PALETTE.amber,
    dot: DOT.amber,
    animated: true,
    weight: 1,
  },
  offline: {
    label: "Offline",
    icon: WifiOff,
    className: PALETTE.destructive,
    dot: DOT.destructive,
    weight: 3,
  },
  unknown: {
    label: "Unknown",
    icon: CircleSlash,
    className: PALETTE.neutral,
    dot: DOT.neutral,
    weight: 2,
  },
};

/* ------------------------------------------------------------------ *
 * Risk
 * ------------------------------------------------------------------ */

export const RISK_TOKENS: TokenMap<RiskLevel> = {
  low: {
    label: "Low risk",
    icon: ShieldCheck,
    className: PALETTE.emerald,
    dot: DOT.emerald,
    weight: 0,
  },
  medium: {
    label: "Medium risk",
    icon: ShieldAlert,
    className: PALETTE.amber,
    dot: DOT.amber,
    weight: 1,
  },
  high: {
    label: "High risk",
    icon: AlertTriangle,
    className: PALETTE.orange,
    dot: DOT.orange,
    weight: 2,
  },
  critical: {
    label: "Critical risk",
    icon: AlertTriangle,
    className: PALETTE.red,
    dot: DOT.red,
    weight: 3,
  },
};

/* ------------------------------------------------------------------ *
 * Reputation
 * ------------------------------------------------------------------ */

export const REPUTATION_TOKENS: TokenMap<ReputationLevel> = {
  excellent: {
    label: "Excellent",
    icon: Star,
    className: PALETTE.emerald,
    dot: DOT.emerald,
    weight: 0,
  },
  good: { label: "Good", icon: Star, className: PALETTE.sky, dot: DOT.sky, weight: 1 },
  average: { label: "Average", icon: Gauge, className: PALETTE.amber, dot: DOT.amber, weight: 2 },
  unknown: {
    label: "Unrated",
    icon: Minus,
    className: PALETTE.neutral,
    dot: DOT.neutral,
    weight: 3,
  },
};

/* ------------------------------------------------------------------ *
 * Activity
 * ------------------------------------------------------------------ */

export const ACTIVITY_TOKENS: TokenMap<ActivityLevel> = {
  trending: {
    label: "Trending",
    icon: TrendingUp,
    className: PALETTE.amber,
    dot: DOT.amber,
    weight: 0,
  },
  popular: {
    label: "Popular",
    icon: Activity,
    className: PALETTE.violet,
    dot: DOT.violet,
    weight: 1,
  },
  new: { label: "New", icon: Plus, className: PALETTE.sky, dot: DOT.sky, weight: 1 },
  stable: {
    label: "Stable",
    icon: Activity,
    className: PALETTE.emerald,
    dot: DOT.emerald,
    weight: 2,
  },
  inactive: {
    label: "Inactive",
    icon: Minus,
    className: PALETTE.neutral,
    dot: DOT.neutral,
    weight: 3,
  },
};

/* ------------------------------------------------------------------ *
 * Builder status
 * ------------------------------------------------------------------ */

export const BUILDER_TOKENS: TokenMap<BuilderStatus> = {
  "verified-builder": {
    label: "Verified Builder",
    icon: UserCheck,
    className: PALETTE.emerald,
    dot: DOT.emerald,
    weight: 0,
  },
  "community-builder": {
    label: "Community Builder",
    icon: Users,
    className: PALETTE.sky,
    dot: DOT.sky,
    weight: 1,
  },
  "unknown-builder": {
    label: "Unknown Builder",
    icon: CircleSlash,
    className: PALETTE.neutral,
    dot: DOT.neutral,
    weight: 2,
  },
  experimental: {
    label: "Experimental",
    icon: FlaskConical,
    className: PALETTE.orange,
    dot: DOT.orange,
    weight: 2,
  },
};

/* ------------------------------------------------------------------ *
 * Agent lifecycle status
 * ------------------------------------------------------------------ */

export const AGENT_STATUS_TOKENS: TokenMap<AgentStatus> = {
  live: {
    label: "Live",
    icon: BadgeCheck,
    className: PALETTE.emerald,
    dot: DOT.emerald,
    weight: 0,
  },
  paused: { label: "Paused", icon: Pause, className: PALETTE.amber, dot: DOT.amber, weight: 1 },
  updating: {
    label: "Updating",
    icon: RefreshCw,
    className: PALETTE.sky,
    dot: DOT.sky,
    animated: true,
    weight: 1,
  },
  "coming-soon": {
    label: "Coming Soon",
    icon: Sparkles,
    className: PALETTE.violet,
    dot: DOT.violet,
    weight: 2,
  },
  retired: {
    label: "Retired",
    icon: CircleSlash,
    className: PALETTE.neutral,
    dot: DOT.neutral,
    weight: 3,
  },
};

/* ------------------------------------------------------------------ *
 * Protocol chip (neutral by design — the protocol name carries meaning)
 * ------------------------------------------------------------------ */

export const PROTOCOL_TOKEN: StateToken = {
  label: "Protocol",
  icon: ShieldCheck,
  className: "border-border bg-card text-muted-foreground",
  dot: DOT.primary,
  weight: 0,
};

/**
 * Registry of every token map keyed by domain — handy for documentation,
 * story generation, and exhaustive rendering in tests.
 */
export const STATE_TOKEN_REGISTRY = {
  verification: VERIFICATION_TOKENS,
  registry: REGISTRY_TOKENS,
  risk: RISK_TOKENS,
  reputation: REPUTATION_TOKENS,
  activity: ACTIVITY_TOKENS,
  builder: BUILDER_TOKENS,
  agentStatus: AGENT_STATUS_TOKENS,
} as const;
