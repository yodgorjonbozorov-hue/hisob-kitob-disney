"use client";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import type { SotuvYozuvi } from "@/lib/kpi/sotuv";

/**
 * SOTUVLAR LENTASI — bonusga KIRGAN yozuvlar.
 *
 * Ro'yxat sotuv raqamining tekshiruvi: qaysi zakazlar bonusga kirgani
 * shu yerda ochiq turadi. Qarzga savdo va qisman to'langan qarz bu yerda
 * KO'RINMAYDI — ular bonusga kirmaydi.
 */
export function SotuvlarBloki({
  sotuvlar,
  userIdBor,
}: {
  sotuvlar: Array<Omit<SotuvYozuvi, "sana"> & { sana: string }>;
  userIdBor: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg mb-3">Sotuvlar</h2>

      {!userIdBor ? (
        <EmptyState
          title="Tizim hisobi bog'lanmagan"
          description="Sotuv avtomatik hisoblanishi uchun xodim kartochkasida tizim foydalanuvchisi biriktirilishi kerak."
        />
      ) : sotuvlar.length === 0 ? (
        <EmptyState
          title="Bu oy sotuv mavjud emas"
          description="Bonusga faqat to'liq to'langan zakazlar kiradi."
        />
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {sotuvlar.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 border-b border-line pb-2 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg truncate">
                  {s.crmNomi ?? s.izoh ?? s.kategoriya ?? "Zakaz"}
                </p>
                <p className="text-2xs text-faint tnum">
                  {s.sana}
                  {s.kategoriya && ` · ${s.kategoriya}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Money value={s.summa} size="sm" suffix={false} />
                {s.qarzTolovi && (
                  <div className="mt-0.5">
                    <Badge tone="info">Qarz yopildi</Badge>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
