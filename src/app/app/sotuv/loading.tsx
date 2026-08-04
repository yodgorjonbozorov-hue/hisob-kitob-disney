import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

/** Sotuv: bugungi yakun va sotuvlar ro'yxati. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonStats soni={2} />
      <SkeletonTable rows={8} />
    </div>
  );
}
