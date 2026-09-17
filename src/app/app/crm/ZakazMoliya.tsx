"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { kirimHavolasi, qarzHavolasi, type BuyurtmaDTO } from "./turlar";

/**
 * ZAKAZNING MOLIYAVIY NATIJASI (4-, 5- va 13-talab).
 *
 * Yakunlangach kirim va qarz yozuvlari SHU YERDA ko'rinadi va havolalar
 * asl yozuvlarga olib boradi. "Yana kirim yaratish" tugmasi ATAYLAB yo'q:
 * yozuv mavjud bo'lsa faqat "Kirim yaratildi" ko'rsatiladi (13-talab).
 *
 * ═══ QARZ BLOKI: `debtId` NING O'ZI YETARLI EMAS ═══
 * Blok ilgari FAQAT `debtId` bor-yo'qligiga qarardi va har holatda
 * "🔴 Qarzdorlikka yozildi" deb turardi. Qarz keyin to'liq to'langan
 * (`PAID`) yoki bekor qilingan (`CANCELLED`) bo'lsa ham ayni qizil belgi
 * "Qoldiq: 0 so'm" bilan ko'rinar, havola esa Qarzdorlar ro'yxatiga olib
 * borardi — u yerda mijoz yo'q, chunki ro'yxat OCHIQ qarzlarni ko'rsatadi.
 * Endi holat serverdan keladi (`qarzHolat`, `qarzOchiq`) va uchala holat
 * ALOHIDA ko'rsatiladi. Qoldiq 0 bo'lsa "qarzdorlik" deb aytilmaydi.
 */

/** Qarz bloki matnlari — holatga qarab (server bergan `qarzHolat`). */
function qarzKorinishi(b: BuyurtmaDTO): { belgi: string; tone: "chiqim" | "kirim" | "neutral"; izoh: string } {
  if (b.qarzHolat === "CANCELLED") {
    return {
      belgi: "⚪ Qarz bekor qilindi",
      tone: "neutral",
      izoh: "Bu zakaz qarzi bekor qilingan — qarzdorlik yo'q.",
    };
  }
  if (!b.qarzOchiq || b.qarzQoldiq <= 0) {
    return {
      belgi: "🟢 Qarz to'langan",
      tone: "kirim",
      izoh: "Qarz to'liq to'langan — qarzdorlar ro'yxatida ko'rinmaydi.",
    };
  }
  return {
    belgi: "🔴 Qarzdorlikka yozildi",
    tone: "chiqim",
    izoh: `Qoldiq: ${formatMoney(b.qarzQoldiq)}`,
  };
}

export function ZakazMoliya({
  b,
  yakunlanganmi,
  onYakunlash,
  onClose,
}: {
  b: BuyurtmaDTO;
  /** Zakaz allaqachon "Yutildi" (qarz ustunida bo'lsa ham). */
  yakunlanganmi: boolean;
  onYakunlash: () => void;
  onClose: () => void;
}) {
  const moliyaYozilgan = Boolean(b.transactionId || b.debtId);
  const qarz = b.debtId ? qarzKorinishi(b) : null;

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
          {qarz && (
            <div className="pt-1 space-y-1">
              <Badge tone={qarz.tone}>{qarz.belgi}</Badge>
              <p className="text-xs text-muted tnum">{qarz.izoh}</p>
              <Link
                href={qarzHavolasi(b)}
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
              To&apos;lov tanlanmagan bo&apos;lsa hech narsa yozilmaydi. Qoldiq nol bo&apos;lsa
              qarzdorlik UMUMAN ochilmaydi.
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
