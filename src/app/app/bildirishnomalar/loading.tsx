import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

/** Bildirishnomalar ro'yxati. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader amal={false} />
      <SkeletonTable rows={8} sarlavha={false} />
    </div>
  );
}
