"use client";

import { Button } from "@/components/ui/Button";
import { formatSomLabel } from "@/lib/format";
import type { PosMahsulotDTO, PosKategoriyaDTO } from "@/lib/queries/pos";

/**
 * KASSA EKRANINING CHAP TOMONI — qidiruv, kategoriya filtri va mahsulot to'ri.
 *
 * Skaner ishlamay qolgan (yoki kod biriktirilmagan) holat uchun ZAXIRA yo'l:
 * kassir tovarni nomi bo'yicha topib bosa oladi. Shu bois bu qism doim
 * ochiq turadi — "kamera ishlamasa manual qidiruv" talabining amaliy javobi.
 */

/** To'rda ko'rsatiladigan maksimal kartochka — uzun katalogda ekran qotib qolmasin. */
const MAKS_KORINADIGAN = 60;

export function MahsulotTori({
  mahsulotlar,
  kategoriyalar,
  qidiruv,
  kategoriya,
  qidiruvRef,
  onQidiruv,
  onKategoriya,
  onKod,
  onTanlandi,
  onKamera,
}: {
  mahsulotlar: PosMahsulotDTO[];
  kategoriyalar: PosKategoriyaDTO[];
  qidiruv: string;
  kategoriya: string;
  qidiruvRef: React.RefObject<HTMLInputElement>;
  onQidiruv: (q: string) => void;
  onKategoriya: (id: string) => void;
  /** Enter bosilganda: kiritilgan matn kod sifatida tekshiriladi. */
  onKod: (kod: string) => void;
  onTanlandi: (p: PosMahsulotDTO) => void;
  onKamera: () => void;
}) {
  const q = qidiruv.trim().toLowerCase();
  const korinadigan = mahsulotlar.filter((p) => {
    if (kategoriya && p.categoryId !== kategoriya) return false;
    if (!q) return true;
    return (
      p.nomi.toLowerCase().includes(q) ||
      (p.sku?.toLowerCase().includes(q) ?? false) ||
      (p.barcode?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          ref={qidiruvRef}
          value={qidiruv}
          onChange={(e) => onQidiruv(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onKod(qidiruv);
            }
          }}
          placeholder="Skanerlang yoki nomi/kodini yozing"
          aria-label="Mahsulot qidirish yoki kod kiritish"
          autoFocus
          className="flex-1 min-w-0 rounded-xl border border-line px-4 py-3 text-sm bg-surface"
        />
        <Button variant="secondary" onClick={onKamera}>
          Kamera
        </Button>
      </div>

      {kategoriyalar.length > 0 && (
        <div className="flex gap-2 jadval-siljish pb-1">
          <button
            onClick={() => onKategoriya("")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs border ${
              kategoriya === "" ? "border-brand bg-brand-wash text-brand" : "border-line text-muted"
            }`}
          >
            Hammasi
          </button>
          {kategoriyalar.map((k) => (
            <button
              key={k.id}
              onClick={() => onKategoriya(k.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs border ${
                kategoriya === k.id
                  ? "border-brand bg-brand-wash text-brand"
                  : "border-line text-muted"
              }`}
            >
              {k.nomi}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
        {korinadigan.slice(0, MAKS_KORINADIGAN).map((p) => (
          <button
            key={p.id}
            onClick={() => onTanlandi(p)}
            className="text-left rounded-xl border border-line bg-surface p-3 hover:border-brand transition"
          >
            <p className="text-sm font-medium text-fg line-clamp-2">{p.nomi}</p>
            <p className="text-sm text-brand mt-1">{formatSomLabel(p.sotuvNarx)}</p>
            <p className={`text-xs mt-0.5 ${p.miqdor > 0 ? "text-faint" : "text-expense"}`}>
              {p.miqdor > 0 ? `${p.miqdor} ${p.birlik}` : "qoldiq yo'q"}
            </p>
          </button>
        ))}
      </div>

      {korinadigan.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">Mahsulot topilmadi.</p>
      )}
      {korinadigan.length > MAKS_KORINADIGAN && (
        <p className="text-xs text-faint text-center">
          {korinadigan.length} tadan {MAKS_KORINADIGAN} tasi ko&apos;rsatildi — qidiruvni
          aniqlashtiring.
        </p>
      )}
    </div>
  );
}
