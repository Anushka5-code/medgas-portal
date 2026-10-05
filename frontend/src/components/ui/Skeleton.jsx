/** Animated shimmer skeleton block. */
export function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:400%_100%] rounded-xl ${className}`}
      style={{ backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite' }}
    />
  );
}

/** Full-page skeleton for initial load. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse">
      <Skeleton className="h-36 w-full" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-64 col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
