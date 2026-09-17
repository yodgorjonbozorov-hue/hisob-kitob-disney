"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatSom, formatToshkentVaqt } from "@/lib/format";
import type { TransferDTO } from "@/lib/queries/accounts";

/**
 * QABUL KUTAYOTGAN BITTA TOPSHIRIQ.
 *
 * Direktor qaror qabul qilishdan OLDIN olti savolga javob oladi: kim
 * topshirdi, qaysi kassadan, qancha, QAYSI KANALLAR bilan (naqd / Click /
 * Payme), qachon va tizim hisobi bilan farq bormi.
 *
 * Katta raqam — NAQD qismi (`summa`), ya'ni haqiqatda ko'chadigan pul.
 * Online kanallar kassa qoldig'ini o'zgartirmaydi, shuning uchun ular
 * alohida kesimda ko'rsatiladi va jami alohida chiqadi.
 *
 * Farq TOPSHIRISH PAYTIDA muzlatilgan (`hisoblangan`/`farq`), shuning
 * uchun oradan vaqt o'tib kassaga yangi yozuv tushsa ham bu raqam
 * o'zgarmaydi. Naqd umuman topshirilmagan bo'lsa (faqat online kanal)
 * ikkalasi ham nol — u holda farq satri ko'rsatilmaydi.
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
          {t.kanallar.length > 1 && <p className="text-2xs text-faint">naqd qismi</p>}
          <Badge tone="warning">Qabul kutilmoqda</Badge>
        </div>
      </div>

      {/* TO'LOV KANALI KESIMI — direktor "qancha naqd, qancha Click,
          qancha Payme" savoliga qaror qabul qilishdan OLDIN javob oladi.
          Eski topshirishlarda qatorlar yo'q (kesim kiritilgunga qadar) —
          u holda blok umuman chizilmaydi. */}
      {t.kanallar.length > 0 && (
        <dl className="mt-1.5 rounded-lg bg-surface-2/60 px-2.5 py-1.5 space-y-0.5">
          {t.kanallar.map((k) => (
            <div key={k.kanal} className="flex items-baseline justify-between gap-2">
              <dt className="text-2xs text-muted">{k.nomi}</dt>
              <dd className="text-2xs tnum font-medium text-fg">{formatSom(k.summa)} soʻm</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-2 border-t border-line pt-0.5">
            <dt className="text-2xs font-medium text-fg">Jami</dt>
            <dd className="text-2xs tnum font-semibold text-fg">
              {formatSom(t.kanallar.reduce((s, k) => s + k.summa, 0))} soʻm
            </dd>
          </div>
        </dl>
      )}

      {t.hisoblangan !== null && (t.hisoblangan > 0 || farq !== 0) && (
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
