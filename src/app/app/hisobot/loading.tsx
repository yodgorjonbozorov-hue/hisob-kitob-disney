import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

/** Hisobot sahifasi og'ir agregatlarga tayanadi — o'ziga mos skelet ko'rsatiladi. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Hisobot yuklanmoqda">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <SkeletonRows rows={5} />
    </div>
  );
}
