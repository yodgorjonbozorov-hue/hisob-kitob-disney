"use client";

import { Card } from "@/components/ui/Card";
import { formatSom, formatSomLabel, formatDateUZ } from "@/lib/format";
import { telKorinish } from "@/lib/validation/qarz";
import type { QarzDTO } from "@/lib/queries/qarz";
import { QarzHolatBadge } from "./QarzHolatBadge";

/**
 * QARZLAR JADVALI. Ustunlar spetsifikatsiya bo'yicha: mijoz, telefon, qarz,
 * to'langan, qolgan, berilgan sana, oxirgi to'lov, status, mas'ul, amallar.
 *
 * Mobil ekranda jadval gorizontal aylanadi (ustunlarni yashirish o'rniga):
 * kassir uchun "qolgan" va "oxirgi to'lov" ikkalasi ham muhim.
 */
export function QarzJadval({
  qarzlar,
  onOch,
  onEslatma,
}: {
  qarzlar: QarzDTO[];
  onOch: (d: QarzDTO) => void;
  onEslatma: (d: QarzDTO) => void;
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-xs uppercase">
              <th className="pb-2">Mijoz</th>
              <th className="pb-2">Telefon</th>
              <th className="pb-2 text-right">Qarz</th>
              <th className="pb-2 text-right">To&apos;langan</th>
              <th className="pb-2 text-right">Qolgan</th>
              <th className="pb-2">Berilgan</th>
              <th className="pb-2">Oxirgi to&apos;lov</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Mas&apos;ul</th>
              <th className="pb-2 text-right">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {qarzlar.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-faint py-6">
                  Bu filtrga mos qarz yo&apos;q
                </td>
              </tr>
            )}
            {qarzlar.map((d) => (
              <tr key={d.id} className={d.isYopilgan ? "opacity-60" : ""}>
                <td className="py-2.5 font-medium">
                  <button
                    type="button"
                    onClick={() => onOch(d)}
                    className="text-left hover:text-brand hover:underline"
                  >
                    {d.mijozNomi}
                  </button>
                  {d.muddatOtdi && (
                    <span className="ml-2 text-2xs text-expense">muddat o&apos;tdi</span>
                  )}
                </td>
                <td className="py-2.5 text-muted whitespace-nowrap">
                  {d.mijozTel ? telKorinish(d.mijozTel) : "—"}
                </td>
                <td className="py-2.5 text-right tnum">{formatSomLabel(d.jamiSumma)}</td>
                <td className="py-2.5 text-right text-income tnum">{formatSom(d.tolangan)}</td>
                <td className="py-2.5 text-right font-medium text-debt tnum">
                  {formatSom(d.qolgan)}
                </td>
                <td className="py-2.5 text-muted whitespace-nowrap">
                  {formatDateUZ(new Date(d.sana))}
                </td>
                <td className="py-2.5 text-muted whitespace-nowrap">
                  {d.oxirgiTolov ? formatDateUZ(new Date(d.oxirgiTolov)) : "—"}
                </td>
                <td className="py-2.5">
                  <QarzHolatBadge status={d.status} />
                </td>
                <td className="py-2.5 text-muted whitespace-nowrap">{d.masulIsm ?? "—"}</td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  {!d.isYopilgan && d.turi === "olinadigan" && (
                    <button
                      type="button"
                      onClick={() => onEslatma(d)}
                      className="text-xs font-medium text-muted hover:text-fg mr-3"
                    >
                      Eslatma
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOch(d)}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Ochish
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
