/**
 * PRODUCTION HOLATI — FAQAT O'QISH (deploy'dan oldingi va keyingi tekshiruv).
 *
 *   node scripts/production-holat.mjs
 *
 * Nega kerak: production deploy'ini avtomatlashtirish uchun bazaning holatini
 * BILISH kerak — lekin bilish uchun unga yozish shart emas. Bu skript faqat
 * `SELECT` va `PRAGMA` bajaradi: bitta ham `INSERT`/`UPDATE`/`ALTER` yo'q.
 *
 * OMMAVIY LOG QOIDASI: repozitoriya ommaviy, ya'ni Actions logi hammaga
 * ko'rinadi. Shu sababli PUL SUMMALARI, mijoz nomlari va telefonlar
 * CHIQARILMAYDI. Chiqadigan narsa — tekshiruv xulosalari:
 *   · qaysi migratsiyalar kutmoqda (nomlar repozitoriyada allaqachon bor);
 *   · kutilgan ustun/bayroqlar bormi (ha/yo'q);
 *   · barmoq izi (summalarning SHA-256 xesh boshlanishi) — deploy oldidan va
 *     keyin solishtirish uchun. Xesh summani oshkor qilmaydi, lekin
 *     o'zgarganini aniq ko'rsatadi.
 *
 * Shuning uchun "balans farqi 0 mi" savoliga xesh javob beradi: migratsiya
 * pulga tegmagan bo'lsa, xesh O'ZGARMAYDI.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const chiziq = (m = "") => console.log(m);
const bolim = (m) => {
  chiziq();
  chiziq(`── ${m} ${"─".repeat(Math.max(0, 56 - m.length))}`);
};

/** Pul qiymatlarini oshkor qilmaydigan barmoq izi. */
function barmoqIzi(qismlar) {
  return createHash("sha256").update(qismlar.join("|")).digest("hex").slice(0, 16);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    chiziq("DATABASE_URL yo'q — baza holati ANIQLANMADI.");
    chiziq("Actions sirlariga DATABASE_URL qo'shilmagan bo'lsa shunday bo'ladi.");
    chiziq("HOLAT: UNKNOWN");
    return;
  }

  const { createClient } = await import("@libsql/client");
  const c = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  const son = async (sql) => Number((await c.execute(sql)).rows[0]?.n ?? 0);
  const jadvalBor = async (nom) =>
    (await son(`SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='${nom}'`)) > 0;
  const ustunlar = async (nom) =>
    (await c.execute(`PRAGMA table_info("${nom}")`)).rows.map((r) => String(r.name));

  bolim("Ulanish");
  const jadvalSoni = await son(
    "SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  chiziq(`Ulanish: OK · jadval soni: ${jadvalSoni}`);

  bolim("Migratsiya holati");
  const hisobotBor = await jadvalBor("_applied_migrations");
  if (!hisobotBor) {
    chiziq("_applied_migrations jadvali YO'Q — migratsiya hisoboti yuritilmagan.");
  }
  const qollangan = hisobotBor
    ? new Set(
        (await c.execute("SELECT name FROM _applied_migrations")).rows.map((r) => String(r.name))
      )
    : new Set();
  const hammasi = readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
  const kutayotgan = hammasi.filter((d) => !qollangan.has(d));
  chiziq(`Repozitoriyada: ${hammasi.length} ta migratsiya · qo'llangan: ${qollangan.size}`);
  if (kutayotgan.length === 0) {
    chiziq("KUTAYOTGAN MIGRATSIYA YO'Q — baza kod bilan bir xil.");
  } else {
    chiziq(`KUTAYOTGAN: ${kutayotgan.length} ta`);
    for (const d of kutayotgan) chiziq(`   · ${d}`);
  }

  bolim("Sxema bayroqlari (kg savdosi)");
  const txUstun = await ustunlar("Transaction");
  const catUstun = (await jadvalBor("Category")) ? await ustunlar("Category") : [];
  chiziq(`Transaction.miqdorGr: ${txUstun.includes("miqdorGr") ? "BOR" : "YO'Q"}`);
  chiziq(`Transaction.kgNarxi:  ${txUstun.includes("kgNarxi") ? "BOR" : "YO'Q"}`);
  chiziq(`Category.kgAsosli:    ${catUstun.includes("kgAsosli") ? "BOR" : "YO'Q"}`);
  const kassaTransferBor = await jadvalBor("CashHandover");
  chiziq(`CashHandover jadvali: ${kassaTransferBor ? "BOR" : "YO'Q"}`);

  // Kg bayrog'i FAQAT kg savdosi ochilgan mijozda yoqilgan bo'lishi kerak.
  if (catUstun.includes("kgAsosli")) {
    bolim("Kg bayrog'i tenantlar bo'yicha (izolyatsiya)");
    const r = await c.execute(`
      SELECT t."slug" AS slug,
             SUM(CASE WHEN c."kgAsosli" = 1 THEN 1 ELSE 0 END) AS kg,
             COUNT(c."id") AS jami
      FROM "Category" c
      JOIN "Business" b ON b."id" = c."businessId"
      JOIN "Tenant" t ON t."id" = b."tenantId"
      GROUP BY t."slug"
      ORDER BY t."slug"
    `);
    for (const row of r.rows) {
      chiziq(`   ${row.slug}: kg kategoriya ${row.kg} / ${row.jami}`);
    }
  }

  // ZAKAZ JAMOASI + SIFAT NAZORATI (migratsiya 20260902090000) — faqat PRAGMA.
  bolim("Sxema bayroqlari (zakaz jamoasi / baho)");
  const ecUstun = (await jadvalBor("EmployeeCategory")) ? await ustunlar("EmployeeCategory") : [];
  const deUstun = (await jadvalBor("DealEmployee")) ? await ustunlar("DealEmployee") : [];
  chiziq(`EmployeeCategory.zakazgaBiriktiriladi: ${ecUstun.includes("zakazgaBiriktiriladi") ? "BOR" : "YO'Q"}`);
  chiziq(`EmployeeCategory.kopXodim:             ${ecUstun.includes("kopXodim") ? "BOR" : "YO'Q"}`);
  chiziq(`DealEmployee.baho:                     ${deUstun.includes("baho") ? "BOR" : "YO'Q"}`);
  chiziq(`DealEmployee.bahoIzoh:                 ${deUstun.includes("bahoIzoh") ? "BOR" : "YO'Q"}`);
  chiziq(`DealEmployee.bahoAt:                   ${deUstun.includes("bahoAt") ? "BOR" : "YO'Q"}`);
  const dfBor = await jadvalBor("DealFeedback");
  chiziq(`DealFeedback jadvali:                  ${dfBor ? "BOR" : "YO'Q"}`);
  if (dfBor) {
    const idx = (await c.execute(`PRAGMA index_list("DealFeedback")`)).rows.map((r) => String(r.name));
    chiziq(`DealFeedback_dealId_key (UNIQUE):      ${idx.includes("DealFeedback_dealId_key") ? "BOR" : "YO'Q"}`);
    chiziq(`DealFeedback yozuvlar: ${await son(`SELECT COUNT(*) n FROM "DealFeedback"`)}`);
  }
  if (deUstun.includes("baho")) {
    chiziq(`DealEmployee jami: ${await son(`SELECT COUNT(*) n FROM "DealEmployee"`)} · baholangan: ${await son(`SELECT COUNT(*) n FROM "DealEmployee" WHERE "baho" IS NOT NULL`)}`);
    // Dublikat biriktiruv bo'lishi mumkin emas (UNIQUE) — tekshiruv sifatida.
    const dub = await son(`SELECT COUNT(*) n FROM (SELECT "dealId","categoryId","employeeId" FROM "DealEmployee" GROUP BY 1,2,3 HAVING COUNT(*) > 1)`);
    chiziq(`DealEmployee dublikat guruhlar: ${dub}`);
  }

  bolim("Yaxlitlik");
  const fk = await c.execute("PRAGMA foreign_key_check");
  chiziq(`Tashqi kalitlar: ${fk.rows.length === 0 ? "buzilish yo'q" : `${fk.rows.length} ta BUZILISH`}`);

  bolim("Barmoq izlari (summalar oshkor qilinmaydi)");
  // Deploy oldidan va keyin bir xil bo'lishi SHART: migratsiya pulga tegmaydi.
  const izlar = [];
  const qatorlar = [
    ["Transaction", `SELECT COUNT(*) k, COALESCE(SUM("summa"),0) s FROM "Transaction"`],
    ["Debt", `SELECT COUNT(*) k, COALESCE(SUM("jamiSumma"),0) s FROM "Debt"`],
    ["Sale", `SELECT COUNT(*) k, COALESCE(SUM("jamiSumma"),0) s FROM "Sale"`],
    ["AccountTransfer", `SELECT COUNT(*) k, COALESCE(SUM("summa"),0) s FROM "AccountTransfer"`],
  ];
  for (const [nom, sql] of qatorlar) {
    if (!(await jadvalBor(nom))) {
      chiziq(`${nom}: jadval yo'q`);
      continue;
    }
    const row = (await c.execute(sql)).rows[0];
    const iz = barmoqIzi([nom, String(row.k), String(row.s)]);
    izlar.push(iz);
    chiziq(`${nom}: ${row.k} yozuv · iz ${iz}`);
  }
  chiziq(`UMUMIY MOLIYA IZI: ${barmoqIzi(izlar)}`);
  chiziq();
  chiziq("Bu iz deploy oldidan va keyin BIR XIL bo'lishi shart.");
  chiziq("HOLAT: OK (hech narsa o'zgartirilmadi)");
}

main().catch((e) => {
  console.error(`XATO: ${e.message}`);
  console.error("Baza O'ZGARTIRILMADI — bu skript faqat o'qiydi.");
  process.exit(1);
});
