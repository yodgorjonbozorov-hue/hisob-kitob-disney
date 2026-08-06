import {
  SkeletonHeader,
  SkeletonStats,
  SkeletonChart,
  SkeletonTable,
} from "@/components/ui/Skeleton";

/** Boshqaruv paneli: sarlavha + oy tanlash, 3 ta stat karta, ikkita grafik, so'nggi yozuvlar. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonStats soni={3} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}
