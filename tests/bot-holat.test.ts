/**
 * BOT SUHBAT HOLATI + SECRET TEKSHIRUVLARI (C-3, C-5, C-6).
 *
 * C-3: holat bazada saqlanadi — production'da webhook serverless bo'lgani uchun
 * har so'rov boshqa instansiyaga tushishi mumkin. Modul qayta yuklansa ham
 * (xotira tozalansa ham) oqim davom etishi kerak.
 * C-5/C-6: secret sozlanmagan bo'lsa tekshiruv o'tmasligi (fail-closed) shart.
 *
 * Ishga tushirish: npm run test:bot-holat
 */
process.env.DATABASE_URL = "file:./prisma/test-bot-holat.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let store: any;
let state: any;
let compare: any;

const CHAT = "555000";

before(async () => {
  rmSync("prisma/test-bot-holat.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  store = await import("@/bot/conversationStore");
  state = await import("@/bot/state");
  compare = await import("@/lib/security/compare");
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- C-3: holat bazada ----------

test("oqim holati bazaga yoziladi va qayta o'qiladi", async () => {
  await state.setFlow(CHAT, { step: "summa", turi: "kirim", businessId: "b1", categoryId: "c1" });

  const row = await rawPrisma.botConversation.findUnique({ where: { chatId: CHAT } });
  assert.ok(row, "holat bazada bo'lishi kerak");
  assert.equal(row.flow, "transaction");

  const flow = await state.getFlow(CHAT);
  assert.equal(flow.step, "summa");
  assert.equal(flow.turi, "kirim");
  assert.equal(flow.categoryId, "c1");
});

test("boshqa oqim so'ralsa eski holat qaytmaydi (chat bir vaqtda bitta oqimda)", async () => {
  const lead = store.flowStore("lead");
  assert.equal(await lead.get(CHAT), undefined, "transaction holati lead sifatida o'qilmasligi kerak");

  await lead.set(CHAT, { step: "ism" });
  assert.equal(await state.getFlow(CHAT), undefined, "endi transaction holati yo'q");
  assert.equal((await lead.get(CHAT)).step, "ism");
});

test("clearAllFlows chatning holatini butunlay o'chiradi", async () => {
  await store.clearAllFlows(CHAT);
  assert.equal(await rawPrisma.botConversation.findUnique({ where: { chatId: CHAT } }), null);
});

test("tashlab ketilgan suhbatlar 24 soatdan keyin tozalanadi", async () => {
  await state.setFlow("chat_eski", { step: "summa", turi: "kirim" });
  await state.setFlow("chat_yangi", { step: "summa", turi: "chiqim" });

  // Eski yozuvni 30 soat orqaga suramiz (updatedAt @updatedAt bo'lgani uchun raw SQL).
  const eski = new Date(Date.now() - 30 * 60 * 60 * 1000).getTime();
  await rawPrisma.$executeRawUnsafe(
    `UPDATE "BotConversation" SET updatedAt = ? WHERE chatId = 'chat_eski'`,
    eski
  );

  const soni = await store.cleanupOldConversations();
  assert.equal(soni, 1, "faqat eski holat o'chirilishi kerak");
  assert.equal(await state.getFlow("chat_eski"), undefined);
  assert.ok(await state.getFlow("chat_yangi"), "yangi holat qolishi kerak");
});

test("buzilgan JSON oqimni qulflab qo'ymaydi", async () => {
  await rawPrisma.botConversation.create({
    data: { chatId: "chat_buzuq", flow: "transaction", state: "{buzuq" },
  });
  assert.equal(await state.getFlow("chat_buzuq"), undefined);
});

// ---------- C-5 / C-6: fail-closed secretlar ----------

test("bearerTogri: secret sozlanmagan bo'lsa HAR DOIM false", async () => {
  assert.equal(compare.bearerTogri("Bearer undefined", undefined), false);
  assert.equal(compare.bearerTogri("Bearer ", ""), false);
  assert.equal(compare.bearerTogri("Bearer nimadir", undefined), false);
  assert.equal(compare.bearerTogri(null, undefined), false);
});

test("bearerTogri: to'g'ri secret o'tadi, noto'g'risi o'tmaydi", async () => {
  assert.equal(compare.bearerTogri("Bearer s3cr3t", "s3cr3t"), true);
  assert.equal(compare.bearerTogri("Bearer s3cr3T", "s3cr3t"), false);
  assert.equal(compare.bearerTogri("Bearer s3cr3t1", "s3cr3t"), false);
  assert.equal(compare.bearerTogri("s3cr3t", "s3cr3t"), false, "Bearer prefiksi shart");
});

test("secretlarTeng: uzunlik farqi va null xavfsiz ishlanadi", async () => {
  assert.equal(compare.secretlarTeng("abc", "abc"), true);
  assert.equal(compare.secretlarTeng("abc", "abcd"), false);
  assert.equal(compare.secretlarTeng(null, "abc"), false);
  assert.equal(compare.secretlarTeng("abc", undefined), false);
  assert.equal(compare.secretlarTeng("", ""), true);
});

test("Payme auth: noto'g'ri kalit va bo'sh sarlavha rad etiladi", async () => {
  const { paymeAuthOk } = await import("@/lib/billing/payme");
  const basic = (s: string) => `Basic ${Buffer.from(s, "utf8").toString("base64")}`;
  assert.equal(paymeAuthOk(basic("Paycom:kalit"), "kalit"), true);
  assert.equal(paymeAuthOk(basic("Paycom:boshqa"), "kalit"), false);
  assert.equal(paymeAuthOk(basic("Boshqa:kalit"), "kalit"), false);
  assert.equal(paymeAuthOk(null, "kalit"), false);
});
