"use client";

import { useEffect } from "react";
import { iosIlovaMi, splashYop, statusBarSozla, tashqaridaOch } from "@/lib/native/kopruk";
import { IlovaQulfi } from "./IlovaQulfi";

/**
 * Native ilova ishga tushishi — faqat iOS ilovasi ichida ta'sir qiladi,
 * brauzerda (PWA/desktop) hech narsa o'zgarmaydi.
 *
 * Vazifalari:
 *  1. `<html data-native="ios">` — CSS shu belgiga qarab native tuzatishlarni
 *     qo'llaydi (xavfsiz zona, o'rnatish banneri berkitiladi).
 *  2. Splash ekranini yopish — sahifa tayyor bo'lishi bilan.
 *  3. Status bar matni rangini mavzuga moslash (qora fon → oq matn).
 *  4. Tashqi havolalarni ilova ichidagi brauzerda ochish: WKWebView ichida
 *     ochilsa foydalanuvchi Balansaga qaytolmay qoladi.
 */
export function NativeSetup() {
  useEffect(() => {
    if (!iosIlovaMi()) return;

    const html = document.documentElement;
    html.dataset.native = "ios";
    splashYop();

    // Mavzu o'zgarsa status bar ham o'zgarsin (`dark` klassi kuzatiladi).
    const mavzuniQoLla = () => statusBarSozla(html.classList.contains("dark"));
    mavzuniQoLla();
    const kuzatuvchi = new MutationObserver(mavzuniQoLla);
    kuzatuvchi.observe(html, { attributes: true, attributeFilter: ["class"] });

    // Tashqi havolalar — native brauzerda.
    const bosildi = (hodisa: MouseEvent) => {
      const nishon = hodisa.target;
      if (!(nishon instanceof Element)) return;
      const havola = nishon.closest("a");
      if (!havola) return;

      const manzil = havola.getAttribute("href");
      if (!manzil) return;
      // Ichki havola, anchor yoki maxsus sxema (tel:, mailto:) — tegilmaydi.
      if (!/^https?:\/\//i.test(manzil)) return;
      if (new URL(manzil, location.href).host === location.host) return;

      hodisa.preventDefault();
      void tashqaridaOch(manzil);
    };
    document.addEventListener("click", bosildi);

    return () => {
      kuzatuvchi.disconnect();
      document.removeEventListener("click", bosildi);
    };
  }, []);

  return <IlovaQulfi />;
}
