import { Card } from "@/components/ui/Card";
import { formatSomLabel } from "@/lib/format";
import type { DavriyHisobot } from "@/lib/queries/davriyHisobot";

/**
 * Kunlik / haftalik / yillik kesim jadvali.
 *
 * Oylik hisobot ko'rinishi (ReportView) TEGILMAGAN — u kategoriya, qarz va
 * avto bo'limlari bilan boyroq. Bu ko'rinish davr bo'ylab bitta savolga
 * javob beradi: qaysi kun/hafta/oy qancha kirdi, chiqdi va qancha qoldi.
 */
export function DavriyKorinish({ hisobot }: { hisobot: DavriyHisobot }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-muted text-sm mb-1">Jami kirim</p>
          <p className="text-xl sm:text-2xl font-bold text-income tnum">
            {formatSomLabel(hisobot.jamiKirim)}
          </p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Jami chiqim</p>
          <p className="text-xl sm:text-2xl font-bold text-expense tnum">
            {formatSomLabel(hisobot.jamiChiqim)}
          </p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Sof foyda</p>
          <p
            className={`text-xl sm:text-2xl font-bold tnum ${
              hisobot.jamiSof >= 0 ? "text-income" : "text-expense"
            }`}
          >
            {formatSomLabel(hisobot.jamiSof)}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-fg mb-3">{hisobot.sarlavha}</h2>
        {hisobot.qatorlar.length === 0 ? (
          <p className="text-faint text-sm py-6 text-center">Bu davrda yozuv yo&apos;q</p>
        ) : (
          <div className="jadval-siljish">
            <table className="w-full text-sm min-w-[22rem]">
              <thead>
                <tr className="text-left text-faint text-xs uppercase">
                  <th className="pb-2">Davr</th>
                  <th className="pb-2 text-right">Kirim</th>
                  <th className="pb-2 text-right">Chiqim</th>
                  <th className="pb-2 text-right">Sof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {hisobot.qatorlar.map((q) => (
                  <tr key={q.kalit}>
                    <td className="py-2 whitespace-nowrap">{q.yorliq}</td>
                    <td className="py-2 text-right text-income tnum">{formatSomLabel(q.kirim)}</td>
                    <td className="py-2 text-right text-expense tnum">{formatSomLabel(q.chiqim)}</td>
                    <td
                      className={`py-2 text-right font-medium tnum ${
                        q.sof >= 0 ? "text-income" : "text-expense"
                      }`}
                    >
                      {formatSomLabel(q.sof)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
