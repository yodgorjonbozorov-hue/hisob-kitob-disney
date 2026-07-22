import { Bot } from "grammy";
import { findUserByChatId, linkByCode } from "./auth";
import {
  startTransactionFlow,
  handleBusinessCallback,
  handleCategoryCallback,
  handleDateCallback,
  handleSkipIzohCallback,
  handleFlowText,
} from "./transactionFlow";
import { startMonthlyReport, handleReportBusinessCallback, sendReportDocument } from "./report";
import { clearFlow } from "./state";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN .env faylida topilmadi.");
}

export const bot = new Bot(token);

function buyruqlarRoyxati(rol: string): string {
  const base = "Buyruqlar:\n/kirim — kirim kiritish\n/chiqim — chiqim kiritish";
  return rol === "admin" ? `${base}\n/hisobot — joriy oy hisoboti` : base;
}

bot.command("start", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const user = await findUserByChatId(chatId);
  if (user) {
    await ctx.reply(`Salom, ${user.ism}! Siz allaqachon tizimga ulangansiz.\n\n${buyruqlarRoyxati(user.rol)}`);
    return;
  }
  await ctx.reply(
    "Assalomu alaykum! Bu Disney Navoiy kirim-chiqim boti.\n\n" +
      "Botdan foydalanish uchun avval veb-saytda tizimga kiring, so'ng \"Telegram bot bilan bog'lash\" tugmasi orqali " +
      "kod oling va bu yerga /kod 123456 ko'rinishida yuboring."
  );
});

bot.command("kod", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const code = ctx.match?.toString().trim();
  if (!code) {
    await ctx.reply("Kodni shunday yozing: /kod 123456");
    return;
  }

  const result = await linkByCode(chatId, code);
  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: "Bunday kod topilmadi. Veb-saytda yangi kod oling.",
      expired: "Kod muddati o'tgan. Veb-saytda yangi kod oling.",
      chat_already_linked: "Bu Telegram hisobi allaqachon boshqa foydalanuvchiga bog'langan.",
    };
    await ctx.reply(messages[result.reason]);
    return;
  }

  await ctx.reply(`✅ Muvaffaqiyatli bog'landingiz, ${result.user.ism}!\n\n${buyruqlarRoyxati(result.user.rol)}`);
});

bot.command("kirim", async (ctx) => {
  const user = await findUserByChatId(String(ctx.chat.id));
  if (!user) {
    await ctx.reply("Avval /kod orqali tizimga ulaning.");
    return;
  }
  await startTransactionFlow(ctx, user, "kirim");
});

bot.command("chiqim", async (ctx) => {
  const user = await findUserByChatId(String(ctx.chat.id));
  if (!user) {
    await ctx.reply("Avval /kod orqali tizimga ulaning.");
    return;
  }
  await startTransactionFlow(ctx, user, "chiqim");
});

bot.command("hisobot", async (ctx) => {
  const user = await findUserByChatId(String(ctx.chat.id));
  if (!user) {
    await ctx.reply("Avval /kod orqali tizimga ulaning.");
    return;
  }
  if (user.rol !== "admin") {
    await ctx.reply("Bu buyruq faqat direktor uchun mavjud.");
    return;
  }
  await startMonthlyReport(ctx);
});

bot.command("bekor", async (ctx) => {
  clearFlow(String(ctx.chat.id));
  await ctx.reply("Amal bekor qilindi.");
});

bot.callbackQuery(/^biz:/, handleBusinessCallback);
bot.callbackQuery(/^cat:/, handleCategoryCallback);
bot.callbackQuery(/^sana:/, handleDateCallback);

bot.callbackQuery(/^rbiz:/, async (ctx) => {
  const user = await findUserByChatId(String(ctx.chat!.id));
  if (!user || user.rol !== "admin") {
    await ctx.answerCallbackQuery({ text: "Bu amal faqat direktor uchun mavjud." });
    return;
  }
  await handleReportBusinessCallback(ctx);
});

bot.callbackQuery(/^izoh:skip$/, async (ctx) => {
  const user = await findUserByChatId(String(ctx.chat!.id));
  if (!user) {
    await ctx.answerCallbackQuery({ text: "Avval /kod orqali tizimga ulaning." });
    return;
  }
  await handleSkipIzohCallback(ctx, user);
});

bot.callbackQuery(/^report:(pdf|excel):([^:]+):(.+)$/, async (ctx) => {
  const user = await findUserByChatId(String(ctx.chat!.id));
  if (!user) {
    await ctx.answerCallbackQuery({ text: "Avval /kod orqali tizimga ulaning." });
    return;
  }
  if (user.rol !== "admin") {
    await ctx.answerCallbackQuery({ text: "Bu amal faqat direktor uchun mavjud." });
    return;
  }
  const match = ctx.callbackQuery.data.match(/^report:(pdf|excel):([^:]+):(.+)$/);
  if (!match) return;
  const [, format, businessId, month] = match;
  await sendReportDocument(ctx, businessId, month, format as "pdf" | "excel");
});

bot.on("message:text", async (ctx) => {
  const user = await findUserByChatId(String(ctx.chat.id));
  if (!user) {
    await ctx.reply("Avval /kod orqali tizimga ulaning.");
    return;
  }
  await handleFlowText(ctx, user);
});

bot.catch((err) => {
  console.error("Bot xatosi:", err);
});
