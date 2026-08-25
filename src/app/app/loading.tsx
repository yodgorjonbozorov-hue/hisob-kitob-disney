import { Skeleton, SkeletonHeader, SkeletonChart } from "@/components/ui/Skeleton";

/**
 * Boshqaruv panelining SKELETI — yuklanayotgan sahifaning haqiqiy tuzilishi:
 * sarlavha, 5 KPI, grafik + insight, bugungi holat + ogohlantirishlar,
 * kategoriya taqsimoti. Kontent kelganda maket "sakramaydi".
 *
 * `SkeletonStats` ATAYLAB ishlatilmadi: u 3 ustunli tarmoqqa qotirilgan,
 * bu yerda esa telefonda 2, kattasida 5 ustun.
 */
export default function Loading() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <SkeletonHeader />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`bg-surface border border-line rounded-2xl p-4 sm:p-5 space-y-3 ${
              i === 4 ? "col-span-2 lg:col-span-1" : ""
            }`}
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SkeletonChart />
        </div>
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-surface border border-line rounded-2xl p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart balandlik="h-48" />
        <SkeletonChart balandlik="h-48" />
      </div>
    </div>
  );
}
