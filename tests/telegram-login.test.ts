/**
 * TELEGRAM ORQALI KIRISH — xizmat va bot qatlami.
 *
 *   npm run test:telegram-login
 *
 * Alohida baza: prisma/test-telegram-login.db. Bot soxta `ctx` bilan
 * chaqiriladi (Telegram'ga so'rov ketmaydi).
 */
process.env.DATABASE_URL = "file:./prisma/test-telegram-login.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

type Svc = typeof import("@/lib/auth/telegramLogin");
type Flow = typeof import("@/bot/loginFlow");
let rawPrisma: typeof import("@/lib/db/rawPrisma").rawPrisma;
let svc: Svc;
let flow: Flow;

const T = "t_tgl";
const CHAT = "5550001";
const BEGONA_CHAT = "5550002";

before(async () => {
  rmSync("prisma/test-telegram-login.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);
  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  svc = await import("@/lib/auth/telegramLogin");
  flow = await import("@/bot/loginFlow");

  await rawPrisma.tenant.create({ data: { id: T, name: "Tg", slug: "tg", status: "ACTIVE" } });
  await rawPrisma.user.create({
    data: { id: "u_tg", ism: "Aziz", login: "aziz", parolHash: "x", rol: "OWNER", tenantId: T, telegramChatId: CHAT },
  });
  await rawPrisma.user.create({
    data: { id: "u_off", ism: "Nofaol", login: "nofaol", parolHash: "x", rol: "CASHIER", tenantId: T, telegramChatId: "5550009", isActive: false },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

const yangi = () => svc.boshlash({ ip: "203.0.113.5", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130.0 Safari/537.36" });

/** Soxta grammy konteksti: javoblarni yig'adi. */
function ctx(p: { chatId: string; tur?: string; data?: string }) {
  const javoblar: { text: string; markup?: unknown }[] = [];
  const c = {
    chat: { id: Number(p.chatId), type: p.tur ?? "private" },
    callbackQuery: p.data ? { data: p.data } : undefined,
    reply: async (text: string, o?: { reply_markup?: unknown }) => {
      javoblar.push({ text, markup: o?.reply_markup });
    },
    editMessageText: async (text: string) => {
      javoblar.push({ text });
    },
    answerCallbackQuery: async () => {},
  };
  return { c: c as never, javoblar };
}

/** Bot xabaridagi inline tugmalardan callback_data larni oladi. */
function tugmalar(markup: unknown): string[] {
  const m = markup as { inline_keyboard: { callback_data: string }[][] };
  return m.inline_keyboard.flat().map((b) => b.callback_data);
}

// ---------- To'liq oqim ----------

test("to'liq oqim: boshlash → bot → tasdiq → brauzer akkauntni oladi (bir marta)", async () => {
  const { token, nonce } = await yangi();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(`login_${token}`.length <= 64, "Telegram start payload chegarasi");

  assert.equal((await svc.holat(token, nonce)).holat, "kutilmoqda");

  const s = ctx({ chatId: CHAT });
  await flow.handleLoginStart(s.c, `login_${token}`);
  const xabar = s.javoblar[0];
  assert.match(xabar.text, /Aziz/);
  assert.match(xabar.text, /Chrome · macOS/, "qurilma ko'rsatiladi");
  assert.match(xabar.text, /203\.0\.113\.5/, "IP ko'rsatiladi");
  const [ha, yoq] = tugmalar(xabar.markup);
  assert.match(ha, /^tgl:ok:[0-9a-f]{40}$/);
  assert.ok(ha.length <= 64 && yoq.length <= 64, "callback_data 64 bayt chegarasi");

  const cb = ctx({ chatId: CHAT, data: ha });
  await flow.handleLoginCallback(cb.c);
  assert.match(cb.javoblar[0].text, /tasdiqlandi/);

  const n = await svc.holat(token, nonce);
  assert.equal(n.holat, "tasdiqlandi");
  assert.equal(n.user?.id, "u_tg");
  assert.equal((await svc.holat(token, nonce)).holat, "eskirgan", "ikkinchi marta olib bo'lmaydi");
});

// ---------- Xavfsizlik ----------

test("boshqa brauzer (nonce'siz yoki boshqa nonce) tasdiqlangan so'rovni ololmaydi", async () => {
  const { token, nonce } = await yangi();
  const s = ctx({ chatId: CHAT });
  await flow.handleLoginStart(s.c, `login_${token}`);
  const [ha] = tugmalar(s.javoblar[0].markup);
  await flow.handleLoginCallback(ctx({ chatId: CHAT, data: ha }).c);

  assert.equal((await svc.holat(token, null)).holat, "eskirgan");
  assert.equal((await svc.holat(token, "begona-nonce-qiymati")).holat, "eskirgan");
  assert.equal((await svc.holat(token, nonce)).user?.id, "u_tg", "egasi baribir oladi");
});

test("tasdiqni faqat so'rovni ochgan chat bera oladi", async () => {
  const { token, nonce } = await yangi();
  const s = ctx({ chatId: CHAT });
  await flow.handleLoginStart(s.c, `login_${token}`);
  const [ha] = tugmalar(s.javoblar[0].markup);

  const begona = ctx({ chatId: BEGONA_CHAT, data: ha });
  await flow.handleLoginCallback(begona.c);
  assert.match(begona.javoblar[0].text, /eskirgan/);
  assert.equal((await svc.holat(token, nonce)).holat, "kutilmoqda");
});

test("rad etilsa brauzer 'rad' oladi va keyin tasdiqlab bo'lmaydi", async () => {
  const { token, nonce } = await yangi();
  const s = ctx({ chatId: CHAT });
  await flow.handleLoginStart(s.c, `login_${token}`);
  const [ha, yoq] = tugmalar(s.javoblar[0].markup);
  await flow.handleLoginCallback(ctx({ chatId: CHAT, data: yoq }).c);
  assert.equal((await svc.holat(token, nonce)).holat, "rad");
  const keyin = ctx({ chatId: CHAT, data: ha });
  await flow.handleLoginCallback(keyin.c);
  assert.match(keyin.javoblar[0].text, /eskirgan/);
});

test("bog'lanmagan Telegram: yo'riqnoma va brauzerga 'boglanmagan'", async () => {
  const { token, nonce } = await yangi();
  const s = ctx({ chatId: BEGONA_CHAT });
  await flow.handleLoginStart(s.c, `login_${token}`);
  assert.match(s.javoblar[0].text, /bog'lanmagan/);
  assert.equal(s.javoblar[0].markup, undefined, "tasdiq tugmasi yo'q");
  assert.equal((await svc.holat(token, nonce)).holat, "boglanmagan");
});

test("nofaol akkaunt kira olmaydi", async () => {
  const { token, nonce } = await yangi();
  const s = ctx({ chatId: "5550009" });
  await flow.handleLoginStart(s.c, `login_${token}`);
  assert.equal((await svc.holat(token, nonce)).holat, "boglanmagan");
});

test("tasdiqdan keyin akkaunt o'chirilsa sessiya berilmaydi", async () => {
  await rawPrisma.user.create({
    data: { id: "u_tmp", ism: "Vaqtinchalik", login: "tmp", parolHash: "x", rol: "OWNER", tenantId: T, telegramChatId: "5550010" },
  });
  const { token, nonce } = await yangi();
  const s = ctx({ chatId: "5550010" });
  await flow.handleLoginStart(s.c, `login_${token}`);
  const [ha] = tugmalar(s.javoblar[0].markup);
  await flow.handleLoginCallback(ctx({ chatId: "5550010", data: ha }).c);
  await rawPrisma.user.update({ where: { id: "u_tmp" }, data: { isActive: false } });
  assert.equal((await svc.holat(token, nonce)).holat, "eskirgan");
});

test("guruh chatida tasdiq so'ralmaydi", async () => {
  const { token, nonce } = await yangi();
  const s = ctx({ chatId: CHAT, tur: "group" });
  await flow.handleLoginStart(s.c, `login_${token}`);
  assert.match(s.javoblar[0].text, /shaxsiy chat/);
  assert.equal((await svc.holat(token, nonce)).holat, "kutilmoqda");
});

test("yaroqsiz yoki eskirgan havola — aniq javob", async () => {
  const s = ctx({ chatId: CHAT });
  await flow.handleLoginStart(s.c, "login_buzilgan");
  assert.match(s.javoblar[0].text, /eskirgan/);
  assert.equal(flow.kirishSorovimi("login_x"), true);
  assert.equal(flow.kirishSorovimi(""), false);
  assert.equal(flow.kirishSorovimi("boshqa"), false);
});

test("muddati o'tgan so'rov eskirgan; yangi so'rovda eskilari tozalanadi", async () => {
  const { token, nonce } = await yangi();
  const kalitlar = await rawPrisma.appSetting.findMany({ where: { key: { startsWith: "tglogin:" } } });
  // Hammasini o'tmishga suramiz.
  for (const k of kalitlar) {
    const v = JSON.parse(k.value);
    await rawPrisma.appSetting.update({ where: { key: k.key }, data: { value: JSON.stringify({ ...v, exp: Date.now() - 1 }) } });
  }
  assert.equal((await svc.holat(token, nonce)).holat, "eskirgan");
  await yangi();
  const qoldi = await rawPrisma.appSetting.count({ where: { key: { startsWith: "tglogin:" } } });
  assert.equal(qoldi, 1, "faqat yangi so'rov qoladi");
});

test("bekor qilingan so'rovni botda tasdiqlab bo'lmaydi", async () => {
  const { token, nonce } = await yangi();
  await svc.bekorQilish(token, nonce);
  const s = ctx({ chatId: CHAT });
  await flow.handleLoginStart(s.c, `login_${token}`);
  assert.match(s.javoblar[0].text, /eskirgan/);
});

test("bazada token va nonce XOM saqlanmaydi (faqat xesh)", async () => {
  const { token, nonce } = await yangi();
  const hammasi = await rawPrisma.appSetting.findMany({ where: { key: { startsWith: "tglogin:" } } });
  const matn = JSON.stringify(hammasi);
  assert.ok(!matn.includes(token), "token bazada yo'q");
  assert.ok(!matn.includes(nonce), "nonce bazada yo'q");
});

test("brauzerNomi: qisqa o'qiladigan nom", () => {
  assert.equal(svc.brauzerNomi("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36"), "Chrome · Android");
  assert.equal(svc.brauzerNomi("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari/604.1"), "Safari · iOS");
  assert.equal(svc.brauzerNomi(null), null);
});

test("route'lar rawPrisma ishlatmaydi (tenant izolyatsiya qoidasi)", () => {
  for (const f of ["boshlash", "holat", "bekor"]) {
    const src = readFileSync(`src/app/api/auth/telegram/${f}/route.ts`, "utf8");
    assert.doesNotMatch(src, /rawPrisma/, f);
  }
  assert.doesNotMatch(readFileSync("src/app/api/auth/login/route.ts", "utf8"), /rawPrisma/);
});
