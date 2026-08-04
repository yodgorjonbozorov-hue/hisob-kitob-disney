import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

/**
 * /app ostidagi BARCHA sahifalar uchun umumiy yuklanish skeleti.
 *
 * NEGA MUHIM: `loading.tsx` bo'lmaganida Next.js dinamik sahifa uchun suspense
 * chegarasi yarata olmaydi — natijada (1) `<Link>` prefetch hech narsa oldindan
 * yuklamaydi va (2) tugma bosilganda server javob bergunicha ekranda MUTLAQO
 * hech nima o'zgarmaydi, ilova "qotib qolgandek" ko'rinadi.
 *
 * Endi bosilishi bilan skelet ko'rinadi, yon menyu esa joyida qoladi.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-9 w-40" />
      </div>

      <Skeleton className="h-24 w-full" />
      <SkeletonRows rows={6} />
    </div>
  );
}
