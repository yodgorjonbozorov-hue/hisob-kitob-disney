"use client";

import { useEffect, useRef } from "react";

/**
 * APPARAT SKANER (USB / Bluetooth) — HID klaviatura rejimi.
 *
 * Do'kon skanerlarining aksariyati alohida qurilma emas, KLAVIATURA sifatida
 * ko'rinadi: kodni juda tez "yozib" beradi va oxirida Enter bosadi.
 *
 * Shu yerdagi asosiy muammo — SKANER va QO'LDA YOZISH ni ajratish:
 *
 *  1. Kassir izlash maydoniga "coca" deb yozayotgan bo'lsa, uning har harfi
 *     skaner kodiga qo'shilib ketmasligi kerak. Shuning uchun fokus biror
 *     kiritish maydonida bo'lsa, global tinglovchi UMUMAN ishlamaydi
 *     (bundan skanerning o'z maydoni mustasno — u `data-skaner` bilan
 *     belgilanadi va o'z `onSubmit`iga ega).
 *
 *  2. Fokus hech qayerda bo'lmasa ham, foydalanuvchi klaviaturada tasodifan
 *     bosgan harflar kod deb qabul qilinmasligi kerak. Shuning uchun TEZLIK
 *     tekshiriladi: skaner belgilarni ~10-30 ms oralig'ida yuboradi, odam
 *     esa hech qachon bunchalik tez yoza olmaydi.
 */

/** Ketma-ket ikki belgi orasidagi maksimal oraliq (ms) — bundan sekini "odam". */
const MAKS_ORALIQ = 60;
/** Kod deb qabul qilinadigan minimal uzunlik (tasodifiy bosishlardan himoya). */
const MIN_UZUNLIK = 3;

export function useSkaner(onKod: (kod: string) => void, yoqilgan = true) {
  // Callback ref'da: har render'da tinglovchini qayta ulash shart emas.
  const onKodRef = useRef(onKod);
  onKodRef.current = onKod;

  useEffect(() => {
    if (!yoqilgan) return;

    let bufer = "";
    let oxirgiVaqt = 0;

    function kiritishMaydonidami(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    function handler(e: KeyboardEvent) {
      // Fokus kiritish maydonida — bu odam yozmoqda, aralashmaymiz.
      if (kiritishMaydonidami(e.target)) return;
      // Ctrl/Alt/Meta bilan birga bosilgan tugmalar — yorliqlar, kod emas.
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const hozir = Date.now();
      if (hozir - oxirgiVaqt > MAKS_ORALIQ) {
        bufer = ""; // uzilish bo'ldi — yangi ketma-ketlik
      }
      oxirgiVaqt = hozir;

      if (e.key === "Enter") {
        const kod = bufer.trim();
        bufer = "";
        if (kod.length >= MIN_UZUNLIK) {
          e.preventDefault();
          onKodRef.current(kod);
        }
        return;
      }

      // Faqat bitta bosiladigan belgi (Shift, Tab, F1 va h.k. e'tiborsiz).
      if (e.key.length === 1) {
        bufer += e.key;
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [yoqilgan]);
}
