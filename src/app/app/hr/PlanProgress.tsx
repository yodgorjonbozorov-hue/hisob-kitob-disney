import { PLAN_BIRLIK, PLAN_NOMI, type PlanTuri } from "@/lib/validation/hr";
import type { PlanDTO } from "@/lib/queries/xodimPlan";

/** Foizga qarab rang: 100%+ yashil, 70%+ brend, undan past — ogohlantirish. */
export function foizRang(foiz: number): string {
  if (foiz >= 100) return "bg-income";
  if (foiz >= 70) return "bg-brand";
  return "bg-warning";
}

/** So'm qiymatlarini qisqa ko'rsatish (38 500 000 → "38.5 mln"). */
export function qisqaSumma(qiymat: number): string {
  if (Math.abs(qiymat) >= 1_000_000_000)
    return `${(qiymat / 1_000_000_000).toLocaleString("uz-UZ", { maximumFractionDigits: 1 })} mlrd`;
  if (Math.abs(qiymat) >= 1_000_000)
    return `${(qiymat / 1_000_000).toLocaleString("uz-UZ", { maximumFractionDigits: 1 })} mln`;
  return qiymat.toLocaleString("uz-UZ");
}

/** Plan qiymatini turiga qarab formatlaydi (soni — dona, summa — qisqa so'm). */
export function planQiymat(turi: PlanTuri, qiymat: number): string {
  return turi === "savdo" || turi === "kirim" ? qisqaSumma(qiymat) : String(qiymat);
}

/**
 * PLAN PROGRESS — asosiy vizual element: "42 / 50 zakaz · 84%" + chiziq.
 * Foiz 100 dan oshsa chiziq to'la va yashil bo'ladi (110% raqamda ko'rinadi).
 */
export function PlanProgress({ plan, compact = false }: { plan: PlanDTO; compact?: boolean }) {
  const kenglik = Math.min(100, plan.foiz);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={`${compact ? "text-2xs" : "text-sm"} text-muted`}>
          {PLAN_NOMI[plan.planTuri]}:{" "}
          <span className="text-fg font-medium tnum">
            {planQiymat(plan.planTuri, plan.natija)} / {planQiymat(plan.planTuri, plan.maqsad)}{" "}
            {PLAN_BIRLIK[plan.planTuri]}
          </span>
        </p>
        <p
          className={`${compact ? "text-sm" : "text-lg"} font-bold tnum ${
            plan.foiz >= 100 ? "text-income" : "text-fg"
          }`}
        >
          {plan.foiz}%
        </p>
      </div>
      <div
        className={`${compact ? "h-1.5" : "h-2"} mt-1 rounded-full bg-surface-2 overflow-hidden`}
        role="progressbar"
        aria-valuenow={plan.foiz}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full ${foizRang(plan.foiz)} transition-all`}
          style={{ width: `${kenglik}%` }}
        />
      </div>
    </div>
  );
}
