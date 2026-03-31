import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Skeleton — shimmer loading placeholder.
 * Uses CSS shimmer animation defined in globals.css.
 */
export function Skeleton({ className, ...props }: SkeletonProps): React.ReactElement {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[#2A2A2A]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * OrderbookSkeleton — loading placeholder for orderbook ladder.
 * Shows 10 rows per side with shimmer bars.
 */
export function OrderbookSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-6 gap-0 px-3 py-1.5 border-b border-[#2A2A2A]">
        <Skeleton className="h-3 w-8 col-span-2" />
        <Skeleton className="h-3 w-6 ml-auto" />
        <Skeleton className="h-3 w-8 col-span-2 ml-auto" />
        <Skeleton className="h-3 w-6 ml-auto" />
      </div>
      {/* Body */}
      <div className="grid grid-cols-2 gap-0 flex-1">
        <div className="flex flex-col gap-0.5 p-1 border-r border-[#2A2A2A]/50">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={`bid-skel-${i}`} className="flex items-center justify-between px-2 py-[3px]">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 p-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={`ask-skel-${i}`} className="flex items-center justify-between px-2 py-[3px]">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * TradeTickerSkeleton — loading placeholder for trade ticker.
 */
export function TradeTickerSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2A2A2A]">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-6" />
        <Skeleton className="h-3 w-6" />
      </div>
      <div className="flex-1 p-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`trade-skel-${i}`} className="flex items-center justify-between px-2 py-[3px]">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * DepthChartSkeleton — loading placeholder for depth chart.
 */
export function DepthChartSkeleton(): React.ReactElement {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[160px]">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-20 w-48 rounded-lg" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
