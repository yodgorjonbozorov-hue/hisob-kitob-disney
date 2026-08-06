import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

/** Takroriy yozuvlar andozalari. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonTable rows={6} />
    </div>
  );
}
