import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

/** Tasdiq qoidalari ro'yxati. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonTable rows={5} />
    </div>
  );
}
