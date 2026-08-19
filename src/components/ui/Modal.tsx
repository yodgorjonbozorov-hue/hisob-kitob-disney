"use client";

import { useEffect, useRef } from "react";

/** Klaviatura bilan yuriladigan elementlar (yashirinlari hisobga olinmaydi). */
const FOKUSLANADIGAN =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Desktop'da markazdagi dialog, mobil'da pastki sheet (bottom sheet).
 * ESC va backdrop bosilganda yopiladi; ochilganda body scroll bloklanadi.
 *
 * FOKUS QAMOVI (focus trap): ochilganda fokus modal ichiga o'tadi va Tab
 * bilan undan chiqib bo'lmaydi. Busiz klaviatura yoki skrin-rider bilan
 * ishlaydigan foydalanuvchi Tab bosaverib modal ORTIDAGI ko'rinmas
 * tugmalarga tushib ketardi — forma to'ldirilmay, nima bo'layotgani
 * bilinmay qolardi. Yopilganda fokus modalni ochgan elementga qaytadi.
 */
export function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /**
   * `md` — forma oynasi (asosiy holat). `lg` — ro'yxat oynasi: uzun
   * ro'yxatlar (kategoriya tafsiloti) tor ustunda o'qilmaydi.
   * Mobil ko'rinish ikkalasida ham bir xil — pastdan chiqadigan varaq.
   */
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const oldingiFokus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Modal ochilishidan oldin fokusda turgan element — yopilgach shunga qaytamiz.
    oldingiFokus.current = document.activeElement as HTMLElement | null;

    const elementlar = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>(FOKUSLANADIGAN) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    // Birinchi maydonga fokus. Yopish tugmasi birinchi bo'lib qolmasligi uchun
    // avval forma elementini qidiramiz — foydalanuvchi darhol yoza boshlasin.
    const birinchi =
      panel.current?.querySelector<HTMLElement>("input, select, textarea") ?? elementlar()[0];
    birinchi?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const royxat = elementlar();
      if (royxat.length === 0) {
        e.preventDefault();
        return;
      }
      const bosh = royxat[0];
      const oxir = royxat[royxat.length - 1];
      const faol = document.activeElement;

      // Chetlarda aylantiramiz: oxirgidan keyin birinchisiga, aksincha ham.
      if (!e.shiftKey && faol === oxir) {
        e.preventDefault();
        bosh.focus();
      } else if (e.shiftKey && faol === bosh) {
        e.preventDefault();
        oxir.focus();
      } else if (faol instanceof Node && !panel.current?.contains(faol)) {
        // Fokus qandaydir yo'l bilan tashqariga chiqib ketgan — qaytaramiz.
        e.preventDefault();
        bosh.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      oldingiFokus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panel}
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface text-fg w-full ${
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
        } sm:rounded-2xl rounded-t-2xl shadow-xl px-4 sm:px-6 sm:pt-6 pb-safe-4 sm:pb-6 max-h-[92vh] overflow-y-auto overscroll-contain animate-slide-up sm:animate-fade-in`}
      >
        {/* Pastdan chiqadigan varaqning tortish belgisi — mobil'da bu shakl
            "yopish uchun pastga suring" degan ishorani beradi. */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-line mx-auto mt-3 mb-1" aria-hidden="true" />

        {/* Sarlavha yopishqoq: uzun formada pastga tushganda ham "Yopish"
            tugmasi barmoq ostida qoladi. */}
        <div className="sticky sm:static top-0 z-10 -mx-4 px-4 sm:mx-0 sm:px-0 bg-surface flex items-center justify-between gap-2 py-3 sm:py-0 sm:mb-4">
          <h3 className="text-lg font-semibold text-fg min-w-0 break-words">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="shrink-0 text-faint hover:text-fg text-2xl leading-none w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center -mr-2 rounded-lg hover:bg-surface-2"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
