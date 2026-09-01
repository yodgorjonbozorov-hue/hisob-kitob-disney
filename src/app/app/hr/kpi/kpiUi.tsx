import { Badge } from "@/components/ui/Badge";
import { qisqaSumma } from "../PlanProgress";
import type { BallHolati } from "@/lib/kpi/hisob";

/**
 * KPI bo'limining umumiy vizual bo'laklari. Mavjud Balansa tiliga
 * (rounded-2xl, border-line, bg-surface, tnum) qat'iy amal qiladi —
 * yangi dizayn tizimi kiritilmaydi.
 */

export { qisqaSumma };

const HOLAT_BELGI: Record<BallHolati, { matn: string; tone: "kirim" | "warning" | "chiqim" | "neutral" }> = {
  yaxshi: { matn: "Yaxshi", tone: "kirim" },
  ogohlantirish: { matn: "Ogohlantirish", tone: "warning" },
  risk: { matn: "Risk", tone: "chiqim" },
  kritik: { matn: "Kritik", tone: "chiqim" },
};

export function BallBelgi({ holat }: { holat: BallHolati }) {
  const b = HOLAT_BELGI[holat];
  return <Badge tone={b.tone}>{b.matn}</Badge>;
}

/** Oylik holati belgisi — QORALAMA "hozirgi hisob", qolganlari yakuniy. */
const OYLIK_BELGI: Record<string, { matn: string; tone: "info" | "warning" | "kirim" | "neutral" }> = {
  QORALAMA: { matn: "Hozirgi hisob", tone: "info" },
  HISOBLANDI: { matn: "Hisoblandi", tone: "neutral" },
  TASDIQLANDI: { matn: "Tasdiqlandi", tone: "warning" },
  TOLANDI: { matn: "To'landi", tone: "kirim" },
};

export function OylikBelgi({ holat }: { holat: string }) {
  const b = OYLIK_BELGI[holat] ?? OYLIK_BELGI.QORALAMA;
  return <Badge tone={b.tone}>{b.matn}</Badge>;
}

/** Foizga qarab rang — plan chizig'i uchun (mavjud `foizRang` bilan bir xil qoida). */
function planRang(foiz: number): string {
  if (foiz >= 100) return "bg-income";
  if (foiz >= 70) return "bg-brand";
  return "bg-warning";
}

/** SOTUV PLANI CHIZIG'I — "97.5 / 100 mln · 97%". */
export function PlanChizigi({
  sotuv,
  plan,
  foiz,
  compact = false,
}: {
  sotuv: number;
  plan: number;
  foiz: number;
  compact?: boolean;
}) {
  const kenglik = Math.min(100, Math.max(0, foiz));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={`${compact ? "text-2xs" : "text-sm"} text-muted`}>
          Plan:{" "}
          <span className="text-fg font-medium tnum">
            {qisqaSumma(sotuv)} / {qisqaSumma(plan)}
          </span>
        </p>
        <p
          className={`${compact ? "text-sm" : "text-lg"} font-bold tnum ${
            foiz >= 100 ? "text-income" : "text-fg"
          }`}
        >
          {foiz}%
        </p>
      </div>
      <div
        className={`${compact ? "h-1.5" : "h-2"} mt-1 rounded-full bg-surface-2 overflow-hidden`}
        role="progressbar"
        aria-valuenow={kenglik}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${planRang(foiz)} transition-all`} style={{ width: `${kenglik}%` }} />
      </div>
    </div>
  );
}

/** BALL CHIZIG'I — "91 / 100 ball" (ball 100 ga nisbatan). */
export function BallChizigi({
  ball,
  boshlangich,
  compact = false,
}: {
  ball: number;
  boshlangich: number;
  compact?: boolean;
}) {
  const kenglik = boshlangich > 0 ? Math.min(100, Math.round((ball / boshlangich) * 100)) : 0;
  const rang = ball >= 85 ? "bg-income" : ball >= 70 ? "bg-brand" : ball >= 55 ? "bg-warning" : "bg-expense";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={`${compact ? "text-2xs" : "text-sm"} text-muted`}>Ball</p>
        <p className={`${compact ? "text-sm" : "text-lg"} font-bold tnum text-fg`}>
          {ball} <span className="text-faint font-normal">/ {boshlangich}</span>
        </p>
      </div>
      <div className={`${compact ? "h-1.5" : "h-2"} mt-1 rounded-full bg-surface-2 overflow-hidden`}>
        <div className={`h-full rounded-full ${rang} transition-all`} style={{ width: `${kenglik}%` }} />
      </div>
    </div>
  );
}

/** Foizni yuzdan bir aniqlikdagi butun sondan matnga (11000 → "110%"). */
export function foizMatn(foiz: number): string {
  const butun = foiz / 100;
  return `${Number.isInteger(butun) ? butun : butun.toFixed(1)}%`;
}
