"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Skeleton } from "../skeleton.js";

/**
 * Marketplace loading skeletons.
 *
 * Each mirrors the layout of the real component so the page doesn't shift when
 * data arrives. All are decorative (`aria-hidden`); wrap a group in
 * `SkeletonGrid` which exposes a polite `role="status"` for screen readers.
 */

/* ------------------------- card + grid ------------------------- */

export function SkeletonCard({ list, className }: { list?: boolean; className?: string }) {
  if (list) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4",
          className
        )}
        aria-hidden="true"
      >
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    );
  }
  return (
    <div
      className={cn("rounded-xl border border-border/60 bg-card/60 p-5", className)}
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <div className="mt-4 flex gap-2 border-t border-border/50 pt-4">
        <Skeleton className="h-8 flex-1 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

export interface SkeletonGridProps {
  /** Number of skeleton cards. */
  count?: number;
  list?: boolean;
  density?: "comfortable" | "compact";
  label?: string;
  className?: string;
}

export function SkeletonGrid({
  count = 6,
  list,
  density = "comfortable",
  label = "Loading agents",
  className,
}: SkeletonGridProps) {
  return (
    <div role="status" aria-label={label} className={className}>
      <span className="sr-only">{label}</span>
      <div
        className={cn(
          "grid gap-4",
          list
            ? "grid-cols-1"
            : density === "compact"
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
        )}
      >
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} list={list} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------- filters + sidebar ------------------------- */

export function SkeletonFilters({
  sections = 3,
  className,
}: {
  sections?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)} aria-hidden="true">
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="space-y-2 border-b border-border/60 pb-4 last:border-0">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 4 }).map((_, r) => (
            <div key={r} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonSidebar({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border/60 bg-card/60 p-4", className)}
      aria-hidden="true"
    >
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-10" />
      </div>
      <SkeletonFilters />
    </div>
  );
}

/* ------------------------- search + toolbar ------------------------- */

export function SkeletonSearch({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 w-full rounded-md", className)} />;
}

export function SkeletonToolbar({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)} aria-hidden="true">
      <div className="flex flex-1 items-center gap-3">
        <Skeleton className="h-10 max-w-md flex-1 rounded-md" />
        <Skeleton className="hidden h-4 w-24 sm:block" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-28 rounded-md" />
        <Skeleton className="h-10 w-16 rounded-md" />
      </div>
    </div>
  );
}

/* ------------------------- pagination ------------------------- */

export function SkeletonPagination({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-1", className)} aria-hidden="true">
      <Skeleton className="h-9 w-9 rounded-md" />
      <Skeleton className="h-9 w-9 rounded-md" />
      <Skeleton className="mx-2 h-4 w-24" />
      <Skeleton className="h-9 w-9 rounded-md" />
      <Skeleton className="h-9 w-9 rounded-md" />
    </div>
  );
}
