"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { kirimHavolasi, QARZ_HAVOLASI, type BuyurtmaDTO } from "./turlar";

/**
 * ZAKAZNING MOLIYAVIY NATIJASI — KIRIM VA QARZ YOZUVLARIGA HAVOLALAR.
 *
 * Pul zakazga TO'LOV QILINGAN paytda kirimga tushadi (`ZakazTolovlari`),
 * shuning uchun bu blok "pulni o'tkazish" tugmasi emas, NATIJA ko'rsatgichi:
 * qaysi yozuvlar yaratilgan va ular qayerda. "Yana kirim yaratish" tugmasi
 * ATAYLAB yo'q — dublikat yozuvga yo'l ochilmaydi.
 */
export function ZakazMoliya({
  b,
  yakunlanganmi,
  onYakunlash,
  onClose,
}: {
  b: BuyurtmaDTO;
  /** Zakaz allaqachon "Yutildi" ustunidami. */
  yakunlanganmi: boolean;
  onYakunlash: () => void;
  onClose: () => void;
}) {
  const moliyaYozilgan = Boolean(b.transactionId || b.debtId);

  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3 space-y-2">
      {moliyaYozilgan ? (
        <>
          {b.transactionId && (
            <>
              <Badge tone="kirim">🟢 Kirim yaratildi</Badge>
              <p className="text-xs text-muted tnum">Kirimga o&apos;tgan: {formatMoney(b.kirimSumma)}</p>
              <Link
                href={kirimHavolasi(b)}
                className="inline-block text-brand text-sm font-medium"
                onClick={onClose}
              >
                Kirim yozuvini ochish →
              </Link>
            </>
          )}
          {b.debtId && (
            <div className="pt-1 space-y-1">
              <Badge tone="chiqim">🔴 Qarzdorlikka yozildi</Badge>
              <p className="text-xs text-muted tnum">Qoldiq: {formatMoney(b.qarzQoldiq)}</p>
              <Link
                href={QARZ_HAVOLASI}
                className="inline-block text-brand text-sm font-medium"
                onClick={onClose}
              >
                Qarzdorlikni ochish →
              </Link>
            </div>
          )}
          <p className="text-2xs text-faint">
            Har to&apos;lov bir marta kirimga tushadi — &quot;Yutildi&quot; yangi kirim
            yaratmaydi (dublikat bo&apos;lmaydi).
          </p>
        </>
      ) : (
        <>
          <Badge tone="warning">🟠 To&apos;lov kelmagan</Badge>
          {yakunlanganmi ? (
            <p className="text-xs text-muted">
              Zakaz yutilgan, lekin unga to&apos;lov yozilmagan. To&apos;lovni yuqoridagi
              &quot;To&apos;lovlar&quot; bo&apos;limidan qo&apos;shing.
            </p>
          ) : (
            <p className="text-xs text-muted">
              Pul kelganda uni &quot;To&apos;lovlar&quot; bo&apos;limiga yozing — o&apos;sha zahoti
              Kirimga tushadi. Zakaz to&apos;liq to&apos;langach &quot;Yutildi&quot; bosiladi;
              qolgan summa esa QOLDIQ bo&apos;lib turadi, qarz hisoblanmaydi.
            </p>
          )}
          {!yakunlanganmi && (
            <button
              onClick={onYakunlash}
              className="w-full rounded-lg bg-income text-white text-sm font-medium py-2"
            >
              Zakazni yutildi qilish
            </button>
          )}
        </>
      )}
    </div>
  );
}
