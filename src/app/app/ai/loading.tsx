import { Skeleton, SkeletonHeader } from "@/components/ui/Skeleton";

/** AI yordamchi: suhbat oynasi va kiritish maydoni. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader amal={false} />
      <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
        <Skeleton className="h-16 w-3/4 rounded-xl" />
        <Skeleton className="h-24 w-5/6 ml-auto rounded-xl" />
        <Skeleton className="h-16 w-2/3 rounded-xl" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
