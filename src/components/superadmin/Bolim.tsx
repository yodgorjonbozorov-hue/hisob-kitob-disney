import { cn } from "@/lib/cn";

/**
 * Sahifa sarlavhasi va bo'lim kartochkasi — TIPOGRAFIK IYERARXIYA (talab 39).
 *
 *   Sahifa sarlavhasi (lg)  ->  Bo'lim sarlavhasi (sm/medium)  ->  Matn  ->  Izoh (2xs)
 *
 * Har sahifa shu ikki komponentdan foydalanadi, shuning uchun bo'limlar
 * o'rtasida vizual farq yuzaga kelmaydi.
 */

export function SahifaSarlavha({
  sarlavha,
  izoh,
  amallar,
}: {
  sarlavha: string;
  izoh?: string;
  amallar?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-lg font-display font-semibold text-fg">{sarlavha}</h2>
        {izoh && <p className="text-sm text-muted mt-0.5">{izoh}</p>}
      </div>
      {amallar && <div className="flex flex-wrap items-center gap-2">{amallar}</div>}
    </div>
  );
}

export function Bolim({
  sarlavha,
  izoh,
  amallar,
  className = "",
  children,
}: {
  sarlavha?: string;
  izoh?: string;
  amallar?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-surface border border-line rounded-xl p-4", className)}>
      {(sarlavha || amallar) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            {sarlavha && <h3 className="text-sm font-medium text-fg">{sarlavha}</h3>}
            {izoh && <p className="text-2xs text-muted mt-0.5">{izoh}</p>}
          </div>
          {amallar}
        </div>
      )}
      {children}
    </section>
  );
}
