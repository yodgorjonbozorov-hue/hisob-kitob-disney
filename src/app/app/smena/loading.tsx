import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

/** Smena yakuni: kutilgan naqd va oldingi yakunlar. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonStats soni={2} />
      <SkeletonTable rows={6} />
    </div>
  );
}
