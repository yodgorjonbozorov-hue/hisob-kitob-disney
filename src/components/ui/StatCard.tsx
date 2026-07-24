import { formatPercent, changeDirection } from "@/lib/format";

/**
 * KPI kartasi: sarlavha + katta qiymat (tabular) + o'tgan davrga nisbatan Δ.
 * `goodWhenUp` — o'sish yaxshimi (kirim uchun true, chiqim uchun false):
 * shu asosda o'q rangi yashil/qizil bo'ladi.
 */
export function StatCard({
  label,
  value,
  changePct = null,
  goodWhenUp = true,
  accent = "neutral",
  children,
}: {
  label: string;
  value: string;
  changePct?: number | null;
  goodWhenUp?: boolean;
  accent?: "income" | "expense" | "neutral" | "brand";
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
    neutral: "text-fg",
  }[accent];

  return (
    <div className="bg-surface rounded-2xl shadow-card border border-line p-4 sm:p-5">
      <p className="text-muted text-sm mb-1">{label}</p>
      <p className={`text-xl sm:text-2xl font-semibold tnum ${accentClass}`}>{value}</p>
      {changePct !== null && (
        <p className={`text-2xs mt-1 flex items-center gap-1 tnum ${deltaClass}`}>
          {dir === "up" ? "▲" : dir === "down" ? "▼" : "•"} {formatPercent(changePct)}
          <span className="text-faint">o'tgan oyga nisbatan</span>
        </p>
      )}
      {children}
    </div>
  );
}
