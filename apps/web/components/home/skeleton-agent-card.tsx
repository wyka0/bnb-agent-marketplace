import { Skeleton } from "@bnb-marketplace/ui";

export function SkeletonAgentCard() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card/60 p-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>

      <Skeleton className="mt-5 h-9 w-full rounded-md" />

      <p className="sr-only">Loading live agent from registry…</p>
    </div>
  );
}
