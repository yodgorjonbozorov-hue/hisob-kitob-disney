import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

/** Obuna: joriy tarif, tariflar va to'lovlar tarixi. */
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <SkeletonHeader amal={false} />
      <SkeletonStats soni={3} />
      <SkeletonTable rows={5} />
    </div>
  );
}
