"use client";

import * as React from "react";
import { Alert, AlertDescription, AlertTitle, Button } from "@bnb-marketplace/ui";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>An unexpected error occurred while loading this page.</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
