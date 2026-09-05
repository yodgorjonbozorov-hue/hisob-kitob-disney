"use client";

/**
 * "Omborga ta'minot" oqimining to'rt qadami — nomi va progress ko'rsatkichi.
 *
 * TARTIB MUHIM: to'lov MAHSULOTDAN KEYIN so'raladi. Sabab — "qanday
 * to'landi?" savoliga javob ko'pincha SUMMAGA bog'liq (6 mln bo'lsa qarzga,
 * 200 ming bo'lsa naqd). Ilgari to'lov ikkinchi qadamda edi va foydalanuvchi
 * summani hali bilmay turib tanlashi kerak edi, keyin esa orqaga qaytardi.
 */
export const QADAM_NOMI = ["Kimdan?", "Nima keldi?", "Qanday to'landi?", "Saqlash"];

export function Progress({ qadam }: { qadam: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`${qadam + 1}-qadam, jami ${QADAM_NOMI.length}`}>
      {QADAM_NOMI.map((nomi, i) => (
        <span
          key={nomi}
          className={`h-1.5 flex-1 rounded-full transition ${
            i <= qadam ? "bg-brand" : "bg-surface-2"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Idempotentlik kaliti. `crypto.randomUUID` eski brauzerlarda (va HTTPS'siz
 * kontekstda) yo'q — shu bois zaxira yo'l bor, aks holda oqim butunlay
 * ochilmay qolardi.
 */
export function yangiKalit(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
