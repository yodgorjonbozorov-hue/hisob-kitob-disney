import * as React from "react";

type AnyFn = (...args: any[]) => any;

/**
 * So'rov doirasidagi memoizatsiya (request-level cache).
 *
 * Next.js server komponentlarida React'ning `cache()` funksiyasi BITTA so'rov
 * davomida natijani saqlaydi: layout, sahifa va guard'lar bir xil ma'lumotni
 * so'rasa, baza faqat bir marta o'qiladi. Turso/libsql uzoq baza bo'lgani uchun
 * bu takroriy borish-kelishlarni yo'q qiladi — sezilarli tezlik farqi.
 *
 * MUHIM: `cache` faqat React Server Components muhitida (`react-server` shartli
 * eksporti) mavjud. Telegram bot, cron va test skriptlari oddiy Node'da ishlaydi
 * va u yerda `React.cache` — `undefined`. Shu sabab bu yerda mavjudligi
 * tekshiriladi: bo'lmasa funksiya o'zgarishsiz qaytariladi (memoizatsiyasiz,
 * lekin to'g'ri ishlaydi). Aks holda bot ishga tushishda yiqiladi.
 */
const reactCache = (React as { cache?: <T extends AnyFn>(fn: T) => T }).cache;

export const perRequestCache: <T extends AnyFn>(fn: T) => T =
  typeof reactCache === "function" ? reactCache : (fn) => fn;
