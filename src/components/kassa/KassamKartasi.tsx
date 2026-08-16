import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import type { KassaHolatDTO } from "@/lib/queries/kassirKassa";

/**
 * "MENING KASSAM" ixcham kartasi — Yozuvlar sahifasi uchun.
 *
 * ATAYLAB asosiy moliyaviy blokdan (Naqd/Click/Qarz/Sof) ajratilgan (talab 20):
 * u yerdagi raqamlar biznes hisoboti, bu yerdagi raqam esa xodimning
 * qo'lidagi real pul. Ikkalasi bir-biriga aralashmasligi kerak.
 */
export function KassamKartasi({ holat }: { holat: KassaHolatDTO }) {
  return (
    <Card className="border-brand/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted">Mening kassam · kassadagi qoldiq</p>
          <div className="mt-0.5">
            <Money
              value={holat.qoldiq}
              size="xl"
              tone={holat.qoldiq > 0 ? "brand" : holat.qoldiq < 0 ? "expense" : "neutral"}
            />
          </div>
          <p className="text-xs text-faint mt-1">
            Bugungi kirim: {holat.bugungiKirim.toLocaleString("ru-RU")} · Bugungi chiqim:{" "}
            {holat.bugungiChiqim.toLocaleString("ru-RU")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {holat.kutilayotgan && <Badge tone="warning">Tasdiq kutilmoqda</Badge>}
          <Link
            href="/app/kassam"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-110 min-h-[44px]"
          >
            {holat.kutilayotgan ? "Kassam" : "Kassani topshirish"}
          </Link>
        </div>
      </div>
    </Card>
  );
}
