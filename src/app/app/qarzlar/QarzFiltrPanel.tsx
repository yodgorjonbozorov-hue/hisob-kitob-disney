"use client";

import { QARZ_MATN } from "@/lib/biznesTuri";
import { MUDDAT_BELGI, YAQIN_MUDDAT_KUN } from "@/lib/qarzMuddat";
import { Select } from "@/components/ui/Select";

/** Yo'nalish filtri: kimga qarzdor. "Barcha" ATAYLAB yo'q — 26-talab. */
export type QarzYonalish = "hammasi" | "olinadigan" | "beriladigan";

export const YONALISHLAR: { kod: QarzYonalish; nomi: string }[] = [
  { kod: "olinadigan", nomi: QARZ_MATN.olinadigan.nomi },
  { kod: "beriladigan", nomi: QARZ_MATN.beriladigan.nomi },
];

/** Ro'yxat ko'rinishi: shaxs kesimi yoki qarz yozuvlari jadvali. */
export type QarzKorinish = "qarzdorlar" | "yozuvlar";

/**
 * TEZ FILTR (13-talab) — KPI kartalar va chiplar bitta holatni boshqaradi.
 *
 * Bitta manba bo'lgani uchun "Muddati o'tgan" kartasini bosish chipni ham
 * yoqadi: foydalanuvchi ro'yxat NEGA qisqarganini ko'rib turadi.
 */
export type QarzTezFiltr =
  | "hammasi"
  | "kechikdi"
  | "bugun"
  | "yaqin"
  | "ochiq"
  | "qisman"
  | "yopilgan"
  | "bugun-berilgan"
  | "bugun-tolangan";

export const TEZ_FILTRLAR: { kod: QarzTezFiltr; nomi: string; belgi?: string }[] = [
  { kod: "hammasi", nomi: "Barchasi" },
  { kod: "kechikdi", nomi: "Muddati o'tgan", belgi: MUDDAT_BELGI.kechikdi },
  { kod: "bugun", nomi: "Bugun", belgi: MUDDAT_BELGI.bugun },
  { kod: "yaqin", nomi: `${YAQIN_MUDDAT_KUN} kun ichida`, belgi: MUDDAT_BELGI.yaqin },
  { kod: "ochiq", nomi: "Ochiq" },
  { kod: "qisman", nomi: "Qisman to'langan" },
  { kod: "yopilgan", nomi: "Yopilgan", belgi: MUDDAT_BELGI.yopilgan },
];

/** Qarzdorlar kesimidagi tartib (14-talab). */
export type QarzTartib = "kritik" | "summa" | "muddat" | "ism";

export const TARTIBLAR: { kod: QarzTartib; nomi: string }[] = [
  { kod: "kritik", nomi: "Eng kritik tepada" },
  { kod: "summa", nomi: "Katta summa tepada" },
  { kod: "muddat", nomi: "Muddat bo'yicha" },
  { kod: "ism", nomi: "Ism bo'yicha" },
];

/**
 * QARZLAR FILTRI — yo'nalish tablari, tez filtr chiplari, qidiruv va tartib.
 *
 * "Yopilgan" chipi faqat YOZUVLAR kesimida ma'noli: qarzdorlar ro'yxatida
 * ochiq qarzi borlar turadi, "yopilgan qarzdor" degan tushuncha yo'q —
 * shuning uchun u chip bosilganda ko'rinish avtomatik almashadi.
 */
export function QarzFiltrPanel({
  yonalish,
  onYonalish,
  sanoq,
  korinish,
  onKorinish,
  q,
  onQ,
  tez,
  onTez,
  tartib,
  onTartib,
  kategoriyalar,
  kategoriya,
  onKategoriya,
}: {
  yonalish: QarzYonalish;
  onYonalish: (v: QarzYonalish) => void;
  /** Har yo'nalishdagi ochiq qarzdorlar soni. */
  sanoq: Record<QarzYonalish, number>;
  korinish: QarzKorinish;
  onKorinish: (v: QarzKorinish) => void;
  q: string;
  onQ: (v: string) => void;
  tez: QarzTezFiltr;
  onTez: (v: QarzTezFiltr) => void;
  tartib: QarzTartib;
  onTartib: (v: QarzTartib) => void;
  /** Yozuvlar kesimidagi kategoriya filtri (mavjud kategoriyalar). */
  kategoriyalar: string[];
  kategoriya: string;
  onKategoriya: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {/* Yo'nalish — eng katta ajratuvchi, shuning uchun tab ko'rinishida. */}
      <div
        className="flex gap-1 p-1 bg-surface-2 rounded-xl"
        role="tablist"
        aria-label="Qarz yo'nalishi"
      >
        {YONALISHLAR.map((y) => (
          <button
            key={y.kod}
            type="button"
            role="tab"
            aria-selected={yonalish === y.kod}
            onClick={() => onYonalish(y.kod)}
            className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition ${
              yonalish === y.kod
                ? "bg-surface text-fg shadow-card"
                : "text-muted hover:text-fg"
            }`}
          >
            <span className="truncate">{y.nomi}</span>
            <span className="ml-1.5 text-2xs opacity-70 tnum">{sanoq[y.kod]}</span>
          </button>
        ))}
      </div>

      {/* Tez filtr chiplari — telefonda yon tomonga suriladi. */}
      <div className="flex gap-2 jadval-siljish pb-1" role="group" aria-label="Tez filtr">
        {TEZ_FILTRLAR.map((f) => (
          <button
            key={f.kod}
            type="button"
            onClick={() => onTez(f.kod)}
            aria-pressed={tez === f.kod}
            className={`shrink-0 min-h-[36px] px-3 py-1.5 rounded-full text-sm font-medium transition border ${
              tez === f.kod
                ? "bg-brand text-white border-brand"
                : "bg-surface text-muted border-line hover:border-brand"
            }`}
          >
            {f.belgi && <span aria-hidden>{f.belgi} </span>}
            {f.nomi}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Ism yoki telefon..."
          className="flex-1 min-w-[10rem] min-h-[44px] rounded-lg border border-line px-3 py-2 text-sm"
          aria-label="Qarzdorlar orasidan qidirish"
        />

        {korinish === "qarzdorlar" ? (
          <Select
            className="w-48 shrink-0"
            aria-label="Tartib"
            value={tartib}
            onChange={(v) => onTartib(v as QarzTartib)}
            options={TARTIBLAR.map((t) => ({ value: t.kod, label: t.nomi }))}
          />
        ) : (
          kategoriyalar.length > 0 && (
            <Select
              className="w-48 shrink-0"
              aria-label="Kategoriya bo'yicha filtr"
              value={kategoriya}
              onChange={onKategoriya}
              searchable={kategoriyalar.length > 7}
              options={[
                { value: "", label: "Barcha kategoriyalar" },
                ...kategoriyalar.map((k) => ({ value: k, label: k })),
              ]}
            />
          )
        )}

        <div className="flex rounded-lg border border-line overflow-hidden text-sm shrink-0">
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
              aria-pressed={korinish === k.kod}
              className={`min-h-[44px] px-3 py-2 transition ${
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
