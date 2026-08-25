"use client";

import { formatSom, parseSomInput } from "@/lib/format";

/**
 * SUMMA — formadagi eng muhim maydon, shuning uchun eng katta.
 *
 * `inputMode="numeric"` telefonda raqamli klaviaturani ochadi (harflar
 * klaviaturasidan raqam qidirish kunlik ishda sekundlarni yeydi), matn esa
 * kiritilayotgan payt guruhlanadi: 1000000 → "1 000 000". Serverga baribir
 * `parseSomInput` bilan XOM butun son ketadi — formatlangan matn emas.
 *
 * `type="text"` ATAYLAB (number emas): `type=number` da bo'sh joy bilan
 * guruhlash mumkin emas va iOS'da g'ildirak/strelkalar summani tasodifan
 * o'zgartirib yuboradi.
 */
export function SummaMaydoni({
  qiymat,
  onChange,
  turi,
  disabled = false,
}: {
  /** Formatlangan matn ("1 000 000"). Xom qiymat `parseSomInput` bilan olinadi. */
  qiymat: string;
  onChange: (matn: string) => void;
  turi: "kirim" | "chiqim";
  disabled?: boolean;
}) {
  const son = parseSomInput(qiymat);
  const rang = turi === "kirim" ? "text-income" : "text-expense";

  return (
    <div>
      <label className="block text-sm font-medium text-fg mb-1.5" htmlFor="tx-summa">
        Summa
      </label>
      <div className="relative">
        <input
          id="tx-summa"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={qiymat}
          onChange={(e) => {
            const n = parseSomInput(e.target.value);
            onChange(n ? formatSom(n) : "");
          }}
          placeholder="0"
          aria-describedby="tx-summa-izoh"
          className={`w-full rounded-xl border-2 border-line bg-surface px-4 py-3 pr-16
            text-2xl sm:text-3xl font-display tnum font-semibold ${rang}
            placeholder:text-faint placeholder:font-normal
            focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30
            disabled:opacity-50`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-faint pointer-events-none">
          so&apos;m
        </span>
      </div>
      {/* Kiritilgan qiymatni odam o'qiydigan ko'rinishda takrorlaymiz —
          "70000" bilan "700000" ni adashtirish eng qimmat xatolardan biri. */}
      <p id="tx-summa-izoh" className="mt-1.5 text-sm text-muted tnum min-h-[1.375rem]">
        {son > 0 ? `${formatSom(son)} so'm` : "Summani kiriting"}
      </p>
    </div>
  );
}
