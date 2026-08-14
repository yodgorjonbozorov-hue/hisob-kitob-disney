import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

/** Kunlik hisobot tarixi: kunlar ro'yxati. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonTable rows={10} />
    </div>
  );
}
