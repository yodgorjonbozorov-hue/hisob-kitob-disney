import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatMoney, formatSom } from "@/lib/format";
import { formatKg, formatKgLabel } from "@/lib/kg";
import type { KgSavdoHisoboti } from "@/lib/queries/selos";

/**
 * DIREKTOR PANELIDAGI KG SAVDOSI BLOKI (mijozga xos — Fortex Selos).
 *
 * Uch raqam + sotuvchilar kesimi: "bugun kim necha kg sotdi va qancha tushum
 * keltirdi". Kg kassa balansiga QO'SHILMAYDI — bu mahsulot ko'rsatkichi.
 */
export function SelosBugunKartasi({
  hisobot,
  sarlavha = "Bugungi kg savdosi",
}: {
  hisobot: KgSavdoHisoboti;
  /** Kunlik hisobotda o'tgan kun ham ko'rsatilishi mumkin. */
  sarlavha?: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-fg">{sarlavha}</h2>
        <Link href="/app/selos" className="text-sm text-brand hover:underline">
          Batafsil →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-2xs text-muted">Jami sotildi</p>
          <p className="font-semibold tnum text-fg">{formatKg(hisobot.jamiGr)} kg</p>
        </div>
        <div>
          <p className="text-2xs text-muted">Jami savdo</p>
          <p className="font-semibold tnum text-income">{formatMoney(hisobot.jamiSumma)}</p>
        </div>
        <div>
          <p className="text-2xs text-muted">Oʻrtacha</p>
          <p className="font-semibold tnum text-fg">{formatSom(hisobot.ortachaNarx)} soʻm/kg</p>
        </div>
      </div>

      {hisobot.sotuvchilar.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line space-y-1.5">
          {hisobot.sotuvchilar.map((s) => (
            <div key={s.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-fg truncate">{s.nomi}</span>
              <span className="shrink-0 tnum text-muted">
                <span className="text-fg font-medium">{formatKgLabel(s.miqdorGr)}</span> ·{" "}
                {formatMoney(s.summa)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
