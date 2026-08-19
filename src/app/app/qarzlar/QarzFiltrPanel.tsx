"use client";

import { QARZ_MATN } from "@/lib/biznesTuri";
import { QARZ_HOLATLARI, QARZ_HOLAT_NOMI, type QarzHolat } from "@/lib/validation/qarz";

/** Yo'nalish filtri: hammasi yoki bitta tomon. */
export type QarzYonalish = "hammasi" | "olinadigan" | "beriladigan";

export const YONALISHLAR: { kod: QarzYonalish; nomi: string }[] = [
  { kod: "hammasi", nomi: "Barcha" },
  { kod: "olinadigan", nomi: QARZ_MATN.olinadigan.nomi },
  { kod: "beriladigan", nomi: QARZ_MATN.beriladigan.nomi },
];

/** Ro'yxat ko'rinishi: shaxs kesimi yoki qarz yozuvlari jadvali. */
export type QarzKorinish = "qarzdorlar" | "yozuvlar";

/**
 * QARZLAR FILTRI — yo'nalish, ko'rinish, qidiruv va (yozuvlar jadvalida)
 * holat.
 *
 * Holat filtri qarzdorlar kesimida ko'rinmaydi: u yerda faqat OCHIQ qarzlar
 * bor, "yopilgan qarzdor" degan tushuncha yo'q.
 */
export function QarzFiltrPanel({
  yonalish,
  onYonalish,
  sanoq,
  korinish,
  onKorinish,
  q,
  onQ,
  status,
  onStatus,
}: {
  yonalish: QarzYonalish;
  onYonalish: (v: QarzYonalish) => void;
  /** Har yo'nalishdagi ochiq qarzdorlar soni. */
  sanoq: Record<QarzYonalish, number>;
  korinish: QarzKorinish;
  onKorinish: (v: QarzKorinish) => void;
  q: string;
  onQ: (v: string) => void;
  status: QarzHolat | "HAMMASI";
  onStatus: (v: QarzHolat | "HAMMASI") => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 jadval-siljish pb-0.5">
        {YONALISHLAR.map((y) => (
          <button
            key={y.kod}
            type="button"
            onClick={() => onYonalish(y.kod)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              yonalish === y.kod ? "bg-brand text-white" : "bg-surface-2 text-muted"
            }`}
          >
            {y.nomi}
            <span className="ml-1.5 text-2xs opacity-80">{sanoq[y.kod]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Ism yoki telefon..."
          className="flex-1 min-w-[12rem] rounded-lg border border-line px-3 py-2 text-sm"
          aria-label="Qarzdorlar orasidan qidirish"
        />
        {korinish === "yozuvlar" && (
          <select
            value={status}
            onChange={(e) => onStatus(e.target.value as QarzHolat | "HAMMASI")}
            className="rounded-lg border border-line px-3 py-2 text-sm bg-surface"
            aria-label="Holat bo'yicha filtr"
          >
            <option value="HAMMASI">Barcha holatlar</option>
            {QARZ_HOLATLARI.map((s) => (
              <option key={s} value={s}>
                {QARZ_HOLAT_NOMI[s]}
              </option>
            ))}
          </select>
        )}
        <div className="flex rounded-lg border border-line overflow-hidden text-sm">
          {(
            [
              { kod: "qarzdorlar", nomi: "Qarzdorlar" },
              { kod: "yozuvlar", nomi: "Yozuvlar" },
            ] as const
          ).map((k) => (
            <button
              key={k.kod}
              type="button"
              onClick={() => onKorinish(k.kod)}
              className={`px-3 py-2 transition ${
                korinish === k.kod ? "bg-brand text-white" : "bg-surface text-muted"
              }`}
            >
              {k.nomi}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
