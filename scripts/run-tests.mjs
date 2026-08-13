#!/usr/bin/env node
/**
 * YIG'MA TEST SKRIPTI (H-11) — `npm test`.
 *
 * `tests/*.test.ts` fayllarini KETMA-KET ishga tushiradi va birortasi
 * yiqilsa nolga teng bo'lmagan kod bilan chiqadi (CI shu bilan qizil bo'ladi).
 *
 * Ketma-ket, parallel emas: har test fayli o'z SQLite bazasini
 * (`file:./prisma/test-*.db`) o'zi yaratadi/o'chiradi, lekin ba'zilari
 * umumiy vaqtinchalik resurslar (portlar, snapshot fayllar) bilan ishlaydi.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** Alohida ishga tushiriladiganlar — default `npm test` ga kirmaydi. */
const CHIQARILGAN = new Map([
  // Chromium va ishlaydigan ilova kerak — `npm run test:smoke` bilan alohida.
  ["smoke-brauzer.test.ts", "brauzer talab qiladi"],
]);

const fayllar = readdirSync("tests")
  .filter((f) => f.endsWith(".test.ts") && !CHIQARILGAN.has(f))
  .sort();

for (const [fayl, sabab] of CHIQARILGAN) {
  console.log(`O'TKAZIB YUBORILDI: ${fayl} (${sabab})`);
}

const yiqilgan = [];
const boshlandi = Date.now();
for (const f of fayllar) {
  console.log(`\n=== tests/${f} ===`);
  const res = spawnSync(process.execPath, ["-r", "ts-node/register", `tests/${f}`], {
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) yiqilgan.push(f);
}

const soniya = Math.round((Date.now() - boshlandi) / 1000);
if (yiqilgan.length > 0) {
  console.error(`\nYIQILDI (${yiqilgan.length}/${fayllar.length}, ${soniya}s):`);
  for (const f of yiqilgan) console.error(`  - tests/${f}`);
  process.exit(1);
}
console.log(`\nBarcha ${fayllar.length} test fayli o'tdi (${soniya}s).`);
