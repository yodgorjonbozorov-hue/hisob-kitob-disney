/**
 * ZAXIRA PAPKASINI SHIFRLASH — CI artefakti uchun (audit: P0-3).
 *
 *   node scripts/zaxira-shifrla.mjs [papka]     (standart: prisma/backups)
 *
 * MUAMMO. Migratsiya CI'si (`.github/workflows/migratsiya.yml`) olingan
 * zaxirani GitHub artefakti sifatida saqlaydi. Artefakt esa oddiy ZIP: uni
 * repozitoriyga kirish huquqi bo'lgan HAR KIM yuklab oladi. Ichida — butun
 * production bazasi: mijozlar, telefon raqamlari, qarzlar, pul aylanmasi.
 * Telegramga ketadigan zaxira allaqachon shifrlanadi (`lib/backup/send.ts`,
 * `deploy-zaxira.mjs`), artefakt esa OCHIQ ketardi. Bir xil ma'lumot, ikki
 * xil himoya — bu farqning sababi yo'q edi.
 *
 * YECHIM. Yuklashdan OLDIN papkadagi har bir fayl o'sha AES-256-GCM
 * mexanizmi bilan shifrlanadi (`src/lib/backup/shifr-asos.cjs` — Telegram
 * yo'li bilan bir xil manba, ya'ni `npm run zaxira:xom -- --tikla` ularni
 * o'zi tanib ochadi).
 *
 * FAIL-CLOSED: `BACKUP_ENCRYPTION_KEY` bo'lmasa bu skript XATO bilan
 * to'xtaydi va HECH NARSA o'zgartirmaydi. "Kalit yo'q ekan, ochiq qoldiray"
 * — aynan shu yo'l ma'lumotni tashqariga chiqaradi.
 *
 * IDEMPOTENT: allaqachon shifrlangan fayl (`BLNS1` sarlavhasi) qayta
 * shifrlanmaydi, shuning uchun skriptni qayta chaqirish xavfsiz.
 */
import "dotenv/config";
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { shifrla, shifrlanganmi, kalitBormi, KALIT_ENV } from "../src/lib/backup/shifr-asos.cjs";

const papka = process.argv[2] ?? "prisma/backups";

if (!kalitBormi()) {
  console.error(
    `\n❌ ${KALIT_ENV} sozlanmagan — zaxira shifrlanmadi.\n\n` +
      "   Zaxira ochiq holda saqlanishi/yuklanishi mumkin emas: ichida butun\n" +
      "   production bazasi bor. Sekretni sozlang va qayta ishga tushiring.\n\n" +
      "   Hech qanday fayl o'zgartirilmadi.\n"
  );
  process.exit(1);
}

if (!existsSync(papka)) {
  console.log(`${papka} papkasi yo'q — shifrlanadigan zaxira topilmadi.`);
  process.exit(0);
}

let shifrlandi = 0;
let otkazildi = 0;

for (const nom of readdirSync(papka).sort()) {
  const yol = join(papka, nom);
  if (!statSync(yol).isFile()) continue;

  const bayt = readFileSync(yol);
  if (shifrlanganmi(bayt)) {
    otkazildi++;
    console.log(`   · ${nom} — allaqachon shifrlangan`);
    continue;
  }

  // Avval vaqtinchalik faylga yozib, keyin almashtiriladi: skript o'rtada
  // uzilsa yarim yozilgan (tiklab bo'lmaydigan) zaxira qolib ketmasin.
  const vaqtinchalik = `${yol}.shifr-tmp`;
  writeFileSync(vaqtinchalik, shifrla(bayt));
  renameSync(vaqtinchalik, `${yol}.enc`);
  // Ochiq nusxa qoldirilmaydi — aks holda artefaktga aynan o'sha tushadi.
  unlinkSync(yol);
  shifrlandi++;
  console.log(`   🔐 ${nom} -> ${nom}.enc`);
}

console.log(`\n✅ Zaxira shifrlandi: ${shifrlandi} ta fayl, ${otkazildi} ta o'tkazib yuborildi.`);
