"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils.js";
import {
  ACTIVITY_TOKENS,
  AGENT_STATUS_TOKENS,
  BUILDER_TOKENS,
  PROTOCOL_TOKEN,
  REGISTRY_TOKENS,
  REPUTATION_TOKENS,
  RISK_TOKENS,
  VERIFICATION_TOKENS,
  type StateToken,
} from "./tokens.js";
import type {
  ActivityLevel,
  AgentStatus,
  BuilderStatus,
  RegistryState,
  ReputationLevel,
  RiskLevel,
  VerificationState,
} from "./tokens.js";

/**
 * Unified badge system.
 *
 * Every badge (Verification / Risk / Registry / Activity / Builder / Protocol /
 * Status / Reputation) is a thin wrapper over the shared `StateBadge`
 * renderer, so they ALL expose the same API:
 *
 *   size?:    "sm" | "md" | "lg"       (default "md")
 *   variant?: "solid" | "soft" | "dot" (default "soft")
 *   withIcon?: boolean                 (default true)
 *   label?:   string                   (override the token label)
 *   className?: string
 *
 * The `state` prop name is the only thing that changes between badges, and it
 * is strongly typed to that badge's domain union.
 */

export type BadgeSize = "sm" | "md" | "lg";
export type BadgeVariant = "solid" | "soft" | "dot";

export interface BadgeBaseProps {
  /** Visual size. */
  size?: BadgeSize;
  /** `soft` = tinted (default) · `solid` = filled dot label · `dot` = dot only. */
  variant?: BadgeVariant;
  /** Show the leading icon (ignored for `dot` variant). */
  withIcon?: boolean;
  /** Override the token's default label. */
  label?: string;
  className?: string;
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-0.5 text-xs gap-1.5",
  lg: "px-3 py-1 text-sm gap-1.5",
};

const ICON_SIZE: Record<BadgeSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

/**
 * Internal renderer shared by every public badge. Not exported as a component
 * to keep the public surface to the eight named badges, but the props type is
 * exported so consumers can build their own state chips if needed.
 */
export interface StateBadgeProps extends BadgeBaseProps {
  token: StateToken;
  /** Accessible role — status badges announce politely; decorative ones don't. */
  role?: "status";
}

export function StateBadge({
  token,
  size = "md",
  variant = "soft",
  withIcon = true,
  label,
  className,
  role,
}: StateBadgeProps) {
  const Icon = token.icon;
  const text = label ?? token.label;

  if (variant === "dot") {
    return (
      <span
        role={role}
        aria-label={text}
        className={cn(
          "inline-flex items-center gap-1.5 font-medium text-foreground",
          size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs",
          className
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            token.dot,
            token.animated && "animate-pulse"
          )}
          aria-hidden="true"
        />
        {text}
      </span>
    );
  }

  return (
    <span
      role={role}
      aria-label={text}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border font-medium tracking-tight transition-colors",
        SIZE_CLASSES[size],
        variant === "solid" ? "border-transparent" : "",
        token.className,
        className
      )}
    >
      {withIcon ? (
        token.animated && Icon === RefreshCw ? (
          <RefreshCw className={cn(ICON_SIZE[size], "animate-spin")} aria-hidden="true" />
        ) : (
          <Icon className={ICON_SIZE[size]} aria-hidden="true" />
        )
      ) : token.animated ? (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", token.dot, "animate-pulse")}
          aria-hidden="true"
        />
      ) : null}
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * The eight public badges — identical API, domain-typed `state`.
 * ------------------------------------------------------------------ */

export function VerificationBadge({
  state,
  ...rest
}: BadgeBaseProps & { state: VerificationState }) {
  return <StateBadge token={VERIFICATION_TOKENS[state]} {...rest} />;
}

export function RiskBadge({ state, ...rest }: BadgeBaseProps & { state: RiskLevel }) {
  return <StateBadge token={RISK_TOKENS[state]} {...rest} />;
}

export function RegistryBadge({ state, ...rest }: BadgeBaseProps & { state: RegistryState }) {
  return <StateBadge token={REGISTRY_TOKENS[state]} role="status" {...rest} />;
}

export function ActivityBadge({ state, ...rest }: BadgeBaseProps & { state: ActivityLevel }) {
  return <StateBadge token={ACTIVITY_TOKENS[state]} {...rest} />;
}

export function BuilderBadge({ state, ...rest }: BadgeBaseProps & { state: BuilderStatus }) {
  return <StateBadge token={BUILDER_TOKENS[state]} {...rest} />;
}

export function StatusBadge({ state, ...rest }: BadgeBaseProps & { state: AgentStatus }) {
  return <StateBadge token={AGENT_STATUS_TOKENS[state]} role="status" {...rest} />;
}

export function ReputationBadge({ state, ...rest }: BadgeBaseProps & { state: ReputationLevel }) {
  return <StateBadge token={REPUTATION_TOKENS[state]} {...rest} />;
}

export function ProtocolBadge({ label, ...rest }: BadgeBaseProps & { label: string }) {
  return <StateBadge token={PROTOCOL_TOKEN} label={label} {...rest} />;
}
