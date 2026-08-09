/**
 * Zaxiradan tiklash. Maqsad baza — joriy env'dagi DATABASE_URL.
 *
 *   npm run restore -- <fayl.json> --confirm           (bo'sh bazaga)
 *   npm run restore -- <fayl.json> --confirm --force   (ustiga yozish — XAVFLI)
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
import { rawPrisma } from "@/lib/db/rawPrisma";
import { restoreDump, jamiYozuvlar, type Zaxira } from "@/lib/backup/dump";
import { zaxiraFayliniOch } from "@/lib/backup/shifr";

async function main() {
  const args = process.argv.slice(2);
  const yol = args.find((a) => !a.startsWith("--"));
  const confirm = args.includes("--confirm");
  const force = args.includes("--force");

  if (!yol) {
    console.error("Ishlatish: npm run restore -- <fayl.json> --confirm [--force]");
    process.exit(1);
  }
  if (!confirm) {
    console.error("XATO: --confirm bayrog'i kerak (bu buyruq bazaga yozadi).");
    process.exit(1);
  }

  // Telegram'dan kelgan fayl shifrlangan va/yoki gzip bo'lishi mumkin —
  // ikkalasi ham shu yerda ochiladi, eski ochiq .json fayllar o'zgarishsiz o'tadi.
  const zaxira: Zaxira = JSON.parse(zaxiraFayliniOch(readFileSync(yol)).toString("utf8"));
  const maqsad = process.env.DATABASE_URL ?? "(DATABASE_URL yo'q)";

  console.log(`Fayl:   ${yol} (${zaxira.createdAt}, ${jamiYozuvlar(zaxira)} yozuv)`);
  console.log(`Maqsad: ${maqsad.replace(/authToken=[^&]*/i, "authToken=***")}`);
  if (force) console.log("⚠️  --force: mavjud ma'lumot ustiga yoziladi.");
  console.log("");

  const yozilgan = await restoreDump(zaxira, rawPrisma, { force });

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
