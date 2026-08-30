"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { XodimPerformanceDTO } from "@/lib/queries/xodimPlan";
import { XodimAvatar } from "./XodimAvatar";
import { PlanProgress, qisqaSumma } from "./PlanProgress";

const HOLAT_BELGI: Record<string, { matn: string; tone: "kirim" | "neutral" | "warning" }> = {
  faol: { matn: "Faol", tone: "kirim" },
  tatil: { matn: "Ta'tilda", tone: "warning" },
  ketgan: { matn: "Ishdan chiqqan", tone: "neutral" },
};

/**
 * XODIM KARTOCHKASI — compact, mobile-first. Progress bar va foiz asosiy
 * vizual element; reytingda medal chiqadi.
 */
export function XodimKarta({
  xodim,
  orin,
  onPlan,
  onTahrir,
}: {
  xodim: XodimPerformanceDTO;
  /** Reytingdagi o'rni (1 dan) — plani borlar uchun medal/raqam. */
  orin: number | null;
  onPlan: () => void;
  onTahrir: () => void;
}) {
  const b = HOLAT_BELGI[xodim.holat] ?? HOLAT_BELGI.faol;
  const medal = orin === 1 ? "🏆" : orin === 2 ? "🥈" : orin === 3 ? "🥉" : null;

  return (
    <div className={`rounded-2xl border border-line bg-surface p-4 ${xodim.isActive ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-3">
        <Link href={`/app/hr/xodim/${xodim.id}`} className="shrink-0">
          <XodimAvatar ism={xodim.ism} rasmUrl={xodim.rasmUrl} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/app/hr/xodim/${xodim.id}`}
              className="font-bold text-fg truncate hover:text-brand"
            >
              {xodim.ism}
            </Link>
            {orin !== null && (
              <span className="text-2xs text-faint tnum shrink-0">{medal ?? `${orin}.`}</span>
            )}
          </div>
          <p className="text-2xs text-muted truncate">{xodim.lavozim ?? "—"}</p>
        </div>
        <Badge tone={b.tone}>{b.matn}</Badge>
      </div>

      <div className="mt-3">
        {xodim.plan ? (
          <PlanProgress plan={xodim.plan} compact />
        ) : (
          <button
            type="button"
            onClick={onPlan}
            className="w-full text-left text-2xs text-muted bg-surface-2 rounded-lg px-3 py-2 hover:text-fg"
          >
            Plan belgilanmagan — bosib belgilang
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-2xs text-muted">
        <span className="tnum">
          {xodim.zakazlar} zakaz · {qisqaSumma(xodim.savdo)} savdo
        </span>
        <span className="tnum">
          {xodim.vazifa.jami > 0 ? `${xodim.vazifa.bajarildi}/${xodim.vazifa.jami} vazifa` : "vazifa yo'q"}
          {xodim.vazifa.kechikkan > 0 && (
            <span className="text-expense"> · {xodim.vazifa.kechikkan} kechikkan</span>
          )}
        </span>
      </div>

      <div className="mt-2 flex gap-3 justify-end border-t border-line pt-2">
        <button type="button" onClick={onPlan} className="text-2xs text-brand hover:underline">
          Plan
        </button>
        <button type="button" onClick={onTahrir} className="text-2xs text-brand hover:underline">
          Tahrirlash
        </button>
        <Link href={`/app/hr/xodim/${xodim.id}`} className="text-2xs text-brand hover:underline">
          Batafsil
        </Link>
      </div>
    </div>
  );
}
