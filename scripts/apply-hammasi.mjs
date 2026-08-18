/**
 * MIGRATSIYALARNI TO'LIQ VA XAVFSIZ QO'LLASH — bitta buyruq.
 *
 *   npm run apply:hammasi
 *
 * Ketma-ketlik:
 *   1. Oldindan tekshiruv — ulanish bormi, nechta migratsiya kutmoqda
 *   2. ZAXIRA — muvaffaqiyatsiz bo'lsa boshqa hech narsa qilinmaydi
 *   3. Migratsiyalar (`scripts/db-migrate.mjs`, idempotent)
 *   4. `kassa:migratsiya` — busiz kassa qoldig'i haqiqiy pulni ko'rsatmaydi
 *   5. Tekshiruv — yozuvlar soni, FK yaxlitligi, kassasiz tranzaksiyalar
 *
 * TO'XTASH QOIDASI: har qadam oldingisiga bog'liq. Zaxira olinmasa —
 * to'xtaydi. Migratsiya yiqilsa — kassa skripti umuman ishga tushmaydi.
 * Jimgina davom etish yarim qo'llangan bazadan ko'ra yomonroq.
 *
 * Bu skript IDEMPOTENT: qayta ishga tushirsangiz allaqachon qo'llangan
 * migratsiyalar o'tkazib yuboriladi va kassa skripti hech narsa buzmaydi.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isPostgres, yashirUrl } from "../src/lib/db/provider.cjs";
import * as pgSurat from "./lib/pg-surat.cjs";
import { RUXSAT_ENV, migratsiyaRuxsati } from "./lib/rejim.cjs";

/**
 * PROVAYDER QATLAMI (audit: P0-3).
 *
 * Bu skript ilgari butunlay libsql'ga qurilgan edi: `sqlite_master` dan
 * jadval qidirar, `_applied_migrations` dan hisobot o'qir va `PRAGMA
 * foreign_key_check` bilan tekshirardi. Postgres'da bularning birortasi
 * yo'q, ya'ni CI migratsiyasi (`migratsiya.yml`) u yerda umuman
 * ishlamasdi.
 *
 * Endi TEKSHIRUV va HISOBOT qismi provayderga qarab tanlanadi. Qadamlarning
 * O'ZI (surat, migratsiya, kassa migratsiyasi, zaxira) o'zgarmadi — ular
 * allaqachon provayderga moslashgan skriptlarni chaqiradi.
 */
const POSTGRES = isPostgres(process.env.DATABASE_URL);

/**
 * `--surat <yol>` — ALLAQACHON olingan va tekshirilgan suratni ishlatish.
 *
 * CI zaxirani alohida qadamda oladi (log'da "zaxira yiqildi" bilan
 * "migratsiya yiqildi" farqi ko'rinib tursin). Busiz shu skript ikkinchi
 * dump olardi: katta bazada bu qo'shimcha daqiqalar va ikkita turli
 * paytdagi surat — qaysi biridan tiklashni tanlash muammosi.
 */
const TAYYOR_SURAT = (() => {
  const i = process.argv.indexOf("--surat");
  return i !== -1 ? process.argv[i + 1] : null;
})();

const YASHIL = "\x1b[32m";
const QIZIL = "\x1b[31m";
const SARIQ = "\x1b[33m";
const TOZA = "\x1b[0m";

const ok = (m) => console.log(`${YASHIL}✓${TOZA} ${m}`);
const xato = (m) => console.error(`${QIZIL}✗${TOZA} ${m}`);
const ogoh = (m) => console.log(`${SARIQ}⚠${TOZA}  ${m}`);

function bolim(n, matn) {
  console.log(`\n${"─".repeat(60)}\n${n}. ${matn}\n${"─".repeat(60)}`);
}

/** Bola jarayonni ishga tushiradi; muvaffaqiyatsiz bo'lsa butun skript to'xtaydi. */
function bajar(nom, buyruq, args) {
  const res = spawnSync(buyruq, args, { stdio: "inherit", env: process.env, shell: false });
  if (res.status !== 0) {
    xato(`${nom} muvaffaqiyatsiz tugadi (kod: ${res.status}).`);
    console.error(
      `\n${QIZIL}TO'XTATILDI.${TOZA} Keyingi qadamlar bajarilmadi — baza yarim ` +
        `qo'llangan holatda qolmasligi uchun.\n` +
        `Yuqoridagi xatoni tuzatib, shu buyruqni QAYTA ishga tushiring ` +
        `(skript idempotent, allaqachon bajarilganini takrorlamaydi).`
    );
    process.exit(1);
  }
}

async function main() {
  console.log("\n🚀 BALANSA — migratsiyalarni qo'llash\n");

  // ---- 1. Oldindan tekshiruv ----
  bolim(1, "Oldindan tekshiruv");

  if (!process.env.DATABASE_URL) {
    xato("DATABASE_URL sozlanmagan.");
    console.error(
      "\nBu skript bazaga yozadi, shuning uchun ulanishsiz ishga tushmaydi.\n" +
        "Production uchun: .env faylida DATABASE_URL (va Turso bo'lsa " +
        "DATABASE_AUTH_TOKEN) bo'lishi kerak."
    );
    process.exit(1);
  }

  // Ulanish satri LOGGA chiqadi — parol/token maskalanadi (P0-3).
  ok(`Ulanish: ${yashirUrl(process.env.DATABASE_URL)}`);

  if (POSTGRES) {
    // Postgres yo'li bazaga YOZADI, shuning uchun u faqat migratsiya CI'sida
    // ishlashi kerak. Bayroqsiz chaqiruv (masalan tasodifan lokal terminalda
    // production env bilan) shu yerda to'xtaydi — hech narsa o'zgarmasdan.
    if (!migratsiyaRuxsati()) {
      xato(`PostgreSQL uchun ${RUXSAT_ENV}=ha talab qilinadi.`);
      console.error(
        "\nPostgres migratsiyasi FAQAT migratsiya CI'sida bajariladi\n" +
          "(.github/workflows/migratsiya.yml) — u yerda `postgresql-client` bor\n" +
          "va zaxira migratsiyadan oldin majburiy olinadi.\n\n" +
          `${SARIQ}Baza O'ZGARTIRILMADI.${TOZA}\n`
      );
      process.exit(1);
    }

    // ZAXIRA VOSITASI OLDINDAN tekshiriladi: `pg_dump` yo'qligi 2-qadamda
    // ma'lum bo'lsa, biz allaqachon bazaga ulangan bo'lamiz va foydalanuvchi
    // "nega yiqildi" deb izlaydi. Bu yerda esa hech narsa boshlanmagan.
    if (!pgSurat.pgDumpBormi()) {
      xato("pg_dump topilmadi.");
      console.error(
        "\nZaxirasiz migratsiya qilinmaydi. Muhitga postgresql-client o'rnating:\n" +
          "  apt-get install -y postgresql-client\n\n" +
          `${SARIQ}Baza O'ZGARTIRILMADI.${TOZA}\n`
      );
      process.exit(1);
    }
    ok("pg_dump mavjud — zaxira olinishi mumkin.");
  }

  // ---- Provayder qatlami: ulanish, so'rov va tekshiruvlar ----
  let client;
  let son;
  let jadvalBorMi;
  let jadvalSoni;
  let butunlikTekshiruvi;
  let yopish;

  if (POSTGRES) {
    const c = await pgSurat.pgKlient();
    client = c;
    yopish = () => c.end();
    son = async (sql) => Number((await c.query(sql)).rows[0]?.n ?? 0);

    const jadvallar = new Set(await pgSurat.ilovaJadvallari(c));
    jadvalBorMi = async (nom) => jadvallar.has(nom);
    jadvalSoni = () => jadvallar.size;

    // Postgres tashqi kalitlarni DOIMO majburlaydi va SQLite'dagi
    // `PRAGMA integrity_check` ekvivalenti yo'q — u yerda buzilish
    // umuman paydo bo'lolmaydi. Shu bois tekshiruv "tasdiqlash" bo'lib
    // qoladi: cheklovlar o'rnida turganini sanaymiz.
    butunlikTekshiruvi = async () => {
      const fk = await son(
        `SELECT COUNT(*) n FROM information_schema.table_constraints
         WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY'`
      );
      return { fkBuzilish: 0, izoh: `${fk} ta tashqi kalit o'rnida (Postgres doimo majburlaydi)` };
    };
  } else {
    const { createClient } = await import("@libsql/client");
    const c = createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    client = c;
    yopish = async () => {};
    son = async (sql) => Number((await c.execute(sql)).rows[0]?.n ?? 0);

    jadvalBorMi = async (nom) =>
      (await son(`SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='${nom}'`)) > 0;

    // Xizmat jadvallari hisobga olinmaydi — surat ham ularni olmaydi.
    jadvalSoni = async () =>
      son(
        "SELECT COUNT(*) n FROM sqlite_master WHERE type='table' " +
          "AND name NOT LIKE 'sqlite_%' AND name <> '_applied_migrations'"
      );

    butunlikTekshiruvi = async () => {
      const fk = await c.execute("PRAGMA foreign_key_check");
      const it = await c.execute("PRAGMA integrity_check");
      return {
        fkBuzilish: fk.rows.length,
        izoh: `Baza yaxlitligi: ${String(it.rows[0]?.integrity_check ?? "?")}`,
        yaxlitOk: String(it.rows[0]?.integrity_check ?? "?") === "ok",
      };
    };

    // SQLite hisoboti shu skript tomonidan yuritiladi (Postgres'da uni
    // Prisma yuritadi, shuning uchun u yerda yaratilmaydi).
    await c.execute(
      "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    );
  }

  const hammasi = readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();

  let kutayotgan;
  if (POSTGRES) {
    // Postgres'da hisobotni Prisma yuritadi (`_prisma_migrations`).
    kutayotgan = await pgSurat.kutayotganMigratsiyalar(client);
  } else {
    const qollangan = new Set(
      (await client.execute("SELECT name FROM _applied_migrations")).rows.map((r) => String(r.name))
    );
    kutayotgan = hammasi.filter((d) => !qollangan.has(d));
  }

  if (kutayotgan.length === 0) {
    ok("Kutayotgan migratsiya yo'q — baza allaqachon yangi.");
  } else {
    ok(`${kutayotgan.length} ta migratsiya kutmoqda:`);
    for (const d of kutayotgan) console.log(`     · ${d}`);
  }

  // HISOBOT MOSLIGI. `db-migrate.mjs` qaysi migratsiya qo'llanganini
  // `_applied_migrations` jadvalida yuritadi. Agar baza boshqa yo'l bilan
  // qurilgan bo'lsa (masalan `prisma migrate deploy` yoki `db push`), bu
  // jadval bo'sh qoladi va runner hammasini BOSHIDAN qo'llashga urinadi:
  // "table Business already exists" bilan O'RTADA yiqiladi.
  //
  // Buni oldindan aniqlaymiz: birinchi kutayotgan migratsiya allaqachon
  // mavjud jadvalni yaratmoqchimi?
  // Bu tekshiruv FAQAT SQLite uchun. Postgres'da hisobotni Prisma o'zi
  // yuritadi va nomuvofiqlikda `migrate deploy` ochiq xato bilan to'xtaydi —
  // qo'lda belgilash (`migratsiya:belgila`) ham u yerda ishlatilmaydi.
  if (!POSTGRES && kutayotgan.length > 0) {
    const birinchi = kutayotgan[0];
    const sql = readFileSync(join("prisma/migrations", birinchi, "migration.sql"), "utf8");
    const yaratiladigan = [...sql.matchAll(/CREATE TABLE\s+"(\w+)"/g)].map((m) => m[1]);

    for (const jadval of yaratiladigan) {
      if (await jadvalBorMi(jadval)) {
        xato("Migratsiya hisoboti baza holatiga mos kelmaydi.");
        console.error(
          `\nBirinchi kutayotgan migratsiya (${birinchi}) "${jadval}" jadvalini\n` +
            `yaratmoqchi, lekin u BAZADA ALLAQACHON BOR.\n\n` +
            `Sabab: baza \`scripts/db-migrate.mjs\` dan boshqa yo'l bilan qurilgan\n` +
            `(masalan \`prisma migrate deploy\`), shuning uchun \`_applied_migrations\`\n` +
            `jadvali to'liq emas.\n\n` +
            `${SARIQ}Hech narsa o'zgartirilmadi.${TOZA} Yechim — allaqachon qo'llangan\n` +
            `migratsiyalarni qo'lda belgilash:\n\n` +
            `  npm run migratsiya:belgila -- <oxirgi-qo'llangan-migratsiya-nomi>\n\n` +
            `Qaysi biri ekanini bilmasangiz, bazadagi jadvallarni ko'rib chiqing:\n` +
            `Account jadvali bor bo'lsa — kassa migratsiyasi qo'llangan, va h.k.`
        );
        process.exit(1);
      }
    }
    ok("Migratsiya hisoboti baza holatiga mos.");
  }

  const oldingi = {};
  for (const t of ["Tenant", "Business", "User", "Transaction", "Sale", "Debt", "Product"]) {
    if (await jadvalBorMi(t)) oldingi[t] = await son(`SELECT COUNT(*) n FROM "${t}"`);
  }
  const oldingiSumma = (await jadvalBorMi("Transaction"))
    ? await son(`SELECT COALESCE(SUM("summa"), 0) n FROM "Transaction"`)
    : 0;

  console.log(
    `\n  Hozirgi holat: ${Object.entries(oldingi).map(([k, v]) => `${k}=${v}`).join(", ")}`
  );
  console.log(`  Tranzaksiyalar jami: ${oldingiSumma.toLocaleString("uz-UZ")} so'm`);

  // ---- 2. Xom surat ----
  bolim(2, "Xom surat (majburiy — busiz davom etilmaydi)");
  console.log(
    "Sxemaga bog'liq BO'LMAGAN surat olinadi.\n" +
      "Nega oddiy `npm run backup` emas: u joriy KOD sxemasini biladi, baza esa\n" +
      "hozir undan orqada (Account jadvali yo'q, Transaction.accountId ustuni yo'q).\n" +
      "Prisma zaxirasi shu holatda yiqilardi — zaxira eng kerak paytda ishlamasdi.\n"
  );
  let suratYoli;
  if (TAYYOR_SURAT) {
    // CI'da surat ALOHIDA qadamda olinadi va ALOHIDA qadamda tekshiriladi
    // (`zaxira-tekshir.mjs`), shunda log'da "zaxira" bilan "migratsiya"
    // aniq ajralib turadi. Ikkinchi marta dump olishning ma'nosi yo'q —
    // shuning uchun tayyorini qabul qilamiz, LEKIN uni yana o'zimiz
    // tekshiramiz: bu qadamning shartini chaqiruvchiga ishonib
    // topshirmaymiz.
    suratYoli = TAYYOR_SURAT;
    bajar("Zaxira tekshiruvi", process.execPath, [
      "scripts/zaxira-tekshir.mjs",
      suratYoli,
      "--jadvallar",
      String(await jadvalSoni()),
    ]);
    ok(`Tayyor surat qabul qilindi: ${suratYoli}`);
  } else {
    suratYoli = `prisma/backups/xom-surat-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19)}.json`;
    bajar("Xom surat", process.execPath, ["scripts/xom-zaxira.mjs", suratYoli]);
    // Postgres yo'lida `xom-zaxira.mjs` kengaytmani `.dump` ga almashtiradi.
    if (!existsSync(suratYoli) && existsSync(suratYoli.replace(/\.json$/, ".dump"))) {
      suratYoli = suratYoli.replace(/\.json$/, ".dump");
    }
    bajar("Zaxira tekshiruvi", process.execPath, [
      "scripts/zaxira-tekshir.mjs",
      suratYoli,
      "--jadvallar",
      String(await jadvalSoni()),
    ]);
    ok(`Surat olindi va tekshirildi: ${suratYoli}`);
  }

  // ---- 3. Migratsiyalar ----
  bolim(3, "Migratsiyalar");
  if (kutayotgan.length === 0) {
    ok("O'tkazib yuborildi — kutayotgani yo'q.");
  } else {
    bajar("Migratsiya", process.execPath, ["scripts/db-migrate.mjs"]);
    ok("Migratsiyalar qo'llandi.");
  }

  // ---- 4. Kassa migratsiyasi ----
  bolim(4, "Kassa migratsiyasi (majburiy)");
  console.log(
    "Har biznesga default kassa ochiladi va kassasiz eski tranzaksiyalar\n" +
      "unga bog'lanadi. Busiz kassa qoldig'i haqiqiy pulni ko'rsatmaydi.\n"
  );
  bajar("Kassa migratsiyasi", process.execPath, [
    "-r",
    "ts-node/register",
    "scripts/kassa-migratsiya.ts",
  ]);
  ok("Kassa migratsiyasi tugadi.");

  // ---- 5. Tekshiruv ----
  bolim(5, "Tekshiruv");
  let muammo = 0;
  const tekshir = (shart, matn) => {
    if (shart) ok(matn);
    else {
      xato(matn);
      muammo++;
    }
  };

  // Yozuvlar yo'qolmaganmi?
  for (const [jadval, kutilgan] of Object.entries(oldingi)) {
    const hozir = await son(`SELECT COUNT(*) n FROM "${jadval}"`);
    tekshir(hozir >= kutilgan, `${jadval}: ${kutilgan} → ${hozir}`);
  }

  const yangiSumma = await son(`SELECT COALESCE(SUM("summa"), 0) n FROM "Transaction"`);
  tekshir(
    yangiSumma === oldingiSumma,
    `Tranzaksiyalar jami: ${yangiSumma.toLocaleString("uz-UZ")} so'm ` +
      (yangiSumma === oldingiSumma ? "(o'zgarmadi)" : `(ILGARI ${oldingiSumma.toLocaleString("uz-UZ")})`)
  );

  const butunlik = await butunlikTekshiruvi();
  tekshir(butunlik.fkBuzilish === 0, `Tashqi kalitlar: ${butunlik.fkBuzilish} ta buzilish`);
  tekshir(butunlik.yaxlitOk ?? true, butunlik.izoh);

  const kassasiz = await son(`SELECT COUNT(*) n FROM "Transaction" WHERE "accountId" IS NULL`);
  tekshir(kassasiz === 0, `Kassasiz tranzaksiyalar: ${kassasiz}`);

  const sanasiz = await son(`SELECT COUNT(*) n FROM "Sale" WHERE "sana" IS NULL`);
  tekshir(sanasiz === 0, `Sanasiz sotuvlar: ${sanasiz}`);

  // ---- 6. Mantiqiy zaxira (endi sxema mos keladi) ----
  if (muammo === 0) {
    bolim(6, "Mantiqiy zaxira (migratsiyadan keyin)");
    console.log("Endi baza va kod sxemasi mos — odatdagi zaxira ishlaydi.\n");
    bajar("Zaxira", process.execPath, ["-r", "ts-node/register", "scripts/backup.ts"]);
    ok("Mantiqiy zaxira olindi.");
  }

  await yopish();

  // ---- Yakun ----
  console.log(`\n${"═".repeat(60)}`);
  if (muammo === 0) {
    console.log(`${YASHIL}✅ HAMMASI MUVAFFAQIYATLI${TOZA}`);
    console.log(`${"═".repeat(60)}\n`);
    console.log("Keyingi qadamlar:");
    console.log("  1. Ilovani qayta deploy qiling (yangi modullar PRO tarifda)");
    console.log("  2. Sozlamalar → Modullar: XARID, TASDIQLASH, MIJOZLAR, HR, HUJJATLAR");
    console.log("  3. PROGRESS-AGENT.md dagi har modul tekshiruv ro'yxatidan o'ting\n");
  } else {
    console.log(`${QIZIL}❌ ${muammo} TA MUAMMO TOPILDI${TOZA}`);
    console.log(`${"═".repeat(60)}\n`);
    ogoh("Migratsiyalar qo'llandi, LEKIN tekshiruv o'tmadi.");
    console.log(
      `Xom surat 2-qadamda olingan: ${suratYoli}\n` +
        "Orqaga qaytarish kerak bo'lsa:\n" +
        `  npm run zaxira:xom -- --tikla ${suratYoli}\n\n` +
        "DIQQAT: surat MIGRATSIYADAN OLDINGI sxema holatiga tegishli. Uni tiklash\n" +
        "uchun baza ham o'sha holatga qaytarilishi kerak (yangi jadvallarni tashlab).\n" +
        "Shubha bo'lsa — hech narsa qilmasdan avval yordam so'rang.\n"
    );
    process.exit(1);
  }
}

main().catch((e) => {
  xato(`Kutilmagan xato: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
