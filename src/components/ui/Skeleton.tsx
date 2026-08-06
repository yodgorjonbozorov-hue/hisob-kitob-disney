export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

/** Jadval/ro'yxat uchun tayyor skelet qatorlari. */
export function SkeletonRows({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/**
 * SAHIFA SKELETLARI (`loading.tsx` uchun).
 *
 * Maqsad — generik spinner emas, sahifaning HAQIQIY tuzilishini takrorlash:
 * foydalanuvchi kontent kelguncha ham qayerda nima turishini ko'radi va
 * yuklangach sahifa "sakramaydi".
 */

/** Sahifa sarlavhasi + (ixtiyoriy) o'ng tarafdagi amal tugmasi. */
export function SkeletonHeader({ amal = true }: { amal?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Skeleton className="h-8 w-48" />
      {amal && <Skeleton className="h-11 w-32 rounded-lg" />}
    </div>
  );
}

/** Yuqoridagi statistika kartalari qatori. */
export function SkeletonStats({ soni = 3 }: { soni?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: soni }).map((_, i) => (
        <div key={i} className="bg-surface border border-line rounded-2xl p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Grafik bloki (trend, kunlik dinamika). */
export function SkeletonChart({ balandlik = "h-64" }: { balandlik?: string }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className={`w-full ${balandlik}`} />
    </div>
  );
}

/** Kartaga o'ralgan jadval/ro'yxat. */
export function SkeletonTable({ rows = 6, sarlavha = true }: { rows?: number; sarlavha?: boolean }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
      {sarlavha && <Skeleton className="h-4 w-40" />}
      <SkeletonRows rows={rows} />
    </div>
  );
}

/** Filtr paneli (sana oraliq, tur, kategoriya). */
export function SkeletonFilters({ soni = 4 }: { soni?: number }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 flex flex-wrap gap-3">
      {Array.from({ length: soni }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-36 rounded-lg" />
      ))}
    </div>
  );
}

/** Kanban ustunlari (CRM, vazifalar). */
export function SkeletonBoard({ ustunlar = 3, kartalar = 3 }: { ustunlar?: number; kartalar?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: ustunlar }).map((_, i) => (
        <div key={i} className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: kartalar }).map((_, j) => (
            <Skeleton key={j} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
}
