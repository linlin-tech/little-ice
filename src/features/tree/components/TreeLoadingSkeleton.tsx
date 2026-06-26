/**
 * TreeLoadingSkeleton（加载骨架屏）
 */

export function TreeLoadingSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-4">
      <div className="h-12 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-4">
        <div className="h-10 w-36 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="flex gap-3">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-muted" />
        <div className="h-8 w-28 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
