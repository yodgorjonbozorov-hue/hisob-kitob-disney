import { SkeletonHeader, SkeletonFilters, SkeletonTable } from "@/components/ui/Skeleton";

/** Yozuvlar: sarlavha, filtr paneli, jami qatori va lenta. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonFilters soni={5} />
      <SkeletonTable rows={10} />
    </div>
  );
}
