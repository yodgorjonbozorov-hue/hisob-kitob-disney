"use client";

import { formatSomLabel } from "@/lib/format";

/**
 * "HOZIRGI QARZ → YANGI JAMI" paneli.
 *
 * Kassir qarzga sotishdan OLDIN mijozning qarzi qanchaga chiqishini ko'rishi
 * kerak — aks holda "bu odamga yana berish mumkinmi" savoliga javob yo'q.
 *
 * `hozirgi` — SERVERDAN kelgan raqam (`/api/debts/mijozlar`). Frontendda
 * hech narsa jamlanmaydi; bu yerda faqat "hozirgi + yangi" qo'shiladi va u
 * ham KO'RSATISH uchun. Haqiqiy qoldiq har doim serverda qayta hisoblanadi.
 */
export function QarzOldinKorish({
  ism,
  hozirgi,
  yangi,
  yuklanmoqda,
}: {
  ism: string;
  hozirgi: number | null;
  yangi: number;
  yuklanmoqda?: boolean;
}) {
  if (hozirgi === null && !yuklanmoqda) return null;

  const qator = (nomi: string, qiymat: number | null, kuchli?: boolean) => (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`text-2xs ${kuchli ? "text-fg" : "text-muted"}`}>{nomi}</span>
      <span className={`tabular-nums ${kuchli ? "text-sm font-semibold text-debt" : "text-xs text-fg"}`}>
        {qiymat === null ? "…" : formatSomLabel(qiymat)}
      </span>
    </div>
  );

  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 space-y-1">
      <p className="text-2xs font-medium text-muted truncate">{ism}</p>
      {qator("Hozirgi qarz", hozirgi)}
      {yangi > 0 && qator("Yangi qarz", yangi)}
      {yangi > 0 && (
        <div className="border-t border-line pt-1">
          {qator("Yangi jami", hozirgi === null ? null : hozirgi + yangi, true)}
        </div>
      )}
    </div>
  );
}
