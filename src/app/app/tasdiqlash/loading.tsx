import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

/** Tasdiqlash: kutayotgan so'rovlar yakuni va ro'yxati. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonStats soni={2} />
      <SkeletonTable rows={6} />
    </div>
  );
}
