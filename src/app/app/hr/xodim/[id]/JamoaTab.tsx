"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatSom } from "@/lib/format";
import { USTUN_NOMI, type Ustun } from "@/lib/crm/pipeline";
import type { XodimJamoaKpiDTO, LavozimKpiDTO } from "@/lib/queries/xodimJamoaKpi";
import type { XodimZakazQatoriDTO } from "@/lib/queries/kategoriyaAnalitika";

/** Bitta KPI katakchasi. */
function Katak({ label, qiymat, rang = "text-fg" }: { label: string; qiymat: string; rang?: string }) {
  return (
    <Card className="p-3">
      <p className="text-2xs text-muted">{label}</p>
      <p className={`text-xl font-bold tnum ${rang}`}>{qiymat}</p>
    </Card>
  );
}

/**
 * LAVOZIM KPI KARTALARI (16-23-talab) — turga qarab:
 *   sotuvchi: zakaz oldi / yutilgan / bekor / konversiya / jami savdo / o'rtacha chek;
 *   ijrochi:  zakazga chiqdi / bajarildi / bekor / o'rtacha baho.
 */
function LavozimKartalar({ k }: { k: LavozimKpiDTO }) {
  if (k.turi === "sotuvchi") {
    const maxraj = k.yutilgan + k.yoqotilgan;
    const konversiya = maxraj > 0 ? Math.round((k.yutilgan / maxraj) * 1000) / 10 : 0;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Katak label="Zakaz oldi" qiymat={String(k.jami)} />
        <Katak label="Yutilgan" qiymat={String(k.yutilgan)} rang="text-income" />
        <Katak label="Bekor" qiymat={String(k.yoqotilgan)} rang={k.yoqotilgan > 0 ? "text-expense" : "text-fg"} />
        <Katak label="Conversion" qiymat={`${konversiya}%`} />
        <Katak label="Jami savdo" qiymat={`${formatSom(k.summa)} so'm`} />
        <Katak label="O'rtacha chek" qiymat={`${formatSom(k.yutilgan > 0 ? Math.round(k.summa / k.yutilgan) : 0)} so'm`} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Katak label="Zakazga chiqdi" qiymat={String(k.jami)} />
      <Katak label="Bajarildi" qiymat={String(k.yutilgan)} rang="text-income" />
      <Katak label="Bekor" qiymat={String(k.yoqotilgan)} rang={k.yoqotilgan > 0 ? "text-expense" : "text-fg"} />
      <Katak label="O'rtacha baho" qiymat={k.ortachaBaho !== null ? `${k.ortachaBaho}/10` : "—"} />
    </div>
  );
}

const USTUN_RANGI: Record<string, string> = {
  YUTILDI: "text-income",
  YOQOTILDI: "text-expense",
};

/**
 * LAVOZIM KPI TABI — xodimning har lavozimi bo'yicha oy KPI'si va zakaz
 * qatnashuvlari lentasi. Manba — CRM biriktiruvlari (hisoblagich emas).
 */
export function JamoaTab({
  jamoa,
  zakazlar,
  oy,
}: {
  jamoa: XodimJamoaKpiDTO | null;
  zakazlar: XodimZakazQatoriDTO[];
  oy: string;
}) {
  if (!jamoa || jamoa.kpi.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="🏷️"
          title="Lavozim biriktirilmagan"
          description="Xodimlar → Lavozimlar bo'limida xodimni lavozimga biriktiring — zakazlardagi qatnashuvi shu yerda hisoblanadi."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {jamoa.kpi.map((k) => (
        <div key={k.categoryId} className="space-y-2">
          <p className="text-2xs uppercase tracking-wide text-faint">
            {k.nomi} · {oy}
          </p>
          <LavozimKartalar k={k} />
        </div>
      ))}

      <Card className="p-0 overflow-hidden">
        <p className="px-4 pt-3 text-2xs uppercase tracking-wide text-faint">Zakazlar</p>
        {zakazlar.length === 0 ? (
          <EmptyState icon="🧾" title="Bu oyda zakaz qatnashuvi yo'q" />
        ) : (
          <ul className="divide-y divide-line">
            {zakazlar.map((z) => (
              <li key={`${z.dealId}-${z.kategoriyaNomi}`}>
                <Link
                  href={`/app/crm?buyurtma=${z.dealId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-fg truncate">{z.nomi}</span>
                    <span className="block text-2xs text-muted tnum">
                      {z.sana}
                      {z.mijoz ? ` · ${z.mijoz}` : ""} · {z.kategoriyaNomi}
                      {z.baho !== null ? ` · baho ${z.baho}/10` : ""}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-medium text-fg tnum">{formatSom(z.summa)}</span>
                    <span className={`block text-2xs ${USTUN_RANGI[z.ustun] ?? "text-muted"}`}>
                      {USTUN_NOMI[z.ustun as Ustun] ?? z.ustun}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
