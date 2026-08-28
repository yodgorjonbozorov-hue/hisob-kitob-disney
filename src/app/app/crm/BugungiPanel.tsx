"use client";

import { formatMoney, formatDateUZ } from "@/lib/format";
import type { KategoriyaStatDTO, KunlikXulosaDTO } from "./turlar";

/**
 * "Bugungi buyurtmalar" (6-talab) va kategoriya statistikasi (7-talab).
 *
 * Ikkala blok ham BITTA savolga javob beradi: bugun qancha buyurtma olindi va
 * shundan qanchasi haqiqatan Kirimga tushdi.
 */
export function BugungiPanel({
  kunlik,
  kategoriyalar,
}: {
  kunlik: KunlikXulosaDTO & { qatorlar: { id: string; nomi: string; kategoriya: string | null; summa: number; kirimBor: boolean }[] };
  kategoriyalar: KategoriyaStatDTO[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Bugungi buyurtmalar */}
      <section className="bg-surface rounded-2xl border border-line p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold text-fg">Bugungi buyurtmalar</h2>
          <span className="text-xs text-faint tnum">{formatDateUZ(new Date(kunlik.sana))}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Karta nomi="Jami buyurtma" summa={kunlik.jami} rang="text-fg" izoh={`${kunlik.soni} ta`} />
          <Karta nomi="Kirimga o'tgan" summa={kunlik.kirimga} rang="text-income" />
          <Karta nomi="Kutilmoqda" summa={kunlik.kutilmoqda} rang="text-debt-fg" />
        </div>

        <div className="space-y-1.5">
          {kunlik.qatorlar.length === 0 ? (
            <p className="text-sm text-faint">Bugun buyurtma yo&apos;q.</p>
          ) : (
            kunlik.qatorlar.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-2 text-sm border-b border-line/60 pb-1.5 last:border-0">
                <span className="truncate">
                  <span className="text-muted">{q.kategoriya ?? "Kategoriyasiz"}</span>
                  <span className="text-faint"> — </span>
                  <span className="text-fg">{q.nomi}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="tnum text-fg">{formatMoney(q.summa)}</span>
                  <span title={q.kirimBor ? "Kirim yozilgan" : "Kirim kutilmoqda"}>
                    {q.kirimBor ? "🟢" : "🟠"}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Kategoriya statistikasi */}
      <section className="bg-surface rounded-2xl border border-line p-4 space-y-3">
        <h2 className="font-semibold text-fg">Kategoriya bo&apos;yicha</h2>
        {kategoriyalar.length === 0 ? (
          <p className="text-sm text-faint">Hali buyurtma yo&apos;q.</p>
        ) : (
          <div className="jadval-siljish">
            <table className="w-full text-sm">
              <thead className="text-2xs uppercase text-muted">
                <tr>
                  <th className="text-left py-1.5">Kategoriya</th>
                  <th className="text-right py-1.5">Soni</th>
                  <th className="text-right py-1.5">Jami</th>
                  <th className="text-right py-1.5">Kirimga</th>
                  <th className="text-right py-1.5">Kutilmoqda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {kategoriyalar.map((k) => (
                  <tr key={k.categoryId ?? "yoq"}>
                    <td className="py-1.5 text-fg truncate max-w-[120px]">{k.nomi}</td>
                    <td className="py-1.5 text-right text-muted tnum">{k.soni}</td>
                    <td className="py-1.5 text-right text-fg tnum">{formatMoney(k.jami)}</td>
                    <td className="py-1.5 text-right text-income tnum">{formatMoney(k.kirimga)}</td>
                    <td className="py-1.5 text-right text-debt-fg tnum">{formatMoney(k.kutilmoqda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Karta({ nomi, summa, rang, izoh }: { nomi: string; summa: number; rang: string; izoh?: string }) {
  return (
    <div className="rounded-xl bg-surface-2/60 border border-line p-2.5">
      <p className="text-2xs text-muted truncate">{nomi}</p>
      <p className={`text-sm font-semibold tnum ${rang}`}>{formatMoney(summa)}</p>
      {izoh && <p className="text-2xs text-faint">{izoh}</p>}
    </div>
  );
}
