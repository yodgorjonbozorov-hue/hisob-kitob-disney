/**
 * VAZIFALAR TESTLARI (BOS-3).
 * createTask (mas'ul/bitim tekshiruvi), moveTask, eslatmalar, izolyatsiya.
 * Ishga tushirish: npm run test:tasks
 */
process.env.DATABASE_URL = "file:./prisma/test-tasks.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let svc: any;
let crm: any;
let ForbiddenError: any;
let BadRequestError: any;

let tA: any;
let tB: any;

before(async () => {
  rmSync("prisma/test-tasks.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  svc = await import("@/lib/tasks/service");
  crm = await import("@/lib/crm/service");
  ({ ForbiddenError, BadRequestError } = await import("@/lib/auth/guard"));

  tA = await createTenantWithOwner({ kompaniyaNomi: "Vazifa A", ism: "A", login: "+998955555501", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "Vazifa B", ism: "B", login: "+998955555502", parol: "parol12345" });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("createTask: default mas'ul — yaratuvchining o'zi", async () => {
  const task = await runWithTenant(tA.tenant.id, () =>
    svc.createTask({ businessId: tA.business.id, nomi: "Hisobotni tekshirish", createdBy: tA.user.id })
  );
  assert.equal(task.masulId, tA.user.id);
  assert.equal(task.holat, "OCHIQ");
});

test("createTask: boshqa tenant foydalanuvchisi mas'ul bo'lolmaydi", async () => {
  await assert.rejects(
    async () =>
      runWithTenant(tA.tenant.id, () =>
        svc.createTask({ businessId: tA.business.id, nomi: "X", masulId: tB.user.id, createdBy: tA.user.id })
      ),
    BadRequestError
  );
});

test("createTask: bitimga bog'lash — faqat o'z biznes bitimi", async () => {
  const deal = await runWithTenant(tA.tenant.id, () =>
    crm.createDeal({ businessId: tA.business.id, nomi: "Bog'liq bitim", userId: tA.user.id })
  );
  const task = await runWithTenant(tA.tenant.id, () =>
    svc.createTask({ businessId: tA.business.id, nomi: "Taklif tayyorlash", dealId: deal.id, createdBy: tA.user.id })
  );
  assert.equal(task.dealId, deal.id);

  // B tenant o'z kontekstida A bitimiga vazifa bog'lay olmaydi.
  await assert.rejects(
    async () =>
      runWithTenant(tB.tenant.id, () =>
        svc.createTask({ businessId: tB.business.id, nomi: "Hack", dealId: deal.id, createdBy: tB.user.id })
      ),
    ForbiddenError
  );
});

test("moveTask: BAJARILDI -> bajarildiAt yoziladi, qaytarilsa tozalanadi", async () => {
  const task = await runWithTenant(tA.tenant.id, () =>
    svc.createTask({ businessId: tA.business.id, nomi: "Holat testi", createdBy: tA.user.id })
  );
  const done = await runWithTenant(tA.tenant.id, () =>
    svc.moveTask({ businessId: tA.business.id, taskId: task.id, holat: "BAJARILDI" })
  );
  assert.ok(done.bajarildiAt);

  const back = await runWithTenant(tA.tenant.id, () =>
    svc.moveTask({ businessId: tA.business.id, taskId: task.id, holat: "JARAYONDA" })
  );
  assert.equal(back.bajarildiAt, null);
});

test("moveTask: noma'lum holat rad etiladi", async () => {
  const task = await runWithTenant(tA.tenant.id, () =>
    svc.createTask({ businessId: tA.business.id, nomi: "X2", createdBy: tA.user.id })
  );
  await assert.rejects(
    async () => runWithTenant(tA.tenant.id, () => svc.moveTask({ businessId: tA.business.id, taskId: task.id, holat: "QANDAYDIR" })),
    BadRequestError
  );
});

test("IZOLYATSIYA: A vazifalari B kontekstida ko'rinmaydi/ko'chirilmaydi", async () => {
  const bTasks = await runWithTenant(tB.tenant.id, () => prisma.task.findMany());
  assert.equal(bTasks.length, 0);

  const aTask = await runWithTenant(tA.tenant.id, () => prisma.task.findFirst());
  await assert.rejects(
    async () => runWithTenant(tB.tenant.id, () => svc.moveTask({ businessId: tB.business.id, taskId: aTask.id, holat: "BAJARILDI" })),
    ForbiddenError
  );
});

test("sendTaskReminders: muddati o'tgan vazifa mas'uliga bitta xabar, kunda bir marta", async () => {
  // Mas'ulga telegram bog'laymiz va muddati kecha bo'lgan vazifa yaratamiz.
  await rawPrisma.user.update({ where: { id: tA.user.id }, data: { telegramChatId: "chat_test_123" } });
  const kecha = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await runWithTenant(tA.tenant.id, () =>
    svc.createTask({ businessId: tA.business.id, nomi: "Kechikkan ish", muddat: kecha, createdBy: tA.user.id })
  );

  const yuborilgan: { chatId: string; text: string }[] = [];
  const fakeApi = { sendMessage: async (chatId: string, text: string) => void yuborilgan.push({ chatId, text }) };

  const soni = await svc.sendTaskReminders(fakeApi);
  assert.ok(soni >= 1);
  assert.ok(yuborilgan.some((m) => m.chatId === "chat_test_123" && m.text.includes("Kechikkan ish")));

  // Ikkinchi chaqiruv — o'sha kun uchun takrorlanmaydi.
  const ikkinchi = await svc.sendTaskReminders(fakeApi);
  assert.equal(ikkinchi, 0);
});
