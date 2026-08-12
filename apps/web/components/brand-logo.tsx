import Link from "next/link";

/**
 * BrandLogo — the single branding source of truth (matches the Homepage nav).
 *
 * Gold "B" mark + "Agent Studio / MARKETPLACE" wordmark. Used by both the
 * marketing nav (HomeNav) and the application nav (TopNav) so every page shares
 * identical branding. Do not fork this markup.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group flex items-center gap-2.5 ${className ?? ""}`}
      aria-label="BNB Agent Studio Marketplace home"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)] transition-shadow group-hover:shadow-[0_0_32px_-4px_hsl(var(--primary)/0.9)]">
        B
      </span>
      <span className="hidden flex-col leading-tight sm:flex">
        <span className="text-sm font-bold tracking-tight">Agent Studio</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Marketplace
        </span>
      </span>
    </Link>
  );
}
