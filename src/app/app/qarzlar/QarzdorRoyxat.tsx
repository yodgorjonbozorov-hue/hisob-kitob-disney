"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatSomLabel, formatDateUz } from "@/lib/format";
import { telKorinish } from "@/lib/validation/qarz";
import type { QarzdorDTO } from "@/lib/queries/qarz";

/**
 * QARZDORLAR RO'YXATI — har qatorda bitta SHAXS.
 *
 * Qarz yozuvlari jadvali (QarzJadval) "qaysi savdo qarzga ketdi" savoliga
 * javob beradi; bu ro'yxat esa kundalik savolga: "kim qancha qarzdor va
 * oxirgi marta qachon to'lagan". Shu bois eng katta element — SUMMA.
 *
 * Mobil-birinchi: telefonda vertikal kartalar, kengroq ekranda ikki ustun.
 */
export function QarzdorRoyxat({
  qarzdorlar,
  onOch,
  onQarzQosh,
  bosh,
}: {
  qarzdorlar: QarzdorDTO[];
  onOch: (q: QarzdorDTO) => void;
  onQarzQosh: () => void;
  /** Filtr emas, umuman qarz yo'q — boshqa matn ko'rsatiladi. */
  bosh: boolean;
}) {
  if (qarzdorlar.length === 0) {
    return (
      <Card className="text-center py-10">
        <p className="text-3xl mb-2" aria-hidden>
          🧾
        </p>
        <p className="font-semibold text-fg">
          {bosh ? "Qarzdorlik mavjud emas" : "Bu filtrga mos qarzdor yo'q"}
        </p>
        <p className="text-sm text-muted mt-1 mb-4">
          {bosh
            ? "Hozircha hech kim sizga qarzdor emas."
            : "Qidiruv yoki yo'nalishni o'zgartirib ko'ring."}
        </p>
        {bosh && <Button onClick={onQarzQosh}>+ Qarz qo&apos;shish</Button>}
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {qarzdorlar.map((q) => (
        <li key={`${q.turi}:${q.kalit}`}>
          <button
            type="button"
            onClick={() => onOch(q)}
            className="w-full text-left bg-surface rounded-2xl shadow-card border border-line p-4 transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-fg truncate">{q.ism}</p>
                <p className="text-2xs text-muted truncate">
                  {q.tel ? telKorinish(q.tel) : "telefon kiritilmagan"}
                </p>
              </div>
              {q.muddatOtdi && (
                <span className="shrink-0 text-2xs font-medium text-expense bg-expense-soft/40 rounded-full px-2 py-0.5">
                  muddat o&apos;tdi
                </span>
              )}
            </div>

            {/* Qarz miqdori — kartadagi eng muhim vizual element. */}
            <p className="mt-3 text-2xl font-bold tnum text-debt">{formatSomLabel(q.qarz)}</p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
              <span>
                Oxirgi to&apos;lov:{" "}
                <span className="text-fg">
                  {q.oxirgiTolov ? formatDateUz(new Date(q.oxirgiTolov)) : "yo'q"}
                </span>
              </span>
              {q.ochiqSoni > 1 && <span>{q.ochiqSoni} ta ochiq qarz</span>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
