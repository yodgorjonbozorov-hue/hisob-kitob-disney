import { InlineKeyboard, type Context } from "grammy";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDeal } from "@/lib/crm/service";
import { formatMoney, parseSomInput } from "@/lib/format";

/**
 * TELEGRAM LEAD KANALI (BOS-5): xodim botdan 30 soniyada yangi mijoz + bitim
 * kiritadi. Oqim: /lead -> (biznes) -> mijoz ismi -> telefon -> bitim nomi ->
 * summa -> CRM'ning birinchi bosqichiga tushadi (manba: "telegram").
 * Tenant kontekstida chaqiriladi (bot.ts tenantHandler).
 */

type LeadStep = "business" | "ism" | "tel" | "nomi" | "summa";

interface LeadFlowState {
  step: LeadStep;
  businessId?: string;
  ism?: string;
  tel?: string | null;
  nomi?: string;
}

const leadConversations = new Map<string, LeadFlowState>();

export function getLeadFlow(chatId: string): LeadFlowState | undefined {
  return leadConversations.get(chatId);
}

export function clearLeadFlow(chatId: string): void {
  leadConversations.delete(chatId);
}

/** /lead — oqimni boshlaydi. Kassir biriktirilgan biznesda; boshqalar tanlaydi. */
export async function startLeadFlow(ctx: Context, user: User) {
  const chatId = String(ctx.chat!.id);

  if (user.businessId) {
    leadConversations.set(chatId, { step: "ism", businessId: user.businessId });
    await ctx.reply("Yangi lead 📇\nMijoz ismini yozing:");
    return;
  }

  const businesses = await prisma.business.findMany({
    where: { isActive: true },
    orderBy: { nomi: "asc" },
  });
  if (businesses.length === 0) {
    await ctx.reply("Hali biznes yaratilmagan.");
    return;
  }
  if (businesses.length === 1) {
    leadConversations.set(chatId, { step: "ism", businessId: businesses[0].id });
    await ctx.reply("Yangi lead 📇\nMijoz ismini yozing:");
    return;
  }

  leadConversations.set(chatId, { step: "business" });
  const keyboard = new InlineKeyboard();
  businesses.forEach((b, i) => {
    keyboard.text(b.nomi, `lbiz:${b.id}`);
    if (i % 2 === 1) keyboard.row();
  });
  await ctx.reply("Yangi lead — qaysi biznes uchun?", { reply_markup: keyboard });
}

/** lbiz:<businessId> callback. */
export async function handleLeadBusinessCallback(ctx: Context) {
  const chatId = String(ctx.chat!.id);
  const flow = leadConversations.get(chatId);
  const data = ctx.callbackQuery?.data ?? "";
  const businessId = data.startsWith("lbiz:") ? data.slice(5) : null;

  if (!flow || flow.step !== "business" || !businessId) {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan, /lead bilan qaytadan boshlang." });
    return;
  }

  // Tenant-scoped tekshiruv: begona biznes id o'tmaydi.
  const business = await prisma.business.findFirst({ where: { id: businessId, isActive: true }, select: { id: true } });
  if (!business) {
    await ctx.answerCallbackQuery({ text: "Biznes topilmadi" });
    return;
  }

  leadConversations.set(chatId, { step: "ism", businessId: business.id });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Yangi lead 📇\nMijoz ismini yozing:");
}

/** Matn qadamlari. Lead oqimi faol bo'lsa true qaytaradi (router uchun). */
export async function handleLeadText(ctx: Context, user: User): Promise<boolean> {
  const chatId = String(ctx.chat!.id);
  const flow = leadConversations.get(chatId);
  if (!flow) return false;

  const text = ctx.message?.text?.trim() ?? "";

  if (flow.step === "ism") {
    if (!text) {
      await ctx.reply("Mijoz ismini yozing:");
      return true;
    }
    leadConversations.set(chatId, { ...flow, step: "tel", ism: text });
    await ctx.reply("Telefon raqami (bo'lmasa «-» yozing):");
    return true;
  }

  if (flow.step === "tel") {
    const tel = text === "-" ? null : text;
    leadConversations.set(chatId, { ...flow, step: "nomi", tel });
    await ctx.reply("Bitim nomi (masalan: 50 ta stol buyurtmasi):");
    return true;
  }

  if (flow.step === "nomi") {
    if (!text) {
      await ctx.reply("Bitim nomini yozing:");
      return true;
    }
    leadConversations.set(chatId, { ...flow, step: "summa", nomi: text });
    await ctx.reply("Taxminiy summa (so'm) yoki «-»:");
    return true;
  }

  if (flow.step === "summa") {
    const summa = text === "-" ? 0 : parseSomInput(text);
    if (text !== "-" && summa <= 0) {
      await ctx.reply("Summani to'g'ri kiriting (masalan: 2500000) yoki «-» yozing.");
      return true;
    }

    const deal = await createDeal({
      businessId: flow.businessId!,
      nomi: flow.nomi!,
      summa,
      kontaktIsm: flow.ism,
      kontaktTel: flow.tel,
      manba: "telegram",
      userId: user.id,
    });
    clearLeadFlow(chatId);

    await ctx.reply(
      [
        "✅ Lead saqlandi — CRM'ning «Yangi» bosqichida",
        `Mijoz: ${flow.ism}${flow.tel ? ` (${flow.tel})` : ""}`,
        `Bitim: ${deal.nomi}`,
        summa > 0 ? `Summa: ${formatMoney(summa)}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
    return true;
  }

  return false;
}
