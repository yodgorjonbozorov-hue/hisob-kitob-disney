"use client";

import { TOLOV_TURLARI, TOLOV_NOMI, TOLOV_BELGI, type TolovTuri } from "@/lib/validation/transaction";

/**
 * Formaning birinchi ikki qadami: KIRIM/CHIQIM va TO'LOV TURI.
 *
 * Ikkalasi ham dropdown emas, ko'rinib turgan tugmalar: kassir bir qarashda
 * qaysi holatda ekanini biladi va bitta bosishda almashtiradi. To'lov
 * turlari ro'yxati QOTIRILMAGAN — u `lib/validation/transaction.ts` dagi
 * yagona manbadan keladi, ya'ni yangi tur qo'shilsa forma o'zi yangilanadi.
 *
 * QARZ faqat kirimda: chiqimni qarzga yozib bo'lmaydi (server ham shu
 * qoidani zod bilan majburlaydi).
 */
export function TurVaTolov({
  turi,
  tolovTuri,
  onTuri,
  onTolov,
}: {
  turi: "kirim" | "chiqim";
  tolovTuri: TolovTuri;
  onTuri: (t: "kirim" | "chiqim") => void;
  onTolov: (t: TolovTuri) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onTuri("kirim")}
          aria-pressed={turi === "kirim"}
          className={`py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition ${
            turi === "kirim" ? "bg-income text-white" : "bg-income-soft text-income-fg"
          }`}
        >
          + Kirim
        </button>
        <button
          type="button"
          onClick={() => onTuri("chiqim")}
          aria-pressed={turi === "chiqim"}
          className={`py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition ${
            turi === "chiqim" ? "bg-expense text-white" : "bg-expense-soft text-expense-fg"
          }`}
        >
          − Chiqim
        </button>
      </div>

      <div>
        <p className="block text-sm font-medium text-fg mb-1.5">To&apos;lov turi</p>
        <div className="grid grid-cols-3 gap-2">
          {TOLOV_TURLARI.filter((t) => t !== "qarz" || turi === "kirim").map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTolov(t)}
              aria-pressed={tolovTuri === t}
              className={`px-2 py-2 min-h-[44px] rounded-lg border text-sm transition ${
                tolovTuri === t
                  ? "border-brand bg-brand-wash text-brand font-medium"
                  : "border-line bg-surface-2 text-fg hover:border-brand"
              }`}
            >
              {TOLOV_BELGI[t]} {TOLOV_NOMI[t]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
