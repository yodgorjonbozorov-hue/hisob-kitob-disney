import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

/** Mijoz kartochkasi. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonStats soni={3} />
      <SkeletonTable rows={6} />
    </div>
  );
}
