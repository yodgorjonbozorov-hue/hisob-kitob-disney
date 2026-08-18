/**
 * MIGRATSIYA CI'SINING OLDINDAN TEKSHIRUVI (audit: P0-3).
 *
 *   node scripts/migratsiya-preflight.mjs
 *
 * NEGA ALOHIDA SKRIPT. Bu tekshiruvlar ilgari `migratsiya.yml` ichida
 * `run: |` blokida bo'lardi — ya'ni ularni LOKAL ravishda ishga tushirib
 * ko'rib ham, test bilan qamrab ham bo'lmasdi. Migratsiya CI'si esa
 * production bazaga yozadigan yagona yo'l: uning "to'xtatuvchi" mantig'i
 * tekshirilmagan holda qolishi mumkin emas.
 *
 * NIMA TEKSHIRILADI (shu TARTIBDA — har biri oldingisiga bog'liq):
 *   1. `DATABASE_URL` bormi;
 *   2. u tanib bo'ladigan sxemami (`postgres://`, `postgresql://`,
 *      `libsql://`, `file:`) — noto'g'ri sekret bilan ishga tushirish
 *      keyingi qadamlarda tushunarsiz xatolar berardi;
 *   3. provayder aniqlanadi;
 *   4. Postgres bo'lsa: `pg_dump` VA `pg_restore` bormi — zaxira ham,
 *      undan qaytish yo'li ham shu ikkisiga tayanadi;
 *   5. Postgres bo'lsa: ulanish ochilib, kutayotgan migratsiyalar SANALADI
 *      (faqat O'QISH — hech narsa yozilmaydi).
 *
 * BU SKRIPT BAZAGA YOZMAYDI. Uning vazifasi — yozadigan qadamlar
 * boshlanishidan OLDIN to'xtatish.
 *
 * SIR CHIQMAYDI: `DATABASE_URL` hech qayerda to'liq chop etilmaydi —
 * `yashirUrl()` dan o'tadi. Xato matnlarida ham, `GITHUB_OUTPUT` da ham
 * faqat provayder nomi va sonlar bo'ladi.
 */
import "dotenv/config";
import { appendFileSync } from "node:fs";
import { isPostgres, yashirUrl } from "../src/lib/db/provider.cjs";
import * as pgSurat from "./lib/pg-surat.cjs";
import { RUXSAT_ENV, migratsiyaRuxsati } from "./lib/rejim.cjs";
import { kalitBormi, KALIT_ENV } from "../src/lib/backup/shifr-asos.cjs";

/** Tanib olinadigan ulanish sxemalari. */
const SXEMALAR = /^(postgres(ql)?:\/\/|libsql:\/\/|https?:\/\/|file:)/i;

function xato(sarlavha, izoh) {
  console.error(`::error::${sarlavha}`);
  console.error(`\n❌ ${sarlavha}\n\n${izoh}\n`);
  process.exit(1);
}

/** CI qadamlari uchun natija (sir emas — faqat provayder va sonlar). */
function chiqar(kalit, qiymat) {
  console.log(`${kalit}=${qiymat}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${kalit}=${qiymat}\n`);
}

async function main() {
  console.log("── Migratsiya preflight ──\n");

  // ---- 1. Sir bormi ----
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    xato(
      "DATABASE_URL sozlanmagan.",
      "Settings -> Secrets and variables -> Actions -> New repository secret\n" +
        "Sekret nomi: DATABASE_URL"
    );
  }

  // ---- 2. Sxema tanib olinadimi ----
  if (!SXEMALAR.test(url)) {
    xato(
      "DATABASE_URL tanib bo'lmaydigan sxema bilan boshlanmoqda.",
      "Kutilgan: postgresql:// | postgres:// | libsql:// | file:\n" +
        `Berilgan: ${yashirUrl(url)}\n\n` +
        "Sekret noto'g'ri qo'yilgan bo'lishi mumkin (masalan qo'shtirnoq bilan)."
    );
  }

  // ---- 3. Provayder ----
  const provayder = isPostgres(url) ? "postgresql" : "sqlite";
  console.log(`✓ Ulanish: ${yashirUrl(url)}`);
  console.log(`✓ Provayder: ${provayder}`);
  chiqar("provayder", provayder);

  // ---- Bayroq ----
  // CI bazaga YOZADI, shuning uchun o'zini shu bayroq bilan tanitishi shart.
  // Bayroq yo'q bo'lsa `db-migrate.mjs` baribir to'xtaydi — lekin bu yerda
  // to'xtash arzonroq: hali zaxira ham olinmagan, ulanish ham ochilmagan.
  if (!migratsiyaRuxsati()) {
    xato(
      `${RUXSAT_ENV}=ha berilmagan.`,
      "Migratsiya CI'si bazaga yozadigan qadamlarni shu bayroq bilan ochadi.\n" +
        "Workflow'ning `env:` blokiga qo'shing:\n\n" +
        `  ${RUXSAT_ENV}: ha`
    );
  }
  console.log(`✓ ${RUXSAT_ENV}=ha`);

  // ---- Shifrlash kaliti ----
  // Zaxira CI artefakti sifatida saqlanadi, artefakt esa repozitoriyga
  // kirish huquqi bo'lgan HAR KIMGA ochiq. Kalit YO'Q bo'lsa zaxira ochiq
  // qolardi — shuning uchun bu YERDA to'xtaymiz: zaxira hali olinmagan,
  // ya'ni ochiq fayl umuman paydo bo'lmaydi.
  if (!kalitBormi()) {
    xato(
      `${KALIT_ENV} sozlanmagan.`,
      "Zaxira artefakt sifatida yuklanadi va u ochiq holda saqlanishi mumkin emas\n" +
        "(ichida butun production bazasi bor).\n\n" +
        "Settings -> Secrets and variables -> Actions -> New repository secret\n" +
        `Sekret nomi: ${KALIT_ENV}\n\n` +
        "Zaxira OLINMADI, baza O'ZGARTIRILMADI."
    );
  }
  console.log(`✓ ${KALIT_ENV} sozlangan`);

  if (provayder !== "postgresql") {
    console.log("\nSQLite/Turso yo'li — `pg_dump` talab qilinmaydi.");
    chiqar("kutayotgan", "nomalum");
    return;
  }

  // ---- 4. PostgreSQL vositalari ----
  // HARDCODE QILINMAYDI: yo'l ham, versiya ham tekshirilmaydi — faqat
  // buyruq ishlayaptimi. Runner image'i o'zgarsa ham shu tekshiruv to'g'ri
  // qoladi.
  if (!pgSurat.pgDumpBormi()) {
    xato(
      "pg_dump topilmadi.",
      "PostgreSQL zaxirasi shu vositaga tayanadi va ZAXIRASIZ migratsiya\n" +
        "qilinmaydi. Workflow'da `postgresql-client` o'rnatilganiga ishonch hosil qiling.\n\n" +
        "Baza O'ZGARTIRILMADI."
    );
  }
  console.log("✓ pg_dump mavjud");

  // `pg_restore` — zaxiradan QAYTISH yo'li. U yo'q bo'lsa zaxira olingan
  // bo'lsa ham foydasiz: kerak bo'lganda tiklab bo'lmaydi.
  if (!pgSurat.pgRestoreBormi()) {
    xato(
      "pg_restore topilmadi.",
      "Zaxira olinardi, lekin undan QAYTIB bo'lmasdi — bu zaxirasiz\n" +
        "migratsiya bilan bir xil xavf.\n\n" +
        "Baza O'ZGARTIRILMADI."
    );
  }
  console.log("✓ pg_restore mavjud");

  // ---- 5. Ulanish + kutayotganlar (FAQAT O'QISH) ----
  let klient;
  try {
    klient = await pgSurat.pgKlient(url);
  } catch (e) {
    xato(
      "Bazaga ulanib bo'lmadi.",
      `Maqsad: ${yashirUrl(url)}\n` +
        `Sabab: ${e.message}\n\n` +
        "Sekret, tarmoq ruxsati (IP allowlist) yoki SSL sozlamasini tekshiring.\n\n" +
        "Baza O'ZGARTIRILMADI."
    );
  }

  try {
    const kutayotgan = await pgSurat.kutayotganMigratsiyalar(klient);
    const jadvallar = (await pgSurat.ilovaJadvallari(klient)).length;
    console.log(`✓ Ulanish ochildi — ${jadvallar} ta jadval`);

    if (kutayotgan.length === 0) {
      console.log("✓ Kutayotgan migratsiya yo'q — baza allaqachon yangi.");
    } else {
      console.log(`✓ ${kutayotgan.length} ta migratsiya kutmoqda:`);
      for (const m of kutayotgan) console.log(`     · ${m}`);
    }
    chiqar("kutayotgan", String(kutayotgan.length));
    chiqar("jadvallar", String(jadvallar));
  } finally {
    await klient.end();
  }

  console.log("\n✅ Preflight o'tdi — zaxira qadamiga o'tish mumkin.");
}

main().catch((e) => {
  console.error(`::error::Preflight kutilmagan xato: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
