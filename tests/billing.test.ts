/**
 * BILLING TESTLARI (FAZA 4).
 * computeAccess (sof funksiya) + MANUAL to'lov oqimi: checkout -> confirmPayment
 * -> tenant ACTIVE va muddat uzayadi. Ishga tushirish: npm run test:billing
 */
process.env.DATABASE_URL = "file:./prisma/test-billing.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: <T>(tenantId: string, fn: () => T) => T;
let computeAccess: any;
let confirmPayment: any;
let rejectPayment: any;
let extendTenant: any;
let updateExpiredStatuses: any;
let manualProvider: any;
let createTenantWithOwner: any;

const KUN_MS = 24 * 60 * 60 * 1000;
let t: any; // signup natijasi

before(async () => {
  rmSync("prisma/test-billing.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ computeAccess } = await import("@/lib/billing/access"));
  ({ confirmPayment, rejectPayment, extendTenant, updateExpiredStatuses } = await import("@/lib/billing/subscribe"));
  ({ manualProvider } = await import("@/lib/billing/provider"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Billing Test",
    ism: "Test",
    login: "+998900000077",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- computeAccess (sof funksiya) ----------
test("TRIAL faol — FULL; 3 kun qolganda ogohlantirish", () => {
  const now = new Date();
  const full = computeAccess({ status: "TRIAL", trialEndsAt: new Date(now.getTime() + 10 * KUN_MS), currentPeriodEnd: null }, now);
  assert.equal(full.mode, "FULL");
  assert.equal(full.ogohlantirish, null);

  const soon = computeAccess({ status: "TRIAL", trialEndsAt: new Date(now.getTime() + 2 * KUN_MS), currentPeriodEnd: null }, now);
  assert.equal(soon.mode, "FULL");
  assert.ok(soon.ogohlantirish?.includes("tugaydi"));
});

test("TRIAL muddati o'tgan — BILLING_ONLY", () => {
  const now = new Date();
  const a = computeAccess({ status: "TRIAL", trialEndsAt: new Date(now.getTime() - KUN_MS), currentPeriodEnd: null }, now);
  assert.equal(a.mode, "BILLING_ONLY");
});

test("PAST_DUE — READONLY (ma'lumot garovga olinmaydi)", () => {
  const a = computeAccess({ status: "PAST_DUE", trialEndsAt: null, currentPeriodEnd: new Date(Date.now() - KUN_MS) });
  assert.equal(a.mode, "READONLY");
});

test("BLOCKED — BILLING_ONLY", () => {
  const a = computeAccess({ status: "BLOCKED", trialEndsAt: null, currentPeriodEnd: null });
  assert.equal(a.mode, "BILLING_ONLY");
});

test("ACTIVE davri tugagan — READONLY (cron'siz ham himoya)", () => {
  const now = new Date();
  const a = computeAccess({ status: "ACTIVE", trialEndsAt: null, currentPeriodEnd: new Date(now.getTime() - KUN_MS) }, now);
  assert.equal(a.mode, "READONLY");
});

test("noma'lum status — xavfsizlik uchun BILLING_ONLY", () => {
  const a = computeAccess({ status: "QANDAYDIR", trialEndsAt: null, currentPeriodEnd: null });
  assert.equal(a.mode, "BILLING_ONLY");
});

// ---------- MANUAL to'lov oqimi ----------
test("checkout PENDING Payment yaratadi (tenant kontekstida, tenantId avtomatik)", async () => {
  const result = await runWithTenant(t.tenant.id, () => manualProvider.initiateCheckout({ planCode: "STANDARD" }));
  assert.ok(result.paymentId);
  assert.ok(result.korsatma?.includes("199"));

  const payment = await rawPrisma.payment.findUnique({ where: { id: result.paymentId } });
  assert.equal(payment.tenantId, t.tenant.id);
  assert.equal(payment.status, "PENDING");
});

test("confirmPayment: to'lov tasdiqlanadi, obuna yaratiladi, tenant ACTIVE + 30 kun", async () => {
  const now = new Date();
  const { paymentId } = await runWithTenant(t.tenant.id, () => manualProvider.initiateCheckout({ planCode: "STANDARD" }));
  const { payment, subscription, tenant } = await confirmPayment(paymentId, now);

  assert.equal(payment.status, "CONFIRMED");
  assert.ok(payment.paidAt);
  assert.equal(subscription.status, "ACTIVE");
  assert.equal(tenant.status, "ACTIVE");
  const kunlar = (tenant.currentPeriodEnd.getTime() - now.getTime()) / KUN_MS;
  assert.ok(kunlar >= 29.9 && kunlar <= 30.1, `30 kun kutilgan edi: ${kunlar}`);

  // Endi access FULL bo'lishi kerak.
  assert.equal(computeAccess(tenant, now).mode, "FULL");
});

test("qayta to'lov davr OXIRIDAN uzayadi (kunlar yo'qolmaydi)", async () => {
  const now = new Date();
  const before = await rawPrisma.tenant.findUnique({ where: { id: t.tenant.id } });
  const { paymentId } = await runWithTenant(t.tenant.id, () => manualProvider.initiateCheckout({ planCode: "STANDARD" }));
  const { tenant } = await confirmPayment(paymentId, now);
  const diff = (tenant.currentPeriodEnd.getTime() - before.currentPeriodEnd.getTime()) / KUN_MS;
  assert.ok(diff >= 29.9 && diff <= 30.1, `oldingi muddat ustiga 30 kun: ${diff}`);
});

test("bir to'lovni ikki marta tasdiqlab bo'lmaydi", async () => {
  const { paymentId } = await runWithTenant(t.tenant.id, () => manualProvider.initiateCheckout({ planCode: "STANDARD" }));
  await confirmPayment(paymentId);
  await assert.rejects(async () => confirmPayment(paymentId), /allaqachon tasdiqlangan/);
});

test("rejectPayment faqat PENDING to'lovni rad etadi", async () => {
  const { paymentId } = await runWithTenant(t.tenant.id, () => manualProvider.initiateCheckout({ planCode: "STANDARD" }));
  const rejected = await rejectPayment(paymentId, "pul kelmadi");
  assert.equal(rejected.status, "REJECTED");
  await assert.rejects(async () => rejectPayment(paymentId), /Faqat kutilayotgan/);
});

test("extendTenant: SUPERADMIN muddatni to'lovsiz uzaytiradi va tenant qayta ishlaydi", async () => {
  // Muddatni o'tgan sanaga qo'yamiz — bloklanadi.
  await rawPrisma.tenant.update({
    where: { id: t.tenant.id },
    data: { status: "TRIAL", trialEndsAt: new Date(Date.now() - KUN_MS), currentPeriodEnd: null },
  });
  let tenant = await rawPrisma.tenant.findUnique({ where: { id: t.tenant.id } });
  assert.equal(computeAccess(tenant).mode, "BILLING_ONLY");

  // SUPERADMIN uzaytiradi — yana FULL.
  tenant = await extendTenant(t.tenant.id, 7);
  assert.equal(tenant.status, "ACTIVE");
  assert.equal(computeAccess(tenant).mode, "FULL");
});

// ---------- Cron: statuslarni yangilash ----------
test("updateExpiredStatuses: davri tugagan ACTIVE -> PAST_DUE (cron)", async () => {
  const now = new Date();
  const expired = await createTenantWithOwner({
    kompaniyaNomi: "Muddati O'tgan",
    ism: "X",
    login: "+998900000099",
    parol: "parol12345",
  });
  await rawPrisma.tenant.update({
    where: { id: expired.tenant.id },
    data: { status: "ACTIVE", currentPeriodEnd: new Date(now.getTime() - KUN_MS) },
  });

  const count = await updateExpiredStatuses(now);
  assert.ok(count >= 1);

  const after = await rawPrisma.tenant.findUnique({ where: { id: expired.tenant.id } });
  assert.equal(after.status, "PAST_DUE");

  // Faol tenantga tegilmaydi (t.tenant hozircha kelajak muddatli ACTIVE).
  const active = await rawPrisma.tenant.findUnique({ where: { id: t.tenant.id } });
  assert.equal(active.status, "ACTIVE");
});

// ---------- Izolyatsiya: to'lovlar ham tenant bo'yicha ----------
test("Payment/Subscription boshqa tenantga ko'rinmaydi", async () => {
  const other = await createTenantWithOwner({
    kompaniyaNomi: "Boshqa Kompaniya",
    ism: "X",
    login: "+998900000088",
    parol: "parol12345",
  });
  const payments = await runWithTenant(other.tenant.id, () => prisma.payment.findMany());
  const subs = await runWithTenant(other.tenant.id, () => prisma.subscription.findMany());
  assert.equal(payments.length, 0);
  assert.equal(subs.length, 0);
});

// ---------- Obuna eslatmalari (3 kun / 1 kun / tugadi / kechikdi) ----------

test("eslatmaNuqtasi: to'rtta nuqta to'g'ri aniqlanadi", async () => {
  const { eslatmaNuqtasi } = await import("@/lib/billing/notify");
  assert.equal(eslatmaNuqtasi(10), null, "hali erta");
  assert.equal(eslatmaNuqtasi(3), "3kun");
  assert.equal(eslatmaNuqtasi(2), "3kun", "cron bir kun ishlamasa ham o'tkazib yubormaydi");
  assert.equal(eslatmaNuqtasi(1), "1kun");
  assert.equal(eslatmaNuqtasi(0), "tugadi");
  assert.equal(eslatmaNuqtasi(-1), "tugadi");
  assert.equal(eslatmaNuqtasi(-3), "kechikdi");
  assert.equal(eslatmaNuqtasi(-30), null, "juda eski — bezovta qilinmaydi");
  assert.equal(eslatmaNuqtasi(null), null);
});

test("eslatma matnida to'lov havolasi va tarif narxi bo'ladi", async () => {
  const { eslatmaMatni } = await import("@/lib/billing/notify");
  const matn = eslatmaMatni("1kun", {
    tenantNomi: "RedFlora",
    trial: true,
    kunQoldi: 1,
    narx: 199_000,
    havola: "https://balansa.uz/billing",
  });
  assert.match(matn, /RedFlora/);
  assert.match(matn, /ERTAGA/);
  assert.match(matn, /https:\/\/balansa\.uz\/billing/);
  assert.match(matn, /199 000/);
});

test("sendExpiryWarnings: Telegram ulanmagan mijoz ro'yxatga tushadi, xabar yuborilmaydi", async () => {
  const { sendExpiryWarnings } = await import("@/lib/billing/notify");

  const trial = await createTenantWithOwner({
    kompaniyaNomi: "Sinov Tugayapti",
    ism: "Egasi",
    login: "+998900000091",
    parol: "parol12345",
  });
  const now = new Date();
  // Sinov muddati ertaga tugaydi.
  await rawPrisma.tenant.update({
    where: { id: trial.tenant.id },
    data: { status: "TRIAL", trialEndsAt: new Date(now.getTime() + KUN_MS) },
  });

  const yuborilgan: { chatId: string; text: string }[] = [];
  const fakeBot: any = {
    api: {
      sendMessage: async (chatId: string, text: string) => {
        yuborilgan.push({ chatId, text });
      },
    },
  };

  const r1 = await sendExpiryWarnings(fakeBot, now);
  assert.equal(yuborilgan.length, 0, "Telegram ulanmagan — xabar yuborilmaydi");
  assert.ok(r1.telegramsiz.includes("Sinov Tugayapti"), "qo'ng'iroq qilinadiganlar ro'yxatida bo'lishi kerak");

  // Endi direktor Telegramni ulaydi.
  await rawPrisma.user.update({
    where: { id: trial.user.id },
    data: { telegramChatId: "555000111" },
  });

  const r2 = await sendExpiryWarnings(fakeBot, now);
  assert.equal(r2.yuborilgan, 1);
  assert.match(yuborilgan[0].text, /ERTAGA/);
  assert.match(yuborilgan[0].text, /billing/);

  // Takroriy chaqiruv — shu nuqta ikkinchi marta yuborilmaydi.
  const r3 = await sendExpiryWarnings(fakeBot, now);
  assert.equal(r3.yuborilgan, 0, "bir nuqta bir marta yuboriladi");

  // Muddat tugadi — bu boshqa nuqta, yangi xabar ketadi.
  const keyin = new Date(now.getTime() + KUN_MS + 60_000);
  const r4 = await sendExpiryWarnings(fakeBot, keyin);
  assert.equal(r4.yuborilgan, 1, "'tugadi' nuqtasi alohida yuboriladi");
  assert.match(yuborilgan[yuborilgan.length - 1].text, /tugadi/i);
});

test("bloklangan tenantga eslatma yuborilmaydi", async () => {
  const { sendExpiryWarnings } = await import("@/lib/billing/notify");
  const bloklangan = await createTenantWithOwner({
    kompaniyaNomi: "Bloklangan Mijoz",
    ism: "Egasi",
    login: "+998900000092",
    parol: "parol12345",
  });
  const now = new Date();
  await rawPrisma.tenant.update({
    where: { id: bloklangan.tenant.id },
    data: { status: "BLOCKED", trialEndsAt: new Date(now.getTime() + KUN_MS) },
  });
  await rawPrisma.user.update({
    where: { id: bloklangan.user.id },
    data: { telegramChatId: "555000222" },
  });

  const yuborilgan: string[] = [];
  const fakeBot: any = {
    api: { sendMessage: async (_c: string, t: string) => void yuborilgan.push(t) },
  };
  await sendExpiryWarnings(fakeBot, now);
  assert.equal(
    yuborilgan.filter((t) => t.includes("Bloklangan Mijoz")).length,
    0
  );
});
