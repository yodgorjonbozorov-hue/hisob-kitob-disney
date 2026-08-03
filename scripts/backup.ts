/**
 * Qo'lda to'liq zaxira olish.
 *
 *   npm run backup                    -> prisma/backups/ ichiga yozadi
 *   npm run backup -- <fayl-yo'li>    -> ko'rsatilgan faylga yozadi
 *
 * Production zaxirasi uchun production env bilan ishga tushiring
 * (DATABASE_URL / DATABASE_AUTH_TOKEN). Server ko'chirishdan OLDIN majburiy qadam.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { createDump, jamiYozuvlar } from "@/lib/backup/dump";

async function main() {
  const berilgan = process.argv[2];
  const sana = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const yol = berilgan ?? `prisma/backups/balansa-zaxira-${sana}.json`;

  console.log("Zaxira olinmoqda...");
  const zaxira = await createDump();

  mkdirSync(dirname(yol), { recursive: true });
  writeFileSync(yol, JSON.stringify(zaxira, null, 1), "utf8");

  console.log(`\n✅ Zaxira tayyor: ${yol}`);
  console.log(`   Jami yozuv: ${jamiYozuvlar(zaxira)}`);
  for (const [jadval, soni] of Object.entries(zaxira.counts)) {
    if (soni > 0) console.log(`   ${jadval}: ${soni}`);
  }
}

main()
  .catch((e) => {
    console.error("XATO:", e.message);
    process.exit(1);
  })
  .finally(() => rawPrisma.$disconnect());
