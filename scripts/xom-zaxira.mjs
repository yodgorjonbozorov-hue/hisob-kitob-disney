/**
 * XOM SNAPSHOT — buyruq qatori qobig'i.
 *
 *   npm run zaxira:xom                       -> prisma/backups/ ichiga yozadi
 *   npm run zaxira:xom -- <fayl>             -> ko'rsatilgan faylga
 *   npm run zaxira:xom -- --tikla <fayl>     -> shu fayldan tiklaydi
 *
 * Mantiq `scripts/lib/xom-surat.mjs` da — u yerda nima uchun bu zaxira
 * Prisma zaxirasidan alohida kerakligi ham tushuntirilgan.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { klient, suratOl, suratTikla, jamiYozuv } from "./lib/xom-surat.mjs";
import { zaxiraFayliniOch } from "./lib/shifr.mjs";

async function ol(yol) {
  const surat = await suratOl(klient());

  mkdirSync(dirname(yol), { recursive: true });
  writeFileSync(yol, JSON.stringify(surat), "utf8");

  const jadvallar = Object.keys(surat.jadvallar);
  console.log(`\n✅ Xom surat tayyor: ${yol}`);
  console.log(`   ${jadvallar.length} jadval, ${jamiYozuv(surat)} yozuv`);
  for (const [j, v] of Object.entries(surat.jadvallar)) {
    if (v.qatorlar.length > 0) console.log(`   ${j}: ${v.qatorlar.length}`);
  }
}

async function tikla(yol) {
  // Telegram'dan kelgan fayl shifrlangan va/yoki gzip bo'lishi mumkin —
  // ikkalasini ham shu yerda ochamiz, foydalanuvchi qo'lda ochib o'tirmaydi.
  const surat = JSON.parse(zaxiraFayliniOch(readFileSync(yol), gunzipSync).toString("utf8"));
  console.log(`Tiklanmoqda: ${yol} (${surat.olingan})\n`);

  const jami = await suratTikla(klient(), surat, (jadval, soni) => {
    console.log(`   ✓ ${jadval}: ${soni}`);
  });

  console.log(`\n✅ Tiklandi: ${jami} yozuv, tashqi kalitlar toza.`);
}

const args = process.argv.slice(2);
const tiklash = args.includes("--tikla");
const yol =
  args.find((a) => !a.startsWith("--")) ??
  `prisma/backups/xom-surat-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;

(tiklash ? tikla(yol) : ol(yol)).catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
