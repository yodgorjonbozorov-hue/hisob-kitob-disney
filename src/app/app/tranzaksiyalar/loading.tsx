import { Skeleton, SkeletonFilters, SkeletonRows } from "@/components/ui/Skeleton";

/**
 * Kirim/Chiqim skeleti — sahifaning HAQIQIY tuzilishini takrorlaydi:
 * sarlavha + amal tugmalari, davr yakuni, filtr paneli, ro'yxat.
 * Shu tufayli ma'lumot kelganda maket "sakramaydi".
 */
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-24 rounded-lg" />
          <Skeleton className="h-11 w-24 rounded-lg" />
        </div>
      </div>
      {/* Davr yakuni: uchta karta + taqsimot qatorlari */}
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <SkeletonFilters soni={4} />
      <div className="bg-surface border border-line rounded-2xl p-5">
        <SkeletonRows rows={8} />
      </div>
    </div>
  );
}
