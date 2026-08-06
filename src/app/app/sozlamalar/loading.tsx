import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

/** Sozlamalar (modullar) ro'yxati. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader amal={false} />
      <SkeletonTable rows={6} />
    </div>
  );
}
