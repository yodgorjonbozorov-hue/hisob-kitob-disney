"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SotuvchiKpiKartalar, SotuvchiOqimQatori } from "../../sotuvchilar/SotuvchiKpiKartalar";
import type { SotuvchiKpiDTO } from "@/lib/queries/sotuvchiKpi";

/**
 * SOTUV TABI (24-talab) — xodim kartochkasida sotuvchi KPI'si.
 * Faqat sotuvchi kategoriyasidagi xodimda ko'rinadi; to'liq tafsilot
 * (davr filtri, zakazlar lentasi, bonus) alohida sahifada.
 */
export function SotuvTab({
  kpi,
  employeeId,
  oy,
}: {
  kpi: SotuvchiKpiDTO | null;
  employeeId: string;
  oy: string;
}) {
  if (!kpi) {
    return (
      <Card>
        <EmptyState
          icon="🏷️"
          title="Bu xodim sotuvchi emas"
          description="Xodimlar → Kategoriyalar bo'limida uni 'Sotuvchi' turidagi kategoriyaga biriktiring — zakazlari shu yerda hisoblanadi."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <SotuvchiKpiKartalar kpi={kpi} />
      <SotuvchiOqimQatori kpi={kpi} />
      <Link
        href={`/app/hr/sotuvchilar/${employeeId}`}
        className="inline-block text-brand text-sm font-medium"
      >
        To&apos;liq sotuv statistikasi ({oy}) →
      </Link>
    </div>
  );
}
