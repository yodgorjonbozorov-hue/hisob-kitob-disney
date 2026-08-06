import { SkeletonHeader, SkeletonStats, SkeletonChart, SkeletonTable } from "@/components/ui/Skeleton";

/** Oylik hisobot: oy tanlash, yakun kartalari, kategoriya taqsimoti, eksport jadvali. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonStats soni={3} />
      <SkeletonChart balandlik="h-56" />
      <SkeletonTable rows={8} />
    </div>
  );
}
