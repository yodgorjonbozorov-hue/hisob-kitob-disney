import { Skeleton, SkeletonFilters, SkeletonRows } from "@/components/ui/Skeleton";

/**
 * Kirim/Chiqim skeleti — sahifaning HAQIQIY tuzilishini takrorlaydi:
 * sarlavha + amal tugmalari, filtr paneli, ro'yxat.
 *
 * "Davr yakuni" bloki ATAYLAB yo'q: u faqat direktorga ko'rinadi, skelet
 * esa rolni bilmaydi. Uni har kimga ko'rsatib keyin yo'qotish — kassirda
 * maket sakrashi va bir lahzalik "nimadir bor edi" taassuroti demak.
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
      <SkeletonFilters soni={4} />
      <div className="bg-surface border border-line rounded-2xl p-5">
        <SkeletonRows rows={8} />
      </div>
    </div>
  );
}
