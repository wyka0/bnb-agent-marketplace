"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

/**
 * Marketplace layout primitives.
 *
 * These compose the responsive shell every marketplace-style screen shares:
 * a header, a sticky sidebar of filters and a content column with a grid.
 * They are pure layout — no data, no state.
 *
 * Breakpoints (Tailwind defaults):
 *   Desktop  ≥1280 (xl)   Laptop ≥1024 (lg)
 *   Tablet   ≥768  (md)   Mobile <768   Small mobile <400 (handled by fluid)
 */

/* ------------------------------------------------------------------ *
 * MarketplaceContainer — max-width, centered, responsive gutters.
 * ------------------------------------------------------------------ */

export interface MarketplaceContainerProps {
  children: React.ReactNode;
  /** Max width preset. */
  size?: "default" | "wide" | "full";
  className?: string;
}

export function MarketplaceContainer({
  children,
  size = "default",
  className,
}: MarketplaceContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        size === "default" && "max-w-7xl",
        size === "wide" && "max-w-[96rem]",
        size === "full" && "max-w-none",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * MarketplaceHeader — page title / subtitle / actions band.
 * ------------------------------------------------------------------ */

export interface MarketplaceHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned actions (buttons, etc.). */
  actions?: React.ReactNode;
  /** Optional breadcrumb / eyebrow node above the title. */
  eyebrow?: React.ReactNode;
  className?: string;
}

export function MarketplaceHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  className,
}: MarketplaceHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/* ------------------------------------------------------------------ *
 * MarketplaceLayout — the sidebar + content shell (responsive).
 * ------------------------------------------------------------------ */

export interface MarketplaceLayoutProps {
  /** The filter sidebar column. */
  sidebar: React.ReactNode;
  /** The main content column. */
  children: React.ReactNode;
  /** Sidebar width preset. */
  sidebarWidth?: "sm" | "md" | "lg";
  /** Sidebar side. */
  side?: "left" | "right";
  className?: string;
}

export function MarketplaceLayout({
  sidebar,
  children,
  sidebarWidth = "md",
  side = "left",
  className,
}: MarketplaceLayoutProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 lg:grid-cols-[var(--mp-sidebar)_minmax(0,1fr)]",
        side === "right" && "lg:grid-cols-[minmax(0,1fr)_var(--mp-sidebar)]",
        className
      )}
      style={
        {
          "--mp-sidebar":
            sidebarWidth === "sm" ? "14rem" : sidebarWidth === "lg" ? "20rem" : "17rem",
        } as React.CSSProperties
      }
    >
      {children}
      {/* Source order keeps content first for a11y/SEO; visual order via classes. */}
      <div className={cn("lg:col-start-1 lg:row-start-1", side === "right" && "lg:col-start-2")}>
        {sidebar}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * MarketplaceSidebar — sticky positioning wrapper for filters.
 * ------------------------------------------------------------------ */

export interface MarketplaceSidebarProps {
  children: React.ReactNode;
  /** Sticky offset from top (px). */
  offset?: number;
  className?: string;
}

export function MarketplaceSidebar({ children, offset = 24, className }: MarketplaceSidebarProps) {
  return (
    <div
      style={{ top: offset }}
      className={cn(
        "lg:sticky lg:max-h-[calc(100vh-var(--mp-offset,2rem))] lg:overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * MarketplaceContent — the main results column, source-ordered first.
 * ------------------------------------------------------------------ */

export interface MarketplaceContentProps {
  children: React.ReactNode;
  className?: string;
}

export function MarketplaceContent({ children, className }: MarketplaceContentProps) {
  return (
    <main className={cn("min-w-0 lg:col-start-2 lg:row-start-1", className)}>
      <div className="flex flex-col gap-4">{children}</div>
    </main>
  );
}

/* ------------------------------------------------------------------ *
 * MarketplaceGrid — responsive results grid with density support.
 * ------------------------------------------------------------------ */

export type GridDensity = "comfortable" | "compact";

export interface MarketplaceGridProps {
  children: React.ReactNode;
  /** Column density. */
  density?: GridDensity;
  /** Force a single column (list view). */
  list?: boolean;
  className?: string;
}

export function MarketplaceGrid({
  children,
  density = "comfortable",
  list,
  className,
}: MarketplaceGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        list
          ? "grid-cols-1"
          : density === "compact"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * SectionDivider — labelled horizontal divider between sections.
 * ------------------------------------------------------------------ */

export interface SectionDividerProps {
  /** Optional centered / leading label. */
  label?: React.ReactNode;
  align?: "start" | "center";
  className?: string;
}

export function SectionDivider({ label, align = "start", className }: SectionDividerProps) {
  if (!label) {
    return <hr className={cn("my-6 border-border/70", className)} />;
  }
  return (
    <div
      className={cn(
        "my-6 flex items-center gap-3",
        align === "center" && "justify-center",
        className
      )}
    >
      {align === "center" ? <span className="h-px flex-1 bg-border/70" /> : null}
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border/70" />
    </div>
  );
}
