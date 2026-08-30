"use client";

import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import type { XodimZakazDTO } from "@/lib/queries/xodimPlan";

const TOLOV_NOMI: Record<string, string> = {
  naqd: "Naqd",
  click: "Click",
  qarz: "Qarzga",
};

/** ZAKAZLAR TAB — oy ichidagi kirim yozuvlari lentasi (sotuvchi kesimi). */
export function ZakazlarTab({
  zakazlar,
  userIdBor,
}: {
  zakazlar: XodimZakazDTO[];
  userIdBor: boolean;
}) {
  if (!userIdBor) {
    return (
      <Card>
        <EmptyState
          icon="🔗"
          title="Tizim hisobi bog'lanmagan"
          description="Zakazlar kirim yozuvlaridan sotuvchi kesimida hisoblanadi. Xodimni foydalanuvchi hisobiga bog'lasangiz, zakazlari shu yerda ko'rinadi."
        />
      </Card>
    );
  }
  if (zakazlar.length === 0) {
    return (
      <Card>
        <EmptyState icon="🧾" title="Bu oyda zakaz yo'q" />
      </Card>
    );
  }

  const jami = zakazlar.reduce((s, z) => s + z.summa, 0);

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-bold text-fg">{zakazlar.length} ta zakaz</p>
        <Money value={jami} size="sm" tone="income" />
      </div>
      <div className="space-y-2">
        {zakazlar.map((z) => (
          <div
            key={z.id}
            className="flex items-center justify-between gap-2 border-b border-line last:border-0 pb-2 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm text-fg truncate">
                {z.crmNomi ?? z.izoh ?? z.kategoriya ?? "Zakaz"}
                {z.crmNomi && <span className="text-2xs text-faint"> · CRM</span>}
              </p>
              <p className="text-2xs text-muted tnum">
                {z.sana}
                {z.kategoriya && ` · ${z.kategoriya}`}
                {z.tolovTuri && ` · ${TOLOV_NOMI[z.tolovTuri] ?? z.tolovTuri}`}
              </p>
            </div>
            <Money value={z.summa} size="sm" tone="income" />
          </div>
        ))}
      </div>
      <p className="text-2xs text-faint mt-3">
        Qarz to&apos;lovlari ro&apos;yxatga kirmaydi — qarzga savdo faqat savdo kunida bir
        marta sanaladi.
      </p>
    </Card>
  );
}
