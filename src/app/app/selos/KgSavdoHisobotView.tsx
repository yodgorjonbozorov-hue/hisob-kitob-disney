import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatMoney, formatSom, formatDateUZ } from "@/lib/format";
import { formatKg, formatKgLabel } from "@/lib/kg";
import type { KgKesim, KgSavdoHisoboti } from "@/lib/queries/selos";

/**
 * KG SAVDOSI KESIMI (mijozga xos — Fortex Selos).
 *
 * Ikki birlik ATAYLAB alohida ustunlarda: KG — mahsulot ko'rsatkichi,
 * SO'M — moliyaviy tushum. O'rtacha narx statistik (jami / jami), har
 * yozuvdagi real narx o'zgarmaydi.
 */
export function KgSavdoHisobotView({
  hisobot,
  sana,
  bugun,
  kassaPuli = {},
}: {
  hisobot: KgSavdoHisoboti;
  sana: string;
  bugun: string;
  /** Kassa joriy qoldig'i (ledger'dan) — kg savdosi bilan yonma-yon ko'rsatiladi. */
  kassaPuli?: Record<string, number>;
}) {
  const kun = (siljish: number) =>
    new Date(new Date(`${sana}T00:00:00.000Z`).getTime() + siljish * 86_400_000)
      .toISOString()
      .slice(0, 10);

  return (
    <div className="space-y-5">
      {/* Kun tanlash — kechagi savdo ham ko'rinsin. */}
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/app/selos?sana=${kun(-1)}`} className="px-3 py-1.5 rounded-lg bg-surface-2 text-fg">
          ← Oldingi kun
        </Link>
        <span className="font-medium text-fg">
          {sana === bugun ? "Bugun" : formatDateUZ(new Date(`${sana}T00:00:00.000Z`))}
        </span>
        {sana < bugun && (
          <Link href={`/app/selos?sana=${kun(1)}`} className="px-3 py-1.5 rounded-lg bg-surface-2 text-fg">
            Keyingi kun →
          </Link>
        )}
      </div>

      {/* Jami: kg · savdo · o'rtacha */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-2xs text-muted uppercase tracking-wide">Sotildi</p>
          <p className="font-display text-2xl font-bold tnum text-fg mt-1">
            {formatKg(hisobot.jamiGr)} <span className="text-sm text-faint font-sans">kg</span>
          </p>
        </Card>
        <Card>
          <p className="text-2xs text-muted uppercase tracking-wide">Savdo</p>
          <p className="font-display text-2xl font-bold tnum text-income mt-1">
            {formatSom(hisobot.jamiSumma)} <span className="text-sm text-faint font-sans">soʻm</span>
          </p>
        </Card>
        <Card>
          <p className="text-2xs text-muted uppercase tracking-wide">Oʻrtacha</p>
          <p className="font-display text-2xl font-bold tnum text-fg mt-1">
            {formatSom(hisobot.ortachaNarx)}{" "}
            <span className="text-sm text-faint font-sans">soʻm/kg</span>
          </p>
        </Card>
      </div>

      {hisobot.savdoSoni === 0 ? (
        <Card>
          <p className="text-muted text-sm">
            Bu kunda kg savdosi yozilmagan. Yozuv kiritish uchun &quot;Pul kirdi&quot; →
            kg kategoriyasini tanlang.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <Kesim sarlavha="Sotuvchilar" qatorlar={hisobot.sotuvchilar} />
            <Kesim sarlavha="Kassalar" qatorlar={hisobot.kassalar} kassaPuli={kassaPuli} />
            <Kesim sarlavha="Mahsulotlar" qatorlar={hisobot.kategoriyalar} />
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-line">
              <h2 className="font-semibold text-fg">Savdolar ({hisobot.savdoSoni})</h2>
            </div>
            <div className="jadval-siljish">
              <table className="w-full text-sm min-w-[40rem]">
                <thead className="bg-surface-2 text-muted text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Mahsulot</th>
                    <th className="text-right px-4 py-2">Miqdor</th>
                    <th className="text-right px-4 py-2">1 kg narxi</th>
                    <th className="text-right px-4 py-2">Jami</th>
                    <th className="text-left px-4 py-2">Sotuvchi</th>
                    <th className="text-left px-4 py-2">Kassa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {hisobot.qatorlar.map((q) => (
                    <tr key={q.id}>
                      <td className="px-4 py-2 text-fg">
                        {q.kategoriya}
                        {q.izoh && <span className="block text-2xs text-faint">{q.izoh}</span>}
                      </td>
                      <td className="px-4 py-2 text-right tnum whitespace-nowrap">
                        {formatKgLabel(q.miqdorGr)}
                      </td>
                      <td className="px-4 py-2 text-right tnum whitespace-nowrap text-muted">
                        {formatSom(q.kgNarxi)}
                      </td>
                      <td className="px-4 py-2 text-right tnum whitespace-nowrap font-medium text-income">
                        {formatSom(q.summa)}
                      </td>
                      <td className="px-4 py-2 text-muted">{q.sotuvchi ?? "—"}</td>
                      <td className="px-4 py-2 text-muted">{q.kassa ?? "Qarz"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Kesim({
  sarlavha,
  qatorlar,
  kassaPuli,
}: {
  sarlavha: string;
  qatorlar: KgKesim[];
  /** Berilsa: kassadagi JORIY pul ham ko'rsatiladi (kg emas — moliyaviy qoldiq). */
  kassaPuli?: Record<string, number>;
}) {
  return (
    <Card>
      <h2 className="font-semibold text-fg mb-3">{sarlavha}</h2>
      <div className="space-y-2">
        {qatorlar.length === 0 && <p className="text-sm text-faint">Maʼlumot yoʻq</p>}
        {qatorlar.map((q) => (
          <div key={q.id} className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-fg truncate">{q.nomi}</span>
            <span className="text-right shrink-0">
              <span className="block text-sm font-medium tnum text-fg">{formatKgLabel(q.miqdorGr)}</span>
              <span className="block text-2xs tnum text-muted">
                {formatMoney(q.summa)} · {formatSom(q.ortacha)} soʻm/kg
              </span>
              {kassaPuli?.[q.id] !== undefined && (
                <span className="block text-2xs tnum text-faint">
                  kassada: {formatMoney(kassaPuli[q.id])}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
