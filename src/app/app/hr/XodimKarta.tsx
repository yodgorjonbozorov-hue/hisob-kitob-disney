"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { XodimPerformanceDTO } from "@/lib/queries/xodimPlan";
import type { XodimJamoaKpiDTO, LavozimKpiDTO } from "@/lib/queries/xodimJamoaKpi";
import { XodimAvatar } from "./XodimAvatar";
import { PlanProgress, qisqaSumma } from "./PlanProgress";

const HOLAT_BELGI: Record<string, { matn: string; tone: "kirim" | "neutral" | "warning" }> = {
  faol: { matn: "Faol", tone: "kirim" },
  tatil: { matn: "Ta'tilda", tone: "warning" },
  ketgan: { matn: "Ishdan chiqqan", tone: "neutral" },
};

/**
 * LAVOZIM KPI SATRI (14-talab) — lavozim turiga mos ko'rsatkichlar:
 *   sotuvchi: "46 ta zakaz · 41 ta yutilgan · 22,4 mln so'm"
 *   ijrochi:  "31 ta zakazga chiqdi · 29 ta bajarildi · baho 9.4"
 * Shofyor/videochi pul bilan baholanmaydi (18-talab).
 */
function LavozimKpi({ k }: { k: LavozimKpiDTO }) {
  if (k.turi === "sotuvchi") {
    return (
      <span className="tnum">
        {k.jami} ta zakaz · {k.yutilgan} ta yutilgan · {qisqaSumma(k.summa)} so&apos;m
      </span>
    );
  }
  return (
    <span className="tnum">
      {k.jami} ta zakazga chiqdi · {k.yutilgan} ta bajarildi
      {k.ortachaBaho !== null ? ` · baho ${k.ortachaBaho}` : ""}
    </span>
  );
}

/**
 * XODIM KARTOCHKASI — compact, mobile-first: rasm, ism, lavozim(lar),
 * "Bu oy" lavozim KPI'si, plan progress, vazifalar.
 */
export function XodimKarta({
  xodim,
  jamoa,
  orin,
  onPlan,
  onTahrir,
}: {
  xodim: XodimPerformanceDTO;
  /** Lavozim kesimidagi oy KPI'si (null — lavozimsiz xodim). */
  jamoa: XodimJamoaKpiDTO | null;
  /** Reytingdagi o'rni (1 dan) — plani borlar uchun medal/raqam. */
  orin: number | null;
  onPlan: () => void;
  onTahrir: () => void;
}) {
  const b = HOLAT_BELGI[xodim.holat] ?? HOLAT_BELGI.faol;
  const medal = orin === 1 ? "🏆" : orin === 2 ? "🥈" : orin === 3 ? "🥉" : null;
  const lavozimMatni = jamoa?.lavozimlar.length
    ? jamoa.lavozimlar.map((l) => l.nomi).join(" · ")
    : xodim.lavozim ?? "—";
  // Faqat qatnashuvi yoki a'zoligi bor lavozimlar — bo'sh satr ko'rsatilmaydi.
  const kpiQatorlar = (jamoa?.kpi ?? []).filter((k) => k.jami > 0 || jamoa?.lavozimlar.some((l) => l.categoryId === k.categoryId));

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
          <p className="text-2xs text-muted truncate">{lavozimMatni}</p>
        </div>
        <Badge tone={b.tone}>{b.matn}</Badge>
      </div>

      {kpiQatorlar.length > 0 && (
        <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 space-y-0.5">
          <p className="text-2xs uppercase tracking-wide text-faint">Bu oy</p>
          {kpiQatorlar.map((k) => (
            <p key={k.categoryId} className="text-xs text-fg">
              {kpiQatorlar.length > 1 && <span className="text-muted">{k.nomi}: </span>}
              <LavozimKpi k={k} />
            </p>
          ))}
        </div>
      )}

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
        {kpiQatorlar.length === 0 ? (
          <span className="tnum">
            {xodim.zakazlar} zakaz · {qisqaSumma(xodim.savdo)} savdo
          </span>
        ) : (
          <span />
        )}
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
