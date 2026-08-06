import * as React from "react";

/**
 * Bir request ichidagi takroriy so'rovlarni birlashtirish (dedupe).
 *
 * Next.js server renderida React'ning `cache()` funksiyasi ishlatiladi —
 * layout ham, sahifa ham bir xil lookup'ni chaqirsa, DB'ga BITTA so'rov ketadi.
 * Oddiy Node muhitida (ts-node testlar) `React.cache` mavjud emas — u holda
 * funksiya o'zgarishsiz qaytariladi (keshsiz, xatti-harakat avvalgidek).
 */
export function requestCache<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const reactCache = (React as { cache?: (f: (...args: A) => R) => (...args: A) => R }).cache;
  return typeof reactCache === "function" ? reactCache(fn) : fn;
}
