"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils.js";

/**
 * Filter primitives.
 *
 * All are controlled and state-agnostic: the consuming page owns filter state
 * and passes values + change handlers. No querying, no URL sync, no business
 * logic. Built for keyboard + screen-reader use out of the box.
 */

/* ------------------------------------------------------------------ *
 * FilterSidebar — the scrollable container for filter sections.
 * ------------------------------------------------------------------ */

export interface FilterSidebarProps {
  /** Optional heading shown at the top of the sidebar. */
  title?: string;
  /** Optional trailing node in the header (e.g. ResetFiltersButton). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FilterSidebar({
  title = "Filters",
  action,
  children,
  className,
}: FilterSidebarProps) {
  return (
    <aside
      aria-label={title}
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border bg-card/60 p-4",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      <div className="flex flex-col divide-y divide-border/70">{children}</div>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * FilterSection — a collapsible titled group.
 * ------------------------------------------------------------------ */

export interface FilterSectionProps {
  title: string;
  /** Optional count / hint shown next to the title. */
  hint?: React.ReactNode;
  /** Collapsible (default true). */
  collapsible?: boolean;
  /** Initial open state when collapsible (default true). */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FilterSection({
  title,
  hint,
  collapsible = true,
  defaultOpen = true,
  children,
  className,
}: FilterSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const contentId = React.useId();
  const isOpen = collapsible ? open : true;

  return (
    <section className={cn("py-3 first:pt-1", className)}>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md py-1 text-left text-sm font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex items-center gap-2">
            {title}
            {hint ? (
              <span className="text-xs font-normal text-muted-foreground">{hint}</span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className="flex items-center gap-2 py-1 text-sm font-medium">
          {title}
          {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
        </div>
      )}
      <div id={contentId} hidden={!isOpen} className="mt-2">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * FilterGroup — spacing wrapper for a set of options; supports a11y grouping.
 * ------------------------------------------------------------------ */

export interface FilterGroupProps {
  /** When set, renders as a radiogroup/group with an accessible label. */
  label?: string;
  /** Layout: stacked list (default) or wrapped chips. */
  layout?: "list" | "wrap";
  /** ARIA role for the group. */
  role?: "radiogroup" | "group";
  children: React.ReactNode;
  className?: string;
}

export function FilterGroup({
  label,
  layout = "list",
  role = "group",
  children,
  className,
}: FilterGroupProps) {
  return (
    <div
      role={role}
      aria-label={label}
      className={cn(
        layout === "wrap" ? "flex flex-wrap gap-2" : "flex flex-col gap-1.5",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * FilterChip — toggleable pill (multi-select friendly).
 * ------------------------------------------------------------------ */

export interface FilterChipProps {
  label: React.ReactNode;
  selected: boolean;
  onToggle: () => void;
  /** Optional leading icon. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional count suffix. */
  count?: number;
  disabled?: boolean;
  className?: string;
}

export function FilterChip({
  label,
  selected,
  onToggle,
  icon: Icon,
  count,
  disabled,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {label}
      {typeof count === "number" ? (
        <span
          className={cn(
            "ml-0.5 rounded-full px-1.5 text-[10px]",
            selected ? "bg-primary/20" : "bg-muted"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * FilterCheckbox — labelled checkbox row with optional count.
 * ------------------------------------------------------------------ */

export interface FilterCheckboxProps {
  label: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
  count?: number;
  disabled?: boolean;
  className?: string;
}

export function FilterCheckbox({
  label,
  checked,
  onToggle,
  count,
  disabled,
  className,
}: FilterCheckboxProps) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted/60",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span className="flex items-center gap-2">
        <span className="relative flex h-4 w-4 items-center justify-center">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onToggle}
            className="peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-border bg-background transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          />
          <svg
            viewBox="0 0 12 12"
            className="pointer-events-none absolute h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10.4 2.4 4.7 8.1 1.6 5 2.7 3.9 4.7 5.9 9.3 1.3z" />
          </svg>
        </span>
        <span className="text-foreground/90 group-hover:text-foreground">{label}</span>
      </span>
      {typeof count === "number" ? (
        <span className="text-xs text-muted-foreground">{count}</span>
      ) : null}
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * FilterRadio — single option in an exclusive group.
 * ------------------------------------------------------------------ */

export interface FilterRadioProps {
  label: React.ReactNode;
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  count?: number;
  disabled?: boolean;
  className?: string;
}

export function FilterRadio({
  label,
  name,
  value,
  checked,
  onSelect,
  count,
  disabled,
  className,
}: FilterRadioProps) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted/60",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span className="flex items-center gap-2">
        <span className="relative flex h-4 w-4 items-center justify-center">
          <input
            type="radio"
            name={name}
            value={value}
            checked={checked}
            disabled={disabled}
            onChange={() => onSelect(value)}
            className="peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-background transition-colors checked:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          />
          <span
            className="pointer-events-none absolute h-2 w-2 rounded-full bg-primary opacity-0 peer-checked:opacity-100"
            aria-hidden="true"
          />
        </span>
        <span className="text-foreground/90 group-hover:text-foreground">{label}</span>
      </span>
      {typeof count === "number" ? (
        <span className="text-xs text-muted-foreground">{count}</span>
      ) : null}
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * FilterToggle — a labelled on/off switch (e.g. "Verified only").
 * ------------------------------------------------------------------ */

export interface FilterToggleProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function FilterToggle({
  label,
  description,
  checked,
  onToggle,
  disabled,
  className,
}: FilterToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span className="flex flex-col">
        <span className="text-sm text-foreground/90">{label}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-primary" : "bg-muted-foreground/30"
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
