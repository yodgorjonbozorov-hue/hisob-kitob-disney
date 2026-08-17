"use client";

import { formatSom, formatSomLabel, formatDateUz } from "@/lib/format";
import { QARZ_TOLOV_NOMI, type QarzTolovUsuli } from "@/lib/validation/qarz";
import type { QarzdorHodisa } from "@/lib/queries/qarz";

/**
 * QARZDOR TARIXI — qarzlar va to'lovlar bitta vaqt o'qida, YUGURUVCHI QOLDIQ
 * bilan.
 *
 * Har qatorda "shu hodisadan keyin qancha qoldi" ko'rinadi: qoldiq alohida
 * saqlanadigan qiymat emas, aynan shu ustundagi yig'indi. Foydalanuvchi
 * raqamni ko'zi bilan tekshira oladi — hisobga ishonch shundan boshlanadi.
 */
export function QarzdorTarix({ hodisalar }: { hodisalar: QarzdorHodisa[] }) {
  if (hodisalar.length === 0) {
    return <p className="text-xs text-faint">Tarix bo&apos;sh.</p>;
  }

  let qoldiq = 0;
  const qatorlar = hodisalar.map((h) => {
    qoldiq += h.turi === "qarz" ? h.summa : -h.summa;
    return { h, qoldiq };
  });

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      <ul className="divide-y divide-line">
        {qatorlar.map(({ h, qoldiq: q }) => (
          <li key={h.id} className="flex items-start justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-fg">
                {formatDateUz(new Date(h.sana))} ·{" "}
                <span className="text-muted">
                  {h.turi === "qarz" ? "Qarz qo'shildi" : "To'lov"}
                </span>
              </p>
              {(h.tafsil || h.izoh) && (
                <p className="text-2xs text-faint truncate">
                  {[
                    h.turi === "tolov" && h.tafsil
                      ? QARZ_TOLOV_NOMI[h.tafsil as QarzTolovUsuli] ?? h.tafsil
                      : h.tafsil,
                    h.izoh,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <div className="text-right whitespace-nowrap">
              <p
                className={`text-sm font-medium tnum ${
                  h.turi === "qarz" ? "text-debt" : "text-income"
                }`}
              >
                {h.turi === "qarz" ? "+" : "−"} {formatSom(h.summa)}
              </p>
              <p className="text-2xs text-faint tnum">qoldiq {formatSom(q)}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between px-3 py-2 bg-surface-2">
        <span className="text-xs font-medium text-muted">Qoldiq</span>
        <span className="text-sm font-semibold tnum text-debt">{formatSomLabel(qoldiq)}</span>
      </div>
    </div>
  );
}
