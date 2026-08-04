import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

/** Budjet: kategoriya bo'yicha limit va sarf qatorlari. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonTable rows={8} />
    </div>
  );
}
