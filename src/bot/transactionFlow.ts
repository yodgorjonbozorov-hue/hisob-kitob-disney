import { InlineKeyboard, type Context } from "grammy";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatSomLabel, parseSomInput, formatDateUZ } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { createTransaction } from "@/lib/services/transactionService";
import { getFlow, setFlow, clearFlow, type TransactionFlowState } from "./state";

function chatIdOf(ctx: Context): string {
  return String(ctx.chat!.id);
}

/**
 * Tranzaksiya kiritishni boshlaydi.
 * - Kassir (biznesga biriktirilgan): to'g'ridan-to'g'ri kategoriya tanlash.
 * - Admin (biznes null): avval biznes tanlash bosqichi.
 */
export async function startTransactionFlow(ctx: Context, user: User, turi: "kirim" | "chiqim") {
  const chatId = chatIdOf(ctx);

  if (user.businessId) {
    setFlow(chatId, { step: "category", turi, businessId: user.businessId });
    await showCategories(ctx, chatId, turi, user.businessId, false);
    return;
  }

  // Admin — biznes tanlaydi.
  const businesses = await prisma.business.findMany({
    where: { isActive: true },
    orderBy: { nomi: "asc" },
  });
  if (businesses.length === 0) {
    await ctx.reply("Hali biznes yaratilmagan. Veb-saytda biznes qo'shing.");
    return;
  }

  setFlow(chatId, { step: "business", turi });
  const keyboard = new InlineKeyboard();
  businesses.forEach((b, i) => {
    keyboard.text(b.nomi, `biz:${b.id}`);
    if (i % 2 === 1) keyboard.row();
  });
  await ctx.reply(`${turi === "kirim" ? "Kirim" : "Chiqim"} — qaysi biznes uchun?`, {
    reply_markup: keyboard,
  });
}

async function showCategories(
  ctx: Context,
  chatId: string,
  turi: "kirim" | "chiqim",
  businessId: string,
  edit: boolean
) {
  const categories = await prisma.category.findMany({
    where: { businessId, turi, isActive: true },
    orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
  });

  if (categories.length === 0) {
    const msg = "Bu biznesda bu turdagi kategoriyalar hali sozlanmagan. Admin panel orqali qo'shing.";
    clearFlow(chatId);
    if (edit) await ctx.editMessageText(msg);
    else await ctx.reply(msg);
    return;
  }

  const keyboard = new InlineKeyboard();
  categories.forEach((c, i) => {
    keyboard.text(c.nomi, `cat:${c.id}`);
    if (i % 2 === 1) keyboard.row();
  });

  const text = `${turi === "kirim" ? "Kirim" : "Chiqim"} — kategoriyani tanlang:`;
  if (edit) await ctx.editMessageText(text, { reply_markup: keyboard });
  else await ctx.reply(text, { reply_markup: keyboard });
}

export async function handleBusinessCallback(ctx: Context) {
  const chatId = chatIdOf(ctx);
  const flow = getFlow(chatId);
  const data = ctx.callbackQuery?.data ?? "";
  const businessId = data.startsWith("biz:") ? data.slice(4) : null;

  if (!flow || flow.step !== "business" || !businessId) {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan, qaytadan boshlang." });
    return;
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, isActive: true },
    select: { id: true },
  });
  if (!business) {
    await ctx.answerCallbackQuery({ text: "Biznes topilmadi" });
    return;
  }

  setFlow(chatId, { ...flow, step: "category", businessId: business.id });
  await ctx.answerCallbackQuery();
  await showCategories(ctx, chatId, flow.turi, business.id, true);
}

export async function handleCategoryCallback(ctx: Context) {
  const chatId = chatIdOf(ctx);
  const flow = getFlow(chatId);
  const data = ctx.callbackQuery?.data ?? "";
  const categoryId = data.startsWith("cat:") ? data.slice(4) : null;

  if (!flow || flow.step !== "category" || !categoryId || !flow.businessId) {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan, qaytadan boshlang." });
    return;
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.businessId !== flow.businessId) {
    await ctx.answerCallbackQuery({ text: "Kategoriya topilmadi" });
    return;
  }

  setFlow(chatId, { ...flow, step: "summa", categoryId: category.id, categoryNomi: category.nomi });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `Kategoriya: ${category.nomi}\nEndi summani kiriting (masalan: 1250000 yoki 1 250 000):`
  );
}

export async function handleDateCallback(ctx: Context) {
  const chatId = chatIdOf(ctx);
  const flow = getFlow(chatId);
  const data = ctx.callbackQuery?.data ?? "";

  if (!flow || flow.step !== "sana") {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan, qaytadan boshlang." });
    return;
  }

  await ctx.answerCallbackQuery();

  if (data === "sana:bugun") {
    setFlow(chatId, { ...flow, step: "izoh", sana: todayDateOnlyString() });
    await ctx.editMessageText("Izoh yozing (ixtiyoriy) yoki tugmani bosing:", {
      reply_markup: new InlineKeyboard().text("O'tkazib yuborish", "izoh:skip"),
    });
  } else if (data === "sana:custom") {
    setFlow(chatId, { ...flow, step: "sana_custom" });
    await ctx.editMessageText("Sanani KUN.OY.YIL formatida yozing (masalan: 15.06.2026):");
  }
}

export async function handleSkipIzohCallback(ctx: Context, user: User) {
  const chatId = chatIdOf(ctx);
  const flow = getFlow(chatId);
  if (!flow || flow.step !== "izoh") {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan, qaytadan boshlang." });
    return;
  }
  await ctx.answerCallbackQuery();
  await finalizeTransaction(ctx, user, flow, null);
}

/** Matn xabarlarni joriy suhbat holatiga qarab qayta ishlaydi. Agar aktiv flow bo'lmasa false qaytaradi. */
export async function handleFlowText(ctx: Context, user: User): Promise<boolean> {
  const chatId = chatIdOf(ctx);
  const flow = getFlow(chatId);
  if (!flow) return false;

  const text = ctx.message?.text?.trim() ?? "";

  if (flow.step === "summa") {
    const summa = parseSomInput(text);
    if (summa <= 0) {
      await ctx.reply("Summani to'g'ri kiriting (masalan: 1250000).");
      return true;
    }
    setFlow(chatId, { ...flow, step: "sana", summa });
    await ctx.reply(`Summa: ${formatSomLabel(summa)}\nSanani tanlang:`, {
      reply_markup: new InlineKeyboard().text("Bugun", "sana:bugun").text("Boshqa sana", "sana:custom"),
    });
    return true;
  }

  if (flow.step === "sana_custom") {
    const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) {
      await ctx.reply("Format noto'g'ri. Masalan: 15.06.2026 ko'rinishida yozing.");
      return true;
    }
    const [, dd, mm, yyyy] = match;
    const sana = `${yyyy}-${mm}-${dd}`;
    setFlow(chatId, { ...flow, step: "izoh", sana });
    await ctx.reply("Izoh yozing (ixtiyoriy) yoki tugmani bosing:", {
      reply_markup: new InlineKeyboard().text("O'tkazib yuborish", "izoh:skip"),
    });
    return true;
  }

  if (flow.step === "izoh") {
    await finalizeTransaction(ctx, user, flow, text || null);
    return true;
  }

  return false;
}

async function finalizeTransaction(
  ctx: Context,
  user: User,
  flow: TransactionFlowState,
  izoh: string | null
) {
  const chatId = chatIdOf(ctx);
  if (!flow.businessId || !flow.categoryId || !flow.summa || !flow.sana) {
    await ctx.reply("Xatolik yuz berdi, qaytadan /kirim yoki /chiqim buyrug'ini yuboring.");
    clearFlow(chatId);
    return;
  }

  const transaction = await createTransaction(user.id, flow.businessId, {
    turi: flow.turi,
    categoryId: flow.categoryId,
    summa: flow.summa,
    sana: flow.sana,
    izoh,
  });

  clearFlow(chatId);

  await ctx.reply(
    [
      `✅ ${flow.turi === "kirim" ? "Kirim" : "Chiqim"} saqlandi`,
      `Kategoriya: ${transaction.category.nomi}`,
      `Summa: ${formatSomLabel(transaction.summa)}`,
      `Sana: ${formatDateUZ(new Date(transaction.sana))}`,
      izoh ? `Izoh: ${izoh}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  );
}
