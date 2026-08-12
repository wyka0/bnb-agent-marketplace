import * as React from "react";
import { Loader2 } from "./icons.js";
import { cn } from "../lib/utils.js";

export interface LoadingSpinnerProps {
  /** Relative size: small for inline, medium default, large for full blocks. */
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizeClasses: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

function LoadingSpinner({ size = "md", className, label }: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}
    >
      <Loader2 className={cn("animate-spin", sizeClasses[size])} aria-hidden="true" />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}
LoadingSpinner.displayName = "LoadingSpinner";

export { LoadingSpinner };
