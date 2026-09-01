"use client";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatSom } from "@/lib/format";
import type { SotuvchiKpiDTO } from "@/lib/queries/sotuvchiKpi";

/**
 * SOTUVCHI KPI KARTALARI (20-talab).
 *
 * "Yutilgan summa" va "Puli kelgan" ATAYLAB yonma-yon turadi: birinchisi
 * yopilgan sotuv qiymati, ikkinchisi haqiqatda kelgan pul. Bonus faqat
 * ikkinchisidan hisoblanadi (16/17/18-talab), shuning uchun farq ko'rinib
 * turishi kerak.
 */
export function SotuvchiKpiKartalar({
  kpi,
  loading = false,
}: {
  kpi: SotuvchiKpiDTO;
  loading?: boolean;
}) {
  const kartalar = [
    { label: "Olingan zakaz", qiymat: `${kpi.olingan.soni} ta` },
    { label: "Zakaz summasi", qiymat: `${formatSom(kpi.olingan.summa)} so'm` },
    { label: "Yutildi", qiymat: `${kpi.yutilgan.soni} ta` },
    { label: "Yutilgan summa", qiymat: `${formatSom(kpi.yutilgan.summa)} so'm` },
    { label: "Puli kelgan sotuv", qiymat: `${formatSom(kpi.puliKelgan)} so'm` },
    { label: "Konversiya", qiymat: `${kpi.konversiya}%` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kartalar.map((k) => (
        <Card key={k.label}>
          <p className="text-muted text-xs mb-1">{k.label}</p>
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p className="text-lg font-bold text-fg tnum truncate" title={k.qiymat}>
              {k.qiymat}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

/** Yutilgan/yo'qotilgan/jarayonda taqsimoti — bitta ixcham qator. */
export function SotuvchiOqimQatori({ kpi }: { kpi: SotuvchiKpiDTO }) {
  return (
    <Card className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <span className="text-muted">
        Yutilgan: <span className="font-semibold text-income tnum">{kpi.yutilgan.soni} ta</span>
      </span>
      <span className="text-muted">
        Yo&apos;qotilgan: <span className="font-semibold text-expense tnum">{kpi.yoqotilgan.soni} ta</span>
      </span>
      <span className="text-muted">
        Jarayonda: <span className="font-semibold text-fg tnum">{kpi.jarayonda.soni} ta</span>
      </span>
      <span className="text-muted">
        Qarzdagi sotuv:{" "}
        <span className="font-semibold text-debt tnum">{formatSom(kpi.qarzdagi)} so&apos;m</span>
      </span>
      <span className="text-muted">
        Sotuv bonusi bazasi:{" "}
        <span className="font-semibold text-brand tnum">{formatSom(kpi.bonusAsosi)} so&apos;m</span>
      </span>
    </Card>
  );
}
