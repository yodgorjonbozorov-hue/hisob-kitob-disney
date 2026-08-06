import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

/** Superadmin: tenantlar va to'lovlar jadvallari. */
export default function Loading() {
  return (
    <div className="p-4 space-y-6">
      <SkeletonHeader amal={false} />
      <SkeletonStats soni={4} />
      <SkeletonTable rows={10} />
      <SkeletonTable rows={6} />
    </div>
  );
}
