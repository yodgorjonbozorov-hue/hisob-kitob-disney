import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import type { MeningKassam } from "@/lib/queries/accounts";

/**
 * "MENING KASSAM" ixcham kartasi — Yozuvlar sahifasi uchun.
 *
 * Raqam Account ledgeridan keladi (Kassalar sahifasi bilan AYNI manba).
 * Yuqoridagi Naqd/Click/Qarz/Sof — biznes hisoboti; bu yerdagi raqam esa
 * xodimning O'Z kassasidagi pul. Ikkalasi boshqa savolga javob beradi,
 * lekin endi bitta haqiqat manbaidan hisoblanadi.
 *
 * Shaxsiy kassa ochilmagan bo'lsa (`kassa === null`) karta umuman
 * ko'rsatilmaydi — bo'sh nol raqam faqat chalg'itardi.
 */
export function KassamKartasi({ kassa }: { kassa: MeningKassam | null }) {
  if (!kassa) return null;

  return (
    <Card className="border-brand/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted">Mening kassam · {kassa.nomi}</p>
          <div className="mt-0.5">
            <Money
              value={kassa.qoldiq}
              size="xl"
              tone={kassa.qoldiq > 0 ? "brand" : kassa.qoldiq < 0 ? "expense" : "neutral"}
            />
          </div>
          <p className="text-xs text-faint mt-1">
            Bugungi kirim: {kassa.bugungiKirim.toLocaleString("ru-RU")} · Bugungi chiqim:{" "}
            {kassa.bugungiChiqim.toLocaleString("ru-RU")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {kassa.kutilayotganSoni > 0 && (
            <Badge tone="warning">
              {kassa.kutilayotganSoni} ta o&apos;tkazma qabul kutmoqda
            </Badge>
          )}
          <Link
            href="/app/kassam"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-110 min-h-[44px]"
          >
            {kassa.kutilayotganSoni > 0 ? "Kassam" : "Smenani topshirish"}
          </Link>
        </div>
      </div>
    </Card>
  );
}
