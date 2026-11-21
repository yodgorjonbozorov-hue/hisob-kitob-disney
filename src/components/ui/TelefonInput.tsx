"use client";

import { useState, type InputHTMLAttributes } from "react";
import { INPUT_CLASS } from "./fieldStyles";
import { telE164, telKorinish } from "@/lib/tel";

/**
 * Telefon raqami maydoni — standartlar bo'yicha:
 *
 *  - `type="tel"` + `inputMode="tel"`: telefonda raqamli klaviatura (HTML).
 *  - `autoComplete="tel"`: brauzer foydalanuvchining o'z raqamini taklif qiladi
 *    (WHATWG autofill). Chaqiruvchi boshqa qiymat bera oladi.
 *  - Maydondan chiqqanda to'g'ri raqam ITU-T E.123 xalqaro ko'rinishiga
 *    keltiriladi (`+998 90 123 45 67`) — foydalanuvchi nima saqlanishini ko'radi.
 *    Bazaga esa server E.164 (`+998901234567`) yozadi (lib/tel.ts).
 *  - Yaroqsiz raqam: `aria-invalid` + maydon ostida izoh (`aria-describedby`).
 *
 * Yozish paytida (har harfda) formatlanmaydi: kursor sakrab, o'chirish
 * qiyinlashadi. Formatlash faqat blur'da.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  id: string;
  value: string;
  onChange: (qiymat: string) => void;
};

export function TelefonInput({ id, value, onChange, onBlur, className = "", ...props }: Props) {
  const [tekshirildi, setTekshirildi] = useState(false);
  const yaroqsiz = tekshirildi && value.trim() !== "" && telE164(value) === null;
  const izohId = `${id}-izoh`;

  return (
    <div>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const e164 = telE164(value);
          // O'zbekiston raqami E.123 ko'rinishida; chet el raqami E.164 (bo'shliqsiz).
          if (e164) onChange(e164.startsWith("+998") ? telKorinish(e164) : e164);
          setTekshirildi(true);
          onBlur?.(e);
        }}
        aria-invalid={yaroqsiz || undefined}
        aria-describedby={yaroqsiz ? izohId : undefined}
        // `!` — INPUT_CLASS dagi `border-line` CSS tartibida ustun keladi.
        className={`${INPUT_CLASS} ${yaroqsiz ? "!border-expense" : ""} ${className}`}
        {...props}
      />
      {yaroqsiz && (
        <p id={izohId} className="mt-1.5 text-sm text-expense">
          Raqamni to&apos;liq kiriting: +998 90 123 45 67. Boshqa davlat raqami + bilan yoziladi.
        </p>
      )}
    </div>
  );
}
