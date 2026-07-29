/**
 * BOS-5 TESTLARI: kunlik xulosa (digest), modul tekshiruv yordamchisi.
 * Ishga tushirish: npm run test:automation
 */
process.env.DATABASE_URL = "file:./prisma/test-automation.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let createTransactionSvc: any;
let digest: any;
let guard: any;

let tA: any;
let tB: any;

before(async () => {
  rmSync("prisma/test-automation.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction: createTransactionSvc } = await import("@/lib/services/transactionService"));
  digest = await import("@/lib/reports/dailyDigest");
  guard = await import("@/lib/modules/guard");

  tA = await createTenantWithOwner({ kompaniyaNomi: "Digest A", ism: "A", login: "+998977777701", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "Digest B", ism: "B", login: "+998977777702", parol: "parol12345" });

  // A direktoriga telegram; kechaga bitta kirim.
  await rawPrisma.user.update({ where: { id: tA.user.id }, data: { telegramChatId: "chat_a" } });
  const kecha = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await runWithTenant(tA.tenant.id, async () => {
    const cat = await rawPrisma.category.findFirst({ where: { businessId: tA.business.id, turi: "kirim" } });
    await createTransactionSvc(tA.user.id, tA.business.id, { turi: "kirim", categoryId: cat.id, summa: 4_000_000, sana: kecha });
  });
  // B direktoriga ham telegram — lekin kecha hech narsa bo'lmagan (xabar bormasligi kerak).
  await rawPrisma.user.update({ where: { id: tB.user.id }, data: { telegramChatId: "chat_b" } });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("sendDailyDigest: kechagi raqamlar faqat o'z direktoriga, bo'sh tenant o'tkazib yuboriladi", async () => {
  const yuborilgan: { chatId: string; text: string }[] = [];
  const fakeApi = { sendMessage: async (chatId: string, text: string) => void yuborilgan.push({ chatId, text }) };

  const soni = await digest.sendDailyDigest(fakeApi);
  assert.equal(soni, 1);
  assert.equal(yuborilgan.length, 1);
  assert.equal(yuborilgan[0].chatId, "chat_a");
  assert.ok(yuborilgan[0].text.includes("Kunlik xulosa"));
  assert.ok(yuborilgan[0].text.includes("4 000 000"), "A raqami bo'lishi kerak");
  // B'ga hech narsa bormadi (bo'sh kun) — va A xabarida B nomi yo'q.
  assert.ok(!yuborilgan.some((m) => m.chatId === "chat_b"));
  assert.ok(!yuborilgan[0].text.includes("Digest B"));
});

test("sendDailyDigest: kuniga bir marta (dedupe)", async () => {
  const fakeApi = { sendMessage: async () => {} };
  const ikkinchi = await digest.sendDailyDigest(fakeApi);
  assert.equal(ikkinchi, 0);
});

test("isModuleOnForTenant: core doim, PRO'siz CRM yo'q, yoqilgach bor", async () => {
  assert.equal(await guard.isModuleOnForTenant(tA.tenant.id, "MOLIYA"), true);
  assert.equal(await guard.isModuleOnForTenant(tA.tenant.id, "CRM"), false); // STANDARD

  await rawPrisma.tenant.update({ where: { id: tA.tenant.id }, data: { plan: "PRO" } });
  assert.equal(await guard.isModuleOnForTenant(tA.tenant.id, "CRM"), false); // hali yoqilmagan

  await rawPrisma.tenantModule.create({ data: { tenantId: tA.tenant.id, code: "CRM", isActive: true } });
  assert.equal(await guard.isModuleOnForTenant(tA.tenant.id, "CRM"), true);

  // Boshqa tenantga ta'sir qilmaydi.
  assert.equal(await guard.isModuleOnForTenant(tB.tenant.id, "CRM"), false);
});
