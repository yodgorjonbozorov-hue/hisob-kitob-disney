import { Skeleton } from "@/components/ui/Skeleton";

/** AI Copilot: to'liq ekranli suhbat oynasi yuklanmoqda. */
export default function Loading() {
  return (
    <div className="ai-ekran -mx-4 -mt-4 -mb-24 lg:m-0 flex gap-4">
      <div className="hidden xl:block w-60 shrink-0 rounded-2xl border border-line bg-surface p-3 space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-8 w-3/4 rounded-lg" />
        <Skeleton className="h-8 w-2/3 rounded-lg" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col bg-surface lg:rounded-2xl lg:border lg:border-line overflow-hidden">
        <div className="border-b border-line px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
        <div className="flex-1 flex flex-col justify-center items-center gap-3 px-4">
          <Skeleton className="h-6 w-40 rounded-lg" />
          <Skeleton className="h-28 w-full max-w-2xl rounded-xl" />
          <Skeleton className="h-10 w-full max-w-2xl rounded-xl" />
        </div>
        <div className="border-t border-line px-3 lg:px-6 py-3">
          <Skeleton className="h-12 w-full max-w-3xl mx-auto rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
