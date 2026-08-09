/**
 * Shifrlangan zaxira faylini qo'lda ochish (ko'rish/tekshirish uchun).
 *
 *   ZAXIRA_PAROL=... npm run zaxira:och -- <fayl.json.gz.shifr> [chiqish.json]
 *
 * Tiklash uchun bu qadam SHART EMAS — `npm run restore` va
 * `npm run zaxira:xom -- --tikla` shifr va gzip'ni o'zi ochadi. Bu skript
 * faylni ochiq JSON ko'rinishida diskka yozib beradi, xolos.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { zaxiraFayliniOch } from "./lib/shifr.mjs";

const args = process.argv.slice(2);
const kirish = args[0];
if (!kirish) {
  console.error("Ishlatish: npm run zaxira:och -- <fayl.json.gz.shifr> [chiqish.json]");
  process.exit(1);
}

const tozalangan = kirish.replace(/\.gz\.shifr$|\.shifr$|\.gz$/, "");
const chiqish = args[1] ?? (tozalangan !== kirish ? tozalangan : `${kirish}.ochiq.json`);
if (existsSync(chiqish)) {
  console.error(`XATO: ${chiqish} allaqachon bor — ustiga yozilmaydi. Chiqish nomini o'zingiz bering.`);
  process.exit(1);
}

try {
  const json = zaxiraFayliniOch(readFileSync(kirish), gunzipSync);
  JSON.parse(json.toString("utf8")); // buzuq faylni diskka yozishdan oldin ushlaymiz
  writeFileSync(chiqish, json);
  console.log(`✅ Ochildi: ${chiqish} (${json.byteLength} bayt)`);
} catch (e) {
  console.error("XATO:", e.message);
  process.exit(1);
}
