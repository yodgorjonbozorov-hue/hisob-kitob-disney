import { InlineKeyboard, type Context } from "grammy";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createAvtoMashina,
  addProductExpense,
  createSale,
  XARAJAT_TURLARI,
  type XarajatTuri,
} from "@/lib/services/inventory";
import { formatMoney, parseSummaText } from "@/lib/format";
import { getFlow } from "./state";
import { flowStore } from "./conversationStore";
import { botBizneslar } from "./bizneslar";

/**
 * TELEGRAM AVTO KANALI: olib-sotar ko'p vaqt bozorda/yo'lda bo'ladi — mashina
 * qabul qilish va unga xarajat yozish botdan ham bajariladi.
 *
 * Ikki yo'l:
 *  1) /mashina va /xarajat — bosqichma-bosqich (tugmalar bilan);
 *  2) bir qatorda tez yozish: "xarajat: Cobalt, ta'mirlash 2 mln".
 *
 * Tenant kontekstida chaqiriladi (bot.ts tenantHandler) — prisma so'rovlari
 * avtomatik shu kompaniyaga cheklanadi.
 */

type AvtoStep =
  | "m_business"
  | "m_nomi"
  | "m_olingan"
  | "m_sotuv"
  | "m_tolov"
  | "m_egasi"
  | "x_business"
  | "x_mashina"
  | "x_turi"
  | "x_summa"
  | "s_business"
  | "s_mashina"
  | "s_narx"
  | "s_tolov"
  | "s_xaridor";

interface AvtoFlowState {
  step: AvtoStep;
  businessId?: string;
  // Mashina qabul qilish
  nomi?: string;
  olinganNarx?: number;
  sotuvNarx?: number;
  tolovTuri?: "naqd" | "qarz";
  // Xarajat
  productId?: string;
  productNomi?: string;
  turi?: XarajatTuri;
  // Sotuv
  sotuvSummasi?: number;
}

// Holat bazada saqlanadi (serverless webhook) — batafsil: ./conversationStore.ts
const avtoConversations = flowStore<AvtoFlowState>("avto");

export function clearAvtoFlow(chatId: string): Promise<void> {
  return avtoConversations.delete(chatId);
}

/** Apostrof va registr farqini yo'q qiladi ("Ta'mirlash" ≈ "tamirlash"). */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/['''`ʻʼ]/g, "")
    .trim();
}

/** Matndan xarajat turini topadi ("remont", "pokraska", "moyka" ham tushuniladi). */
function turiniTop(matn: string): XarajatTuri | null {
  const s = normalize(matn);
  if (/tamirla|remont|dvigatel|motor/.test(s)) return "tamirlash";
  if (/boyoq|boya|pokraska|malyar/.test(s)) return "boyoq";
  if (/yuvish|moyka|tozala/.test(s)) return "yuvish";
  if (/rasmiy|mrb|notarius|hujjat/.test(s)) return "rasmiylashtirish";
  if (/ehtiyot|zapchast|qism|detal/.test(s)) return "ehtiyot_qism";
  if (/boshqa/.test(s)) return "boshqa";
  return null;
}

/**
 * Erkin matn ichidan summani ajratadi: "ta'mirlash 2 mln" → 2 000 000,
 * "2 500 000 so'm" → 2 500 000.
 */
function summaniTop(matn: string): number {
  const m = matn.match(/(\d[\d\s.,]*)\s*(mlrd|milliard|mln|million|mil|ming|k)?\b/i);
  if (!m) return 0;
  return parseSummaText(`${m[1].trim()} ${m[2] ?? ""}`.trim());
}

/** Foydalanuvchiga ochiq avto bizneslar (biriktirilgan bo'lsa — faqat o'shalar). */
async function avtoBizneslar(user: User) {
  return botBizneslar(user, { turi: "avto" });
}

/** Avtoparkdagi (sotilmagan) mashinalar. */
async function avtoparkMashinalar(businessId: string) {
  return prisma.product.findMany({
    where: { businessId, isActive: true, miqdor: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

function mashinaBelgi(p: { nomi: string; avtoRaqam: string | null }): string {
  return [p.nomi, p.avtoRaqam].filter(Boolean).join(" · ");
}

/**
 * Biznesni aniqlaydi: bittagina bo'lsa o'zi tanlaydi, ko'p bo'lsa tugma beradi.
 * true qaytsa — biznes tanlandi va oqim davom etadi.
 */
async function bizneslarniSora(
  ctx: Context,
  user: User,
  chatId: string,
  keyingiStep: "m_nomi" | "x_mashina",
  prefiks: "amb" | "axb" | "sxb"
): Promise<string | null> {
  const bizneslar = await avtoBizneslar(user);
  if (bizneslar.length === 0) {
    await ctx.reply("Avto rejimidagi biznes topilmadi. Veb-saytda biznes turini «Avto» qilib belgilang.");
    return null;
  }
  if (bizneslar.length === 1) return bizneslar[0].id;

  await avtoConversations.set(chatId, { step: keyingiStep === "m_nomi" ? "m_business" : "x_business" });
  const keyboard = new InlineKeyboard();
  bizneslar.forEach((b, i) => {
    keyboard.text(b.nomi, `${prefiks}:${b.id}`);
    if (i % 2 === 1) keyboard.row();
  });
  await ctx.reply("Qaysi biznes uchun?", { reply_markup: keyboard });
  return null;
}

// ---------------------------------------------------------------------------
// /mashina — avtoparkka mashina qabul qilish
// ---------------------------------------------------------------------------

export async function startMashinaFlow(ctx: Context, user: User) {
  const chatId = String(ctx.chat!.id);
  const businessId = await bizneslarniSora(ctx, user, chatId, "m_nomi", "amb");
  if (!businessId) return;

  await avtoConversations.set(chatId, { step: "m_nomi", businessId });
  await ctx.reply("Yangi mashina 🚗\nModelni yozing (masalan: Cobalt 2019):");
}

/** amb:<businessId> */
export async function handleMashinaBusinessCallback(ctx: Context) {
  const chatId = String(ctx.chat!.id);
  const businessId = (ctx.callbackQuery?.data ?? "").slice(4);
  const business = await prisma.business.findFirst({
    where: { id: businessId, isActive: true },
    select: { id: true },
  });
  if (!business) {
    await ctx.answerCallbackQuery({ text: "Biznes topilmadi" });
    return;
  }
  await avtoConversations.set(chatId, { step: "m_nomi", businessId: business.id });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Yangi mashina 🚗\nModelni yozing (masalan: Cobalt 2019):");
}

/** mtol:<naqd|qarz> */
export async function handleMashinaTolovCallback(ctx: Context, user: User) {
  const chatId = String(ctx.chat!.id);
  const flow = await avtoConversations.get(chatId);
  const tolovTuri = (ctx.callbackQuery?.data ?? "").slice(5) as "naqd" | "qarz";

  if (!flow || flow.step !== "m_tolov") {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan, /mashina bilan qaytadan boshlang." });
    return;
  }

  if (tolovTuri === "qarz") {
    await avtoConversations.set(chatId, { ...flow, step: "m_egasi", tolovTuri });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Kimdan qarzga olindi? Ism yozing:");
    return;
  }

  await ctx.answerCallbackQuery();
  await mashinaniSaqla(ctx, user, { ...flow, tolovTuri: "naqd" });
}

async function mashinaniSaqla(ctx: Context, user: User, flow: AvtoFlowState, egasiNomi?: string) {
  const chatId = String(ctx.chat!.id);
  const mashina = await createAvtoMashina({
    businessId: flow.businessId!,
    nomi: flow.nomi!,
    olinganNarx: flow.olinganNarx!,
    sotuvNarx: flow.sotuvNarx ?? 0,
    tolovTuri: flow.tolovTuri ?? "naqd",
    egasiNomi: egasiNomi ?? null,
    userId: user.id,
  });
  await clearAvtoFlow(chatId);

  const kutilayotgan = (flow.sotuvNarx ?? 0) > 0 ? flow.sotuvNarx! - flow.olinganNarx! : null;
  await ctx.reply(
    [
      `✅ Avtoparkka qo'shildi: ${mashina!.nomi}`,
      `Olingan narx: ${formatMoney(flow.olinganNarx!)}`,
      (flow.sotuvNarx ?? 0) > 0 ? `Sotuv narxi: ${formatMoney(flow.sotuvNarx!)}` : null,
      kutilayotgan !== null ? `Kutilayotgan foyda: ${formatMoney(kutilayotgan)}` : null,
      flow.tolovTuri === "qarz" ? `Qarz ochildi: ${egasiNomi}` : "Chiqim yozildi (naqd).",
      "",
      "Xarajat qo'shish: /xarajat yoki «xarajat: " + mashina!.nomi + ", ta'mirlash 2 mln»",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

// ---------------------------------------------------------------------------
// /xarajat — mashinaga xarajat yozish
// ---------------------------------------------------------------------------

export async function startXarajatFlow(ctx: Context, user: User) {
  const chatId = String(ctx.chat!.id);
  const businessId = await bizneslarniSora(ctx, user, chatId, "x_mashina", "axb");
  if (!businessId) return;
  await mashinalarniKorsat(ctx, chatId, businessId);
}

async function mashinalarniKorsat(ctx: Context, chatId: string, businessId: string) {
  const mashinalar = await avtoparkMashinalar(businessId);
  if (mashinalar.length === 0) {
    await ctx.reply("Avtoparkda sotuvdagi mashina yo'q. Avval /mashina bilan qo'shing.");
    return;
  }

  await avtoConversations.set(chatId, { step: "x_mashina", businessId });
  const keyboard = new InlineKeyboard();
  mashinalar.forEach((m) => {
    keyboard.text(mashinaBelgi(m), `axm:${m.id}`).row();
  });
  await ctx.reply("Qaysi mashinaga xarajat?", { reply_markup: keyboard });
}

/** axb:<businessId> */
export async function handleXarajatBusinessCallback(ctx: Context) {
  const chatId = String(ctx.chat!.id);
  const businessId = (ctx.callbackQuery?.data ?? "").slice(4);
  const business = await prisma.business.findFirst({
    where: { id: businessId, isActive: true },
    select: { id: true },
  });
  if (!business) {
    await ctx.answerCallbackQuery({ text: "Biznes topilmadi" });
    return;
  }
  await ctx.answerCallbackQuery();
  await mashinalarniKorsat(ctx, chatId, business.id);
}

/** axm:<productId> */
export async function handleXarajatMashinaCallback(ctx: Context) {
  const chatId = String(ctx.chat!.id);
  const productId = (ctx.callbackQuery?.data ?? "").slice(4);
  const flow = await avtoConversations.get(chatId);

  const mashina = await prisma.product.findFirst({ where: { id: productId } });
  if (!mashina) {
    await ctx.answerCallbackQuery({ text: "Mashina topilmadi" });
    return;
  }

  await avtoConversations.set(chatId, {
    ...(flow ?? {}),
    step: "x_turi",
    businessId: mashina.businessId,
    productId: mashina.id,
    productNomi: mashina.nomi,
  });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`${mashinaBelgi(mashina)} — xarajat turi?`, {
    reply_markup: turiKeyboard(),
  });
}

function turiKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  Object.entries(XARAJAT_TURLARI).forEach(([code, nomi], i) => {
    keyboard.text(nomi, `axt:${code}`);
    if (i % 2 === 1) keyboard.row();
  });
  return keyboard;
}

/** axt:<turi> */
export async function handleXarajatTuriCallback(ctx: Context) {
  const chatId = String(ctx.chat!.id);
  const flow = await avtoConversations.get(chatId);
  const turi = (ctx.callbackQuery?.data ?? "").slice(4) as XarajatTuri;

  if (!flow || flow.step !== "x_turi" || !XARAJAT_TURLARI[turi]) {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan, /xarajat bilan qaytadan boshlang." });
    return;
  }

  await avtoConversations.set(chatId, { ...flow, step: "x_summa", turi });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `${flow.productNomi} — ${XARAJAT_TURLARI[turi]}\nSummani yozing (masalan: 2 mln yoki 2000000):`
  );
}

async function xarajatniSaqla(
  ctx: Context,
  user: User,
  params: { businessId: string; productId: string; productNomi: string; turi: XarajatTuri; summa: number }
) {
  await addProductExpense({
    businessId: params.businessId,
    productId: params.productId,
    turi: params.turi,
    summa: params.summa,
    userId: user.id,
  });
  await clearAvtoFlow(String(ctx.chat!.id));

  // Yangilangan sof foyda darhol ko'rinadi — olib-sotar aynan shu raqamni kutadi.
  const [mashina, jami] = await Promise.all([
    prisma.product.findFirst({ where: { id: params.productId } }),
    prisma.productExpense.aggregate({
      where: { businessId: params.businessId, productId: params.productId },
      _sum: { summa: true },
    }),
  ]);
  const xarajatJami = jami._sum.summa ?? 0;
  const sof =
    mashina && mashina.sotuvNarx > 0 ? mashina.sotuvNarx - mashina.kelganNarx - xarajatJami : null;

  await ctx.reply(
    [
      `✅ ${XARAJAT_TURLARI[params.turi]}: ${formatMoney(params.summa)}`,
      `Mashina: ${params.productNomi}`,
      `Shu mashinaga jami xarajat: ${formatMoney(xarajatJami)}`,
      sof !== null ? `Kutilayotgan sof foyda: ${formatMoney(sof)}` : null,
      "Chiqim avtomatik yozildi — qo'lda kiritish shart emas.",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

// ---------------------------------------------------------------------------
// /sotish — mashinani sotish
// ---------------------------------------------------------------------------

export async function startSotishFlow(ctx: Context, user: User) {
  const chatId = String(ctx.chat!.id);
  const businessId = await bizneslarniSora(ctx, user, chatId, "x_mashina", "sxb");
  if (!businessId) return;
  await sotuvMashinalariniKorsat(ctx, chatId, businessId);
}

async function sotuvMashinalariniKorsat(ctx: Context, chatId: string, businessId: string) {
  const mashinalar = await avtoparkMashinalar(businessId);
  if (mashinalar.length === 0) {
    await ctx.reply("Avtoparkda sotuvdagi mashina yo'q.");
    return;
  }

  await avtoConversations.set(chatId, { step: "s_mashina", businessId });
  const keyboard = new InlineKeyboard();
  mashinalar.forEach((m) => {
    keyboard.text(mashinaBelgi(m), `sxm:${m.id}`).row();
  });
  await ctx.reply("Qaysi mashina sotildi?", { reply_markup: keyboard });
}

/** sxb:<businessId> */
export async function handleSotishBusinessCallback(ctx: Context) {
  const chatId = String(ctx.chat!.id);
  const businessId = (ctx.callbackQuery?.data ?? "").slice(4);
  const business = await prisma.business.findFirst({
    where: { id: businessId, isActive: true },
    select: { id: true },
  });
  if (!business) {
    await ctx.answerCallbackQuery({ text: "Biznes topilmadi" });
    return;
  }
  await ctx.answerCallbackQuery();
  await sotuvMashinalariniKorsat(ctx, chatId, business.id);
}

/** sxm:<productId> — mashina tanlandi, narx so'raladi. */
export async function handleSotishMashinaCallback(ctx: Context) {
  const chatId = String(ctx.chat!.id);
  const productId = (ctx.callbackQuery?.data ?? "").slice(4);

  const mashina = await prisma.product.findFirst({ where: { id: productId } });
  if (!mashina) {
    await ctx.answerCallbackQuery({ text: "Mashina topilmadi" });
    return;
  }

  const xarajat = await prisma.productExpense.aggregate({
    where: { businessId: mashina.businessId, productId: mashina.id },
    _sum: { summa: true },
  });
  const xarajatJami = xarajat._sum.summa ?? 0;

  await avtoConversations.set(chatId, {
    step: "s_narx",
    businessId: mashina.businessId,
    productId: mashina.id,
    productNomi: mashina.nomi,
  });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    [
      `${mashinaBelgi(mashina)}`,
      `Olingan narx: ${formatMoney(mashina.kelganNarx)}`,
      xarajatJami > 0 ? `Xarajatlar: ${formatMoney(xarajatJami)}` : null,
      mashina.sotuvNarx > 0 ? `Rejadagi narx: ${formatMoney(mashina.sotuvNarx)}` : null,
      "",
      "Necha pulga sotildi? (masalan: 148 mln)",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

/** stol:<naqd|qarz> */
export async function handleSotishTolovCallback(ctx: Context, user: User) {
  const chatId = String(ctx.chat!.id);
  const flow = await avtoConversations.get(chatId);
  const tolovTuri = (ctx.callbackQuery?.data ?? "").slice(5) as "naqd" | "qarz";

  if (!flow || flow.step !== "s_tolov") {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan, /sotish bilan qaytadan boshlang." });
    return;
  }

  if (tolovTuri === "qarz") {
    await avtoConversations.set(chatId, { ...flow, step: "s_xaridor" });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Xaridor ismi? (qarzdorlik shu nom bilan yuritiladi)");
    return;
  }

  await ctx.answerCallbackQuery();
  await sotuvniSaqla(ctx, user, flow, "naqd");
}

async function sotuvniSaqla(
  ctx: Context,
  user: User,
  flow: AvtoFlowState,
  tolovTuri: "naqd" | "qarz",
  xaridor?: string
) {
  const chatId = String(ctx.chat!.id);
  const mashina = await prisma.product.findFirst({ where: { id: flow.productId! } });
  if (!mashina) {
    await ctx.reply("Mashina topilmadi.");
    await clearAvtoFlow(chatId);
    return;
  }

  await createSale({
    businessId: flow.businessId!,
    productId: flow.productId!,
    miqdor: 1,
    tolovTuri,
    mijozNomi: xaridor ?? null,
    narx: flow.sotuvSummasi,
    userId: user.id,
  });

  const xarajat = await prisma.productExpense.aggregate({
    where: { businessId: flow.businessId!, productId: flow.productId! },
    _sum: { summa: true },
  });
  const xarajatJami = xarajat._sum.summa ?? 0;
  const sof = flow.sotuvSummasi! - mashina.kelganNarx - xarajatJami;

  await clearAvtoFlow(chatId);
  await ctx.reply(
    [
      `✅ Sotildi: ${flow.productNomi}`,
      `Sotilgan narx: ${formatMoney(flow.sotuvSummasi!)}`,
      `Olingan narx: ${formatMoney(mashina.kelganNarx)}`,
      xarajatJami > 0 ? `Xarajatlar: ${formatMoney(xarajatJami)}` : null,
      `${sof >= 0 ? "SOF FOYDA" : "ZARAR"}: ${formatMoney(Math.abs(sof))}`,
      tolovTuri === "qarz" ? `Qarzdorlik ochildi: ${xaridor}` : "Kirim yozildi (naqd).",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

// ---------------------------------------------------------------------------
// Matn qadamlari + bir qatorli tez buyruq
// ---------------------------------------------------------------------------

/**
 * "xarajat: Cobalt, ta'mirlash 2 mln" ko'rinishidagi tez buyruq.
 * Qabul qilinadigan shakllar:
 *   xarajat: <mashina>, <turi> <summa>
 *   xarajat <mashina>, <summa>            (turi = boshqa)
 */
async function tezXarajat(ctx: Context, user: User, matn: string): Promise<boolean> {
  const qism = matn.replace(/^xarajat\s*:?\s*/i, "");
  if (!qism.trim()) {
    await ctx.reply(
      "Shunday yozing: «xarajat: Cobalt, ta'mirlash 2 mln»\nYoki tugmalar bilan: /xarajat"
    );
    return true;
  }

  const [mashinaMatn, ...qolgan] = qism.split(",");
  const tafsilot = qolgan.join(",").trim();
  if (!tafsilot) {
    await ctx.reply("Summa ko'rinmadi. Masalan: «xarajat: Cobalt, ta'mirlash 2 mln»");
    return true;
  }

  const bizneslar = await avtoBizneslar(user);
  if (bizneslar.length === 0) {
    await ctx.reply("Avto rejimidagi biznes topilmadi.");
    return true;
  }

  // Mashinani nomi yoki davlat raqami bo'yicha topamiz (sotuvdagilar orasidan).
  const qidiruv = normalize(mashinaMatn);
  const hammasi = (
    await Promise.all(bizneslar.map((b) => avtoparkMashinalar(b.id)))
  ).flat();
  const topilgan = hammasi.filter(
    (m) => normalize(m.nomi).includes(qidiruv) || normalize(m.avtoRaqam ?? "").includes(qidiruv)
  );

  if (topilgan.length === 0) {
    await ctx.reply(`«${mashinaMatn.trim()}» avtoparkda topilmadi. Ro'yxatdan tanlang: /xarajat`);
    return true;
  }
  if (topilgan.length > 1) {
    const keyboard = new InlineKeyboard();
    topilgan.slice(0, 10).forEach((m) => keyboard.text(mashinaBelgi(m), `axm:${m.id}`).row());
    await ctx.reply("Bir nechta mashina mos keldi — qaysi biri?", { reply_markup: keyboard });
    return true;
  }

  const mashina = topilgan[0];
  const summa = summaniTop(tafsilot);
  if (summa <= 0) {
    await ctx.reply("Summani tushunmadim. Masalan: «xarajat: Cobalt, ta'mirlash 2 mln»");
    return true;
  }

  const turi = turiniTop(tafsilot) ?? "boshqa";
  await xarajatniSaqla(ctx, user, {
    businessId: mashina.businessId,
    productId: mashina.id,
    productNomi: mashina.nomi,
    turi,
    summa,
  });
  return true;
}

/** Matn qadamlari. Avto oqimi (yoki tez buyruq) ishlagan bo'lsa true. */
export async function handleAvtoText(ctx: Context, user: User): Promise<boolean> {
  const chatId = String(ctx.chat!.id);
  const matn = ctx.message?.text?.trim() ?? "";
  const flow = await avtoConversations.get(chatId);

  // Faol kirim/chiqim oqimi bo'lsa aralashmaymiz.
  if (!flow && /^xarajat\b/i.test(matn) && !(await getFlow(chatId))) {
    return tezXarajat(ctx, user, matn);
  }
  if (!flow) return false;

  if (flow.step === "m_nomi") {
    if (!matn) {
      await ctx.reply("Model nomini yozing:");
      return true;
    }
    await avtoConversations.set(chatId, { ...flow, step: "m_olingan", nomi: matn });
    await ctx.reply("Qanchaga olindi? (masalan: 120 mln)");
    return true;
  }

  if (flow.step === "m_olingan") {
    const summa = parseSummaText(matn);
    if (summa <= 0) {
      await ctx.reply("Narxni to'g'ri kiriting (masalan: 120 mln yoki 120000000):");
      return true;
    }
    await avtoConversations.set(chatId, { ...flow, step: "m_sotuv", olinganNarx: summa });
    await ctx.reply("Rejadagi sotuv narxi? (bilmasangiz «-» yozing)");
    return true;
  }

  if (flow.step === "m_sotuv") {
    const sotuv = matn === "-" ? 0 : parseSummaText(matn);
    if (matn !== "-" && sotuv <= 0) {
      await ctx.reply("Sotuv narxini kiriting yoki «-» yozing:");
      return true;
    }
    await avtoConversations.set(chatId, { ...flow, step: "m_tolov", sotuvNarx: sotuv });
    await ctx.reply("Mashina qanday olindi?", {
      reply_markup: new InlineKeyboard().text("Naqdga", "mtol:naqd").text("Qarzga", "mtol:qarz"),
    });
    return true;
  }

  if (flow.step === "m_egasi") {
    if (!matn) {
      await ctx.reply("Kimdan qarzga olindi? Ism yozing:");
      return true;
    }
    await mashinaniSaqla(ctx, user, flow, matn);
    return true;
  }

  if (flow.step === "s_narx") {
    const summa = parseSummaText(matn);
    if (summa <= 0) {
      await ctx.reply("Sotilgan narxni to'g'ri kiriting (masalan: 148 mln):");
      return true;
    }
    await avtoConversations.set(chatId, { ...flow, step: "s_tolov", sotuvSummasi: summa });
    await ctx.reply("To'lov qanday?", {
      reply_markup: new InlineKeyboard().text("Naqd olindi", "stol:naqd").text("Qarzga", "stol:qarz"),
    });
    return true;
  }

  if (flow.step === "s_xaridor") {
    if (!matn) {
      await ctx.reply("Xaridor ismini yozing:");
      return true;
    }
    await sotuvniSaqla(ctx, user, flow, "qarz", matn);
    return true;
  }

  if (flow.step === "x_summa") {
    const summa = parseSummaText(matn);
    if (summa <= 0) {
      await ctx.reply("Summani to'g'ri kiriting (masalan: 2 mln yoki 2000000):");
      return true;
    }
    await xarajatniSaqla(ctx, user, {
      businessId: flow.businessId!,
      productId: flow.productId!,
      productNomi: flow.productNomi!,
      turi: flow.turi!,
      summa,
    });
    return true;
  }

  return false;
}
