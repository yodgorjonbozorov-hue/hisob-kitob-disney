import { SkeletonHeader, SkeletonBoard } from "@/components/ui/Skeleton";

/** Vazifalar: ochiq / jarayonda / bajarildi ustunlari. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonBoard ustunlar={3} kartalar={4} />
    </div>
  );
}
