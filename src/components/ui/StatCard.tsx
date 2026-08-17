import Link from "next/link";
import { formatPercent, changeDirection } from "@/lib/format";

/**
 * KPI kartasi: sarlavha + katta qiymat (tabular) + o'tgan davrga nisbatan Δ.
 * `goodWhenUp` — o'sish yaxshimi (kirim uchun true, chiqim uchun false):
 * shu asosda o'q rangi yashil/qizil bo'ladi.
 *
 * `href` berilsa karta butunlay bosiladigan bo'ladi (ichki havola emas —
 * barmoq bilan nishonga tegish oson bo'lsin), `title` esa uzun raqamning
 * to'liq ko'rinishini hoverda beradi.
 */
export function StatCard({
  label,
  value,
  changePct = null,
  goodWhenUp = true,
  accent = "neutral",
  href,
  title,
  children,
}: {
  label: string;
  value: string;
  changePct?: number | null;
  goodWhenUp?: boolean;
  accent?: "income" | "expense" | "neutral" | "brand" | "debt";
  href?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const dir = changeDirection(changePct);
  const isGood = dir === "flat" ? null : (dir === "up") === goodWhenUp;
  const deltaClass =
    isGood === null ? "text-faint" : isGood ? "text-income" : "text-expense";

  const accentClass = {
    income: "text-income",
    expense: "text-expense",
    brand: "text-brand",
    debt: "text-debt",
    neutral: "text-fg",
  }[accent];

  const ichi = (
    <>
      <p className="text-muted text-sm mb-1 flex items-center gap-1">
        {label}
        {href && <span aria-hidden className="text-faint">›</span>}
      </p>
      <p className={`text-xl sm:text-2xl font-semibold tnum ${accentClass}`} title={title}>
        {value}
      </p>
      {changePct !== null && (
        <p className={`text-2xs mt-1 flex items-center gap-1 tnum ${deltaClass}`}>
          {dir === "up" ? "▲" : dir === "down" ? "▼" : "•"} {formatPercent(changePct)}
          <span className="text-faint">o'tgan oyga nisbatan</span>
        </p>
      )}
      {children}
    </>
  );

  const asos = "bg-surface rounded-2xl shadow-card border border-line p-4 sm:p-5";
  if (href) {
    return (
      <Link
        href={href}
        className={`${asos} block transition hover:border-brand hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
      >
        {ichi}
      </Link>
    );
  }
  return <div className={asos}>{ichi}</div>;
}
