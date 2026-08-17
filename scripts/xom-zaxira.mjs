/**
 * XOM SNAPSHOT — buyruq qatori qobig'i.
 *
 *   npm run zaxira:xom                       -> prisma/backups/ ichiga yozadi
 *   npm run zaxira:xom -- <fayl>             -> ko'rsatilgan faylga
 *   npm run zaxira:xom -- --tikla <fayl>     -> shu fayldan tiklaydi
 *
 * Tiklashda fayl formati O'ZI aniqlanadi — qo'shimcha buyruq kerak emas:
 *   .json            — oddiy JSON
 *   .json.gz         — gzip
 *   .json.gz.enc     — AES-256-GCM (deploy oldidan Telegramga ketgan zaxira).
 *                      Ochish uchun BACKUP_ENCRYPTION_KEY env'da bo'lishi shart.
 *
 * Mantiq `scripts/lib/xom-surat.mjs` da — u yerda nima uchun bu zaxira
 * Prisma zaxirasidan alohida kerakligi ham tushuntirilgan.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname } from "node:path";
import { klient, suratOl, suratTikla, jamiYozuv } from "./lib/xom-surat.mjs";
import { deshifrla, shifrlanganmi } from "../src/lib/backup/shifr-asos.cjs";

/** Gzip fayllari shu ikki bayt bilan boshlanadi. */
const GZIP_SARLAVHA = [0x1f, 0x8b];

/**
 * Faylni surat obyektiga aylantiradi: shifrlangan bo'lsa ochadi, siqilgan
 * bo'lsa yoyadi. Tartib teskari — fayl avval siqilib, keyin shifrlangan.
 */
function suratniOqi(yol) {
  let buf = readFileSync(yol);

  const shifrlangan = shifrlanganmi(buf);
  if (shifrlangan) buf = deshifrla(buf);
  if (buf[0] === GZIP_SARLAVHA[0] && buf[1] === GZIP_SARLAVHA[1]) buf = gunzipSync(buf);

  return { surat: JSON.parse(buf.toString("utf8")), shifrlangan };
}

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
  const { surat, shifrlangan } = suratniOqi(yol);
  if (shifrlangan) console.log("🔐 Shifrlangan zaxira ochildi (AES-256-GCM).");
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
