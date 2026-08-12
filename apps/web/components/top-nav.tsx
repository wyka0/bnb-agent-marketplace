import Link from "next/link";
import { Search } from "lucide-react";
import { NAV_ITEMS } from "@bnb-marketplace/config";
import { ThemeToggle } from "./theme-toggle";
import { BrandLogo } from "./brand-logo";

/**
 * Application top navigation.
 *
 * Shares the Homepage branding source of truth (`BrandLogo`) and the same
 * header height, spacing, colors, and button language so moving from the
 * marketing site into the app feels continuous — not a different website.
 * Nav links intentionally carry a light visual weight so the page content
 * (the Marketplace) leads.
 */
export function TopNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-6">
        <BrandLogo />

        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {NAV_ITEMS.filter((item) => item.href !== "/").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <a
            href="#search"
            aria-label="Jump to search"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </a>

          <ThemeToggle />

          <button
            type="button"
            disabled
            title="Wallet connection arrives in a future sprint"
            className="hidden h-10 items-center gap-2 rounded-md border border-border bg-primary/10 px-4 text-sm font-medium text-primary opacity-70 xl:inline-flex"
          >
            Connect Wallet
            <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              Coming Soon
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
