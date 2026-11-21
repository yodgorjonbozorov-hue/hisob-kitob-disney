/**
 * TELEGRAM ORQALI KIRISH — xizmat va bot qatlami (kontakt bilan tasdiq).
 *
 *   npm run test:telegram-login
 *
 * Oqim: /start login_<token> → "📱 Raqamni yuborish" → kontakt → akkaunt
 * topiladi → "Ha, kirish" → brauzer sessiyani BIR MARTA oladi.
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
const BIZ = "biz_tgl";

before(async () => {
  rmSync("prisma/test-telegram-login.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);
  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  svc = await import("@/lib/auth/telegramLogin");
  flow = await import("@/bot/loginFlow");

  await rawPrisma.tenant.create({ data: { id: T, name: "Tg", slug: "tg", status: "ACTIVE" } });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "Tg biznes", tenantId: T } });
  const u = (id: string, login: string, extra: Record<string, unknown> = {}) =>
    rawPrisma.user.create({ data: { id, ism: id, login, parolHash: "x", rol: "OWNER", tenantId: T, ...extra } });
  await u("u_tel", "+998901112233"); // telefon login (yangi format)
  await u("u_eski", "902223344"); // telefon login (eski 9 raqam)
  await u("u_kassir", "kassir1", { rol: "CASHIER" }); // harfli login, raqam xodim kartochkasida
  await rawPrisma.employee.create({
    data: { ism: "Kassir", tel: "+998 (93) 444-55-66", userId: "u_kassir", businessId: BIZ } as never,
  });
  await u("u_chat", "boshqaruvchi", { telegramChatId: "7000005" }); // faqat /kod bilan bog'langan
  await u("u_off", "+998905556677", { isActive: false });
  await u("u_dub1", "+998937778899");
  await u("u_dub2", "937778899"); // bitta raqam ikki akkauntda
});

after(async () => {
  await rawPrisma?.$disconnect();
});

const yangi = () =>
  svc.boshlash({ ip: "203.0.113.5", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130.0 Safari/537.36" });

type Javob = { text: string; markup?: unknown };

/** Soxta grammy konteksti: javoblarni yig'adi. */
function ctx(p: { chatId: string; tur?: string; data?: string; contact?: { phone_number: string; user_id?: number }; fromId?: number }) {
  const javoblar: Javob[] = [];
  const c = {
    chat: { id: Number(p.chatId), type: p.tur ?? "private" },
    from: { id: p.fromId ?? Number(p.chatId) },
    message: p.contact ? { contact: p.contact } : undefined,
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

const inlineTugmalar = (markup: unknown) =>
  (markup as { inline_keyboard: { callback_data: string }[][] }).inline_keyboard.flat().map((b) => b.callback_data);

/** Start → kontakt; oxirgi javobni (tasdiq xabari yoki xato) qaytaradi. */
async function startVaKontakt(token: string, chatId: string, telefon: string, contactUserId?: number) {
  await flow.handleLoginStart(ctx({ chatId }).c, `login_${token}`);
  const k = ctx({ chatId, contact: { phone_number: telefon, user_id: contactUserId ?? Number(chatId) } });
  await flow.handleLoginContact(k.c);
  return k.javoblar;
}

// ---------- To'liq oqim ----------

test("Start: request_contact tugmasi beriladi", async () => {
  const { token } = await yangi();
  const s = ctx({ chatId: "7000001" });
  await flow.handleLoginStart(s.c, `login_${token}`);
  const kb = s.javoblar[0].markup as { keyboard: { text: string; request_contact?: boolean }[][]; one_time_keyboard?: boolean };
  assert.equal(kb.keyboard[0][0].request_contact, true, "Telegram standarti: request_contact");
  assert.match(kb.keyboard[0][0].text, /Raqamni yuborish/);
  assert.equal(kb.one_time_keyboard, true);
});

test("to'liq oqim: kontakt → tasdiq → brauzer akkauntni BIR MARTA oladi", async () => {
  const { token, nonce } = await yangi();
  assert.ok(`login_${token}`.length <= 64, "Telegram start payload chegarasi");
  const javoblar = await startVaKontakt(token, "7000001", "998901112233");
  assert.equal((javoblar[0].markup as { remove_keyboard: boolean }).remove_keyboard, true, "klaviatura yopiladi");
  const tasdiq = javoblar[1];
  assert.match(tasdiq.text, /u_tel/);
  assert.match(tasdiq.text, /Chrome · macOS/);
  assert.match(tasdiq.text, /203\.0\.113\.5/);
  const [ha, yoq] = inlineTugmalar(tasdiq.markup);
  assert.ok(ha.length <= 64 && yoq.length <= 64, "callback_data 64 bayt chegarasi");

  assert.equal((await svc.holat(token, nonce)).holat, "kutilmoqda", "tasdiqsiz kirilmaydi");
  const cb = ctx({ chatId: "7000001", data: ha });
  await flow.handleLoginCallback(cb.c);
  assert.match(cb.javoblar[0].text, /tasdiqlandi/);

  const n = await svc.holat(token, nonce);
  assert.equal(n.holat, "tasdiqlandi");
  assert.equal(n.user?.id, "u_tel");
  assert.equal((await svc.holat(token, nonce)).holat, "eskirgan", "ikkinchi marta olib bo'lmaydi");
});

test("tasdiqdan keyin chat akkauntga bog'lanadi (bot funksiyalari ochiladi)", async () => {
  const u = await rawPrisma.user.findUnique({ where: { id: "u_tel" } });
  assert.equal(u?.telegramChatId, "7000001");
});

test("raqam har xil formatda kelsa ham topiladi; eski loginlar ham", async () => {
  for (const [tel, kutilgan] of [["+998902223344", "u_eski"], ["998902223344", "u_eski"]] as const) {
    const { token } = await yangi();
    const j = await startVaKontakt(token, "7000002", tel);
    assert.match(j[1]?.text ?? "", new RegExp(kutilgan), tel);
  }
});

test("harfli login: raqam xodim kartochkasidan (erkin format) topiladi", async () => {
  const { token } = await yangi();
  const j = await startVaKontakt(token, "7000003", "998934445566");
  assert.match(j[1].text, /u_kassir/);
});

test("raqam topilmasa, lekin chat /kod bilan bog'langan bo'lsa — o'sha akkaunt", async () => {
  const { token } = await yangi();
  const j = await startVaKontakt(token, "7000005", "998909990000");
  assert.match(j[1].text, /u_chat/);
});

// ---------- Xavfsizlik ----------

test("BEGONA kontakt (boshqa odamniki) qabul qilinmaydi", async () => {
  const { token, nonce } = await yangi();
  const j = await startVaKontakt(token, "7000006", "998901112233", 123456);
  assert.match(j[0].text, /o'zingizning raqamingizni/);
  assert.equal(j.length, 1, "tasdiq so'ralmaydi");
  assert.equal((await svc.holat(token, nonce)).holat, "kutilmoqda");
  // user_id umuman yo'q kontakt (qo'lda tuzilgan) ham rad etiladi.
  const k = ctx({ chatId: "7000006", contact: { phone_number: "998901112233" } });
  await flow.handleLoginContact(k.c);
  assert.match(k.javoblar[0].text, /o'zingizning raqamingizni/);
});

test("kontaktsiz tasdiq tugmasini soxtalashtirib bo'lmaydi", async () => {
  const { token, nonce } = await yangi();
  await flow.handleLoginStart(ctx({ chatId: "7000007" }).c, `login_${token}`);
  const id = (await rawPrisma.appSetting.findUnique({ where: { key: "tglogin:chat:7000007" } }))!;
  const soxta = ctx({ chatId: "7000007", data: `tgl:ok:${JSON.parse(id.value).id}` });
  await flow.handleLoginCallback(soxta.c);
  assert.match(soxta.javoblar[0].text, /eskirgan/);
  assert.equal((await svc.holat(token, nonce)).holat, "kutilmoqda");
});

test("boshqa brauzer (nonce'siz yoki boshqa nonce) tasdiqlangan so'rovni ololmaydi", async () => {
  const { token, nonce } = await yangi();
  const j = await startVaKontakt(token, "7000002", "998902223344");
  await flow.handleLoginCallback(ctx({ chatId: "7000002", data: inlineTugmalar(j[1].markup)[0] }).c);
  assert.equal((await svc.holat(token, null)).holat, "eskirgan");
  assert.equal((await svc.holat(token, "begona-nonce")).holat, "eskirgan");
  assert.equal((await svc.holat(token, nonce)).user?.id, "u_eski", "egasi baribir oladi");
});

test("tasdiqni faqat so'rovni ochgan chat bera oladi; boshqa chat so'rovni egallay olmaydi", async () => {
  const { token, nonce } = await yangi();
  const j = await startVaKontakt(token, "7000002", "998902223344");
  const [ha] = inlineTugmalar(j[1].markup);
  const begona = ctx({ chatId: "7000099", data: ha });
  await flow.handleLoginCallback(begona.c);
  assert.match(begona.javoblar[0].text, /eskirgan/);
  const ikkinchi = ctx({ chatId: "7000099" });
  await flow.handleLoginStart(ikkinchi.c, `login_${token}`);
  assert.match(ikkinchi.javoblar[0].text, /eskirgan/, "havola boshqa chatda ochilmaydi");
  assert.equal((await svc.holat(token, nonce)).holat, "kutilmoqda");
});

test("rad etilsa brauzer 'rad' oladi va keyin tasdiqlab bo'lmaydi", async () => {
  const { token, nonce } = await yangi();
  const j = await startVaKontakt(token, "7000002", "998902223344");
  const [ha, yoq] = inlineTugmalar(j[1].markup);
  await flow.handleLoginCallback(ctx({ chatId: "7000002", data: yoq }).c);
  assert.equal((await svc.holat(token, nonce)).holat, "rad");
  const keyin = ctx({ chatId: "7000002", data: ha });
  await flow.handleLoginCallback(keyin.c);
  assert.match(keyin.javoblar[0].text, /eskirgan/);
});

test("akkaunt topilmasa: aniq xabar, brauzerga 'boglanmagan'", async () => {
  const { token, nonce } = await yangi();
  const j = await startVaKontakt(token, "7000008", "998911234567");
  assert.match(j[0].text, /akkaunti topilmadi/);
  assert.equal((await svc.holat(token, nonce)).holat, "boglanmagan");
});

test("nofaol akkaunt va bitta raqamli ikki akkaunt — kirish yo'q", async () => {
  for (const tel of ["998905556677", "998937778899"]) {
    const { token, nonce } = await yangi();
    const j = await startVaKontakt(token, "7000009", tel);
    assert.match(j[0].text, /akkaunti topilmadi/, tel);
    assert.equal((await svc.holat(token, nonce)).holat, "boglanmagan", tel);
  }
});

test("tasdiqdan keyin akkaunt o'chirilsa sessiya berilmaydi", async () => {
  await rawPrisma.user.create({
    data: { id: "u_tmp", ism: "u_tmp", login: "+998901010101", parolHash: "x", rol: "OWNER", tenantId: T },
  });
  const { token, nonce } = await yangi();
  const j = await startVaKontakt(token, "7000010", "998901010101");
  await flow.handleLoginCallback(ctx({ chatId: "7000010", data: inlineTugmalar(j[1].markup)[0] }).c);
  await rawPrisma.user.update({ where: { id: "u_tmp" }, data: { isActive: false } });
  assert.equal((await svc.holat(token, nonce)).holat, "eskirgan");
});

test("so'rovsiz kontakt va guruh chati", async () => {
  const k = ctx({ chatId: "7000011", contact: { phone_number: "998901112233", user_id: 7000011 } });
  await flow.handleLoginContact(k.c);
  assert.match(k.javoblar[0].text, /eskirgan/);
  const { token, nonce } = await yangi();
  const g = ctx({ chatId: "7000012", tur: "group" });
  await flow.handleLoginStart(g.c, `login_${token}`);
  assert.match(g.javoblar[0].text, /shaxsiy chat/);
  assert.equal((await svc.holat(token, nonce)).holat, "kutilmoqda");
});

test("yaroqsiz/bekor qilingan havola — aniq javob", async () => {
  const s = ctx({ chatId: "7000001" });
  await flow.handleLoginStart(s.c, "login_buzilgan");
  assert.match(s.javoblar[0].text, /eskirgan/);
  const { token, nonce } = await yangi();
  await svc.bekorQilish(token, nonce);
  const b = ctx({ chatId: "7000001" });
  await flow.handleLoginStart(b.c, `login_${token}`);
  assert.match(b.javoblar[0].text, /eskirgan/);
  assert.equal(flow.kirishSorovimi("login_x"), true);
  assert.equal(flow.kirishSorovimi(""), false);
});

test("muddati o'tgan yozuvlar eskirgan va tozalanadi; bazada token/nonce xom yo'q", async () => {
  const { token, nonce } = await yangi();
  const matn = JSON.stringify(await rawPrisma.appSetting.findMany({ where: { key: { startsWith: "tglogin:" } } }));
  assert.ok(!matn.includes(token) && !matn.includes(nonce), "faqat xesh saqlanadi");
  for (const k of await rawPrisma.appSetting.findMany({ where: { key: { startsWith: "tglogin:" } } })) {
    const v = JSON.parse(k.value);
    await rawPrisma.appSetting.update({ where: { key: k.key }, data: { value: JSON.stringify({ ...v, exp: Date.now() - 1 }) } });
  }
  assert.equal((await svc.holat(token, nonce)).holat, "eskirgan");
  await yangi();
  assert.equal(await rawPrisma.appSetting.count({ where: { key: { startsWith: "tglogin:" } } }), 1);
});

test("kontaktRaqami: Telegram formatlari E.164 ga", async () => {
  const { kontaktRaqami } = await import("@/lib/auth/telefonAkkaunt");
  assert.equal(kontaktRaqami("998901234567"), "+998901234567");
  assert.equal(kontaktRaqami("+998901234567"), "+998901234567");
  assert.equal(kontaktRaqami("79161234567"), "+79161234567", "Telegram har doim davlat kodi bilan yuboradi");
  assert.equal(kontaktRaqami(""), null);
});

test("route'lar rawPrisma ishlatmaydi; kontakt handler tenantHandler'dan oldin", () => {
  for (const f of ["boshlash", "holat", "bekor"]) {
    assert.doesNotMatch(readFileSync(`src/app/api/auth/telegram/${f}/route.ts`, "utf8"), /rawPrisma/, f);
  }
  const bot = readFileSync("src/bot/bot.ts", "utf8");
  assert.ok(bot.indexOf('"message:contact"') < bot.indexOf('"message:text"'));
});
