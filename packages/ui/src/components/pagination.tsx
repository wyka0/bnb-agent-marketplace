import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "./icons.js";
import { Button } from "./button.js";
import { cn } from "../lib/utils.js";

export interface PaginationProps {
  /** Current (1-indexed) page. */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Called when the user requests a page change. */
  onPageChange: (page: number) => void;
  /** Optional className. */
  className?: string;
}

function clampInRange(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  const current = clampInRange(page, 1, Math.max(1, totalPages));
  const hasPrevious = current > 1;
  const hasNext = current < totalPages;

  const previous = () => hasPrevious && onPageChange(current - 1);
  const next = () => hasNext && onPageChange(current + 1);
  const first = () => hasPrevious && onPageChange(1);
  const last = () => hasNext && onPageChange(totalPages);

  return (
    <nav aria-label="Pagination" className={cn("flex items-center gap-1", className)}>
      <Button variant="outline" size="icon" onClick={first} disabled={!hasPrevious}>
        <ChevronsLeft className="h-4 w-4" />
        <span className="sr-only">First page</span>
      </Button>
      <Button variant="outline" size="icon" onClick={previous} disabled={!hasPrevious}>
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous page</span>
      </Button>
      <span aria-live="polite" className="px-3 text-sm text-muted-foreground">
        Page {current} of {totalPages}
      </span>
      <Button variant="outline" size="icon" onClick={next} disabled={!hasNext}>
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next page</span>
      </Button>
      <Button variant="outline" size="icon" onClick={last} disabled={!hasNext}>
        <ChevronsRight className="h-4 w-4" />
        <span className="sr-only">Last page</span>
      </Button>
    </nav>
  );
}
Pagination.displayName = "Pagination";

export { Pagination };
