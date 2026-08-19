import { cn } from "@/lib/cn";

/**
 * KPI kartochkasi — raqam birinchi, izoh keyin.
 *
 * Typografiya: raqam `font-display` (Manrope, tabular) — ustunlar va
 * kartochkalar orasida raqamlar bir xil kenglikda turadi va sakramaydi.
 */
export function Kpi({
  label,
  qiymat,
  izoh,
  ton = "neytral",
  href,
}: {
  label: string;
  qiymat: string;
  izoh?: string;
  ton?: "neytral" | "muvaffaqiyat" | "ogoh" | "xavf";
  href?: string;
}) {
  const tonKlass = {
    neytral: "text-fg",
    muvaffaqiyat: "text-income-fg",
    ogoh: "text-debt-fg",
    xavf: "text-expense-fg",
  }[ton];

  const ichi = (
    <>
      <p className="text-2xs uppercase tracking-wide text-faint font-medium">{label}</p>
      <p className={cn("font-display text-xl mt-1 tabular-nums", tonKlass)}>{qiymat}</p>
      {izoh && <p className="text-2xs text-muted mt-1 leading-snug">{izoh}</p>}
    </>
  );

  const klass =
    "bg-surface border border-line rounded-xl p-4 min-w-0 transition hover:border-line-strong";

  if (href) {
    return (
      <a href={href} className={cn(klass, "block focus-visible:outline-none")}>
        {ichi}
      </a>
    );
  }
  return <div className={klass}>{ichi}</div>;
}

/** KPI qatori — 375px da 2 ustun, 1280px+ da 5 ustun. */
export function KpiSetka({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">{children}</div>
  );
}
