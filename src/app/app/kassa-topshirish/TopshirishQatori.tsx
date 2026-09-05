"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatSom, formatToshkentVaqt } from "@/lib/format";
import type { TransferDTO } from "@/lib/queries/accounts";

/**
 * QABUL KUTAYOTGAN BITTA TOPSHIRIQ.
 *
 * Direktor qaror qabul qilishdan OLDIN besh savolga javob oladi: kim
 * topshirdi, qaysi kassadan, qancha, qachon va tizim hisobi bilan farq
 * bormi. Farq TOPSHIRISH PAYTIDA muzlatilgan (`hisoblangan`/`farq`),
 * shuning uchun oradan vaqt o'tib kassaga yangi yozuv tushsa ham bu raqam
 * o'zgarmaydi.
 *
 * Kamomad (`farq < 0`) qabul qilingandan keyin ham xodim kassasida OCHIQ
 * qoladi — pul o'z-o'zidan yo'qolmaydi.
 */
export function TopshirishQatori({
  t,
  band,
  qabulQila,
  onQaror,
}: {
  t: TransferDTO;
  band: boolean;
  qabulQila: boolean;
  onQaror: (amal: "qabul" | "rad") => void;
}) {
  const farq = t.farq ?? 0;

  return (
    <li className="px-4 sm:px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg truncate">{t.fromUserIsm ?? t.fromNomi}</p>
          <p className="text-2xs text-muted mt-0.5 truncate">
            {t.fromNomi} → {t.toUserIsm ?? t.toNomi}
          </p>
          <p className="text-2xs text-faint mt-0.5">
            {formatToshkentVaqt(new Date(t.createdAt))}
          </p>
          {t.izoh && <p className="text-2xs text-muted mt-0.5 break-words">{t.izoh}</p>}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="font-display tnum text-base font-semibold text-fg whitespace-nowrap">
            {formatSom(t.summa)}
          </p>
          <Badge tone="warning">Qabul kutilmoqda</Badge>
        </div>
      </div>

      {t.hisoblangan !== null && (
        <p className={`text-2xs mt-1.5 tnum ${farq === 0 ? "text-faint" : "text-expense"}`}>
          {farq === 0
            ? `Tizim bo'yicha ham ${formatSom(t.hisoblangan)} soʻm — farq yo'q`
            : `Tizim bo'yicha ${formatSom(t.hisoblangan)} soʻm edi — kamomad ${formatSom(
                Math.abs(farq)
              )} soʻm, u xodim kassasida ochiq qoladi`}
        </p>
      )}

      {qabulQila && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          <Button size="sm" onClick={() => onQaror("qabul")} disabled={band}>
            Qabul qilish
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onQaror("rad")} disabled={band}>
            Rad etish
          </Button>
        </div>
      )}
    </li>
  );
}
