"use client";

import * as React from "react";
import {
  ArrowUpDown,
  Check,
  LayoutGrid,
  List,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils.js";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../dropdown-menu.js";

/**
 * Toolbar primitives — search, sort, view controls and the active-filter bar.
 * All controlled; the page owns state. No querying or business logic.
 */

/* ------------------------------------------------------------------ *
 * SearchToolbar — horizontal container that arranges toolbar controls.
 * ------------------------------------------------------------------ */

export interface SearchToolbarProps {
  /** Left cluster (usually SearchInput + ResultCounter). */
  children: React.ReactNode;
  /** Right cluster (Sort / View / Grid toggles). */
  actions?: React.ReactNode;
  className?: string;
}

export function SearchToolbar({ children, actions, className }: SearchToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-1 items-center gap-3">{children}</div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * SearchInput — accessible search field with clear button.
 * ------------------------------------------------------------------ */

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible label (visually hidden). */
  label?: string;
  onSubmit?: (value: string) => void;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search the live ERC-8004 registry…",
  label = "Search the live ERC-8004 registry",
  onSubmit,
  className,
}: SearchInputProps) {
  const id = React.useId();
  return (
    <div className={cn("relative flex-1 lg:max-w-[520px]", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        role="searchbox"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) onSubmit(value);
        }}
        className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-10 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * ResultCounter — polite live count of results.
 * ------------------------------------------------------------------ */

export interface ResultCounterProps {
  /** Number of results currently shown / matched. */
  count: number;
  /** Optional total (renders "12 of 240"). */
  total?: number;
  /** Noun, singular. Pluralised with a trailing "s". */
  noun?: string;
  /** Loading suppresses the number for a subtle placeholder. */
  loading?: boolean;
  className?: string;
}

export function ResultCounter({
  count,
  total,
  noun = "agent",
  loading,
  className,
}: ResultCounterProps) {
  const plural = count === 1 ? noun : `${noun}s`;
  return (
    <p
      aria-live="polite"
      className={cn("whitespace-nowrap text-sm text-muted-foreground", className)}
    >
      {loading ? (
        <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted align-middle" />
      ) : (
        <>
          <span className="font-medium text-foreground">{count.toLocaleString()}</span>
          {typeof total === "number" ? <> of {total.toLocaleString()}</> : null} {plural}
        </>
      )}
    </p>
  );
}

/* ------------------------------------------------------------------ *
 * SortDropdown — single-select sort menu built on the shared DropdownMenu.
 * ------------------------------------------------------------------ */

export interface SortOption {
  value: string;
  label: string;
}

export interface SortDropdownProps {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SortDropdown({ options, value, onChange, className }: SortDropdownProps) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        aria-label="Sort by"
      >
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline">Sort:</span>
        <span className="text-foreground">{current?.label ?? "Default"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onChange(o.value)}
            className="justify-between"
          >
            {o.label}
            {o.value === value ? (
              <Check className="h-4 w-4 text-primary" aria-hidden="true" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ *
 * ViewToggle — list vs grid switch (segmented control).
 * ------------------------------------------------------------------ */

export type ViewMode = "grid" | "list";

export interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className={cn(
        "inline-flex items-center rounded-md border border-input bg-background p-0.5",
        className
      )}
    >
      <SegmentButton active={value === "grid"} onClick={() => onChange("grid")} label="Grid view">
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      </SegmentButton>
      <SegmentButton active={value === "list"} onClick={() => onChange("list")} label="List view">
        <List className="h-4 w-4" aria-hidden="true" />
      </SegmentButton>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * GridToggle — grid density switch (comfortable vs compact columns).
 * ------------------------------------------------------------------ */

export type GridDensity = "comfortable" | "compact";

export interface GridToggleProps {
  value: GridDensity;
  onChange: (value: GridDensity) => void;
  className?: string;
}

export function GridToggle({ value, onChange, className }: GridToggleProps) {
  return (
    <div
      role="group"
      aria-label="Grid density"
      className={cn(
        "inline-flex items-center rounded-md border border-input bg-background p-0.5",
        className
      )}
    >
      <SegmentButton
        active={value === "comfortable"}
        onClick={() => onChange("comfortable")}
        label="Comfortable density"
      >
        <Rows3 className="h-4 w-4" aria-hidden="true" />
      </SegmentButton>
      <SegmentButton
        active={value === "compact"}
        onClick={() => onChange("compact")}
        label="Compact density"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      </SegmentButton>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * FilterBadge — a single removable active-filter token.
 * ------------------------------------------------------------------ */

export interface FilterBadgeProps {
  label: React.ReactNode;
  /** Optional facet name, e.g. "Category". */
  facet?: string;
  onRemove: () => void;
  className?: string;
}

export function FilterBadge({ label, facet, onRemove, className }: FilterBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 py-0.5 pl-2.5 pr-1 text-xs font-medium text-foreground",
        className
      )}
    >
      {facet ? <span className="text-muted-foreground">{facet}:</span> : null}
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${facet ? `${facet} ` : ""}${typeof label === "string" ? label : ""}`.trim()}
        onClick={onRemove}
        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * ResetFiltersButton — clears all active filters.
 * ------------------------------------------------------------------ */

export interface ResetFiltersButtonProps {
  onReset: () => void;
  /** Hide when there is nothing to reset. */
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function ResetFiltersButton({
  onReset,
  disabled,
  label = "Reset",
  className,
}: ResetFiltersButtonProps) {
  return (
    <button
      type="button"
      onClick={onReset}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
    >
      <X className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * ActiveFilterBar — wraps FilterBadges + a reset control.
 * ------------------------------------------------------------------ */

export interface ActiveFilterBarProps {
  /** Rendered FilterBadge nodes. */
  children: React.ReactNode;
  /** Whether any filters are active (controls empty rendering). */
  hasActiveFilters: boolean;
  onReset?: () => void;
  className?: string;
}

export function ActiveFilterBar({
  children,
  hasActiveFilters,
  onReset,
  className,
}: ActiveFilterBarProps) {
  if (!hasActiveFilters) return null;
  return (
    <div
      role="region"
      aria-label="Active filters"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <span className="text-xs font-medium text-muted-foreground">Active:</span>
      {children}
      {onReset ? <ResetFiltersButton onReset={onReset} label="Clear all" className="ml-1" /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * StickyToolbar — sticky wrapper for toolbars that pin under the header.
 * ------------------------------------------------------------------ */

export interface StickyToolbarProps {
  children: React.ReactNode;
  /** Top offset (px) to sit under a fixed header. Default 0. */
  offset?: number;
  className?: string;
}

export function StickyToolbar({ children, offset = 0, className }: StickyToolbarProps) {
  return (
    <div
      style={{ top: offset }}
      className={cn(
        "sticky z-30 -mx-px border-b border-border/70 bg-background/80 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      {children}
    </div>
  );
}
