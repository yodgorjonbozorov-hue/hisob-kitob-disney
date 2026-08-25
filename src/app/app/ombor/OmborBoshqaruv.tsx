"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface QoshimchaAmal {
  nomi: string;
  href?: string;
  onClick?: () => void;
  yuklab?: boolean;
}

/**
 * "•••" MENYUSI — ikkinchi darajali amallar.
 *
 * Ilgari Ombor sahifasi tepasida yettita tugma bir qatorda turardi (Excel,
 * import, hisobdan chiqarish, inventarizatsiya, narxlar, ko'proq, yangi) va
 * telefonda ular ikki-uch qatorga sinib ketardi. Endi sahifada FAQAT bitta
 * asosiy amal bor — "+ Tovar keldi", qolgani shu menyuda.
 */
export function OmborBoshqaruv({ amallar }: { amallar: QoshimchaAmal[] }) {
  const [ochiq, setOchiq] = useState(false);
  const orash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ochiq) return;
    const tashqari = (e: MouseEvent) => {
      if (!orash.current?.contains(e.target as Node)) setOchiq(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOchiq(false);
    document.addEventListener("mousedown", tashqari);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", tashqari);
      document.removeEventListener("keydown", esc);
    };
  }, [ochiq]);

  const klass =
    "block w-full text-left px-4 py-2.5 text-sm text-fg hover:bg-surface-2 transition min-h-[44px]";

  return (
    <div className="relative" ref={orash}>
      <button
        type="button"
        onClick={() => setOchiq((v) => !v)}
        aria-label="Boshqa amallar"
        aria-expanded={ochiq}
        className="w-11 h-11 rounded-lg border border-line text-muted hover:text-fg hover:bg-surface-2 transition flex items-center justify-center text-lg leading-none"
      >
        •••
      </button>

      {ochiq && (
        <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-line bg-surface shadow-xl overflow-hidden py-1">
          {amallar.map((a) =>
            a.href ? (
              a.yuklab ? (
                <a key={a.nomi} href={a.href} download className={klass} onClick={() => setOchiq(false)}>
                  {a.nomi}
                </a>
              ) : (
                <Link key={a.nomi} href={a.href} className={klass} onClick={() => setOchiq(false)}>
                  {a.nomi}
                </Link>
              )
            ) : (
              <button
                key={a.nomi}
                type="button"
                className={klass}
                onClick={() => {
                  setOchiq(false);
                  a.onClick?.();
                }}
              >
                {a.nomi}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MOBIL FAB — pastki o'ngda, bottom nav USTIDA.
 *
 * `bottom-[5.5rem]` ATAYLAB: umumiy pastki navigatsiya ~56px va uning
 * o'rtasida allaqachon yashil "+" tugmasi bor. FAB o'sha tugmaning ustiga
 * tushsa ikkisi ham bosib bo'lmaydigan bo'lib qolardi.
 *
 * BELGI ham shu sababdan "+" EMAS, quti (📦): ikkita bir xil yashil "+"
 * yonma-yon turganda foydalanuvchi qaysi biri nima qilishini bilmaydi.
 * Quti belgisi bu tugma AYNAN ombor amallari ekanini aytadi.
 */
export function OmborFab({ amallar }: { amallar: QoshimchaAmal[] }) {
  const [ochiq, setOchiq] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOchiq(true)}
        aria-label="Ombor amallari"
        className="lg:hidden fixed right-4 bottom-[5.5rem] z-30 w-14 h-14 rounded-full bg-brand text-brand-fg
                   shadow-raised flex items-center justify-center text-2xl leading-none active:scale-95 transition"
      >
        <span aria-hidden>&#128230;</span>
      </button>

      {ochiq && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex items-end bg-black/50 animate-fade-in"
          onClick={() => setOchiq(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Ombor amallari"
        >
          <div
            className="bg-surface text-fg w-full rounded-t-2xl p-4 pb-safe-4 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" aria-hidden />
            <div className="flex flex-col gap-1">
              {amallar.map((a) => (
                <button
                  key={a.nomi}
                  type="button"
                  onClick={() => {
                    setOchiq(false);
                    a.onClick?.();
                  }}
                  className="text-left px-4 py-3.5 rounded-xl text-base font-medium hover:bg-surface-2 transition min-h-[52px]"
                >
                  {a.nomi}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
