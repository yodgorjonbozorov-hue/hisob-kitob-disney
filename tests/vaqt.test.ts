/**
 * VAQT (H-2) — ilova kalendari Asia/Tashkent (UTC+5, DSTsiz).
 *
 * Server UTC'da ishlaydi. "Bugun" UTC bo'yicha olinsa, Toshkent vaqti
 * 00:00–05:00 oralig'ida kechagi sana chiqadi va tungi yozuv noto'g'ri
 * kunga (va kunlik hisobotdan tashqariga) tushadi. Shuning uchun "bugun"
 * HAR DOIM todayTashkentDateOnlyString orqali olinadi — UTC varianti
 * kod bazasidan olib tashlangan.
 *
 * Ishga tushirish: npm run test:vaqt
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  todayTashkentDateOnlyString,
  dateOnlyStringToUTCDate,
  utcDateToDateOnlyString,
} from "@/lib/date";

test("20:30 UTC (Toshkentda ertasi kun 01:30) — ertangi sana", () => {
  // 2026-08-13T20:30Z = 2026-08-14 01:30 Toshkent
  assert.equal(todayTashkentDateOnlyString(new Date("2026-08-13T20:30:00.000Z")), "2026-08-14");
});

test("kun chegarasi aynan 19:00 UTC da o'tadi (Toshkent yarim tuni)", () => {
  assert.equal(todayTashkentDateOnlyString(new Date("2026-08-13T18:59:59.999Z")), "2026-08-13");
  assert.equal(todayTashkentDateOnlyString(new Date("2026-08-13T19:00:00.000Z")), "2026-08-14");
});

test("kunduzi UTC va Toshkent kuni bir xil", () => {
  assert.equal(todayTashkentDateOnlyString(new Date("2026-08-13T10:00:00.000Z")), "2026-08-13");
});

test("oy va yil chegarasida ham to'g'ri o'tadi", () => {
  assert.equal(todayTashkentDateOnlyString(new Date("2026-12-31T20:00:00.000Z")), "2027-01-01");
  assert.equal(todayTashkentDateOnlyString(new Date("2026-02-28T21:00:00.000Z")), "2026-03-01");
});

test("date-only aylanish (string -> Date -> string) yo'qotishsiz", () => {
  assert.equal(utcDateToDateOnlyString(dateOnlyStringToUTCDate("2026-08-14")), "2026-08-14");
});

test("kodda UTC'lik todayDateOnlyString qolmagan", () => {
  // H-2 regressiyasi: kimdir yana UTC "bugun"ni qaytarib qo'ymasin.
  const natija = execSync(
    "grep -rn 'todayDateOnlyString' src --include='*.ts' --include='*.tsx' | grep -v todayTashkentDateOnlyString || true",
    { encoding: "utf8" }
  ).trim();
  assert.equal(natija, "", `UTC "bugun" ishlatilgan joy topildi:\n${natija}`);
});
