import * as React from "react";
import { Inbox } from "./icons.js";
import { cn } from "../lib/utils.js";

export interface EmptyStateProps {
  /** Primary title. */
  title?: string;
  /** Secondary descriptive text, aka overrides. */
  description?: string;
  /** Optional CTA action rendered after the copy. */
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center",
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      {title ? <h3 className="text-lg font-semibold">{title}</h3> : null}
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
EmptyState.displayName = "EmptyState";

export { EmptyState };
