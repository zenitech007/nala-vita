import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gray-200/80 dark:bg-gray-800/80",
        className
      )}
      {...props}
    />
  );
}

export function DashboardMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1E1F22] p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-3 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1E1F22]"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-3 w-48 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}