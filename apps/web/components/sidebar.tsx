"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENT_CATEGORIES } from "@bnb-marketplace/config";
import { cn } from "@bnb-marketplace/ui";

const primaryItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/categories", label: "Categories" },
  { href: "/compare", label: "Compare" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/settings", label: "Settings" },
  { href: "/profile", label: "Profile" },
];

const categoryHref: Record<(typeof AGENT_CATEGORIES)[number], string> = {
  rebalancing: "/categories/rebalancing",
  "grid-trading": "/categories/grid-trading",
  yield: "/categories/yield",
  "health-factor": "/categories/health-factor",
};

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string): boolean => pathname === href;

  return (
    <aside className="hidden w-52 shrink-0 border-r border-border/50 bg-transparent xl:block">
      <nav className="sticky top-16 flex flex-col gap-5 p-4" aria-label="Sidebar">
        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
            Navigate
          </p>
          {primaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 font-medium text-primary"
                  : "font-normal text-muted-foreground/80 hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
            Categories
          </p>
          {AGENT_CATEGORIES.map((category) => (
            <Link
              key={category}
              href={categoryHref[category]}
              className="rounded-md px-3 py-1.5 text-sm font-normal capitalize text-muted-foreground/80 transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              {category.replace("-", " ")}
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  );
}
