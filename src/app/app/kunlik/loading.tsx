import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

/** Kunlik hisobot: to'lov turi kartalari, jami karta va tushumlar ro'yxati. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonStats soni={3} />
      <SkeletonTable rows={6} />
    </div>
  );
}
