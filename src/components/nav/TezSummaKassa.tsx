"use client";

import { Select } from "@/components/ui/Select";
import { formatSom, parseSomInput } from "@/lib/format";

export interface KassaOption {
  id: string;
  nomi: string;
}

/** `/api/accounts?forma=1` javobi — faol kassalar + standart tanlov. */
export interface KassaFormaDTO {
  kassalar: KassaOption[];
  standart: { naqd: string | null; click: string | null };
}

/**
 * TEZ QO'SHISH OYNASINING SUMMA MAYDONI.
 *
 * Audit K-4: bu raqam oddiy `<p>` edi, ya'ni desktopda jismoniy klaviatura
 * bilan yozilgan summa umuman qabul qilinmasdi — faqat ekrandagi keypad
 * ishlardi. Endi u INPUT va keypad bilan BITTA `summa` state'ini boshqaradi:
 * yozish, nusxa-joylash, Backspace/Delete va hammasini almashtirish ishlaydi.
 *
 * `type="text"` ATAYLAB (`number` emas): `number` da bo'sh joy bilan
 * guruhlab bo'lmaydi va g'ildirak summani tasodifan o'zgartirib yuboradi.
 * Harf, minus va nuqta `parseSomInput` da tushib qoladi — manfiy summa ham,
 * matn ham kiritib bo'lmaydi.
 */
export function TezSumma({
  summa,
  onSumma,
  turi,
}: {
  summa: number;
  onSumma: (v: number) => void;
  turi: "kirim" | "chiqim";
}) {
  return (
    <div className="px-5 text-center">
      <label htmlFor="tez-summa" className="sr-only">
        Summa (soʻm)
      </label>
      <div className="flex items-baseline justify-center gap-1.5">
        <input
          id="tez-summa"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={summa > 0 ? formatSom(summa) : ""}
          placeholder="0"
          onChange={(e) => onSumma(parseSomInput(e.target.value))}
          onFocus={(e) => e.currentTarget.select()}
          aria-describedby={summa <= 0 ? "tez-summa-xato" : undefined}
          className={`w-full max-w-[16rem] bg-transparent border-0 border-b border-line
            text-center font-display text-3xl tnum py-1 focus:outline-none focus:border-brand
            ${turi === "kirim" ? "text-income" : "text-expense"}`}
        />
        <span className="text-lg text-faint font-sans">soʻm</span>
      </div>
      {summa <= 0 && (
        <p id="tez-summa-xato" className="mt-1 text-2xs text-muted">
          Summani kiriting
        </p>
      )}
    </div>
  );
}

/**
 * TEZ QO'SHISH OYNASINING KASSA MAYDONI — majburiy (audit K-1).
 *
 * Ilgari bu forma kassani umuman so'ramasdi va yozuv jimgina foydalanuvchining
 * shaxsiy kassasiga tushardi. Kassa QOLDIG'I ko'rsatilmaydi: u "kassa.jami"
 * huquqiga bog'liq maxfiy ma'lumot (tests/kassa-maxfiylik.test.ts).
 */
export function TezKassa({
  forma,
  accountId,
  onAccount,
}: {
  /** `null` — hali yuklanmoqda yoki so'rov muvaffaqiyatsiz tugadi. */
  forma: KassaFormaDTO | null;
  accountId: string;
  onAccount: (v: string) => void;
}) {
  if (forma === null) return null;
  if (forma.kassalar.length === 0) {
    return (
      <p className="px-5 mt-3 text-2xs text-expense-fg">
        Faol kassa yo&apos;q — avval &laquo;Kassalar&raquo; bo&apos;limida kassa oching.
      </p>
    );
  }
  return (
    <div className="px-5 mt-3">
      <label className="block text-sm font-medium text-fg mb-1.5" htmlFor="tez-kassa">
        Kassa <span className="text-expense">*</span>
      </label>
      <Select
        id="tez-kassa"
        value={accountId}
        onChange={onAccount}
        searchable={forma.kassalar.length > 7}
        options={forma.kassalar.map((k) => ({ value: k.id, label: k.nomi }))}
      />
    </div>
  );
}
