import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

/** Admin bo'limlari (bizneslar, foydalanuvchilar, kategoriyalar, audit, savat)
 *  bir xil tuzilishda: sarlavha + jadval. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonTable rows={10} />
    </div>
  );
}
