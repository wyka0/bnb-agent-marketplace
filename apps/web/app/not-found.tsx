import Link from "next/link";
import { Button } from "@bnb-marketplace/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <p className="text-6xl font-bold tracking-tight text-muted-foreground">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Button>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
