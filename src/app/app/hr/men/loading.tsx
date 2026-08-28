import { Skeleton, SkeletonHeader } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <SkeletonHeader amal={false} />
      <Skeleton className="h-28" />
      <Skeleton className="h-14" />
      <Skeleton className="h-40" />
    </div>
  );
}
