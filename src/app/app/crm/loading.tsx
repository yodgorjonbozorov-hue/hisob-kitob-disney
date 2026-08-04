import { SkeletonHeader, SkeletonStats, SkeletonBoard } from "@/components/ui/Skeleton";

/** CRM: bosqichlar bo'yicha kanban taxtasi. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonStats soni={3} />
      <SkeletonBoard ustunlar={4} kartalar={3} />
    </div>
  );
}
