/**
 * PUL BELGISI — MANFIY QIYMAT HECH QACHON BELGISIZ CHIQMAYDI.
 *
 * Auditdagi eng qimmat "kosmetik" xato: Kassalar, Mening kassam va CRM
 * xodim kassasi ekranlarida −17 450 000 lik qoldiq "17 450 000" bo'lib
 * ko'rinardi. Isbot: barcha kassalar yig'indisi 181 143 002, "Jami qoldiq"
 * esa 146 243 002 — farq aynan 2 × 17 450 000, ya'ni qiymat manfiy, faqat
 * belgi chizilmagan.
 *
 * Sabab: `Money` komponenti `signed=false` bo'lganda belgini umuman
 * qo'ymasdi va `Math.abs(value)` ni chizardi. Rang (qizil) belgining
 * o'rnini bosa olmaydi — oq-qora chop etishda ham, rang ko'rmaydigan
 * foydalanuvchida ham minus yo'qolardi.
 *
 * Bu fayl BAZASIZ ishlaydi — faqat formatlash funksiyalari.
 *
 * Ishga tushirish: npm run test:pul-format
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatMoneySigned,
  formatSom,
  formatMoneyCompact,
  parseSomInput,
  pulBelgisi,
} from "../src/lib/format";

const MINUS = "− "; // U+2212 — UI'dagi haqiqiy minus (defis emas)

test("pulBelgisi: manfiy qiymat HAR DOIM minus bilan (signed'dan qat'i nazar)", () => {
  assert.equal(pulBelgisi(-17_450_000), MINUS);
  assert.equal(pulBelgisi(-17_450_000, true), MINUS);
  assert.equal(pulBelgisi(-1), MINUS);
});

test("pulBelgisi: musbat qiymat faqat signed rejimida + oladi", () => {
  assert.equal(pulBelgisi(17_450_000), "");
  assert.equal(pulBelgisi(17_450_000, true), "+ ");
});

test("pulBelgisi: nol belgisiz", () => {
  assert.equal(pulBelgisi(0), "");
  assert.equal(pulBelgisi(0, true), "");
});

test("formatMoneySigned: 0, musbat va manfiy", () => {
  assert.equal(formatMoneySigned(0), "0 soʻm");
  assert.equal(formatMoneySigned(17_450_000), "17 450 000 soʻm");
  assert.equal(formatMoneySigned(-17_450_000), `${MINUS}17 450 000 soʻm`);
  // signed rejimi musbatga + qo'shadi, manfiyni o'zgartirmaydi
  assert.equal(formatMoneySigned(17_450_000, true), "+ 17 450 000 soʻm");
  assert.equal(formatMoneySigned(-17_450_000, true), `${MINUS}17 450 000 soʻm`);
});

test("formatSom: guruhlash va manfiylik saqlanadi (matn/PDF uchun ASCII defis)", () => {
  assert.equal(formatSom(0), "0");
  assert.equal(formatSom(1_250_000), "1 250 000");
  assert.equal(formatSom(-17_450_000), "-17 450 000");
});

test("formatMoneyCompact: manfiy qiymat belgisini yo'qotmaydi", () => {
  assert.equal(formatMoneyCompact(0), "0");
  assert.equal(formatMoneyCompact(12_600_000), "12,6 mln");
  assert.equal(formatMoneyCompact(-15_651_000), "-15,7 mln");
});

test("parseSomInput: minus va harflar summaga o'tmaydi", () => {
  // Tez qo'shish oynasidagi summa maydoni shu funksiyadan o'tadi —
  // manfiy summa ham, matn ham kiritib bo'lmasligi kerak (audit K-4).
  assert.equal(parseSomInput("500000"), 500_000);
  assert.equal(parseSomInput("500 000"), 500_000);
  assert.equal(parseSomInput("-500000"), 500_000);
  assert.equal(parseSomInput("abc"), 0);
  assert.equal(parseSomInput(""), 0);
  assert.equal(parseSomInput("1 234 567 so'm"), 1_234_567);
});
