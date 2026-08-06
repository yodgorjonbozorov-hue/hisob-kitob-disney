import { SkeletonHeader, SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";

/** Kassalar: jami qoldiq, kassa kartalari va ko'chirishlar ro'yxati. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader amal={false} />
      <SkeletonStats soni={3} />
      <SkeletonTable rows={5} />
    </div>
  );
}
