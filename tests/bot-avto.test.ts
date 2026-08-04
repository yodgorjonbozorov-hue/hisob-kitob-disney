/**
 * TELEGRAM AVTO BUYRUQLARI TESTLARI.
 * "xarajat: Cobalt, ta'mirlash 2 mln" tez buyrug'i, /mashina va /xarajat
 * bosqichli oqimlari, summa matnini o'qish.
 * Ishga tushirish: npm run test:bot-avto
 */
process.env.DATABASE_URL = "file:./prisma/test-bot-avto.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let inventory: any;
let queries: any;
let avtoFlow: any;
let format: any;

let tA: any;

/** Telegram Context o'rniga — faqat handler ishlatadigan maydonlar. */
function fakeCtx(chatId: string, text?: string) {
  const replies: string[] = [];
  return {
    chat: { id: chatId },
    message: text === undefined ? undefined : { text },
    reply: async (t: string) => {
      replies.push(t);
      return {} as never;
    },
    replies,
  } as any;
}

before(async () => {
  rmSync("prisma/test-bot-avto.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  inventory = await import("@/lib/services/inventory");
  queries = await import("@/lib/queries/inventory");
  avtoFlow = await import("@/bot/avtoFlow");
  format = await import("@/lib/format");

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Bot Avto",
    ism: "Bot Egasi",
    login: "+998955555601",
    parol: "parol12345",
    biznesTuri: "avto",
    plan: "AVTO",
  });

  await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Cobalt",
      olinganNarx: 130_000_000,
      sotuvNarx: 148_000_000,
      avtoRaqam: "01B777CC",
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Summa matni ----------

test("parseSummaText: odam yozgan summani tushunadi", () => {
  assert.equal(format.parseSummaText("2 mln"), 2_000_000);
  assert.equal(format.parseSummaText("2.5 mln"), 2_500_000);
  assert.equal(format.parseSummaText("2,5 mln"), 2_500_000);
  assert.equal(format.parseSummaText("500 ming"), 500_000);
  assert.equal(format.parseSummaText("120 million"), 120_000_000);
  assert.equal(format.parseSummaText("2 500 000"), 2_500_000);
  assert.equal(format.parseSummaText("3000000"), 3_000_000);
  assert.equal(format.parseSummaText("salom"), 0);
});

// ---------- Tez buyruq ----------

test("«xarajat: Cobalt, ta'mirlash 2 mln» — xarajat o'sha mashinaga yoziladi", async () => {
  const ctx = fakeCtx("777", "xarajat: Cobalt, ta'mirlash 2 mln");
  const handled = await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(ctx, tA.user));
  assert.equal(handled, true);

  const mashina = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Cobalt" } })
  );
  const xarajatlar = await runWithTenant(tA.tenant.id, () =>
    queries.listProductExpenses(tA.business.id, mashina.id)
  );
  assert.equal(xarajatlar.length, 1);
  assert.equal(xarajatlar[0].turi, "tamirlash");
  assert.equal(xarajatlar[0].summa, 2_000_000);

  // Javobda yangilangan sof foyda ko'rinadi: 148 − 130 − 2 = 16 mln.
  assert.match(ctx.replies.join("\n"), /16 000 000|16\s?000\s?000/);
});

test("davlat raqami bo'yicha ham topadi, turi yozilmasa «boshqa» bo'ladi", async () => {
  const ctx = fakeCtx("777", "xarajat: 01B777CC, 500 ming");
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(ctx, tA.user));

  const mashina = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Cobalt" } })
  );
  const xarajatlar = await runWithTenant(tA.tenant.id, () =>
    queries.listProductExpenses(tA.business.id, mashina.id)
  );
  assert.equal(xarajatlar.length, 2);
  assert.equal(xarajatlar[0].turi, "boshqa");
  assert.equal(xarajatlar[0].summa, 500_000);
});

test("topilmagan mashina uchun tushunarli javob beriladi", async () => {
  const ctx = fakeCtx("777", "xarajat: Malibu, ta'mirlash 1 mln");
  const handled = await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(ctx, tA.user));
  assert.equal(handled, true);
  assert.match(ctx.replies[0], /topilmadi/i);
});

test("summasiz xabar xarajat yozmaydi", async () => {
  const ctx = fakeCtx("777", "xarajat: Cobalt, ta'mirlash");
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(ctx, tA.user));
  assert.match(ctx.replies[0], /summa/i);

  const mashina = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Cobalt" } })
  );
  const xarajatlar = await runWithTenant(tA.tenant.id, () =>
    queries.listProductExpenses(tA.business.id, mashina.id)
  );
  assert.equal(xarajatlar.length, 2, "yangi xarajat qo'shilmasligi kerak");
});

test("avto oqimi bo'lmaganda oddiy matnga aralashmaydi", async () => {
  const ctx = fakeCtx("778", "shunchaki xabar");
  const handled = await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(ctx, tA.user));
  assert.equal(handled, false, "kirim/chiqim oqimiga xalaqit bermasligi kerak");
});

// ---------- Bosqichli /mashina oqimi ----------

test("/mashina oqimi: model → narx → sotuv → naqd, avtoparkka tushadi", async () => {
  const chatId = "779";
  await runWithTenant(tA.tenant.id, () => avtoFlow.startMashinaFlow(fakeCtx(chatId), tA.user));

  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(fakeCtx(chatId, "Gentra"), tA.user));
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(fakeCtx(chatId, "150 mln"), tA.user));
  const sotuvCtx = fakeCtx(chatId, "170 mln");
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(sotuvCtx, tA.user));
  assert.match(sotuvCtx.replies.join("\n"), /qanday olindi/i);

  // "Naqdga" tugmasi bosilgani — callback o'rniga to'g'ridan-to'g'ri handler.
  const cbCtx: any = fakeCtx(chatId);
  cbCtx.callbackQuery = { data: "mtol:naqd" };
  cbCtx.answerCallbackQuery = async () => {};
  cbCtx.editMessageText = async () => {};
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleMashinaTolovCallback(cbCtx, tA.user));

  const gentra = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Gentra" } })
  );
  assert.ok(gentra, "mashina yaratilmadi");
  assert.equal(gentra.kelganNarx, 150_000_000);
  assert.equal(gentra.sotuvNarx, 170_000_000);
  assert.equal(gentra.miqdor, 1);

  // Naqd olinganda chiqim tranzaksiya yozilishi kerak.
  const txn = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.findFirst({
      where: { businessId: tA.business.id, summa: 150_000_000, turi: "chiqim" },
    })
  );
  assert.ok(txn, "mashina xaridi chiqimga tushmadi");
});

test("/mashina oqimi: noto'g'ri narx qabul qilinmaydi", async () => {
  const chatId = "780";
  await runWithTenant(tA.tenant.id, () => avtoFlow.startMashinaFlow(fakeCtx(chatId), tA.user));
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(fakeCtx(chatId, "Damas"), tA.user));

  const xatoCtx = fakeCtx(chatId, "qimmat");
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(xatoCtx, tA.user));
  assert.match(xatoCtx.replies[0], /narxni to'g'ri/i);

  avtoFlow.clearAvtoFlow(chatId);
});

// ---------- Bosqichli /xarajat oqimi ----------

test("/xarajat oqimi: mashina → turi → summa", async () => {
  const chatId = "781";
  const boshCtx = fakeCtx(chatId);
  await runWithTenant(tA.tenant.id, () => avtoFlow.startXarajatFlow(boshCtx, tA.user));
  assert.match(boshCtx.replies[0], /qaysi mashinaga/i);

  const gentra = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Gentra" } })
  );

  const mashinaCtx: any = fakeCtx(chatId);
  mashinaCtx.callbackQuery = { data: `axm:${gentra.id}` };
  mashinaCtx.answerCallbackQuery = async () => {};
  mashinaCtx.editMessageText = async () => {};
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleXarajatMashinaCallback(mashinaCtx));

  const turiCtx: any = fakeCtx(chatId);
  turiCtx.callbackQuery = { data: "axt:boyoq" };
  turiCtx.answerCallbackQuery = async () => {};
  turiCtx.editMessageText = async () => {};
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleXarajatTuriCallback(turiCtx));

  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(fakeCtx(chatId, "3 mln"), tA.user));

  const xarajatlar = await runWithTenant(tA.tenant.id, () =>
    queries.listProductExpenses(tA.business.id, gentra.id)
  );
  assert.equal(xarajatlar.length, 1);
  assert.equal(xarajatlar[0].turi, "boyoq");
  assert.equal(xarajatlar[0].summa, 3_000_000);
});

test("bot orqali kiritilgan xarajat sof foydaga ta'sir qiladi", async () => {
  const gentra = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Gentra" } })
  );
  await runWithTenant(tA.tenant.id, () =>
    inventory.createSale({
      businessId: tA.business.id,
      productId: gentra.id,
      miqdor: 1,
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );

  const foyda = await runWithTenant(tA.tenant.id, () => queries.getProductProfitability(tA.business.id));
  const g = foyda.find((p: any) => p.nomi === "Gentra");
  assert.equal(g.xarajat, 3_000_000);
  // 170 − 150 − 3 = 17 mln (xarajatsiz 20 mln ko'rinardi).
  assert.equal(g.foyda, 17_000_000);
});

// ---------- /sotish oqimi ----------

test("/sotish: kelishilgan narx bilan sotiladi va sof foyda xarajatlardan keyin", async () => {
  const chatId = "790";
  // Yangi mashina: 100 mln ga olindi, rejada 120 mln.
  const mashina = await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Lacetti",
      olinganNarx: 100_000_000,
      sotuvNarx: 120_000_000,
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );
  await runWithTenant(tA.tenant.id, () =>
    inventory.addProductExpense({
      businessId: tA.business.id,
      productId: mashina.id,
      turi: "tamirlash",
      summa: 4_000_000,
      userId: tA.user.id,
    })
  );

  const boshCtx = fakeCtx(chatId);
  await runWithTenant(tA.tenant.id, () => avtoFlow.startSotishFlow(boshCtx, tA.user));
  assert.match(boshCtx.replies[0], /qaysi mashina sotildi/i);

  const mashinaCtx: any = fakeCtx(chatId);
  mashinaCtx.callbackQuery = { data: `sxm:${mashina.id}` };
  mashinaCtx.answerCallbackQuery = async () => {};
  let korsatilgan = "";
  mashinaCtx.editMessageText = async (t: string) => { korsatilgan = t; };
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleSotishMashinaCallback(mashinaCtx));
  assert.match(korsatilgan, /Xarajatlar/, "tanlashda xarajat ko'rsatilishi kerak");

  // Savdolashib 115 mln ga kelishildi (rejadagi 120 emas).
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(fakeCtx(chatId, "115 mln"), tA.user));

  const tolovCtx: any = fakeCtx(chatId);
  tolovCtx.callbackQuery = { data: "stol:naqd" };
  tolovCtx.answerCallbackQuery = async () => {};
  tolovCtx.editMessageText = async () => {};
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleSotishTolovCallback(tolovCtx, tA.user));

  // Javobda sof foyda: 115 − 100 − 4 = 11 mln.
  assert.match(tolovCtx.replies.join("\n"), /SOF FOYDA/);
  assert.match(tolovCtx.replies.join("\n"), /11 000 000/);

  const foyda = await runWithTenant(tA.tenant.id, () => queries.getProductProfitability(tA.business.id));
  const lacetti = foyda.find((p: any) => p.nomi === "Lacetti");
  assert.equal(lacetti.daromad, 115_000_000, "kelishilgan narx yozilishi kerak");
  assert.equal(lacetti.xarajat, 4_000_000);
  assert.equal(lacetti.foyda, 11_000_000);

  const sotilgan = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findUnique({ where: { id: mashina.id } })
  );
  assert.equal(sotilgan.miqdor, 0, "mashina avtoparkdan chiqishi kerak");
  assert.equal(sotilgan.sotuvNarx, 115_000_000, "kartochkada haqiqiy narx turishi kerak");
});

test("/sotish: qarzga sotilganda xaridor nomi bilan qarzdorlik ochiladi", async () => {
  const chatId = "791";
  const mashina = await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Matiz",
      olinganNarx: 50_000_000,
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );

  await runWithTenant(tA.tenant.id, () => avtoFlow.startSotishFlow(fakeCtx(chatId), tA.user));
  const mashinaCtx: any = fakeCtx(chatId);
  mashinaCtx.callbackQuery = { data: `sxm:${mashina.id}` };
  mashinaCtx.answerCallbackQuery = async () => {};
  mashinaCtx.editMessageText = async () => {};
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleSotishMashinaCallback(mashinaCtx));

  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(fakeCtx(chatId, "58 mln"), tA.user));

  const tolovCtx: any = fakeCtx(chatId);
  tolovCtx.callbackQuery = { data: "stol:qarz" };
  tolovCtx.answerCallbackQuery = async () => {};
  tolovCtx.editMessageText = async () => {};
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleSotishTolovCallback(tolovCtx, tA.user));

  const oxirgi = fakeCtx(chatId, "Sardor aka");
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(oxirgi, tA.user));
  assert.match(oxirgi.replies.join("\n"), /Sardor aka/);

  const qarz = await runWithTenant(tA.tenant.id, () =>
    prisma.debt.findFirst({ where: { businessId: tA.business.id, mijozNomi: "Sardor aka" } })
  );
  assert.equal(qarz.turi, "olinadigan", "xaridor bizga qarzdor");
  assert.equal(qarz.jamiSumma, 58_000_000);
});

test("/sotish: narx noto'g'ri kiritilsa sotuv bo'lmaydi", async () => {
  const chatId = "792";
  const mashina = await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Damas",
      olinganNarx: 80_000_000,
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );
  await runWithTenant(tA.tenant.id, () => avtoFlow.startSotishFlow(fakeCtx(chatId), tA.user));
  const mashinaCtx: any = fakeCtx(chatId);
  mashinaCtx.callbackQuery = { data: `sxm:${mashina.id}` };
  mashinaCtx.answerCallbackQuery = async () => {};
  mashinaCtx.editMessageText = async () => {};
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleSotishMashinaCallback(mashinaCtx));

  const xatoCtx = fakeCtx(chatId, "kelishamiz");
  await runWithTenant(tA.tenant.id, () => avtoFlow.handleAvtoText(xatoCtx, tA.user));
  assert.match(xatoCtx.replies[0], /narxni to'g'ri/i);

  const hali = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findUnique({ where: { id: mashina.id } })
  );
  assert.equal(hali.miqdor, 1, "mashina hali avtoparkda turishi kerak");
  avtoFlow.clearAvtoFlow(chatId);
});
