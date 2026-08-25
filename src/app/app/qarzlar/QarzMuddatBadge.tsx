"use client";

import { muddatMatni, MUDDAT_BELGI, type MuddatHolat } from "@/lib/qarzMuddat";

/** Holat rangi. FAQAT rangga tayanilmaydi — matn har doim yonida (12-talab). */
const RANG: Record<MuddatHolat, string> = {
  kechikdi: "text-expense bg-expense-soft/40",
  bugun: "text-warning bg-warning/10",
  yaqin: "text-warning bg-warning/10",
  keyin: "text-income bg-income-soft/30",
  muddatsiz: "text-muted bg-surface-2",
  yopilgan: "text-income bg-income-soft/30",
};

/**
 * MUDDAT HOLATI BELGISI — "🔴 7 kun kechikdi" ko'rinishida.
 *
 * Rang holat OG'IRLIGINI bir qarashda beradi, matn esa ANIQ raqamni:
 * "qizil" — necha kun kechikkani emas, faqat "yomon" degani. Kassir
 * mijozga qo'ng'iroq qilishdan oldin aynan raqamni bilishi kerak.
 */
export function QarzMuddatBadge({
  holat,
  kun,
  kichik = false,
}: {
  holat: MuddatHolat;
  kun: number | null;
  kichik?: boolean;
}) {
  if (holat === "muddatsiz") return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${
        kichik ? "text-2xs px-2 py-0.5" : "text-xs px-2.5 py-1"
      } ${RANG[holat]}`}
    >
      <span aria-hidden>{MUDDAT_BELGI[holat]}</span>
      {muddatMatni(holat, kun)}
    </span>
  );
}
