/**
 * Zaxiradan tiklash. Maqsad baza — joriy env'dagi DATABASE_URL.
 *
 *   npm run restore -- <fayl.json> --confirm           (bo'sh bazaga)
 *   npm run restore -- <fayl.json> --confirm --force   (ustiga yozish — XAVFLI)
 *
 * Fayl formati O'ZI aniqlanadi — qo'shimcha buyruq kerak emas:
 *   .json            — oddiy JSON (avvalgidek)
 *   .json.gz         — gzip
 *   .json.gz.enc     — AES-256-GCM (Telegram kanalidagi kunlik zaxira).
 *                      Ochish uchun BACKUP_ENCRYPTION_KEY env'da bo'lishi shart.
 *
 * `--parolsiz` — kalit yo'q bo'lsa ham tiklash: ma'lumot to'liq tiklanadi,
 * PAROLLAR esa tiklanmaydi (har foydalanuvchiga yangi parol berish kerak).
 *
 * Server ko'chirish tartibi:
 *   1) eski serverda:  npm run backup
 *   2) yangi baza migratsiya qilinadi:  npm run db:apply   (yangi DATABASE_URL bilan)
 *   3) yangi serverda: npm run restore -- <fayl> --confirm
 *   4) yozuvlar soni solishtiriladi (skript o'zi chiqaradi)
 *
 * `--confirm` ataylab majburiy: bu buyruq ma'lumot yozadi, tasodifan ishga tushmasligi kerak.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { restoreDump, jamiYozuvlar, type Zaxira } from "@/lib/backup/dump";
import { deshifrla, shifrlanganmi } from "@/lib/backup/crypto";

/** Gzip fayllari shu ikki bayt bilan boshlanadi. */
const GZIP_SARLAVHA = [0x1f, 0x8b];

/**
 * Faylni o'qib zaxira obyektiga aylantiradi: shifrlangan bo'lsa ochadi,
 * siqilgan bo'lsa yoyadi. Tartib muhim — fayl avval siqilib, keyin
 * shifrlangan (send.ts), demak teskarisi bajariladi.
 */
function zaxirniOqi(yol: string): { zaxira: Zaxira; shifrlangan: boolean } {
  let buf = readFileSync(yol);

  const shifrlangan = shifrlanganmi(buf);
  if (shifrlangan) buf = deshifrla(buf);
  if (buf[0] === GZIP_SARLAVHA[0] && buf[1] === GZIP_SARLAVHA[1]) buf = gunzipSync(buf);

  return { zaxira: JSON.parse(buf.toString("utf8")) as Zaxira, shifrlangan };
}

async function main() {
  const args = process.argv.slice(2);
  const yol = args.find((a) => !a.startsWith("--"));
  const confirm = args.includes("--confirm");
  const force = args.includes("--force");
  const parolsiz = args.includes("--parolsiz");

  if (!yol) {
    console.error("Ishlatish: npm run restore -- <fayl.json> --confirm [--force] [--parolsiz]");
    process.exit(1);
  }
  if (!confirm) {
    console.error("XATO: --confirm bayrog'i kerak (bu buyruq bazaga yozadi).");
    process.exit(1);
  }

  const { zaxira, shifrlangan } = zaxirniOqi(yol);
  if (shifrlangan) console.log("🔐 Shifrlangan zaxira ochildi (AES-256-GCM).");
  const maqsad = process.env.DATABASE_URL ?? "(DATABASE_URL yo'q)";

  console.log(`Fayl:   ${yol} (${zaxira.createdAt}, ${jamiYozuvlar(zaxira)} yozuv)`);
  console.log(`Maqsad: ${maqsad.replace(/authToken=[^&]*/i, "authToken=***")}`);
  if (force) console.log("⚠️  --force: mavjud ma'lumot ustiga yoziladi.");
  if (parolsiz) console.log("⚠️  --parolsiz: parollar tiklanmaydi, yangi parol berish kerak.");
  console.log("");

  const yozilgan = await restoreDump(zaxira, rawPrisma, { force, parolsiz });

  let mos = true;
  for (const [jadval, kutilgan] of Object.entries(zaxira.counts)) {
    const haqiqiy = yozilgan[jadval] ?? 0;
    if (haqiqiy !== kutilgan) {
      mos = false;
      console.error(`   ✗ ${jadval}: kutilgan ${kutilgan}, yozilgan ${haqiqiy}`);
    } else if (kutilgan > 0) {
      console.log(`   ✓ ${jadval}: ${haqiqiy}`);
    }
  }

  if (!mos) {
    console.error("\n❌ Yozuvlar soni mos kelmadi — bazani ISHLATMANG, tekshiring.");
    process.exit(1);
  }
  console.log(`\n✅ Tiklandi: ${jamiYozuvlar(zaxira)} yozuv, barcha jadvallar mos.`);
}

main()
  .catch((e) => {
    console.error("XATO:", e.message);
    process.exit(1);
  })
  .finally(() => rawPrisma.$disconnect());
