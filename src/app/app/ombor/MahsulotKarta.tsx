"use client";

import { formatSom, formatSomLabel } from "@/lib/format";
import { HOLAT_BELGI, HOLAT_NOMI } from "@/lib/omborHolat";
import type { OmborMahsulotDTO } from "@/lib/queries/ombor";

/**
 * MAHSULOT KARTOCHKASI — rasm, nom, qoldiq, narx, holat. Boshqa hech narsa.
 *
 * Texnik maydonlar (SKU, tannarx, kategoriya id, min qoldiq) ATAYLAB
 * kartochkada yo'q: ular tafsilot oynasida. Grid ko'z bilan skanerlanadigan
 * bo'lishi kerak — har kartochkada olti qator raqam bo'lsa u jadvalning
 * chiroyliroq nusxasiga aylanadi, xolos.
 */
export function MahsulotKarta({
  m,
  onClick,
}: {
  m: OmborMahsulotDTO;
  onClick: () => void;
}) {
  const holatRang =
    m.holat === "tugagan" ? "text-expense" : m.holat === "kam" ? "text-debt" : "text-income";

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-surface rounded-2xl border border-line shadow-card overflow-hidden
                 hover:border-brand focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-brand transition flex flex-col"
    >
      <Rasm nomi={m.nomi} url={m.rasmUrl} tugagan={m.holat === "tugagan"} />

      <div className="p-2.5 sm:p-3 flex flex-col gap-1 min-w-0">
        <p className="font-medium text-fg text-sm leading-tight line-clamp-2 min-h-[2.25rem]">
          {m.nomi}
        </p>

        <p className="text-sm text-fg tnum">
          {formatSom(m.miqdor)}{" "}
          <span className="text-xs text-muted font-normal">{m.birlik}</span>
        </p>

        <p className="text-xs text-muted tnum">
          {m.sotuvNarx > 0 ? formatSomLabel(m.sotuvNarx) : "narx qo'yilmagan"}
        </p>

        <p className={`text-2xs font-medium ${holatRang}`}>
          {HOLAT_BELGI[m.holat]} {HOLAT_NOMI[m.holat]}
        </p>
      </div>
    </button>
  );
}

/**
 * Rasm maydoni.
 *
 * `aspect-square` + `object-cover` — kartochka balandligi rasm o'lchamiga
 * qarab SAKRAMAYDI (grid tinch turadi). `loading="lazy"` va `decoding="async"`
 * — ekrandan tashqaridagi 100 ta rasm birdan yuklanmasin.
 *
 * Next/Image ATAYLAB ishlatilmadi: rasmlar tashqi saqlagichdan (Vercel Blob
 * yoki foydalanuvchi havolasi) keladi va har yangi domen uchun
 * `next.config` ga ruxsat yozish kerak bo'lardi — mijoz o'z havolasini
 * qo'yolmay qolardi.
 */
function Rasm({ nomi, url, tugagan }: { nomi: string; url: string | null; tugagan: boolean }) {
  return (
    <div className="relative aspect-square bg-surface-2 overflow-hidden">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={nomi}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover ${tugagan ? "opacity-50" : ""}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-2xl text-faint" aria-hidden>
          &#128230;
        </div>
      )}
      {tugagan && (
        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-expense text-white text-2xs font-medium">
          Tugagan
        </span>
      )}
    </div>
  );
}
