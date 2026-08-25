"use client";

import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * SAVOL KIRITISH MAYDONI.
 *
 * Mobil talablar: kiritish maydoni suhbat ostida yopishib turadi, matn
 * o'sganda 5 qatorgacha cho'ziladi, `font-size` 16px dan kichik EMAS
 * (aks holda iOS sahifani zumlaydi va gorizontal siljish paydo bo'ladi),
 * pastki bo'shliq iPhone "iyagi"ni (`pb-safe-4`) hisobga oladi.
 */
export function Kompozer({
  onYuborish,
  kutilmoqda,
  ochiq,
  xato,
}: {
  onYuborish: (matn: string) => void;
  kutilmoqda: boolean;
  ochiq: boolean;
  xato: string | null;
}) {
  const [matn, setMatn] = useState("");
  const maydonRef = useRef<HTMLTextAreaElement>(null);

  function balandlikniMoslash(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }

  function yubor() {
    const s = matn.trim();
    if (!s || kutilmoqda) return;
    setMatn("");
    if (maydonRef.current) maydonRef.current.style.height = "auto";
    onYuborish(s);
  }

  return (
    <div className="shrink-0 border-t border-line bg-surface px-3 lg:px-6 pt-3 pb-safe-4 lg:pb-4">
      {xato && <p className="text-xs text-expense-fg mb-2 max-w-3xl mx-auto">{xato}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          yubor();
        }}
        className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-2 focus-within:border-brand transition"
      >
        <textarea
          ref={maydonRef}
          value={matn}
          rows={1}
          onChange={(e) => {
            setMatn(e.target.value);
            balandlikniMoslash(e.target);
          }}
          onKeyDown={(e) => {
            // Enter — yuborish, Shift+Enter — yangi qator (telefonda ham
            // klaviatura "yuborish" tugmasi shu yo'ldan o'tadi).
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              yubor();
            }
          }}
          placeholder={ochiq ? "Savolingizni yozing..." : "AI hali ulanmagan"}
          disabled={!ochiq}
          aria-label="Savolingizni yozing"
          className="flex-1 min-w-0 bg-transparent resize-none text-base leading-6 py-1.5 text-fg placeholder:text-faint focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!ochiq || kutilmoqda || !matn.trim()}
          aria-label="Yuborish"
          className="shrink-0 w-9 h-9 rounded-full bg-brand text-brand-fg flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </form>
      {/* Telefonda bu qator ko'tarilgan FAB tugmasi ostida qolardi — u yerda
          eslatma bosh ekranda ko'rsatiladi (BoshHolat). */}
      <p className="hidden sm:block max-w-3xl mx-auto text-2xs text-faint mt-2 text-center">
        AI faqat sizning biznesingiz ma&apos;lumotlarini o&apos;qiydi va yozuv kirita olmaydi.
      </p>
    </div>
  );
}
