"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { kirimHavolasi, QARZ_HAVOLASI, type BuyurtmaDTO } from "./turlar";

/**
 * ZAKAZNING MOLIYAVIY NATIJASI — qayerda qancha pul turgani va Yutildi.
 *
 * ═══ "YUTILDI" ENDI PUL YOZMAYDI ═══
 * Kirim to'lov kelgan paytda yoziladi (`lib/crm/tolovKirimi.ts`), shuning
 * uchun bu blok ikki narsani ko'rsatadi: MAVJUD moliyaviy yozuvlarga
 * havolalar VA (zakaz hali yakunlanmagan bo'lsa) "Yutildi" tugmasi.
 *
 * Ilgari ikkovi bir-birini istisno qilardi — kirim yozilishi bilan tugma
 * yo'qolardi. Yangi oqimda kirim zakaz JARAYONDA turganda ham bo'ladi
 * (zalog), demak tugma o'sha paytda ham kerak.
 *
 * TUGMA to'liq to'lanmagan zakazda O'CHIQ turadi va sabab ko'rsatiladi.
 * Bu faqat qulaylik: server ayni qoidani mustaqil majburlaydi
 * (`lib/crm/yakunlash.ts`).
 */
export function ZakazMoliya({
  b,
  tosiq,
  yakunlanganmi,
  onYakunlash,
  onClose,
}: {
  b: BuyurtmaDTO;
  /** "Yutildi" ga o'tishga to'siq sababi (`lib/crm/tolovOqish.ts`). */
  tosiq?: string | null;
  /** Zakaz allaqachon "Yutildi" ustunidami. */
  yakunlanganmi: boolean;
  onYakunlash: () => void;
  onClose: () => void;
}) {
  const kirimBor = Boolean(b.transactionId);

  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3 space-y-2">
      {kirimBor ? (
        <>
          <Badge tone="kirim">🟢 Kirimga o&apos;tgan</Badge>
          <p className="text-xs text-muted tnum">{formatMoney(b.kirimSumma)}</p>
          <Link
            href={kirimHavolasi(b)}
            className="inline-block text-brand text-sm font-medium"
            onClick={onClose}
          >
            Kirim yozuvlarini ochish →
          </Link>
        </>
      ) : (
        <>
          <Badge tone="warning">🟠 Kirim yozilmagan</Badge>
          <p className="text-xs text-muted">
            Pul kelgan sari to&apos;lov qo&apos;shiladi va o&apos;sha zahoti Kirimga tushadi.
          </p>
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

      {yakunlanganmi ? (
        <p className="text-2xs text-faint">
          Zakaz yakunlangan. Yozuv bir marta yaratiladi — takroriy yakunlash yangi kirim/qarz
          ochmaydi.
        </p>
      ) : (
        <>
          <p className="text-2xs text-faint">
            &quot;Yutildi&quot; — moliyaviy amal emas, zakazning yakunlangan holati: unga faqat
            puli TO&apos;LIQ kelgan (yoki ataylab qarzga yopilgan) zakaz o&apos;tadi.
          </p>
          {tosiq && <p className="text-xs text-expense">{tosiq}</p>}
          <button
            onClick={onYakunlash}
            disabled={Boolean(tosiq)}
            className="w-full rounded-lg bg-income text-white text-sm font-medium py-2 disabled:opacity-40"
          >
            Yutildi
          </button>
        </>
      )}
    </div>
  );
}
