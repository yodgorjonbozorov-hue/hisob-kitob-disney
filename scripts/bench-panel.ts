/**
 * PANEL TEZLIGI O'LCHOVI — bazaga necha marta murojaat qilinishini sanaydi.
 *
 * Turso/libsql uzoq baza: har bir so'rov alohida tarmoq borish-kelishi (~20-150 ms).
 * Shuning uchun sahifa tezligini belgilaydigan asosiy raqam — SO'ROVLAR SONI.
 *
 * Skript eski (optimizatsiyadan oldingi) va yangi mantiqni bir xil ma'lumot ustida
 * ishlatib, so'rovlar sonini yonma-yon ko'rsatadi.
 *
 * Ishga tushirish:
 *   DATABASE_URL="file:./prisma/bench.db" node -r ts-node/register scripts/bench-panel.ts
 */
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/bench.db";

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const DB_FAYL = process.env.DATABASE_URL.replace(/^file:/, "");
const OY = "2026-05";

/** Bazaga tarmoq murojaatlari soni — libsql klientini o'rab sanaymiz. */
let sanoq = 0;

/**
 * `@libsql/client` modulini rawPrisma import qilinishidan OLDIN o'raymiz —
 * shunda Prisma yaratgan klientning har bir `execute`/`batch` chaqiruvi sanaladi.
 */
function libsqlniOra() {
  const mod = require("@libsql/client");
  const asl = mod.createClient;
  mod.createClient = (cfg: any) => {
    const c = asl(cfg);
    const aslExecute = c.execute.bind(c);
    c.execute = (...a: any[]) => {
      sanoq++;
      return aslExecute(...a);
    };
    const aslBatch = c.batch.bind(c);
    c.batch = (...a: any[]) => {
      sanoq++; // batch — bitta borish-kelish
      return aslBatch(...a);
    };
    return c;
  };
}

async function main() {
  rmSync(DB_FAYL, { force: true });
  const mig = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: process.env, encoding: "utf8" });
  if (mig.status !== 0) throw new Error(`Migratsiya xatosi:\n${mig.stdout}\n${mig.stderr}`);

  libsqlniOra();
  const { rawPrisma } = await import("@/lib/db/rawPrisma");
  const { prisma } = await import("@/lib/prisma");
  const { runWithTenant } = await import("@/lib/db/tenantContext");
  const { createTenantWithOwner } = await import("@/lib/services/signup");
  const dashboard = await import("@/lib/queries/dashboard");
  const { monthRangeUTC, shiftMonthString } = await import("@/lib/date");

  const t = await createTenantWithOwner({
    kompaniyaNomi: "Bench",
    ism: "B",
    login: "+998900000001",
    parol: "parol12345",
  });
  const bid = t.business.id;
  const uid = t.user.id;

  const kategoriyalar = await rawPrisma.category.findMany({ where: { businessId: bid } });

  // 6 oy × ~60 tranzaksiya — kichik biznesning real hajmi.
  const data: any[] = [];
  for (let oyOfset = 0; oyOfset < 6; oyOfset++) {
    const oy = shiftMonthString(OY, -oyOfset);
    for (let i = 0; i < 60; i++) {
      const kat = kategoriyalar[i % kategoriyalar.length];
      const kun = String((i % 27) + 1).padStart(2, "0");
      data.push({
        businessId: bid,
        userId: uid,
        categoryId: kat.id,
        turi: kat.turi,
        summa: 10_000 + i * 137,
        sana: new Date(`${oy}-${kun}T00:00:00.000Z`),
      });
    }
  }
  await rawPrisma.transaction.createMany({ data });
  console.log(`Ma'lumot: ${data.length} ta tranzaksiya, 6 oy.\n`);

  const olcha = async (nom: string, fn: () => Promise<unknown>) => {
    sanoq = 0;
    const boshland = Date.now();
    await fn();
    const vaqt = Date.now() - boshland;
    console.log(`${nom.padEnd(34)} ${String(sanoq).padStart(3)} ta so'rov   ${vaqt} ms`);
    return sanoq;
  };

  // ---------- ESKI mantiq (optimizatsiyadan oldingi kod) ----------
  const eskiSumByType = async (from: Date, to: Date, turi: string) => {
    const r = await prisma.transaction.aggregate({
      _sum: { summa: true },
      where: { businessId: bid, turi, sana: { gte: from, lt: to } },
    });
    return r._sum.summa ?? 0;
  };
  const eskiMonthTotals = async (m: string) => {
    const { from, to } = monthRangeUTC(m);
    const [k, c] = await Promise.all([
      eskiSumByType(from, to, "kirim"),
      eskiSumByType(from, to, "chiqim"),
    ]);
    return { jamiKirim: k, jamiChiqim: c, sofFoyda: k - c };
  };
  const eskiSummary = async () =>
    Promise.all([eskiMonthTotals(OY), eskiMonthTotals(shiftMonthString(OY, -1))]);
  const eskiTrend = async () => {
    const oylar: string[] = [];
    for (let i = 5; i >= 0; i--) oylar.push(shiftMonthString(OY, -i));
    return Promise.all(oylar.map((m) => eskiMonthTotals(m)));
  };
  const eskiBreakdown = async (turi: string) => {
    const { from, to } = monthRangeUTC(OY);
    const grouped = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { businessId: bid, turi, sana: { gte: from, lt: to } },
      _sum: { summa: true },
    });
    if (grouped.length === 0) return [];
    return prisma.category.findMany({ where: { id: { in: grouped.map((g: any) => g.categoryId) } } });
  };
  const eskiDaily = async () => {
    const { from, to } = monthRangeUTC(OY);
    return prisma.transaction.findMany({
      where: { businessId: bid, sana: { gte: from, lt: to } },
      select: { sana: true, turi: true, summa: true },
    });
  };

  console.log("ESKI (optimizatsiyadan oldin)");
  console.log("─".repeat(60));
  let eski = 0;
  await runWithTenant(t.tenant.id, async () => {
    eski += await olcha("  getMonthSummary", eskiSummary);
    eski += await olcha("  getTrend (6 oy)", eskiTrend);
    eski += await olcha("  getCategoryBreakdown ×2", async () => {
      await Promise.all([eskiBreakdown("kirim"), eskiBreakdown("chiqim")]);
    });
    eski += await olcha("  getDailyDynamics", eskiDaily);
  });
  console.log("─".repeat(60));
  console.log(`  JAMI: ${eski} ta so'rov\n`);

  console.log("YANGI (optimizatsiyadan keyin)");
  console.log("─".repeat(60));
  let yangi = 0;
  await runWithTenant(t.tenant.id, async () => {
    yangi += await olcha("  getMonthSummary", () => dashboard.getMonthSummary(bid, OY));
    yangi += await olcha("  getTrend (6 oy)", () => dashboard.getTrend(bid, 6, OY));
    yangi += await olcha("  getCategoryBreakdown ×2", async () => {
      await Promise.all([
        dashboard.getCategoryBreakdown(bid, OY, "kirim"),
        dashboard.getCategoryBreakdown(bid, OY, "chiqim"),
      ]);
    });
    yangi += await olcha("  getDailyDynamics", () => dashboard.getDailyDynamics(bid, OY));
  });
  console.log("─".repeat(60));
  console.log(`  JAMI: ${yangi} ta so'rov\n`);

  const tejaldi = eski - yangi;
  console.log("═".repeat(60));
  console.log(`NATIJA: ${eski} → ${yangi} ta so'rov (${tejaldi} tasi kamaydi, ${(eski / yangi).toFixed(1)}× kam)`);
  console.log(`Turso'da bitta so'rov ~50 ms bo'lsa: ~${tejaldi * 50} ms tejaldi.`);
  console.log("═".repeat(60));

  await rawPrisma.$disconnect();
  rmSync(DB_FAYL, { force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
