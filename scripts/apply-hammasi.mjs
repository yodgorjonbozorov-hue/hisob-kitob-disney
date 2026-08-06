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

  const yashirin = process.env.DATABASE_URL.replace(/authToken=[^&]*/i, "authToken=***");
  ok(`Ulanish: ${yashirin}`);

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  const son = async (sql) => {
    const r = await client.execute(sql);
    return Number(r.rows[0]?.n ?? 0);
  };

  // Qancha migratsiya kutayotganini oldindan ko'rsatamiz.
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"
  );
  const jadvalBorMi = async (nom) =>
    (await son(`SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='${nom}'`)) > 0;

  const qollangan = new Set(
    (await client.execute("SELECT name FROM _applied_migrations")).rows.map((r) => String(r.name))
  );
  const hammasi = readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
  const kutayotgan = hammasi.filter((d) => !qollangan.has(d));

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
  if (kutayotgan.length > 0) {
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
  const suratYoli = `prisma/backups/xom-surat-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19)}.json`;
  bajar("Xom surat", process.execPath, ["scripts/xom-zaxira.mjs", suratYoli]);
  ok(`Surat olindi: ${suratYoli}`);

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

  const fk = await client.execute("PRAGMA foreign_key_check");
  tekshir(fk.rows.length === 0, `Tashqi kalitlar: ${fk.rows.length} ta buzilish`);

  const it = await client.execute("PRAGMA integrity_check");
  const itMatn = String(it.rows[0]?.integrity_check ?? "?");
  tekshir(itMatn === "ok", `Baza yaxlitligi: ${itMatn}`);

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
