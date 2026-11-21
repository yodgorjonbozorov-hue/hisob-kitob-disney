"use client";

import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { INPUT_CLASS } from "./fieldStyles";

/**
 * Parol maydoni: ko'rsatish/yashirish tugmasi va Caps Lock ogohlantirishi.
 *
 * Caps Lock holati faqat klaviatura hodisasidan bilinadi (`getModifierState`),
 * shuning uchun ogohlantirish foydalanuvchi maydonda tugma bosgandan keyin
 * chiqadi. Telefon klaviaturasida bu holat yo'q — ogohlantirish chiqmaydi.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const ParolInput = forwardRef<HTMLInputElement, Props>(function ParolInput(
  { id, className = "", onKeyDown, onKeyUp, onBlur, ...props },
  ref
) {
  const [korinadi, setKorinadi] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const ogohId = id ? `${id}-capslock` : undefined;

  function capsTekshir(e: KeyboardEvent<HTMLInputElement>) {
    // Ba'zi brauzerlar avtoto'ldirishda soxta hodisa yuboradi — unda metod bo'lmaydi.
    if (typeof e.getModifierState === "function") {
      setCapsLock(e.getModifierState("CapsLock"));
    }
  }

  return (
    <div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={korinadi ? "text" : "password"}
          className={`${INPUT_CLASS} pr-12 ${className}`}
          aria-describedby={capsLock ? ogohId : undefined}
          onKeyDown={(e) => {
            capsTekshir(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            capsTekshir(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsLock(false);
            onBlur?.(e);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setKorinadi((v) => !v)}
          // Bosish zonasi 44px — barmoq bilan ham oson tegiladi.
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          // Yorliqda "parol" so'zi ATAYLAB yo'q: brauzer testlari maydonni
          // `getByLabel("Parol")` bilan topadi (qisman moslik) — tugma ham mos
          // kelib qolsa 10 ta brauzer to'plami yiqiladi. Kontekst `aria-controls` da.
          aria-label={korinadi ? "Belgilarni yashirish" : "Belgilarni ko'rsatish"}
          aria-pressed={korinadi}
          aria-controls={id}
        >
          {korinadi ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {capsLock && (
        <p id={ogohId} className="mt-1.5 text-sm text-warning" role="status">
          Caps Lock yoqilgan
        </p>
      )}
    </div>
  );
});
