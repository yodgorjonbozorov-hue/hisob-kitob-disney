"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { kirimHavolasi, QARZ_HAVOLASI, type BuyurtmaDTO } from "./turlar";

/**
 * ZAKAZNING MOLIYAVIY NATIJASI (4-, 5- va 13-talab).
 *
 * Yakunlangach kirim va qarz yozuvlari SHU YERDA ko'rinadi va havolalar
 * asl yozuvlarga olib boradi. "Yana kirim yaratish" tugmasi ATAYLAB yo'q:
 * yozuv mavjud bo'lsa faqat "Kirim yaratildi" ko'rsatiladi (13-talab).
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
            Yozuv bir marta yaratiladi — takroriy yakunlash yangi kirim/qarz ochmaydi.
          </p>
        </>
      ) : (
        <>
          <Badge tone="warning">🟠 Moliyaga o&apos;tmagan</Badge>
          {yakunlanganmi ? (
            <p className="text-xs text-muted">
              Zakaz yutilgan, lekin to&apos;lovi belgilanmagan. Yuqorida to&apos;lovni tanlab saqlang —
              kirim (va qisman/qarzga bo&apos;lsa qarzdorlik) o&apos;zi yoziladi.
            </p>
          ) : (
            <p className="text-xs text-muted">
              Ish yakunlangach &quot;Yutildi&quot; bosiladi: to&apos;langan qism Kirimga, qisman
              to&apos;lovda qolgani, &quot;Qarzga&quot; tanlanganda butun summa Qarzdorlikka yoziladi.
              To&apos;lov tanlanmagan bo&apos;lsa hech narsa yozilmaydi.
            </p>
          )}
          {!yakunlanganmi && (
            <button
              onClick={onYakunlash}
              className="w-full rounded-lg bg-income text-white text-sm font-medium py-2"
            >
              Yutildi va moliyaga o&apos;tkazish
            </button>
          )}
        </>
      )}
    </div>
  );
}
