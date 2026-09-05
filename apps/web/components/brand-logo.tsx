import Link from "next/link";

/**
 * BrandLogo — the single branding source of truth (matches the Homepage nav).
 *
 * BNB gold "BNB" mark + "BNB Agent / MARKETPLACE" wordmark. Used by both the
 * marketing nav (HomeNav) and the application nav (TopNav) so every page shares
 * identical branding. Do not fork this markup.
 *
 * Accessible name (exposed once via the Link's aria-label):
 * "BNB Agent Marketplace home" — the inner visual spans are decorative text;
 * aria-label overrides them for assistive tech (no duplicate announcement).
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group flex shrink-0 items-center gap-2.5 ${className ?? ""}`}
      aria-label="BNB Agent Marketplace home"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-black tracking-tight text-primary-foreground shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)] transition-shadow group-hover:shadow-[0_0_32px_-4px_hsl(var(--primary)/0.9)]">
        BNB
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-tight">BNB Agent</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Marketplace
        </span>
      </span>
    </Link>
  );
}
