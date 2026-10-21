import { cn } from "@/lib/utils";

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded bg-slate-800",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent motion-safe:after:via-slate-700/40 motion-safe:after:to-transparent",
        "motion-safe:after:animate-shimmer",
        className
      )}
    />
  );
}

export function AgreementCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading agreement"
      className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5"
    >
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-4 w-2/5" />
        <SkeletonLine className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonLine className="h-3 w-3/5" />
      <div className="flex gap-3">
        <SkeletonLine className="h-3 w-1/4" />
        <SkeletonLine className="h-3 w-1/4" />
      </div>
      <div className="flex items-center justify-between border-t border-slate-800 pt-2">
        <SkeletonLine className="h-3 w-1/3" />
        <SkeletonLine className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

