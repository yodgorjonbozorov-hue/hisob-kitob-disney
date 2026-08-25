"use client";

import Link from "next/link";
import { RejimPaneli } from "./RejimPaneli";

/**
 * ⚙ KASSA SOZLAMALARI — yig'ilgan (collapsed) blok.
 *
 * Nega yig'ilgan: bu yerdagi sozlamalar oyiga bir marta ham o'zgarmaydi,
 * sahifaning asosiy ishi esa har kungi pul nazorati. Ilgari "Shaxsiy kassa
 * rejimi" katta blok bo'lib sahifaning pastini egallab turardi.
 *
 * `<details>` ATAYLAB: ochish/yopish uchun JS kerak emas, sahifa yuklanishi
 * bilan ishlaydi va klaviatura bilan ham yuriladi.
 */
export function SozlamalarPanel({
  businessId,
  shaxsiyKassa,
}: {
  businessId: string;
  shaxsiyKassa: boolean;
}) {
  return (
    <details className="bg-surface border border-line rounded-2xl shadow-card overflow-hidden">
      <summary className="px-4 sm:px-5 min-h-[52px] flex items-center gap-2 cursor-pointer text-sm font-medium text-muted hover:text-fg select-none">
        <span aria-hidden="true">⚙</span> Kassa sozlamalari
      </summary>
      <div className="px-4 sm:px-5 pb-4 pt-1 space-y-4 border-t border-line">
        <RejimPaneli businessId={businessId} yoqilgan={shaxsiyKassa} />
        <div className="pt-3 border-t border-line">
          <p className="text-sm font-medium text-fg">Kassalar hisoboti</p>
          <p className="text-2xs text-muted mt-1">
            Davr kesimida har kassa bo&apos;yicha savdo, xarajat va qoldiq.
          </p>
          <Link
            href="/app/kassa/hisobot"
            className="inline-flex items-center min-h-[44px] text-sm font-medium text-brand hover:underline"
          >
            Hisobotni ochish →
          </Link>
        </div>
      </div>
    </details>
  );
}
