"use client";

import { DAVR_VARIANTLARI } from "./turlar";

/**
 * DAVR KONTEKSTI.
 *
 * Tanlangan davr har savolga qo'shib yuboriladi va savolda davr aytilmagan
 * bo'lsa SHU ishlatiladi. Foydalanuvchi savolda aniq davr aytsa ("iyulni
 * avgust bilan solishtir"), server tomonda savoldagi davr USTUN turadi
 * (`lib/ai/tools.ts` — `input.davr`).
 *
 * Tor ekranda ro'yxat sig'maydi, shuning uchun `select` — u yerda operatsion
 * tizimning o'z tanlagichi ochiladi (teginish zonasi katta, gorizontal siljish
 * yo'q). Segment tugmalari faqat `lg` dan boshlab: 768-1023px oralig'ida
 * asosiy maydon tor bo'ladi (yon menyu hali yo'q, mobil panel esa yonda
 * turadi) va segmentlar sarlavhani siqib qo'yardi.
 */
export function DavrTanlash({
  qiymat,
  onOzgarish,
}: {
  qiymat: string;
  onOzgarish: (kod: string) => void;
}) {
  return (
    <>
      <select
        value={qiymat}
        onChange={(e) => onOzgarish(e.target.value)}
        aria-label="Davr"
        className="lg:hidden shrink-0 h-9 rounded-lg border border-line bg-surface px-2 text-xs text-muted focus:outline-none focus:ring-2 focus:ring-brand"
      >
        {DAVR_VARIANTLARI.map((d) => (
          <option key={d.kod} value={d.kod}>
            {d.yorliq}
          </option>
        ))}
      </select>

      <div className="hidden lg:inline-flex shrink-0 p-0.5 rounded-lg bg-surface-2 gap-0.5" role="tablist">
        {DAVR_VARIANTLARI.map((d) => {
          const faol = d.kod === qiymat;
          return (
            <button
              key={d.kod}
              role="tab"
              aria-selected={faol}
              onClick={() => onOzgarish(d.kod)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                faol ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
              }`}
            >
              {d.yorliq}
            </button>
          );
        })}
      </div>
    </>
  );
}
