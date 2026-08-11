/**
 * BAZANI YANGI SERVERGA KO'CHIRISH — bitta buyruq (masalan Tokio → Frankfurt).
 *
 *   YANGI_DATABASE_URL=libsql://... YANGI_DATABASE_AUTH_TOKEN=... npm run kochirish
 *
 * Eski baza — joriy DATABASE_URL (yoki ESKI_DATABASE_URL berilsa o'sha).
 * Yangi baza — YANGI_DATABASE_URL (majburiy, ataylab alohida nom: "qaysi
 * bazaga yozilyapti" degan savol hech qachon taxminga qolmasligi kerak).
 *
 * Ketma-ketlik:
 *   1. Oldindan tekshiruv — ikkala ulanish, eski baza to'liq migratsiya
 *      qilinganmi, kassa bog'langanmi, yangi baza BO'SHmi
 *   2. Eski bazadan zaxira (JSON) — eski bazaga FAQAT o'qish bilan tegiladi
 *   3. Yangi bazaga migratsiyalar (`db-migrate.mjs`)
 *   4. Zaxirani yangi bazaga tiklash (`restore.ts --confirm`)
 *   5. Mustaqil verifikatsiya — jadval-bajadval sonlar va pul summalari
 *      ESKI baza bilan QAYTA solishtiriladi (tiklash skriptiga ishonib
 *      qolinmaydi), FK yaxlitligi tekshiriladi
 *
 * TO'XTASH QOIDASI: har qadam oldingisiga bog'liq — birortasi yiqilsa
 * keyingisi umuman boshlanmaydi. Eski bazaga hech qanday yozuv ketmaydi,
 * shuning uchun jarayonning istalgan nuqtasida orqaga yo'l ochiq: Vercel
 * env'iga tegilmagan bo'lsa hech narsa o'zgargani yo'q.
 *
 * Yangi baza bo'sh bo'lishi SHART. Bu ayni paytda idempotentlik himoyasi
 * ham: tasodifan ikkinchi marta ishga tushirilsa (yoki allaqachon ishlab
 * turgan bazaga qaratilsa) skript birinchi qadamda to'xtaydi.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

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

function toxta(sabab, yechim) {
  xato(sabab);
  if (yechim) console.error(`\n${SARIQ}Yechim:${TOZA} ${yechim}`);
  console.error(
    `\n${QIZIL}TO'XTATILDI.${TOZA} Eski bazaga hech narsa yozilmagan, ` +
      `Vercel sozlamalariga tegilmagan — hammasi avvalgidek ishlayapti.`
  );
  process.exit(1);
}

const ESKI_URL = process.env.ESKI_DATABASE_URL || process.env.DATABASE_URL;
const ESKI_TOKEN = process.env.ESKI_DATABASE_URL
  ? process.env.ESKI_DATABASE_AUTH_TOKEN
  : process.env.ESKI_DATABASE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
const YANGI_URL = process.env.YANGI_DATABASE_URL;
const YANGI_TOKEN = process.env.YANGI_DATABASE_AUTH_TOKEN;

/** Bola jarayon uchun env: maqsad bazani DATABASE_URL qilib beradi. */
function muhit(url, token) {
  const env = { ...process.env, DATABASE_URL: url };
  // Eski token yangi bazaga (yoki aksincha) sizib o'tmasligi kerak.
  delete env.DATABASE_AUTH_TOKEN;
  if (token) env.DATABASE_AUTH_TOKEN = token;
  return env;
}

/** Bola jarayonni ishga tushiradi; yiqilsa butun skript to'xtaydi. */
function bajar(nom, args, env) {
  const res = spawnSync(process.execPath, args, { stdio: "inherit", env, shell: false });
  if (res.status !== 0) toxta(`${nom} muvaffaqiyatsiz tugadi (kod: ${res.status}).`);
}

async function son(client, sql) {
  return Number((await client.execute(sql)).rows[0].n);
}

async function main() {
  console.log("\n🚚 BALANSA — bazani yangi serverga ko'chirish\n");

  // ---- 1. Oldindan tekshiruv ----
  bolim(1, "Oldindan tekshiruv");

  if (!ESKI_URL) {
    toxta(
      "Eski baza aniqlanmadi: DATABASE_URL ham, ESKI_DATABASE_URL ham yo'q.",
      "Eski (hozirgi production) bazani DATABASE_URL sifatida bering."
    );
  }
  if (!YANGI_URL) {
    toxta(
      "YANGI_DATABASE_URL berilmagan.",
      "Yangi bazani ATAYLAB alohida o'zgaruvchida bering: " +
        "YANGI_DATABASE_URL=libsql://... (yozish aynan shu bazaga bo'ladi)."
    );
  }
  if (ESKI_URL === YANGI_URL) {
    toxta(
      "Eski va yangi baza BIR XIL manzilga qaratilgan.",
      "YANGI_DATABASE_URL yangi (Frankfurt) bazaga qarashi kerak."
    );
  }
  ok("Manzillar alohida.");

  const eski = createClient({ url: ESKI_URL, authToken: ESKI_TOKEN });
  const yangi = createClient({ url: YANGI_URL, authToken: YANGI_TOKEN });

  // Eski baza to'liq migratsiya qilinganmi? Zaxira joriy Prisma sxemasi
  // bilan o'qiladi — sxema orqada bo'lsa dump yo chala, yo xato bo'ladi.
  const lokalMigratsiyalar = readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
  let eskidaQollangan;
  try {
    eskidaQollangan = await son(eski, "SELECT COUNT(*) n FROM _applied_migrations");
  } catch (e) {
    toxta(
      `Eski bazaga ulanib bo'lmadi yoki _applied_migrations jadvali yo'q: ${e.message}`,
      "Avval eski bazada `npm run apply:hammasi` (yoki `npm run migratsiya:belgila`) bajaring."
    );
  }
  if (eskidaQollangan < lokalMigratsiyalar.length) {
    toxta(
      `Eski baza orqada: ${eskidaQollangan}/${lokalMigratsiyalar.length} migratsiya qo'llangan.`,
      "Avval eski bazada `npm run apply:hammasi` bajaring, keyin ko'chiring."
    );
  }
  ok(`Eski baza to'liq migratsiya qilingan (${eskidaQollangan}/${lokalMigratsiyalar.length}).`);

  // Kassa bog'lanmagan bo'lsa ko'chirish shu xatoni yangi bazaga ko'chiradi.
  const kassasiz = await son(
    eski,
    `SELECT COUNT(*) n FROM "Transaction" WHERE accountId IS NULL AND deletedAt IS NULL`
  );
  if (kassasiz > 0) {
    toxta(
      `Eski bazada ${kassasiz} ta tranzaksiya kassaga bog'lanmagan.`,
      "Avval eski bazada `npm run apply:hammasi` bajaring (u kassa skriptini ham ishlatadi)."
    );
  }
  ok("Barcha tranzaksiyalar kassaga bog'langan.");

  // Yangi baza mutlaqo bo'sh bo'lishi shart — bu ham xavfsizlik (noto'g'ri
  // bazaga qaratilganini ushlaydi), ham idempotentlik (takror ishga
  // tushirish ikki nusxa yaratmaydi).
  let yangidaJadvallar;
  try {
    yangidaJadvallar = await son(
      yangi,
      "SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'"
    );
  } catch (e) {
    toxta(`Yangi bazaga ulanib bo'lmadi: ${e.message}`);
  }
  if (yangidaJadvallar > 0) {
    toxta(
      `Yangi baza bo'sh emas: ${yangidaJadvallar} ta jadval bor.`,
      "Ko'chirish faqat YANGI, bo'sh bazaga qilinadi. Turso'da yangi baza " +
        "yarating yoki (agar bu chala qolgan urinish bo'lsa) uni o'chirib qaytadan oching."
    );
  }
  ok("Yangi baza bo'sh.");

  // ---- 2. Zaxira ----
  bolim(2, "Eski bazadan zaxira");

  const sana = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const surat = process.env.KOCHIRISH_SURAT || `prisma/backups/kochirish-${sana}.json`;
  mkdirSync(dirname(surat), { recursive: true });
  bajar("Zaxira", ["-r", "ts-node/register", "scripts/backup.ts", surat], muhit(ESKI_URL, ESKI_TOKEN));
  ok(`Zaxira: ${surat}`);

  // ---- 3. Yangi bazaga migratsiyalar ----
  bolim(3, "Yangi bazaga migratsiyalar");
  bajar("Migratsiya", ["scripts/db-migrate.mjs"], muhit(YANGI_URL, YANGI_TOKEN));

  // ---- 4. Tiklash ----
  bolim(4, "Zaxirani yangi bazaga tiklash");
  bajar(
    "Tiklash",
    ["-r", "ts-node/register", "scripts/restore.ts", surat, "--confirm"],
    muhit(YANGI_URL, YANGI_TOKEN)
  );

  // ---- 5. Mustaqil verifikatsiya ----
  // restore.ts o'zi ham sonlarni solishtiradi, lekin u ZAXIRA FAYLI bilan
  // solishtiradi. Bu yerda esa ikkala JONLI baza to'g'ridan-to'g'ri
  // solishtiriladi — zanjirdagi bironta bo'g'inga ishonib qolinmaydi.
  bolim(5, "Verifikatsiya (eski ↔ yangi)");

  const zaxira = JSON.parse(readFileSync(surat, "utf8"));
  let mos = true;
  for (const [jadval, kutilgan] of Object.entries(zaxira.counts)) {
    if (kutilgan === 0) continue;
    const eskida = await son(eski, `SELECT COUNT(*) n FROM "${jadval}"`);
    const yangida = await son(yangi, `SELECT COUNT(*) n FROM "${jadval}"`);
    if (eskida !== yangida) {
      mos = false;
      xato(`${jadval}: eski ${eskida}, yangi ${yangida}`);
    }
  }
  if (!mos) toxta("Yozuvlar soni mos kelmadi — yangi bazani ISHLATMANG.");
  ok("Barcha jadvallar soni mos.");

  // Pul summalari — soni mos bo'lib qiymati buzilgan holatni ushlaydi.
  for (const [nom, sql] of [
    ["Tranzaksiyalar summasi", `SELECT COALESCE(SUM(summa),0) n FROM "Transaction"`],
    ["Sotuvlar summasi", `SELECT COALESCE(SUM(jamiSumma),0) n FROM "Sale"`],
    ["Qarzlar summasi", `SELECT COALESCE(SUM(jamiSumma),0) n FROM "Debt"`],
  ]) {
    const eskida = await son(eski, sql);
    const yangida = await son(yangi, sql);
    if (eskida !== yangida) {
      toxta(`${nom} mos emas: eski ${eskida}, yangi ${yangida} — yangi bazani ISHLATMANG.`);
    }
    ok(`${nom}: ${yangida.toLocaleString("uz")} (mos)`);
  }

  // FK yaxlitligi — ba'zi remote serverlarda bu PRAGMA yo'q, u holda
  // o'tkazib yuboriladi (tekshiruv yo'qligi haqida ochiq aytiladi).
  try {
    const fk = await yangi.execute("PRAGMA foreign_key_check");
    if (fk.rows.length > 0) {
      toxta(`FK yaxlitligi buzilgan: ${fk.rows.length} ta muammo — yangi bazani ISHLATMANG.`);
    }
    ok("FK yaxlitligi toza.");
  } catch {
    ogoh("Bu serverda PRAGMA foreign_key_check qo'llab-quvvatlanmaydi — o'tkazib yuborildi.");
  }

  // ---- Yakun ----
  console.log(`\n${"═".repeat(60)}`);
  console.log(`${YASHIL}✅ KO'CHIRISH TUGADI.${TOZA} Eski bazaga tegilmagan.`);
  console.log(`${"═".repeat(60)}\n`);
  console.log("Qolgan qadamlar (Vercel'da, ~2 daqiqa):");
  console.log("  1. Settings → Environment Variables:");
  console.log("     DATABASE_URL va DATABASE_AUTH_TOKEN ni YANGI qiymatlarga almashtiring.");
  console.log("  2. Settings → Functions → Function Region → fra1.");
  console.log("  3. Deployments → Redeploy.");
  console.log("  4. Saytda login + dashboard + bitta kirim qo'shib tekshiring.");
  console.log("\nOrqaga yo'l: env'ni eski qiymatga qaytarib redeploy — 2 daqiqa.");
  console.log("Eski bazani kamida 2 hafta O'CHIRMANG.\n");
}

main().catch((e) => {
  toxta(`Kutilmagan xato: ${e.message}`);
});
