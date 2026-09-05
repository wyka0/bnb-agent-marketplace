"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "../../lib/utils.js";

/**
 * Favorite toggle — consumer owns the state (`active`, `onToggle`).
 * Future mapping: favorites list persisted by Agent Studio (local/account).
 */
export function FavoriteButton({
  active,
  onToggle,
  agentName,
  size = "md",
  className,
}: {
  active: boolean;
  onToggle: () => void;
  /** aria-label subject, e.g. agent name. */
  agentName?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active
          ? `Remove ${agentName ?? "agent"} from favorites`
          : `Add ${agentName ?? "agent"} to favorites`
      }
      onClick={onToggle}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/60 text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        active && "border-primary/60 bg-primary/10 text-primary",
        className
      )}
    >
      <Heart
        className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", active && "fill-current")}
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * Compare checkbox — visual checkbox toggling the compare tray selection.
 * Consumer owns selection state. Role/aria mimic a real checkbox for SR.
 */
export function CompareCheckbox({
  checked,
  onToggle,
  agentName,
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  agentName?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${checked ? "Remove" : "Add"} ${agentName ?? "agent"} for comparison`}
      onClick={onToggle}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:border-primary/60",
        className
      )}
    >
      <svg
        viewBox="0 0 12 12"
        className={cn("h-3 w-3 transition-opacity", checked ? "opacity-100" : "opacity-0")}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10.4 2.4 4.7 8.1 1.6 5 2.7 3.9 4.7 5.9 9.3 1.3z" />
      </svg>
    </button>
  );
}
