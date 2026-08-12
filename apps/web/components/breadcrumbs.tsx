"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment) => ({
    href: `/${segments.slice(0, segments.indexOf(segment) + 1).join("/")}`,
    label: segment.replace(/-/g, " "),
  }));
  return crumbs;
}

export interface BreadcrumbsProps {
  items?: { label: string; href?: string }[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const pathname = usePathname();
  const derived = buildCrumbs(pathname);

  const shown = items ?? derived;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
        </li>
        {shown.map((crumb, index) => {
          const isLast = index === shown.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <ChevronRight className="h-3.5 w-3.5" />
              <li>
                {isLast || !crumb.href ? (
                  <span aria-current="page" className="font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
