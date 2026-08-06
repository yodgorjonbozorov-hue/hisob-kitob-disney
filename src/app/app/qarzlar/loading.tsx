import { SkeletonHeader, SkeletonStats, SkeletonFilters, SkeletonTable } from "@/components/ui/Skeleton";

/** Qarzdorlik: ikki yo'nalish yakuni, filtr va qarzlar ro'yxati. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonStats soni={3} />
      <SkeletonFilters soni={2} />
      <SkeletonTable rows={8} />
    </div>
  );
}
