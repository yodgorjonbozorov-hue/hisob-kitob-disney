/**
 * MIJOZGA XOS BLOKLAR TESTI.
 *
 * Dashboard'dagi "Bugun" bloki faqat buyurtma qilgan mijozga (Fortex Selos)
 * ko'rinishi shart. Regressiya: blok PRO tarifga bog'langanda HAR bir PRO
 * mijoz uni ko'rgan edi — shu holat qaytmasligi uchun test yozildi.
 *
 * Ishga tushirish: npm run test:mijoz-xos
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { bugunPaneliKorinadi } from "@/lib/mijozXos";

test("Fortex Selos UZB — bazadagi haqiqiy tenant (slug bo'yicha)", () => {
  assert.equal(bugunPaneliKorinadi({ name: "Fortex Selos UZB", slug: "fortex-selos-uzb" }), true);
});

test("Fortex Selos — qisqa nom ham ro'yxatda", () => {
  assert.equal(bugunPaneliKorinadi({ name: "Fortex Selos", slug: "fortex-selos" }), true);
});

test("Fortex Selos — slug to'qnashuv suffiksi bilan ham, nom bo'yicha topiladi", () => {
  assert.equal(bugunPaneliKorinadi({ name: "Fortex Selos", slug: "fortex-selos-2" }), true);
});

test("Nom yozilishi (registr, ortiqcha bo'shliq) ahamiyatsiz", () => {
  assert.equal(bugunPaneliKorinadi({ name: "fortex  selos", slug: "boshqa-slug" }), true);
});

test("Boshqa mijozlarga ko'rinmaydi — PRO bo'lsa ham", () => {
  assert.equal(bugunPaneliKorinadi({ name: "Red Flora", slug: "red-flora" }), false);
  assert.equal(bugunPaneliKorinadi({ name: "Fortex G'isht", slug: "fortex-gisht" }), false);
  assert.equal(bugunPaneliKorinadi({ name: "Selos", slug: "selos" }), false);
});
