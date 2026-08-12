import Link from "next/link";
import { APP_NAME } from "@bnb-marketplace/config";

export function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} {APP_NAME}
        </p>
        <nav className="flex gap-4" aria-label="Footer">
          <Link href="/marketplace" className="hover:text-foreground">
            Marketplace
          </Link>
          <Link href="/leaderboards" className="hover:text-foreground">
            Leaderboards
          </Link>
          <Link href="/settings" className="hover:text-foreground">
            Settings
          </Link>
        </nav>
      </div>
    </footer>
  );
}
