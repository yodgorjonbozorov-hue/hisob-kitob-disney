import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader amal={false} />
      <SkeletonStats soni={6} />
      <SkeletonTable rows={6} />
    </div>
  );
}
