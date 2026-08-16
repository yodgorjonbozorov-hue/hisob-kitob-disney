import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

/** Mening kassam: qoldiq kartasi, bugungi ko'rsatkichlar va kassa tarixi. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader amal={false} />
      <SkeletonStats soni={3} />
      <SkeletonTable rows={5} />
    </div>
  );
}
